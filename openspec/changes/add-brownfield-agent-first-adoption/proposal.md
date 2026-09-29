## Why

2.2.0 made products Agent-First, but its guidance reads as if every product started from zero. Many workspaces that receive the bootstrap already have code, APIs and business rules (brownfield). Without explicit guidance, a Development Agent can over-apply Agent-First there: deep-scan repositories during initialization, infer readiness from the mere existence of endpoints, or turn a small feature into a refactor of a whole domain. The bootstrap must work equally well for new products (**Agent-First by design**) and existing ones (**Agent-First by evolution**), converging gradually instead of rewriting.

## What Changes

- `AI-FIRST.md` (framework-managed):
  - principle 8: *Greenfield: Agent-First by design. Brownfield: Agent-First by evolution.*
  - new `## Agent readiness`: levels `AGENT_READY`, `PARTIALLY_AGENT_READY`, `NOT_AGENT_READY`, `UNKNOWN`; evidence-based classification (an endpoint alone proves nothing; `UNKNOWN` preferred to excessive exploration); classify only where it adds value; equivalence of the 2.2.0 status values; readiness gaps as architectural debt (conceptual categories; never auto-created changes, issues or backlog); no score, percentage or dashboard.
  - agentic impact analysis: for an existing capability, current and target readiness, relevant gaps, improvements in scope, gaps left out.
  - new `## Greenfield and brownfield`: greenfield rules not weakened (also for new capabilities in existing products); brownfield as a direction, coexistence of legacy and Agent-Ready capabilities, explicit list of big-bang actions never taken; DISCOVER → DOCUMENT → TOUCH → IMPROVE → VALIDATE; `### Touched capability rule` with its flow and the `cancel_subscription` example; `### Knowledge in a brownfield product`; `### Framework update is not product migration`.
  - *Adopting in an existing project*: optional `Adoption mode` line in the skeleton; `ARCHITECTURE.md` shows the current state, *Target direction* only when useful.
- `CAPABILITIES.md` (project-managed): Status uses the readiness levels (plus `planned`); progressive catalog and incremental readiness map, not an inventory; per-domain readiness table optional; contract details accept the `Agent Readiness` / `Evidence` / `Gaps` keys alone.
- `AI.md`: Phase 2 applies the touched capability rule without widening the impact set; Phase 5 and 7 wording; the Project Initialization Protocol recognizes brownfield (a map, not an audit; sources to start from; what not to read), readiness only from evidence, `Adoption mode`, report counts per level.
- `WORKFLOW.md`: greenfield/brownfield paragraph with the existing-capability flow and the framework/product distinction.
- `openspec/changes/_template/proposal.md`: optional brownfield lines in `## Agentic Impact`. `tasks.md` and `openspec/README.md`: one line each.
- `PROJECT.md` template: `Adoption mode`. `ARCHITECTURE.md` template: draw the architecture as it exists.
- `bootstrap/UPDATE-INSTRUCTIONS.md`: finishing an update never touches product code.
- README: *Greenfield and brownfield* subsection, initialization note, "Upgrading to 2.3.0".

Version: **2.2.0 → 2.3.0** (minor, new capability). **Not breaking.**

### Files under template/

| File | Change | Management |
|---|---|---|
| `AI-FIRST.md` | changed | framework-managed |
| `AI.md` | changed | framework-managed |
| `WORKFLOW.md` | changed | framework-managed |
| `openspec/README.md` | changed | framework-managed |
| `openspec/changes/_template/proposal.md` | changed | framework-managed |
| `openspec/changes/_template/tasks.md` | changed | framework-managed |
| `CAPABILITIES.md` | changed | project-managed |
| `PROJECT.md` | changed | project-managed |
| `ARCHITECTURE.md` | changed | project-managed |
| `.bootstrap-version` | 2.3.0 | version |

No file added or removed. Adapters, protocols and integration scripts are unchanged.

### Existing projects on `--update`

- Framework files above are refreshed if untouched; customized ones are kept when the template did not change them, otherwise merged by the Development Agent through `.bootstrap-update/` (2.2.0 mechanism, unchanged).
- `CAPABILITIES.md`, `PROJECT.md`, `ARCHITECTURE.md`, open changes, ADRs and domain docs are never modified. No new `MIGRATION REQUIRED`: `Adoption mode` is optional, and old status values remain valid through the equivalence in `AI-FIRST.md`.
- No product code, API, database or infrastructure is modified; no change or task is created. Nothing to delete.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `agent-first-architecture`: brownfield adoption, Agent Readiness, touched capability rule, scope boundaries in agentic impact, brownfield initialization, framework update vs product migration.

## Non-goals

- No agent-readiness service, database, dashboard, CLI, scanner, static analyzer, migration engine or score.
- No new template file; no new `MIGRATION REQUIRED` check; no script behavior change.
- No automatic changes, tasks, issues or backlog for readiness gaps; no automatic RAG, embeddings or vector database.
- No change to the 2.2.0 primitives, autonomy levels or update mechanism.

## Impact

- The `template/` files above, `bootstrap/UPDATE-INSTRUCTIONS.md`, `README.md`, `examples/multi-repo-example/` (mirrored framework files; catalog status values and `Adoption mode`).
