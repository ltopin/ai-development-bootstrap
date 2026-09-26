## Why

The first real test of the builder path (Stitch design → Google AI Studio → repository) showed that almost all of its cost comes from the builder, not from the design: AI Studio creates its own repository, always writes to `main`, deleted a file it had not created on its first sync, pinned dependencies that do not install, and generated screens, modals and dependencies nobody designed. Meanwhile the design tool can now be read directly by the agent (Stitch exposes an MCP server), so the agent can implement from the design itself and skip the lossy, inventing translation. The framework presents the builder path as *the* design-driven flow; it should present the direct path first and keep the builder path as an option.

## What Changes

- **Direct path (new, recommended).** The agent implements from the design reference, with no generated app in between: it reads the design by behavior (requirement, display, required flow, design gap, as today), builds a **requirements table** (same columns and statuses as the extraction table) to classify the change, and implements it in the project's stack with real data from the start. The done scan still runs on the agent's own code.
- **States the design does not draw.** Loading, empty, error and validation states that the design omits are added minimally, in the design's style, and listed under *States added* in the pull request. They are not inventions and never a reason to stop.
- **Design export through tool access.** An interactive session MAY create or refresh `design/<tool>/` through the design tool's API or MCP server, **only at the human's explicit request**; the human reviews and commits it. Automated runs never call the design tool and never write under `design/`. **BREAKING** for the rule "the agent never creates, edits or deletes anything under `design/`", which now applies to automated runs and to interactive sessions without that request.
- **Export format.** One file per screen as today, plus: variants of one screen as `<screen>.<variant>.<ext>` (for example `home.desktop.html`, `home.mobile.html`), optional images next to the markup (`<screen>[.<variant>].png`), and a `manifest.json` recording the tool, project, screen ids and export time, so the pull request can say which version of the design it implements.
- **Builder path becomes optional.** `DESIGN-DRIVEN.md`, `WORKFLOW.md` and the READMEs present the direct path first; the builder path (generated app, inventions, design source branch, back-sync) stays, unchanged in its rules, as the path for when a builder must write to the repository.
- **Design source branch naming.** The design source branch is whichever branch the builder writes to (AI Studio: `main` of the repository it creates); production is a separate protected branch (for example `production`). Changing the default branch is no longer the suggested setup. **BREAKING** for the suggestion "`studio` as the default branch" (the scripts already take both names from variables).
- **Preservation check before adopting the builder path.** A repository adopts the design source branch model only after verifying that a builder sync keeps files the builder did not create and pulls commits made by others. Observed AI Studio behavior (creates the repository, writes to `main`, deleted a file on first sync) is documented as the reason.
- **Design tool credentials.** A design tool API key is a Level 3 secret: never committed (MCP configuration with a key stays out of version control), never passed to automated runs.
- **Housekeeping.** Remove the committed `openspec/changes/archive/.openspec-archive.lock` and ignore it.

## Capabilities

### New Capabilities
- `design-direct-implementation`: implementing a change directly from the design reference without a generated app: when the direct path applies, the requirements table and class, fidelity in the project's stack, states the design does not draw, no inventions by the agent, done scan on the agent's own code, pull request content.

### Modified Capabilities
- `design-reference`: who may write `design/<tool>/` (interactive export on explicit request; never automated runs), export format (variants, images, manifest), and that the design reference is read on the change's branch in both paths, not only on a design source branch.
- `design-source-branch`: the design source branch is the branch the builder writes to, production is a separate branch, no default-branch change is required, and adoption requires a preservation check.

## Impact

- `template/protocol/DESIGN-DRIVEN.md`: restructured into *Choosing a path*, *Direct path* (new) and *Builder path* (existing sections); *Design reference* gains tool access, variants, images and manifest; design source branch wording generalized.
- `template/protocol/SECURITY.md`: design tool key as Level 3; export content is data.
- `template/protocol/CLASSIFICATION.md`: the requirements table as evidence on the direct path.
- `template/openspec/changes/_template/proposal.md`: requirements table and *States added* in the design block.
- `template/AI.md`, `template/WORKFLOW.md`: one line each for the direct path.
- `template/integrations/github/README.md`: branch naming, preservation check, observed AI Studio behavior; workflow example comments use neutral branch names.
- `README.md`: design-driven flow leads with the direct path; *Upgrading to* note.
- `.gitignore`, removal of `openspec/changes/archive/.openspec-archive.lock`.
- `template/.bootstrap-version`, `examples/multi-repo-example/` mirror.
- No change to `agent-gate.js` or `design-branch.js`.
