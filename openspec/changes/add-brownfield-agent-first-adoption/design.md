## Context

2.2.0 introduced `AI-FIRST.md` (framework-managed) and `CAPABILITIES.md` (project-managed) with statuses `agent-ready | partial | ui-only | planned | needs validation`. This change adds brownfield adoption without restructuring that work.

## Decisions

1. **No new file.** Everything fits existing files: rules in `AI-FIRST.md` (single source for agentic rules; reaches existing projects on update), the map in `CAPABILITIES.md`, in-flow pointers in `AI.md`, `WORKFLOW.md` and the change template. Alternative rejected: `AGENT-READINESS.md` — a second catalog would drift from `CAPABILITIES.md`.
2. **Readiness levels become the status vocabulary, with an equivalence.** The four requested levels are the Status values (`planned` kept for capabilities not built yet). Existing catalogs are project-managed and never rewritten, so `AI-FIRST.md#agent-readiness` states the 1:1 reading of the old values (`agent-ready` → `AGENT_READY`, `partial` → `PARTIALLY_AGENT_READY`, `ui-only` → `NOT_AGENT_READY`, `needs validation` → `UNKNOWN`). Alternative rejected: keeping two parallel vocabularies.
3. **Greenfield vs brownfield is applied per capability.** New capabilities are Agent-First by design even in brownfield products; existing ones by evolution. `Adoption mode` in `PROJECT.md` is therefore informational and optional: no `MIGRATION REQUIRED`, and agents apply the rules without it. This keeps greenfield behavior intact.
4. **The scope boundary lives in `## Agentic Impact`.** Five optional lines (current, target, relevant gaps, included, left out), only when an existing capability is touched. Widening scope beyond the request is a question for the human, not a Level 1 choice.
5. **Framework update ≠ product migration**, stated in `AI-FIRST.md`, `WORKFLOW.md`, `bootstrap/UPDATE-INSTRUCTIONS.md` and README. The scripts already never touch product code; no script change.

## Anchors

New in `AI-FIRST.md`: `#agent-readiness` (AI.md, CAPABILITIES.md), `#greenfield-and-brownfield` (principle 8, AI.md, WORKFLOW.md, README, PROJECT.md comment), `#touched-capability-rule` (AI.md, openspec README, proposal template, agentic impact analysis), `#framework-update-is-not-product-migration` (WORKFLOW.md). Existing anchors are unchanged.

## Risks / Trade-offs

- Catalogs of existing projects keep the old status words → equivalence documented; no rewrite needed.
- Agents may still over-classify → "classify only when it adds value", `UNKNOWN` as a valid state, no score.
- Customized `AI.md` / `WORKFLOW.md` in a project → merged by the agent through the 2.2.0 mechanism.
