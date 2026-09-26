## Why

Screens designed in the design tool (Stitch is the example) will no longer go through an AI app builder (Google AI Studio). The agent reads the design through the tool's MCP server and implements it directly. The builder path, with its design source branch, workflows, extraction table and preservation check, is no longer used. It only adds text every agent must read and a path choice that costs a question. Also, the direct path's export rules assume a human exports and commits, which adds friction when the whole flow runs in one agent session.

## What Changes

- **BREAKING** Remove the builder path from the protocol: path choice, design comparison, inventions, generated documentation, start scan and extraction table, builder-specific definition of done, design source branch and preservation check (`protocol/DESIGN-DRIVEN.md`).
- **BREAKING** Remove the builder GitHub integration: `design-pr.yml.example`, `design-back-sync.yml.example`, `scripts/design-branch.js` and its tests, the *Design-driven repositories* section, the AI Studio observations and the `DESIGN_SOURCE_BRANCH` / `PRODUCTION_BRANCH` / design `AGENT_APP_ID` variables (`integrations/github/`).
- **BREAKING** Remove `SECURITY.md` §8 (design source branch) and the builder half of rule 7 in `AI.md`.
- Keep the rules that the direct path still needs and move them into the direct path or a common section: fake boundaries detected by behavior (including the four additional signals), presentation is the human's contract, content belongs to the human, new repositories are a human decision, reading the design by behavior, and the export format.
- The agent **only reads** the design tool: it never creates, generates, edits or deletes screens or design systems there. The design stays human input and remains the contract.
- A request to implement named screens of a design project **counts as the export request**: an interactive session exports those screens through the tool's access into `design/<tool>/` without a separate request. Without a named design, it still does not export on its own.
- The agent **commits the export** as its own commit on the change branch, before the implementation commits. It **pushes only when the human asks**.
- Unchanged: automated runs never call the design tool and never write under `design/`; the design tool key is a Level 3 secret; the requirements table, states added, no inventions, design gaps and direct-path definition of done.
- Version **2.0.0**. The README upgrade note tells builder-path users to stay on 1.5.x. `--update` does not delete files from existing projects: the upgrade note lists the builder files for manual removal.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `design-direct-implementation`: the direct path becomes the only path (no path choice, no builder alternative). It takes over the fake-boundary, presentation, content and new-repository rules it depends on.
- `design-reference`: the export is triggered by an implementation request that names the design, committed by the agent and pushed on request. The agent only reads the design tool. The builder comparison, inventions, generated documentation and empty-extraction-table requirements are removed.
- `design-driven-implementation`: builder-only requirements are removed (extraction table, mode from workspace map, parallel backend, builder definition of done). The shared ones move to `design-direct-implementation`. The capability is then empty and retired.
- `design-source-branch`: all requirements are removed and the capability is retired.

## Impact

- `template/protocol/DESIGN-DRIVEN.md` (large reduction), `template/protocol/SECURITY.md`, `template/protocol/LOOP-PREVENTION.md` (design-tool row reworded), `template/protocol/CLASSIFICATION.md` and `DECISION-POLICY.md` (references to the extraction table and builder path), `template/AI.md`, `template/WORKFLOW.md`, `template/openspec/changes/_template/proposal.md`.
- `template/integrations/github/`: two workflow examples and `design-branch.js` (+ tests) deleted, README reduced.
- `bootstrap/bootstrap.sh`, `bootstrap/bootstrap.ps1`: framework file list and version.
- `README.md`, `examples/multi-repo-example/ai-development/` (mirrored protocol files).
- `openspec/specs/`: `design-source-branch` and `design-driven-implementation` retired, `design-reference` and `design-direct-implementation` updated.
- Builds on 1.5.0 (`add-default-stack`, already applied). `STACK.md` references no design rule, so there is no conflict. A *new* repository for a `missing` row still needs the human's decision, and then follows `STACK.md`.
