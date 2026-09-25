## Context

See proposal.md for motivation. Current state that shapes the approach:

- The GitHub integration is driven by `pull_request` events. The gate derives `change_id = PR-<n>` ([agent-gate.js](../../../template/integrations/github/scripts/agent-gate.js)), keeps the ledger and questions as PR comments, and publishes the agent's commits to the PR's head branch with a compare-and-swap (fails with `branch-moved` if someone pushed meanwhile). Any push not made by `AGENT_PUSH_ACTOR` with matching provenance is external intent.
- Observed builder behavior (AI Studio, per its documentation; not yet verified on a real commit):
  - it commits only to the repository's default branch; branch selection is not supported;
  - it syncs both ways (push and pull), and shows a side-by-side diff on conflict;
  - it can import an existing repository;
  - it generates full-stack web apps (React client + Node.js server);
  - there is no documented, stable mock layer.
- The protocol is tool-agnostic: Stitch, AI Studio, Claude and GitHub appear only as examples or adapters.
- `openspec/specs/` has no baseline, so all requirements land in new capabilities.

## Goals / Non-Goals

**Goals:**
- A builder push starts exactly one agent execution through the existing gate, with no change to how loops, duplicates, questions and resumes work.
- The builder never writes to the production branch, and production changes only through a reviewed PR.
- The builder picks up the agent's integration (the round trip closes), so the next design iteration starts from real code.
- The agent finds and removes fake data paths without assuming where they are.

**Non-Goals:**
- Infrastructure, provisioning, deploy and preview environments.
- Parallel design streams in one repository (one design source branch, one open design PR at a time).
- Creating repositories. A new backend in a multi-repo setup needs a repository a human creates (Level 2).
- Supporting builders that cannot commit to Git.
- Driving the builder (the agent never operates Stitch or AI Studio).

## Decisions

### D1. The design source branch is the default branch; the agent works on it through a PR to production

```
 builder ──sync──► studio (default branch) ──── PR studio → main ──► main (protected)
                     ▲   │                                              │
                     │   └─ agent commits here (via the gate's publish) │
                     └──────────── back-sync after merge ◄──────────────┘
```

- The repository's default branch is renamed or created as the design source branch (suggested name `studio`). The production branch (`main`) is protected: changes only through PRs, reviews required.
- The PR `studio → main` is the unit of work: `change_id = PR-<n>`, as today. Each builder push is a `synchronize` event on that PR, which the gate already classifies as external intent. The agent's commits go to `studio` through the existing publish step.
- Because the builder syncs both ways, it pulls the agent's commits. The designer iterates on integrated code, not on mocks.

*Alternative considered:* a promotion branch (`agent/studio`) merged from `studio` by a sync identity, with PR `agent/studio → main`. It keeps the builder's branch clean until merge, but needs merge automation, a third identity, conflict resolution by the agent and gate changes, and the builder would keep editing the mock version. Rejected for this version.

*Alternative considered:* a mirror repository for the builder. It avoids changing the default branch, but adds a repository and a sync automation. Left as a documented variant for teams that cannot change the default branch.

### D2. A small "ensure PR" workflow opens the design PR; the gate is not changed

On `push` to the design source branch, a workflow opens `studio → main` when no open PR exists and `studio` is ahead of `main`. When the PR exists, it does nothing: the builder's push already produced `synchronize`.

- It must open the PR with a GitHub App token, not `GITHUB_TOKEN`. Events caused by `GITHUB_TOKEN` do not start workflows, so the gate would never see the PR. This is the same credential the publish step already recommends.
- It never runs the agent itself and never pushes code.
- "Ahead of main" is checked so the back-sync push (D3) does not open an empty PR.

*Refined during implementation:* "ahead" means GitHub's comparison status `ahead` (production is contained **and** there is something new). When the branches have `diverged` (a merge into production not yet back-synced), the workflow waits: the back-sync's own push runs it again. Otherwise a builder push right after a merge would open the PR before the back-sync lands, and the back-sync merge commit would start a second, wasted agent run on it. The workflow loads its script from the production branch, not from the design source branch, so a builder push cannot change the code that runs with the App token.

*Alternative considered:* let the gate also react to `push`. It would need a second `change_id` scheme and a ledger outside PRs. Rejected: the PR is already where state and questions live.

### D3. Back-sync after merge keeps `studio` a descendant of `main`

When the design PR is merged, a workflow moves `studio` to `main`: fast-forward when possible, otherwise it merges `main` into `studio`. It pushes with the automation App identity and never touches `main`.

- Recommended merge method for the design PR: **merge commit**. A squash makes `studio` and `main` diverge on every cycle. The back-sync handles both, but squash produces a merge commit on `studio` every time.
- If `studio` received builder commits after the PR merged, the back-sync merges instead of fast-forwarding. On conflict it stops, opens nothing and reports it (`WAITING_FOR_HUMAN`-style comment on the merged PR). It never force-pushes the design source branch.
- The back-sync push is not an intent. The "ensure PR" workflow sees `studio` not ahead of `main` and does nothing. If the builder pushes later, a new PR is opened.

*Refined during implementation:* the back-sync runs on **every push to production**, not only on the design PR's merge. Production is protected, so every push is a PR merge, and hotfix PRs keep `studio` a descendant of `main` too (required by D2's refinement). It is API-only: `git.updateRef` with `force: false` for the fast-forward (a 422 means the builder pushed meanwhile, so it merges instead), and the merges API for the merge commit (409 = conflict, reported on the PR associated with the production commit). A hotfix merged while a design PR is open lands on `studio` as a merge commit and counts as external intent on that PR.

### D4. Fake boundaries are found by behavior

`protocol/DESIGN-DRIVEN.md` defines fake boundaries as signals, not paths:

| Signal | Example |
|---|---|
| literal data as a source | `const ORDERS = [...]` read by a component or service |
| simulated latency | `setTimeout`, `Promise.resolve(data)` pretending to be I/O |
| browser storage as a database | `localStorage`/`sessionStorage`/IndexedDB holding domain entities |
| client-generated identity for entities | `Date.now()`, `Math.random()`, `crypto.randomUUID()` as a record id |
| credentials or model/API calls in the client | a key in client code or env exposed to the bundle |
| generated server returning fixed data | an endpoint whose handler returns constants |

The agent runs the detection **twice**: at the start, to build the extraction table, and at the end, as the done check. Anything still matching at the end is either removed or listed in the PR with the reason it is legitimate (fixtures, tests, feature flags).

*Alternative considered:* require the builder to keep mocks in a known folder. Rejected: there is no such convention, and the protocol must not depend on one tool's output.

### D5. The extraction table is the classification evidence

```
| Element (file)           | Needs                  | Real contract            | Status  |
|--------------------------|------------------------|--------------------------|---------|
| OrdersList (ORDERS)      | id, status, total      | GET /orders              | exists  |
| column "tracking"        | tracking_code          | GET /orders, no field    | partial |
| cancel button            | cancel mutation        | none                     | missing |
| server GET /api/summary  | aggregate by status    | none (generated server)  | proposed|
```

- `exists` → class B, `partial` → C, `missing` → D. A generated server endpoint is `proposed`, never `exists`.
- The highest status sets the class, as in `CLASSIFICATION.md`. The table goes into the PR (or `proposal.md` when a formal change is opened).

### D6. Mode is decided from the workspace map, not from the input

- **New project**: the L0 docs list no backend for this product (or `PROJECT.md` is being initialized). The generated app is the frontend; its server is the seed of the backend. The agent hardens it (persistence, auth, validation, tests) instead of rewriting it, unless it contradicts a recorded decision.
- **Existing project**: a backend exists in `REPOSITORIES.md`. Generated client code must follow the existing frontend's structure and conventions (HTTP client, auth, routing, state, components) while preserving what the user sees. A generated server next to a real backend is a **parallel backend**: the agent stops with a Level 2 question (absorb into the real backend, keep as a BFF, or drop), unless `DECISIONS.md` already answers it.
- When the evidence does not say which mode applies, that is itself a Level 2 question.

### D7. Presentation is the human's contract

The agent may change markup, styles or visible behavior only when technically required: broken accessibility, incompatibility with the stack, a security problem, or data that cannot exist as drawn. Each such change is listed in the PR with the reason. The generated app's visual result is not "improved".

### D8. Trust is decided by who can push to the design source branch

The trigger is the branch, not the commit author. A push to `studio` starts an agent that holds credentials. So:

- `studio` is protected by a ruleset that allows only the builder's integration, the humans who design, and the automation identity (for publish and back-sync).
- Forks never trigger (unchanged gate rule).
- Commit author identity is not used as a trust signal (it is not reliably known for the builder; see Open Questions).

### D9. Protocol vs integration split

| Layer | File | Content |
|---|---|---|
| Protocol | `protocol/DESIGN-DRIVEN.md` (new) | D4–D7, the design source branch model at a platform-free level (D1, D3 in words), the definition of done |
| Protocol | `CLASSIFICATION.md`, `SECURITY.md` (edits) | generated server = proposed contract; parallel backend signal; D8 |
| Integration | `integrations/github/workflows/design-pr.yml.example`, `design-back-sync.yml.example` (new) | D2, D3 |
| Integration | `integrations/github/scripts/design-branch.js` + tests (new) | D2/D3 decision logic, kept out of YAML so it is testable like `agent-gate.js` |
| Integration | `integrations/github/README.md` | setup: default branch, rulesets, App token, merge method |

The gate script is expected to stay unchanged. If implementation shows otherwise, the change goes into `agent-gate.js` with tests, not into the workflow YAML.

## Risks / Trade-offs

- [The builder edits `studio` while the agent runs] → the publish CAS fails with `branch-moved`, nothing is overwritten, and the builder's push starts a new external run. Cost: wasted runs when the designer is active. Documented: design, push, then wait for the agent.
- [Every design push counts toward `AGENT_MAX_ITERATIONS`] → long design sessions hit the limit and stop with `WAITING_FOR_HUMAN`. That is the circuit breaker working. Document that the limit is per PR, and consider merging smaller design cycles.
- [The builder's AI rewrites agent-integrated code back into mocks] → the done check (D4) runs on every agent execution and catches reintroduced fakes. The extraction table shows them again.
- [Changing the default branch surprises contributors] → clones and new PRs default to `studio`. Document it. The mirror-repository variant exists for teams that cannot accept this.
- [Back-sync conflicts] → never force; stop and report on the merged PR.
- [Parallel backend in existing projects stops almost every first run] → expected. The first answer goes into `DECISIONS.md`, so later runs do not ask again.
- [Builder behavior is known from documentation, not observation] → a sandbox check is a task before the integration is finalized. The protocol side does not depend on it.
- [Squash-merge habit] → back-sync still works (merge instead of fast-forward), at the cost of noisier `studio` history. Recommend merge commits.

## Migration Plan

- Framework-managed files are added or changed, so `template/.bootstrap-version` is bumped. `--update` creates `protocol/DESIGN-DRIVEN.md` and the new workflow examples, and refreshes the edited protocol files only where they are untouched. Otherwise they are reported as conflicts (the existing behavior).
- Adoption per repository is manual and opt-in: set the default branch, add rulesets, copy the workflows, configure the App. Nothing runs before that.
- Rollback: delete the two workflows and restore `main` as default. The protocol text is inert without them.

## Open Questions

Answered by the sandbox test (repository `landing-page-test`, one landing page built by AI Studio from a Stitch export):

- **Which identity authors and pushes the builder's commits?** The builder commits to the repository's **default branch**, with the **connected human's identity** as author and pusher, and an AI-generated commit message. The commit author therefore cannot tell builder from human, which confirms D8 (identity is not a trust signal); the ruleset allow-list names the human account.
- **How does the builder lay out a full-stack project?** React + Vite client under `src/`, literal data in `src/data/`, an Express `server.ts` at the repository root with in-memory arrays, and a builder `metadata.json` at the root. It also wrote generated documents (architecture, "how it works") that describe components nobody designed. Used for examples in `DESIGN-DRIVEN.md`; detection (D4) does not depend on it.

Still open (not exercised by the sandbox test):

- Sync and conflict behavior when the builder pushes after an external commit on the same branch.
- For monorepos: does the builder handle importing a large existing monorepo, or does it need a subfolder? The branch model is the same either way.
