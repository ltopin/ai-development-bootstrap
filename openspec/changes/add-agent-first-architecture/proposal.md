## Why

The bootstrap governs how **Development Agents** (Claude, Codex, Gemini, …) build a product, but says nothing about how the product itself must be built so that **Product Agents** (sales, support, activation, billing, operations agents running in production) can operate it. Without guidance, features are routinely built with business logic only in the frontend, no programmatic way to query state or execute actions, no policy for autonomous actions and no audit of who (or what) acted. Retrofitting that later is expensive. Products started from this bootstrap should be **Agent-Ready from the first commit**, even before any Product Agent exists, without the bootstrap choosing an agent runtime, protocol or provider.

## What Changes

- New framework-managed `AI-FIRST.md`: the product's Agent-First constitution. Agent-Ready capabilities; the five primitives QUERY, KNOWLEDGE, COMMAND, EVENT, POLICY; channel-independent domain (UI, external channels and Product Agents are consumers of the same application layer); security; autonomy levels (`AUTO`, `AUTO_WITH_LIMITS`, `REQUIRES_CONFIRMATION`, `REQUIRES_APPROVAL`, `HUMAN_ONLY`) and progressive autonomy; auditability and observability; knowledge governance; RAG as an optional strategy; Agentic Impact analysis; Agent-Ready definition of done; the Development Agents vs Product Agents distinction; section skeletons for adopting it in an existing project.
- New project-managed `CAPABILITIES.md`: product-level catalog of capabilities per domain (one table per domain, stable names, optional contract details), readable section by section, shaped so a future machine-readable manifest can be derived from it.
- `AI.md`: L1 reading of `CAPABILITIES.md` (relevant domain only) and `AI-FIRST.md`; Phase 2 impact chain extended with capability and agentic impact; Project Initialization Protocol discovers capabilities, knowledge sources and agent surface from cheap evidence and assesses agent readiness; Phase 6/7 point to the Agent-Ready definition of done and `CAPABILITIES.md`; handling of projects whose L0 files lack the new sections.
- `WORKFLOW.md`: flow gains CAPABILITY ANALYSIS and AGENTIC IMPACT (implicit for small changes); versioning paragraph lists the new files.
- `openspec/changes/_template/proposal.md`: new `## Agentic Impact` section (`NOT APPLICABLE` for purely technical changes). `tasks.md`: update `CAPABILITIES.md` in documentation. `openspec/README.md`: one rule.
- `protocol/CLASSIFICATION.md`: business rules only in the frontend are never class A.
- `PROJECT.md` template: `## Agentic Strategy` and optional `## Product Agents`. `ARCHITECTURE.md` template: `## Agent surface`.
- Bootstrap scripts: `CAPABILITIES.md` is project-managed; `--update` reports **MIGRATION REQUIRED** (non-blocking, read-only) when an existing `PROJECT.md` / `ARCHITECTURE.md` lacks the new sections.
- **Agent-completed updates (no manual merge).** `--update` changes so that the human never merges by hand:
  - line endings are ignored when comparing and hashing (a Windows checkout with CRLF no longer produces false conflicts); old manifests keep working;
  - the manifest keeps the delivered hash of customized framework files, so a customized file whose template did not change is **kept** silently instead of being a conflict forever;
  - a real conflict (customized **and** changed upstream) and every pending migration are written to `ai-development/.bootstrap-update/` (new template version, the base version when it can be recovered read-only from the bootstrap repository's history, `PENDING.md`, and `INSTRUCTIONS.md` from the new `bootstrap/UPDATE-INSTRUCTIONS.md`); the script prints one prompt for the Development Agent, which merges, adds the missing sections and re-runs the update;
  - the re-run recognizes a merged file (changed since the conflict was recorded, merged against the same template version), records it as based on the current template, advances the version and deletes `.bootstrap-update/` when nothing is pending.
- README: the framework's two responsibilities (AI-Assisted Development, AI-First Product Architecture), file tables, "Upgrading to 2.2.0".

Version: **2.1.0 → 2.2.0** (minor, new capability). **Not breaking.**

### Files under template/

| File | Change | Management |
|---|---|---|
| `AI-FIRST.md` | added | framework-managed |
| `CAPABILITIES.md` | added | project-managed |
| `AI.md` | changed | framework-managed |
| `WORKFLOW.md` | changed | framework-managed |
| `openspec/README.md` | changed | framework-managed |
| `openspec/changes/_template/proposal.md` | changed | framework-managed |
| `openspec/changes/_template/tasks.md` | changed | framework-managed |
| `protocol/CLASSIFICATION.md` | changed | framework-managed |
| `PROJECT.md` | changed | project-managed |
| `ARCHITECTURE.md` | changed | project-managed |
| `.bootstrap-version` | 2.2.0 | version |

Adapters (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) are unchanged.

### Existing projects on `--update`

- `AI-FIRST.md` created; `CAPABILITIES.md` created (absent before), never modified afterwards.
- Framework files above refreshed if untouched since install; reported as conflicts if customized (version does not advance until resolved, as today).
- `PROJECT.md` and `ARCHITECTURE.md` are never modified by the script. When they lack `## Agentic Strategy` / `## Agent surface`, the update prints **MIGRATION REQUIRED** and records it in `.bootstrap-update/`; the Development Agent adds the sections from `AI-FIRST.md#adopting-in-an-existing-project`. It does not block the version.
- Customized framework files: kept silently when the template did not change them; otherwise merged by the Development Agent through `.bootstrap-update/` (the version advances once the merge is recognized). `--force` still takes the template version.
- Nothing to delete or merge by hand.

## Capabilities

### New Capabilities
- `agent-first-architecture`: how the layer makes products Agent-Ready: the Agent-First constitution, the capability catalog, agentic impact in analysis, initialization, changes and definition of done, and how existing projects adopt it.

### Modified Capabilities
<!-- none: change-lifecycle, default-stack and design specs are unaffected -->

## Non-goals

- No agent runtime, MCP server, tool registry, capability registry service, LLM provider, prompt engine, agent memory, chatbot or channel integration (WhatsApp, voice…).
- No vector database, embeddings, chunking or RAG pipeline; RAG is documented as optional.
- No mandatory API gateway, agent gateway or message broker.
- No `capabilities.yaml` (only a catalog format that does not prevent one later).
- No Product Agents and no product capabilities in the templates (the example product only).
- No new CLI, daemon or service; no change to adapters.

## Impact

- `template/` files listed above; `bootstrap/bootstrap.sh`, `bootstrap/bootstrap.ps1`, new `bootstrap/UPDATE-INSTRUCTIONS.md` (not installed; copied into `.bootstrap-update/` only while an update is pending); `README.md`; `examples/multi-repo-example/`.
- The installer may run read-only `git log` / `git show` against the **bootstrap repository itself** to recover base versions; it still never runs git in the target workspace.
