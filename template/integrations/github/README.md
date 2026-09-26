# GitHub integration (optional)

Carries the [human-in-the-loop protocol](../../protocol/HUMAN-IN-THE-LOOP.md) and [loop prevention](../../protocol/LOOP-PREVENTION.md) over GitHub pull requests and Actions. Everything here is an **example to copy and adapt**: nothing runs until you copy the workflows into a repository's `.github/workflows/`. The core protocol does not depend on this folder, and nothing here is specific to Claude, Codex, Stitch or any other tool.

```
external change ─► PR event ─► GATE ─► RUN_AGENT ─► agent: analysis, implementation, tests, LOCAL commits
                                                           │
                         PUBLISH (trusted): records the commits, pushes them ─► PR updated ─► CI ─► human review ─► deploy (human)
                                                           │                    │
                                                           │  publish's own push ┴─► CI: runs
                                                           │                     └─► GATE: IGNORE_AUTOMATION_CHANGE (no new agent run)
                                                           └─► Level 2/3 situation ─► question comment + agent:waiting-human ─► run ENDS

   human: "/agent answer Q1 A" or "/agent retry <run-id>" ─► issue_comment ─► agent-resume: gate ─► NEW run, same change ─► ...
```

## Files

| File | Role |
|---|---|
| `workflows/agent-run.yml.example` | `gate` job (classifies every PR event) then `agent` job (only on `RUN_AGENT`); its publish step pushes and records the outcome |
| `workflows/agent-resume.yml.example` | On an `issue_comment` command (`/agent answer`, `/agent retry`): validates it, then runs the agent again in the same change |
| `scripts/agent-gate.js` | Deterministic, dependency-free logic: question parsing, trust, provenance, ledger, decisions, labels |
| `scripts/agent-gate.test.js` | Question, handoff, command and trust unit tests |
| `workflows/design-pr.yml.example` | Builder path only: on a push to the design source branch, opens the design pull request to production if none is open (see below) |
| `workflows/design-back-sync.yml.example` | Builder path only: after a merge into production, brings the design source branch up to it (fast-forward or merge, never force) |
| `scripts/design-branch.js` | Deterministic, dependency-free decisions and API calls for the two design workflows |
| `scripts/design-branch.test.js` | Promotion and back-sync scenarios against an in-memory GitHub |
| `scripts/loop-prevention.test.js` | Provenance, `produced`, idempotency, crash recovery, retry, self-trigger, concurrency, circuit breaker and end-to-end scenarios against an in-memory GitHub, plus the push path against real `git` |

Run the tests: `node --test "ai-development/integrations/github/scripts/*.test.js"`.

You provide the **adapter point**: a step that starts your agent of choice with the protocol (`ai-development/AI.md`), commits **locally** with the provenance trailers (it does not push) and writes `agent-result.json`. Nothing here names or requires a specific agent, and Stitch (or any design tool) is optional: it is just one possible source of an external change.

## What starts the agent, and what does not

The classification is about the **origin of the execution**, not about which tool or model wrote the code.

| Flow | Class | Agent | CI |
|---|---|---|---|
| Stitch → commit/push → GitHub | external intent | runs | runs |
| Human → commit/push → GitHub | external intent | runs | runs |
| Claude **local** (VS Code) → commit/push with the developer's identity | external intent | runs | runs |
| Codex **local** → commit/push with the developer's identity | external intent | runs | runs |
| Automated agent run → commit/push → GitHub | internal automation change | **skipped** (`IGNORE_AUTOMATION_CHANGE`) | runs |

Claude or Codex is **not** treated as automation because it wrote the code. A local session never receives the run id, change id and source sha, so its commits carry no provenance and are ordinary external changes.

## Provenance, in this integration

| Concept | GitHub |
|---|---|
| `change_id` | `PR-<number>` |
| `source_sha` | the PR head the gate classified as an external intent (the agent job checks out exactly this commit) |
| `run_id` | `<github run id>-<run attempt>`, unique per gate run; a resume or a retry gets its own |
| `trigger` | `external` (pull_request event), `resume` (`/agent answer`) or `retry` (`/agent retry`) |
| run record | a bot-authored PR comment starting with an `<!-- agent-run … -->` header: created by the gate **before** the agent starts (it is the claim); `produced` written by publish **before** it pushes; sealed by publish |
| commit provenance | the trailers `Agent-Generated: true`, `Agent-Run`, `Agent-Change`, `Source-SHA` on every commit of the run |
| automation identity | `AGENT_PUSH_ACTOR`, the login publish pushes as. **Required**: every gate fails closed without it |

```
external change ─► gate: change_id PR-42, source_sha abc123, run_id 100-1   (run record: RUNNING)
                                   │
                              agent run ─► LOCAL commits def456, 789fed (trailers: run 100-1, PR-42, abc123)
                                   │
                          publish ─► checks: abc123..HEAD = def456,789fed, all with run 100-1's trailers, branch still at abc123
                                  ─► run record: produced: def456,789fed        (written BEFORE the push)
                                  ─► git push --force-with-lease=<branch>:abc123 (compare-and-swap, as AGENT_PUSH_ACTOR)
                                  ─► run record sealed: READY
```

The ledger is rebuilt from the PR's comments and commits on **every** event, so nothing depends on the runner's memory. Only comments authored by `AGENT_BOT_LOGIN` count: a human who copies the format is ignored.

### How the gate decides a `pull_request` event

0. **Configured?** `AGENT_BOT_LOGIN` and `AGENT_PUSH_ACTOR` set (or `AGENT_GATE_MODE=local`, which is refused inside Actions). Else `REJECT_INVALID`, and nothing is written.
1. **Valid event?** PR number, head sha, commit list ending at the head. Else `REJECT_INVALID`.
2. **Trusted source?** Same-repository branch (never a fork) and an open PR. Else `REJECT_UNTRUSTED` / `REJECT_INVALID`.
3. **Anything pending?** The pending commits are those after the last commit a run started from, minus commits a run **produced**. A commit counts as produced only if it is in the `produced` list of a bot-authored run record (publish wrote it, and pushed the commit itself) **and** carries that run's trailers. Trailers on a commit publish did not record count for nothing, even while that run is `RUNNING`.
4. **Nothing pending:** the head is a start commit of a run → `IGNORE_DUPLICATE`; the head was produced by a run and the event's sender is `AGENT_PUSH_ACTOR` → `IGNORE_AUTOMATION_CHANGE`; produced but another sender → `IGNORE_DUPLICATE` (`push-actor-mismatch`, logged as a warning).
5. **Waiting?** An `OPEN` question exists → `WAITING_FOR_HUMAN` (`open-question`); the push is not lost, the next run after the answer starts from the current head.
6. **Iteration limit?** Runs of this change since the last acknowledgement ≥ `AGENT_MAX_ITERATIONS` → `WAITING_FOR_HUMAN` (`iteration-limit`) and a question is posted.
7. Otherwise `RUN_AGENT`: create the run record, race-safe (below), set `agent:running`, and start the agent.

Identity alone never classifies a commit: a commit pushed by the automation actor that publish did not record is treated as an external change (it costs at most one run, and the circuit breaker bounds a loop).

### Idempotency and races

The run record is the claim of a key: `change_id` + `source_sha` for an external intent, `change_id` + question id for a resume, `change_id` + replaced run for a retry. When two deliveries race, each creates a record, both re-read the PR's comments, and the record with the **lowest comment id** wins; the other deletes its own record and ends with `IGNORE_DUPLICATE` (if it dies before deleting it, the ledger ignores it anyway). The same mechanism protects two copies of an answer, two different answers to one question, and two `/agent retry` for one run. It does not depend on the workflow's `concurrency`.

### Recovery

Every write between a command and the new run is recoverable: the next event (a redelivery, a re-run of the job, another answer) reads the ledger and either continues or reports that the run already exists. The table is in [LOOP-PREVENTION.md](../../protocol/LOOP-PREVENTION.md#recovery-after-a-crash). A run whose record says `RUNNING` but whose Actions execution has ended is `STALE`; `/agent retry` re-runs it.

## Concurrency

Both workflows use the group `agent-<pr number>` with `cancel-in-progress: false`, so two runs of one PR do not execute in parallel and a run is never cancelled mid-commit.

**Concurrency prevents parallelism. It is not loop protection.** A sequence of runs, each started by the previous one, passes through any concurrency group. GitHub also keeps only one *pending* run per group and replaces older pending ones. Loop prevention is provenance, idempotency and the circuit breaker in the gate; the gate also judges every unprocessed commit, not just the event's, so a replaced pending run does not lose a human's change.

## Agent trigger versus CI trigger

Two separate switches. `agent-run` has a `gate` job that runs on every pull request event, including the agent's own push, and an `agent` job that runs only when the gate says `RUN_AGENT`. CI is in your own workflows, which this integration never modifies: no path filter, no `[skip ci]`-style marker, no condition on them. Commits produced by the agent trigger lint, tests, typecheck, build and security checks like any other commit; they only do not start a new agent run.

For CI to run on the agent's commits, publish must push with a GitHub App (or PAT) token, because pushes made with the default `GITHUB_TOKEN` do not trigger workflows (see below). The token reaches only the publish step (`AGENT_PUSH_TOKEN`), never the agent step. Set `AGENT_PUSH_ACTOR` to that identity: `<app-slug>[bot]`, or `github-actions[bot]` if you accept pushing with `GITHUB_TOKEN` and no CI on those commits.

## Circuit breaker

`AGENT_MAX_ITERATIONS` (default **3**, allowed 1 to 100; anything else falls back to 3) caps the runs of one change, resumes and retries included, in the current budget window. It is a safety net against bugs, races, duplicate events, misconfiguration and unforeseen loops; it does not mean the agent may keep trying. 3 is deliberately conservative; a higher value is possible, as a conscious configuration choice.

At the limit the agent is not started. The gate posts a question:

```
<!-- agent-question
id: iteration-limit-1
type: HUMAN_DECISION
status: OPEN
options: continue
reason: iteration-limit
window: 1
last-run: 1234-1
-->
```

with a table of every run (run id, trigger, iteration, source, status) so the cause can be diagnosed, sets `agent:waiting-human`, and stops. `/agent answer iteration-limit-1 continue` (a trusted actor) opens a new **budget window** and resumes the change from the current head. No other run starts until then. Nothing is erased: every run record stays, and `auditChange(collectLedger(comments, botLogin), 'PR-42')` reports the total runs, how many times the breaker opened, and for each `continue` who answered, when (the answer comment's platform timestamp), which run was active and which window it opened.

## Resume

A reply `/agent answer <id> <option>` resumes the **same change**: same `change_id`, same `source_sha` as the run that asked (`resume-of` links the runs), a new `run_id`, `trigger: resume`. It counts toward the limit. It is `RESUME_AGENT`, not an external intent; a second copy of the same answer is `IGNORE_DUPLICATE`.

## Retry

`/agent retry <run-id>` re-runs a run that is `FAILED`, or `STALE` (its record says `RUNNING`, but its Actions execution attempt has ended, checked with `actions.getWorkflowRunAttempt`; if that cannot be checked, nothing is retried). Same `change_id` and `source_sha`, new `run_id`, `trigger: retry`, `retry-of: <run-id>`, counted toward the limit. Trusted actors only. Refused for a run that is not the latest of the PR (`superseded`), still executing, already retried (`IGNORE_DUPLICATE`), while a question is open, or at the limit. A failed publish says which command to use. No empty commit is needed, and none should be used: it would be a new external intent.

## States and labels

| Label | Meaning | Set by |
|---|---|---|
| `agent:running` | An agent run is active on this PR | gate, on `RUN_AGENT`, `RESUME_AGENT` and `RETRY_AGENT` |
| `agent:waiting-human` | Run ended, blocked on an OPEN question or the iteration limit | publish step; gate at the limit |
| `agent:ready` | Work finished; awaiting CI and human review | publish step |

Exactly one of them at a time (a failed run clears them). Run record status: `RUNNING`, `READY`, `WAITING_FOR_HUMAN`, `FAILED` (with a `failure` reason), `STALE` (set when a retry replaces a run whose execution had ended).

## Question and answer

The question is a PR comment starting with the machine-readable header from the protocol. The reply is one line:

```
/agent answer Q1 A optional free-text note
```

The gate accepts it only if **all** hold:

1. the PR is open and its head branch is in **this** repository (never a fork);
2. the comment is new (`created`, not `edited`) and its author is a **trusted actor**: platform `author_association` in `OWNER`, `MEMBER`, `COLLABORATOR`, or listed in `AGENT_TRUSTED_ACTORS`; never a bot;
3. it matches the strict command grammar on its **first line** (comment text is otherwise ignored);
4. the question `id` matches exactly one comment **authored by `AGENT_BOT_LOGIN`** whose header is valid and `OPEN` (a look-alike from a human is not a question);
5. the option is one the question declares;
6. the ledger has a run of this change to resume, and the iteration limit does not hold it.

If valid and no other question remains `OPEN`, the gate creates the resume run record first (it is the claim of the question), then projects `ANSWERED` onto the question header (who, which option, which comment, when), swaps the label to `agent:running` and starts the resume job. If other questions remain `OPEN`, it only records the answer on the header and keeps waiting. Malformed answers from trusted actors get a fixed hint; untrusted ones get silence.

## Configuration (repository variables, not secrets)

| Variable | Purpose | Default |
|---|---|---|
| `AGENT_BOT_LOGIN` | Identity that publishes questions and run records, e.g. `github-actions[bot]` (or your App's `<slug>[bot]` if you pass its token to the script steps). Required: the gate fails closed without it | none |
| `AGENT_PUSH_ACTOR` | Login publish pushes as (e.g. `<app-slug>[bot]`). **Required**: every gate fails closed without it. Necessary, never sufficient: a commit is automation only if publish recorded it | none |
| `AGENT_MAX_ITERATIONS` | Circuit breaker, see above | `3` |
| `AGENT_GATE_MODE` | `github`. `local` only for tests and dry runs outside Actions (the identity may then be omitted); refused when `GITHUB_ACTIONS=true` | `github` |
| `AGENT_TRUSTED_ACTORS` | Extra allowed logins to answer, comma-separated | empty |
| `DESIGN_SOURCE_BRANCH` | Builder path only: the branch the builder writes to, for example `main` (also in the `on.push.branches` of `design-pr.yml`). Set it explicitly: the default is kept for earlier setups | `studio` |
| `PRODUCTION_BRANCH` | Builder path only: the protected production branch, for example `production` (also in `design-back-sync.yml`). Set it explicitly | `main` |
| `AGENT_APP_ID` | Design-driven repositories: the GitHub App whose token opens the design pull request and back-syncs (private key in the secret `AGENT_APP_PRIVATE_KEY`) | none |
| `AGENT_TRUSTED_ASSOCIATIONS` | Associations allowed to answer. `NONE` disables them, leaving only the allowlist. `MEMBER` means *any* organization member; narrow it if that is too broad | `OWNER,MEMBER,COLLABORATOR` |

Agent-step environment (set by the workflows): `AGENT_RUN_ID`, `AGENT_CHANGE_ID`, `AGENT_SOURCE_SHA`, `AGENT_HEAD_REF`, `AGENT_PR_NUMBER`, `AGENT_MODE` (`start`, `resume` or `retry`); on retry also `AGENT_RETRY_OF`; on resume also `AGENT_QUESTION_ID`, `AGENT_QUESTION_TYPE`, `AGENT_ANSWER_OPTION`, `AGENT_DECISION_KEY`, `AGENT_OPENSPEC_CHANGE` (the `openspec/changes/<id>/` folder; not the loop-prevention change id). The trailers are in `$RUNNER_TEMP/agent-trailers.txt`.

Secrets (agent/model credentials, App private key) live in repository or environment secrets and reach only the step that needs them. `HUMAN_SECRET` questions are answered with `/agent answer <id> configured` after the human sets the secret; the value never appears in a comment.

## Security model

Full policy: [protocol/SECURITY.md](../../protocol/SECURITY.md). How it applies here:

- **No untrusted code with privileges.** `agent-run` uses `pull_request` and refuses fork PRs. `agent-resume` uses `issue_comment` (which has secrets and a write token) but its gate job never checks out or runs PR code, only the default branch, and the resume job checks out only branches of this repository. Do **not** switch these to `pull_request_target` with a checkout of the PR head. Note that the `agent-run` gate job runs the copy of `agent-gate.js` in the PR's branch: acceptable because same-repository branches are written by people with write access; if that is not acceptable for you, load the script from the default branch instead.
- **Comments are data.** They are parsed by fixed regexes in `agent-gate.js`; nothing from a comment is ever placed in a shell command, `run:` script or `${{ }}` expression. Values handed to the agent step are validated first and passed as environment variables; the free-text note is passed as a file. The provenance step writes ids that the gate produced, validated against `[A-Za-z0-9_.-]`.
- **Ledger integrity.** Run records and questions count only when authored by `AGENT_BOT_LOGIN`; trailers alone prove nothing. Anyone able to post comments **as** that identity can forge the ledger, so use an identity that only the workflows control.
- **Least privilege.** `permissions: {}` at workflow level; each job asks for the minimum (the gate jobs cannot write contents; the comment gate has `actions: read` only to tell a `STALE` run from a live one). The agent step does not push and does not write comments or labels: the trusted publish step validates `agent-result.json`, refuses a question that sets `reason` or answer fields (reserved for the runtime) or lacks a `### Handoff`, pushes the run's commits with the only push credential of the job, and seals the run record. Publish runs git with repository hooks disabled and never prints the token.
- **Injection surface.** Prompt injection through PR text, comments or repository content is handled by the protocol (data, never instructions). Answers can only choose among options the agent itself offered.
- **Pin actions** to full commit SHAs in real use; the examples use version tags for readability.

## Cross-repository work needs credentials you must provide

The default `GITHUB_TOKEN` of a workflow is scoped to **its own repository**. A run cannot read, branch or open pull requests in another repository with it. For multi-repository changes:

- Create a **GitHub App** (preferred) installed on the involved repositories, with only `contents: write` and `pull-requests: write` (plus `issues: write` for labels/comments there). Generate a short-lived installation token in the workflow (`actions/create-github-app-token`) and pass it to the agent step. A fine-grained personal token is a weaker alternative; avoid classic tokens.
- Scope the token's `repositories:` to the **impact set** only. Impact analysis decides that set, so a least-privilege setup is two phases: an analysis run with a read-only token, then an implementation run whose token is limited to the repositories found. The example keeps one phase for simplicity; splitting it is the safer form.
- Pushes and PRs made with `GITHUB_TOKEN` do **not** trigger other workflows, so CI will not run on them. Use the App token for pushing/opening PRs when CI must run.
- Workflows cannot use secrets of other repositories. Configure them per repository (or use organization secrets with restricted repository access).

Without this, a run can only change the repository it runs in. Commits the agent makes in **other** repositories are not tracked by this ledger (it lives in the primary PR); they carry the same trailers for traceability, and any agent trigger you wire there needs its own gate.

## Where state lives

- The **primary PR** (the one that started the run) carries the questions, answers, labels and the **run records** (the idempotency ledger). The question's handoff lists branches or PRs opened in other repositories.
- Work in progress lives on pushed branches; nothing is kept on the runner between runs.
- The decision is recorded in `DECISIONS.md`. If `ai-development/` is its own repository, writing it needs write access to that repository (same credential rules as above); otherwise the agent proposes the entry in the PR text and a human commits it.

## Setup

1. Copy the two workflows into the `.github/workflows/` of the repository that should host agent runs, dropping `.example`.
2. Copy `scripts/agent-gate.js` to where the workflows expect it (the `require` paths), or edit those paths.
3. Set `AGENT_BOT_LOGIN` and `AGENT_PUSH_ACTOR` (both required; optionally `AGENT_MAX_ITERATIONS` and the trust variables) under *Settings → Secrets and variables → Actions → Variables*. Give the publish step a push token (`AGENT_PUSH_TOKEN`, from the App token step in the examples).
4. Implement the adapter step (`./scripts/run-agent.sh` in the examples) for your agent. Contract: read `AGENT_MODE` (`start`, `resume` or `retry`) and the `AGENT_*` variables, follow `ai-development/AI.md`, commit **locally** on top of the checked-out commit and end **every** commit with the trailers in `$RUNNER_TEMP/agent-trailers.txt` (for example `git commit --trailer "Agent-Generated: true" --trailer "Agent-Run: $AGENT_RUN_ID" --trailer "Agent-Change: $AGENT_CHANGE_ID" --trailer "Source-SHA: $AGENT_SOURCE_SHA"`), **do not push, fetch or rebase** (publish pushes exactly what it verified), and write `$RUNNER_TEMP/agent-result.json`. Do not add CI-skip markers.
5. Protect the default branch (required reviews and status checks). Agents open PRs; humans merge and deploy.
6. Only if an app-builder tool writes to this repository (builder path): follow *Design-driven repositories* below as well. The direct path needs no extra setup.

## Design-driven repositories

Two paths exist ([protocol/DESIGN-DRIVEN.md](../../protocol/DESIGN-DRIVEN.md#choosing-a-path)):

- **Direct path (recommended).** The human commits the design tool's export under `design/<tool>/` (by hand, or by asking an interactive session to export it through the tool's MCP server or API), and the agent implements it in the project's stack. It needs **nothing from this section**: the change is an ordinary pull request, handled by `agent-run.yml` like any other. Keep the design tool's key out of the repository and out of Actions ([SECURITY.md](../../protocol/SECURITY.md#9-design-tool-access)).
- **Builder path (optional).** An app-builder tool commits a generated app to the repository (Google AI Studio is one example) and the agent makes it real. The rest of this section is for that path only.

Such a builder typically writes only to one branch (for a builder that creates the repository, its default branch, usually `main`) and syncs both ways. That branch is the **design source branch**; production is a separate, protected branch (here `production`) behind a pull request. The default branch does not change:

```
 builder ──sync──► main (design source) ── push ─► design-pr.yml ─► PR main → production ─► agent-run.yml (gate, agent, publish to main)
                     ▲                                                                              │
                     │                                                               human review, merge (merge commit)
                     │                                                                              ▼
                     └────────── design-back-sync.yml (fast-forward or merge, never force) ◄── push to production
```

How the pieces interact:

- The design pull request (`main → production`) **is** the change: `change_id = PR-<n>`, ledger, questions, labels and iteration limit work exactly as for any pull request. `agent-gate.js` needs no change: it publishes to the pull request's head branch, here `main`.
- `design-pr.yml` only opens that pull request when none is open and `main` is strictly ahead of `production`. Later builder pushes are `synchronize` events on it, handled by the gate as external intent. It opens nothing while `main` does not yet contain `production` (the back-sync is pending): the back-sync's own push runs it again, so the pull request opens once, with the merge already in it.
- `design-back-sync.yml` runs on every push to `production`. It fast-forwards `main`, or merges `production` into it when the builder pushed after the merge. On conflict it pushes nothing, reports on the merged pull request and fails; a human merges and pushes. A back-sync that leaves `main` equal to `production` opens nothing and starts no run. A merge into `production` from another pull request (a hotfix) while a design pull request is open is merged into `main` too, and counts as external intent on the design pull request.
- Both design workflows are API-only, share the `design-branch` concurrency group, and load their script from the production branch, never from the design source branch.
- The default branch stays the design source branch, so GitHub reads `issue_comment` workflows (and `agent-resume`'s gate script) from a branch the builder can write. The allow-list of step 3 is what keeps that safe; load those scripts from `production` if that is not enough for you.

### What was observed with Google AI Studio

A first test (repository `ltopin/design-01`, 2026-09-26) found:

- AI Studio **creates its own repository** (public by default) and commits to `main` under the connected human's identity; it cannot be pointed at another branch.
- On its **first sync it deleted a file it had not created** (the `README.md` GitHub had created).
- The generated app declared unused dependencies, had a dependency set that did not install without `--legacy-peer-deps`, and shipped **no lock file**.
- It generated screens, a wizard, modals and data nobody designed (the inventions [DESIGN-DRIVEN.md](../../protocol/DESIGN-DRIVEN.md#inventions) handles).

Whether a later sync keeps files and commits made by others is the preservation check below. For `design-01` a sentinel (`design/stitch/teste.txt`, commit `7c211c0`) is committed; the result is **pending** until AI Studio syncs again. Until it passes, treat AI Studio as a prototype outside the repository and use the direct path.

Setup, in addition to the steps above:

0. **Run the preservation check** ([DESIGN-DRIVEN.md](../../protocol/DESIGN-DRIVEN.md#preservation-check)): commit a sentinel file to the branch the builder writes to, make a change in the builder, let it sync, and confirm the sentinel and its commit are still there. If not, stop here: do not adopt this model.
1. Create `production` from `main`. Do **not** change the default branch.
2. **Protect production** with a ruleset on `production`: pull request required, reviews and status checks, no direct pushes, no force-pushes, no deletion. The builder must not be able to write there.
3. **Restrict the design source branch** with a ruleset on `main`: only the builder's integration, the humans who design, and the automation App may push (bypass list or push restriction); block force-pushes and deletion. This allow-list is the trust boundary: a push to `main` starts an agent that holds credentials ([SECURITY.md](../../protocol/SECURITY.md#8-design-source-branch)). Commit author names are not checked and grant nothing.
4. Use a **GitHub App** (`AGENT_APP_ID`, secret `AGENT_APP_PRIVATE_KEY`), the same one as the publish step (`AGENT_PUSH_ACTOR` = `<app-slug>[bot]`). Pull requests and pushes made with `GITHUB_TOKEN` start no workflows, so the gate would never see the design pull request and the back-sync would not re-run `design-pr.yml`.
5. Copy `design-pr.yml.example` and `design-back-sync.yml.example`, set the branch names in their `on:` blocks, and **set** `DESIGN_SOURCE_BRANCH=main` and `PRODUCTION_BRANCH=production`. The script's defaults (`studio` / `main`) are kept for repositories set up with earlier versions, so they do not match this layout.
6. Merge design pull requests with a **merge commit**. Squash also works, but makes `main` and `production` diverge every cycle, so each back-sync adds a merge commit to `main`.

Working with it:

- **Design, push, then wait for the agent.** A builder push while a run is in progress makes that run's publish fail with `branch-moved` (nothing is overwritten) and starts a new run: runs are wasted while the designer is active.
- Every design push counts toward `AGENT_MAX_ITERATIONS`, which is per pull request. A long design session ends in the circuit breaker's question; prefer smaller design cycles merged more often.
- The builder pulls the agent's commits from `main`, so the next design iteration starts from integrated code. If it rewrites integrated code back into mock data, the agent's done check finds it on the next run.
- **Commit the design export.** The builder does not carry the original design into the repository. Export the screens from the design tool (Stitch is one example), one file per screen (variants as `<screen>.<variant>.html`), and commit them under `design/<tool>/` on `main` (for example `design/stitch/home.html`), in the same push cycle as the builder's changes. The agent then uses them as the design reference: it compares them with the generated code and reports inventions ([DESIGN-DRIVEN.md](../../protocol/DESIGN-DRIVEN.md#design-reference)). Automated runs never write under `design/`. No extra setup is needed: the push is an ordinary push to `main`, so the ruleset allow-list of step 3 already decides who may commit it, and any change under `design/` shows in the design pull request diff. Without a design export, the agent takes the generated app as the design and says so in the pull request.

**Mirror-repository variant.** If the builder cannot write to the repository that holds production (for example because it insists on creating its own), keep its repository as a mirror (its default branch is its design source branch) and add, in the main repository, a job that fetches that mirror into a design source branch with the automation identity. The rest is identical. Back-sync then also pushes production back to the mirror. This costs a repository and a sync credential, so prefer the single-repository form.

## Known limits

- One concurrency group per PR: GitHub keeps one *pending* run and replaces older pending ones, so an answer sent in quick succession may be dropped unclaimed. The question stays `OPEN`; send the answer again. A dropped *push* event is not a lost intent, because the next gate run judges every unprocessed commit.
- A push by anyone to the PR branch while the agent works makes publish refuse to push (`branch-moved`): the run fails and its local commits are discarded; the new push starts a new run. Re-running a failed job from the Actions UI is refused as a duplicate; use `/agent retry`.
- `STALE` detection depends on `actions.getWorkflowRunAttempt`. If that call fails (other than 404, meaning the attempt does not exist), the retry is refused rather than guessed. A `RUNNING` record is never retried while its execution is alive.
- A PR with more than 250 commits cannot be listed completely by the API and is rejected as invalid; a run that produces more than 200 commits fails (`too-many-commits`).
- Free-form replies are not interpreted; only the `/agent answer` and `/agent retry` grammars are accepted, on purpose.
- The first version keeps a single PR as coordination point. Multi-PR coordination beyond the handoff list is not automated.
- The examples are illustrative and were not run against a live GitHub repository; the scripts are tested against an in-memory fake of the GitHub API. Test them in a sandbox repository first.
