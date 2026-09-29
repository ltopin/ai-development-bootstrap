## Context

The layer is Markdown read by Development Agents plus two installers. Everything that has to reach existing projects must go through framework-managed files; project-managed files are only created when absent. The request is to make every product built with the bootstrap Agent-Ready, conceptually and without technology choices.

## Goals / Non-Goals

**Goals:** one place for the Agent-First principles; a cheap, product-level catalog of capabilities that reduces code exploration; agentic impact built into analysis, changes and done; safe adoption by existing projects.

**Non-Goals:** see proposal. No runtime, no RAG, no manifest file, no new tooling.

## Decisions

1. **Two new files only.** `AI-FIRST.md` (principles, framework-managed, so every project receives improvements) and `CAPABILITIES.md` (the product's catalog, project-managed). Everything else reuses existing files. Alternative rejected: a `protocol/AGENT-FIRST.md` — the protocol folder governs Development Agents' autonomy; mixing product architecture there blurs the Development/Product Agent distinction the request requires.

2. **AI-FIRST.md is the single source for agentic rules.** `AI.md`, `WORKFLOW.md`, the change template and `CLASSIFICATION.md` hold one-line pointers plus the minimum an agent must see in-flow (the impact chain, the section names). The 12 agentic impact questions and the definition of done live only in `AI-FIRST.md`. Adapters stay unchanged: they point to `AI.md`, which points to `AI-FIRST.md` for product, capability, architecture, feature, integration, automation and Product Agent work.

3. **Two autonomy vocabularies, kept apart.** Development Agents keep Level 1/2/3 (`DECISION-POLICY.md`). Product Agents use `AUTO` … `HUMAN_ONLY`. `AI-FIRST.md` states that they are unrelated and must not be mapped onto each other.

4. **Catalog format: one table per domain.** Columns `Name | Type | Purpose | Owner | Autonomy | Status`, names in `snake_case` (queries, knowledge, commands) and `domain.past_tense` for events, types `query | knowledge | command | event`, autonomy from the five levels (commands only), status `agent-ready | partial | ui-only | planned | needs validation`. Policy is the Autonomy column plus optional `Policy notes` lines (limits, confirmation rules). Contract details are an optional `### <name>` block with a fixed key list. Every row maps 1:1 to a future `capabilities.yaml` entry (domain → type list → name; autonomy → policies), without writing that file now. Alternative rejected: free-form bullet lists per type (harder to keep regular and to parse later).

5. **CAPABILITIES.md is L1 and read by section.** `PROJECT.md` *Main capabilities* stays the L0 one-line summary and links to the catalog. Agents open only the section of the domain involved; the catalog tells them the owner repository, so it narrows repository selection before any code is read.

6. **Initialization stays cheap.** Capabilities come from evidence already opened for the map (READMEs, API description files such as OpenAPI, domain docs, route/feature folder names); endpoints are never listed one by one as capabilities. Knowledge sources are recorded as *candidates* (e.g. `docs/faq/`) and marked `needs validation` for Product Agent use. Agent surface = existing programmatic entry points (public API, webhooks, bots, schedulers, integrations). Readiness is one short assessment per domain. New projects get an almost empty catalog.

7. **Missing sections in existing L0 files are non-blocking.** Scripts cannot edit project-managed files. `--update` greps `PROJECT.md` for `## Agentic Strategy` and `ARCHITECTURE.md` for `## Agent surface` and prints `MIGRATION REQUIRED` and hands the step to the Development Agent (decision 9); the version still advances when there are no conflicts, because the framework works without those sections (agents treat them as "not defined yet" and, when a task needs them, propose adding them from the skeletons in `AI-FIRST.md`). Alternative rejected: holding the version back — it would pin projects that deliberately postpone Agent-First adoption, and conflicts are reserved for framework files.

8. **Agent-First default for new products.** The `PROJECT.md` template says `Agent-First: YES` (the premise of the bootstrap). It is a target posture for how new capabilities are built, not a claim about current readiness; readiness is recorded in `CAPABILITIES.md` from evidence. Setting it to `NO` is a Level 2 decision recorded in `DECISIONS.md`.

9. **The Development Agent finishes updates; the human never merges by hand.** Three causes of conflicts, three treatments:
   - *Line endings.* Compare and hash with `\r` removed. A manifest hash matches when it equals either the normalized or the raw hash, so manifests written before this version keep working.
   - *Customized, template unchanged.* The manifest keeps the delivered hash of a customized file (instead of dropping it). If that hash equals the current template's, the file is reported as *kept* and does not block the version.
   - *Customized and changed upstream.* The script writes `ai-development/.bootstrap-update/`: `<file>.new` (template), `<file>.base` when a template blob with the manifest's hash is found in the bootstrap repository's own git history (read-only; skipped when git or history is unavailable), `conflicts` (the project file's hash when the conflict was recorded), `PENDING.md` and `INSTRUCTIONS.md` (copied from `bootstrap/UPDATE-INSTRUCTIONS.md`, one source for both scripts). The agent merges three-way (two-way without a base), keeping project customizations and reporting judgment calls; a customization that removes a framework rule becomes a Level 2 question. On the next `--update`, a file whose hash changed since the conflict and whose `.new` equals the current template is *merged*: the manifest records the current template's hash as its base, so future updates keep it silently until the template changes again.
   - Migrations are written to the same `PENDING.md`, so one prompt finishes everything. The directory is deleted by the first run with nothing pending.
   Alternatives rejected: storing a full copy of every delivered file in each project (heavier, duplicates the bootstrap's history); an automatic textual 3-way merge in the scripts (no portable `diff3` on Windows, and Markdown rules need judgment); editing project files from the script (forbidden).

## Anchors

New anchors in `AI-FIRST.md` linked from other files: `#agentic-impact-analysis` (AI.md Phase 2, WORKFLOW.md, proposal template), `#agent-ready-definition-of-done` (AI.md Phase 6, WORKFLOW.md), `#adopting-in-an-existing-project` (AI.md, scripts, README), `#autonomy-levels` (CAPABILITIES.md). Existing anchors in `AI.md` (`#project-initialization-protocol`) and `WORKFLOW.md` (`#when-is-a-formal-change-required`) are kept unchanged.

## Risks / Trade-offs

- Customized `AI.md`, `WORKFLOW.md` or change templates → the Development Agent merges them through `.bootstrap-update/` (decision 9); nothing is merged by hand. Residual risk: a merge without a recoverable base relies on the agent's judgment, reported for review.
- Bureaucracy creep → `NOT APPLICABLE` one-liner for technical changes; small changes do the analysis implicitly; contract details only when needed.
- Readers confusing Product Agent autonomy with Development Agent levels → explicit statement in `AI-FIRST.md`.
- Catalog drift from code → updated in Phase 7 in the same change that alters a capability; status `needs validation` when unsure.
