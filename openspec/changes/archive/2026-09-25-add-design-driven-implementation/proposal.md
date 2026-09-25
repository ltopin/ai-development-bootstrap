## Why

The autonomous protocol (1.1.0) can drive an external change to a pull request, but it assumes the external change is a small, human-written intent. The workflow we want to support is different: a human designs in a design tool (Stitch is one example), turns it into a working app with an AI app builder (Google AI Studio is one example), and that builder commits the result. That result is a real, runnable app whose data layer is **fake**: hardcoded data, browser storage used as a database, simulated latency, keys used in the client, sometimes a server that returns fixed data. The agent's job is to make it work for real: integrate with the existing backend, extend it, or build a new one, and stop at a pull request.

Two findings make this necessary now instead of "just another external change":

- The builder commits only to the repository's **default branch** and syncs both ways. Without a branch model, generated code lands on the production branch with no gate, and the agent's work is never pulled back into the builder.
- The builder generates **full-stack** code (a client plus its own server). "Frontend in, backend out" is wrong: the input may already include a server that duplicates or contradicts the real backend.

## What Changes

- New protocol, `protocol/DESIGN-DRIVEN.md`: how an agent implements an app produced by a design/app-builder tool.
  - The presentation (layout, styling, visible behavior) is the human's contract; the agent changes it only when technically required, and records why.
  - The agent finds **fake boundaries** by behavior, not by folder convention (no mock layer is assumed), on the client and on any generated server.
  - It produces an **extraction table** (fake element → needed contract → exists / partial / missing) that is the evidence for classification and goes into the PR.
  - Two modes: **new project** (the generated app is the frontend; its server may seed the backend) and **existing project** (the generated code must fit the existing frontend and backend; a generated server next to a real backend is a **parallel backend** and is never left silently).
  - Definition of done: no fake boundary remains, every client call has a real contract, backend implemented with persistence/migrations and tests, CI green. Infrastructure and deploy are out of scope.
- `protocol/CLASSIFICATION.md`: classification also covers server code arriving with the change; a generated endpoint is a *proposed* contract, not an existing one. "Parallel backend" is a signal that requires a Level 2 decision.
- Branch model for builder-driven repositories: the **design source branch** (suggested name `studio`) is the repository's default branch and the only branch the builder writes; the production branch is protected; the agent's work reaches production only through a pull request; after merge, production flows back to the design source branch so the builder pulls the integrated code.
- `protocol/SECURITY.md`: a push to the design source branch starts an agent with credentials, so who may push there is a trust decision (branch protection), independent of commit author identity.
- GitHub integration: an example workflow that turns a push on the design source branch into a pull request the existing gate already handles, and an example back-sync after merge. The existing gate, ledger, trailers and question/answer flow are reused, not replaced.
- `AI.md`: a short pointer to the new protocol from *Autonomy and human decisions*. Bump `template/.bootstrap-version` (framework files change).

Tools are named only as examples. Nothing in the protocol depends on Stitch, AI Studio, Claude or GitHub.

## Capabilities

### New Capabilities
- `design-driven-implementation`: how the agent turns a builder-generated app into a working, integrated change: presentation as contract, fake-boundary detection, extraction table, new vs existing project modes, parallel backend handling, definition of done.
- `design-source-branch`: the branch model and trigger for builder-driven repositories: design source branch as default, protected production branch, promotion to a pull request, back-sync after merge, and who may trigger.

### Modified Capabilities
<!-- None: openspec/specs/ has no baseline yet. Classification and security changes are captured as requirements of the new capabilities. -->

## Impact

- `template/protocol/`: new `DESIGN-DRIVEN.md`; edits to `CLASSIFICATION.md`, `SECURITY.md`.
- `template/AI.md`, `template/WORKFLOW.md`: pointers.
- `template/integrations/github/`: new workflow example(s) and README section; possibly small additions to `agent-gate.js` and its tests if promotion needs gate support.
- `template/.bootstrap-version`, manifest handling (framework files added/changed; `--update` picks them up).
- `examples/multi-repo-example/`: mirror of the template changes.
- `README.md`: the design-driven flow in the *Autonomous development* section.
- Installed projects: opt-in. Nothing triggers until a repository adopts the branch model and copies the workflows.
