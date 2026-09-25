## 0. Preconditions

- [x] 0.1 Land the pending loop-prevention work (uncommitted `LOOP-PREVENTION.md`, gate and test changes) in its own commit, so this change starts from a clean baseline
- [x] 0.2 Sandbox check with the builder: connect a throwaway repository, push twice (second push after an external commit), import an existing repository, and record the branch used, sync/conflict behavior, commit author and pusher, and the generated full-stack layout in `design.md` (Open Questions) — recorded from the `landing-page-test` sandbox; sync/conflict and monorepo import remain open questions

## 1. Protocol: design-driven implementation

- [x] 1.1 Create `template/protocol/DESIGN-DRIVEN.md`: scope, presentation-as-contract rule, fake-boundary signals table, two scans (start and done), extraction table format and status→class mapping, new vs existing mode, parallel backend question, no repository creation, definition of done, tool independence
- [x] 1.2 Describe the design source branch model in platform-free terms in `DESIGN-DRIVEN.md` (default branch, protected production, one design pull request, back-sync, no force-push)
- [x] 1.3 Edit `template/protocol/CLASSIFICATION.md`: generated server code is part of the change; a generated endpoint is a proposed contract, never an existing one; parallel backend is a Level 2 signal; link to `DESIGN-DRIVEN.md`
- [x] 1.4 Edit `template/protocol/SECURITY.md`: pushing to the design source branch starts an agent with credentials; trust is the branch allow-list, not commit author; forks never trigger
- [x] 1.5 Edit `template/protocol/DECISION-POLICY.md` if needed so parallel backend, ambiguous mode and missing backend repository are listed as Level 2 examples
- [x] 1.6 Add a pointer to `DESIGN-DRIVEN.md` in the *Autonomy and human decisions* section of `template/AI.md`, and in `template/WORKFLOW.md` where external changes are described
- [x] 1.7 Add the extraction table to the classification section of `template/openspec/changes/_template/proposal.md` (optional block for builder-driven changes)

## 2. GitHub integration: design pull request and back-sync

- [x] 2.1 Create `template/integrations/github/scripts/design-branch.js` with the pure decision logic: whether to open the design pull request (no open PR, source ahead of production) and how to back-sync (fast-forward, merge, or stop on conflict), following the structure of `agent-gate.js`
- [x] 2.2 Create `template/integrations/github/scripts/design-branch.test.js` covering every scenario in `specs/design-source-branch/spec.md` (first push, subsequent push, nothing to promote, clean back-sync, builder commits after merge, conflict, back-sync opens nothing)
- [x] 2.3 Create `template/integrations/github/workflows/design-pr.yml.example`: `on: push` to the design source branch, App token, least permissions, calls `design-branch.js`, never runs the agent or pushes code
- [x] 2.4 Create `template/integrations/github/workflows/design-back-sync.yml.example`: on design pull request merged, fast-forward or merge production into the design source branch with the automation identity, no force-push, report on conflict
- [x] 2.5 Verify that `agent-gate.js` needs no change for a pull request whose head is the default branch (gate, publish CAS, iteration counting). If it does, change it with tests in `agent-gate.test.js` and `loop-prevention.test.js`
- [x] 2.6 Update `template/integrations/github/README.md`: design-driven setup (default branch, production ruleset, design source branch allow-list, App token, merge-commit recommendation), how the two new workflows interact with `agent-run`, the "wait for the agent" note, and the mirror-repository variant
- [x] 2.7 Update `template/integrations/README.md` to list the new workflows

## 3. Template versioning and example

- [x] 3.1 Bump `template/.bootstrap-version` (next minor, coordinated with 0.1)
- [x] 3.2 Run the bootstrap `--update --dry-run` on a copy of a 1.1.0 project and confirm the new files are reported as Created and edited untouched files as Updated
- [x] 3.3 Mirror every template change into `examples/multi-repo-example/ai-development/` (including `.bootstrap-version` and `.bootstrap-manifest`)

## 4. Documentation

- [x] 4.1 Add the design-driven flow to the *Autonomous development* section of `README.md` (diagram: builder → design source branch → design PR → agent → production → back-sync), tools named only as examples
- [x] 4.2 Add an *Upgrading to* note for the new version in `README.md` (what `--update` adds, and that adoption is opt-in per repository)

## 5. Verification

- [x] 5.1 Run all integration tests (`node --test` in `template/integrations/github/scripts/`) and confirm the example copies pass too
- [x] 5.2 Check the new protocol text against both specs: every requirement is stated somewhere in `template/`
- [x] 5.3 Search `template/protocol/` for tool names and confirm each appears only as an example
- [x] 5.4 Run `openspec validate add-design-driven-implementation --strict`
