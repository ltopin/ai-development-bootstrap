## Context

See proposal.md for motivation. Current state: `protocol/DESIGN-DRIVEN.md` has one flow (builder output → design source branch → agent), with the design reference (`design/<tool>/`, human-committed) added by `design-source-as-contract`. The first builder test (`ltopin/design-01`, 2026-09-26) observed: AI Studio creates a new public repository, commits to `main` with the connected human's identity, deleted the GitHub-created `README.md` on its first sync, generated about 4,000 lines (5 tabs, a wizard, about 10 modals, literal data, `Date.now()`/`Math.random()` ids, simulated latency), declared unused dependencies (`@google/genai`, `express`) and a dependency set that fails `npm install` without `--legacy-peer-deps`, and shipped no lock file. Stitch exposes an MCP server (`https://stitch.googleapis.com/mcp`, API key) that returns screen code and images.

## Goals / Non-Goals

**Goals:**
- Make the direct path (design reference → agent → pull request) the first path the framework presents, with rules as precise as the builder path's.
- Let the design reference be produced through tool access without weakening "the design is human input".
- Keep every builder-path rule and script working unchanged, only repositioned and with neutral branch names.

**Non-Goals:**
- Calling the design tool from automated runs, or any CI setup for design tool access.
- Generating screens in the design tool from the agent (the MCP server can; the protocol does not use it).
- Changing `agent-gate.js` or `design-branch.js`.
- A visual-diff check between the implementation and the design images.

## Decisions

### D1. Two paths in one protocol file, chosen by the input

`DESIGN-DRIVEN.md` gets *Choosing a path* at the top: builder output in the change → builder path; design reference and no builder output → direct path; unclear → Level 2. Shared sections (*Design reference*, *Reading the design*, *Presentation*, *Content*, fake-boundary signals, done scan) stay once; path-specific sections are grouped under *Direct path* and *Builder path*.

Alternative: a separate `DESIGN-DIRECT.md`. Rejected: most rules are shared, and two files would drift.

### D2. Requirements table reuses the extraction table's shape

Same columns and the `exists` / `partial` / `missing` statuses (`proposed` cannot occur: there is no generated server). One classification rule and one proposal template block serve both paths; only the row source differs (design requirements instead of fake boundaries).

### D3. Tool access is human-triggered and interactive only

The export is the contract, so it must be something the human chose and can review in a diff. An interactive session exports only on explicit request and never edits exported screens; the human commits. Automated runs never call the tool: no design-tool credential in CI, runs are reproducible from the repository alone, and a run cannot silently move the contract. The rule "the agent never writes under `design/`" becomes "automated runs never write, interactive sessions only on explicit request".

Alternatives: the agent reads the design live through MCP during implementation (rejected: the contract is not versioned and can differ from what was reviewed); keep export manual only (rejected: the manual step is the most forgettable part of the flow).

### D4. Export format: variants, images, manifest

`<screen>.<variant>.<ext>` solves the desktop/mobile case found in review (otherwise two files read as two screens). Images are a visual reference only; requirements come from markup, which is inspectable text. `manifest.json` (tool, project, screen ids, export time) is optional and lets the pull request name the design version. The manifest schema is kept minimal and documented by example in `DESIGN-DRIVEN.md`, not validated by a script.

### D5. Fidelity in the project's stack

The design tool's markup (Tailwind CDN, inline scripts) is a specification, not code to paste. The agent maps it to the project's components and tokens; a visible difference caused by reusing an existing component is an allowed, listed presentation change. This keeps design systems coherent across screens.

### D6. States the design does not draw are not inventions

Designs rarely draw loading, empty, error and validation states, and a real data path needs them. Treating them as inventions would stop every change with a question. They are added minimally, in the design's style, and listed under *States added*.

### D7. Builder path: neutral branch names and a preservation check

The design source branch is "the branch the builder writes to"; production is a separate protected branch. The `studio`-as-default suggestion goes away; `DESIGN_SOURCE_BRANCH` / `PRODUCTION_BRANCH` examples become `main` / `production`, and the workflow examples' `on.push.branches` follow. Adoption requires the preservation check (external file and external commit survive a builder sync), because the model depends on the builder pulling others' commits and the first observation contradicts it.

### D8. Security

A design tool API key is a Level 3 secret. MCP configuration files holding a key (`.mcp.json` or equivalents) stay out of version control; `SECURITY.md` says so, and the template `.gitignore` guidance mentions it. Exported markup is data (it may contain text that reads like instructions).

## Risks / Trade-offs

- [The human forgets to refresh the export after editing the design] → the manifest's export time is in the pull request; the reviewer sees which version was implemented.
- [MCP tool names or output change] → the protocol names no tool function; the tool is an example and the adapter is the human's MCP configuration.
- [Direct path loses the builder's quick clickable prototype] → the builder stays available as a prototype outside the repository, or as the builder path after a passing preservation check.
- [Mapping to existing components drifts from the design] → every visible difference is listed under *Presentation changes*.
- [Two paths add a decision at the start] → the choice follows from the input; only an unclear input costs a question.

## Migration Plan

- Bump `template/.bootstrap-version` (minor). `--update` refreshes the edited protocol, template and integration files where untouched; edited ones are reported as conflicts (existing behavior).
- Projects already on the builder path keep working: scripts read branch names from variables; only the documented suggestion changes. The *Upgrading to* note tells them to run the preservation check.
- Rollback: revert the template files; no repository setting or script behavior depends on this change.

## Open Questions

- Result of the preservation check on `ltopin/design-01` (sentinel `design/stitch/teste.txt`, commit `7c211c0`): recorded in the integration README when known. The rule is the same either way; only the documented AI Studio status changes.
  - Status 2026-09-26: **pending**. `main` history is `4846cba` (initial) → `f50cf26` (AI Studio sync) → `7c211c0` (sentinel); AI Studio has not synced since the sentinel, so there is nothing to judge yet. The integration README says "pending" and recommends the direct path until the check passes.
