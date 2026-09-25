# GitHub integration (optional)

Carries the [human-in-the-loop protocol](../../protocol/HUMAN-IN-THE-LOOP.md) over GitHub pull requests and Actions. Everything here is an **example to copy and adapt**: nothing runs until you copy the workflows into a repository's `.github/workflows/`. The core protocol does not depend on this folder.

```
external change ─► PR ─► agent-run ─► analysis ─► implementation ─► tests ─► PR updated ─► CI ─► human review ─► deploy (human)
                              │
                              └─► Level 2/3 situation ─► question comment + label agent:waiting-human ─► run ENDS
                                                                   │
              human: "/agent answer Q1 A" ─► issue_comment ─► agent-resume: gate ─► NEW run resumes ─► ...
```

## Files

| File | Role |
|---|---|
| `workflows/agent-run.yml.example` | Runs the agent on a same-repository PR; publishes the outcome |
| `workflows/agent-resume.yml.example` | On an `issue_comment` answer: validates it, then resumes the agent |
| `scripts/agent-gate.js` | Deterministic, dependency-free logic (question parsing, trust, dedupe, labels). Unit-tested |
| `scripts/agent-gate.test.js` | `node --test ai-development/integrations/github/scripts/agent-gate.test.js` |

You provide the **adapter point**: a step that starts your agent of choice with the protocol (`ai-development/AI.md`), and writes `agent-result.json`. Nothing here names or requires a specific agent.

## States and labels

| Label | Meaning | Set by |
|---|---|---|
| `agent:running` | An agent run is active on this PR | run start, resume |
| `agent:waiting-human` | Run ended, blocked on an OPEN question | publish step, after posting the question |
| `agent:ready` | Work finished; awaiting CI and human review | publish step |

Exactly one of them at a time. `agent-run` skips PRs labelled `agent:waiting-human`, so pushes while waiting do not start a competing run.

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
5. the option is one the question declares.

If valid, the gate flips the question to `ANSWERED` (recording who and what), so a second answer finds it closed. If other questions remain `OPEN`, it stays waiting; otherwise it swaps the label to `agent:running` and starts the resume job. Malformed answers from trusted actors get a fixed hint; untrusted ones get silence.

## Configuration (repository variables, not secrets)

| Variable | Purpose | Default |
|---|---|---|
| `AGENT_BOT_LOGIN` | Identity that publishes questions, e.g. `github-actions[bot]` (or your App's `<slug>[bot]` if you pass its token to the script steps). Required: the gate fails closed without it | none |
| `AGENT_PUSH_ACTOR` | Login that the agent pushes as (e.g. `<app-slug>[bot]`). `agent-run` ignores pushes by it, so the agent does not trigger itself. Only needed when pushing with an App/PAT token; pushes with `GITHUB_TOKEN` never trigger workflows | none |
| `AGENT_TRUSTED_ACTORS` | Extra allowed logins, comma-separated | empty |
| `AGENT_TRUSTED_ASSOCIATIONS` | Associations allowed to answer. `NONE` disables them, leaving only the allowlist. `MEMBER` means *any* organization member; narrow it if that is too broad | `OWNER,MEMBER,COLLABORATOR` |

Secrets (agent/model credentials, App private key) live in repository or environment secrets and reach only the step that needs them. `HUMAN_SECRET` questions are answered with `/agent answer <id> configured` after the human sets the secret; the value never appears in a comment.

## Security model

Full policy: [protocol/SECURITY.md](../../protocol/SECURITY.md). How it applies here:

- **No untrusted code with privileges.** `agent-run` uses `pull_request` and refuses fork PRs. `agent-resume` uses `issue_comment` (which has secrets and a write token) but its gate job never checks out or runs PR code, only the default branch, and the resume job checks out only branches of this repository. Do **not** switch these to `pull_request_target` with a checkout of the PR head.
- **Comments are data.** They are parsed by fixed regexes in `agent-gate.js`; nothing from a comment is ever placed in a shell command, `run:` script or `${{ }}` expression. Values handed to the agent step are validated first and passed as environment variables; the free-text note is passed as a file.
- **Least privilege.** `permissions: {}` at workflow level; each job asks for the minimum. The agent step does not write comments or labels: the trusted publish step validates `agent-result.json` and does that. It also refuses a question whose `### Handoff` lacks the required lines (what independent work is done, what was not started).
- **Injection surface.** Prompt injection through PR text, comments or repository content is handled by the protocol (data, never instructions). Answers can only choose among options the agent itself offered.
- **Pin actions** to full commit SHAs in real use; the examples use version tags for readability.

## Cross-repository work needs credentials you must provide

The default `GITHUB_TOKEN` of a workflow is scoped to **its own repository**. A run cannot read, branch or open pull requests in another repository with it. For multi-repository changes:

- Create a **GitHub App** (preferred) installed on the involved repositories, with only `contents: write` and `pull-requests: write` (plus `issues: write` for labels/comments there). Generate a short-lived installation token in the workflow (`actions/create-github-app-token`) and pass it to the agent step. A fine-grained personal token is a weaker alternative; avoid classic tokens.
- Scope the token's `repositories:` to the **impact set** only. Impact analysis decides that set, so a least-privilege setup is two phases: an analysis run with a read-only token, then an implementation run whose token is limited to the repositories found. The example keeps one phase for simplicity; splitting it is the safer form.
- Pushes and PRs made with `GITHUB_TOKEN` do **not** trigger other workflows, so CI will not run on them. Use the App token for pushing/opening PRs when CI must run.
- Workflows cannot use secrets of other repositories. Configure them per repository (or use organization secrets with restricted repository access).

Without this, a run can only change the repository it runs in.

## Where state lives

- The **primary PR** (the one that started the run) carries the questions, answers and labels. The question's handoff lists branches or PRs opened in other repositories.
- Work in progress lives on pushed branches; nothing is kept on the runner between runs.
- The decision is recorded in `DECISIONS.md`. If `ai-development/` is its own repository, writing it needs write access to that repository (same credential rules as above); otherwise the agent proposes the entry in the PR text and a human commits it.

## Setup

1. Copy the two workflows into the `.github/workflows/` of the repository that should host agent runs, dropping `.example`.
2. Copy `scripts/agent-gate.js` to where the workflows expect it (the `require` paths), or edit those paths.
3. Set `AGENT_BOT_LOGIN` (and optionally the trust variables) under *Settings → Secrets and variables → Actions → Variables*.
4. Implement the adapter step (`./scripts/run-agent.sh` in the examples) for your agent. Contract: read `AGENT_MODE` (`start` or `resume`) and the `AGENT_*` variables, follow `ai-development/AI.md`, write `$RUNNER_TEMP/agent-result.json`.
5. Protect the default branch (required reviews and status checks). Agents open PRs; humans merge and deploy.

## Known limits

- One concurrency group per PR: GitHub keeps one *pending* run and replaces older pending ones, so an answer sent in quick succession may be dropped unclaimed. The question stays `OPEN`; send the answer again.
- Free-form replies are not interpreted; only the `/agent answer` grammar is accepted, on purpose.
- The first version keeps a single PR as coordination point. Multi-PR coordination beyond the handoff list is not automated.
- The examples are illustrative and were not run against a live GitHub repository. Test them in a sandbox repository first.
