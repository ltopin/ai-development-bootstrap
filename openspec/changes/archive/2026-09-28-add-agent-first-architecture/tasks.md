## 1. Protocol

- [x] 1.1 Create `template/AI-FIRST.md` (framework-managed): principles, Agent-Ready capability, Q/K/C/E/P, layers and channels, security, autonomy levels, human-in-the-loop, auditability/observability, knowledge governance, RAG, agentic impact analysis, Agent-Ready definition of done, Development vs Product Agents, future manifest direction, adoption skeletons
- [x] 1.2 Create `template/CAPABILITIES.md` (project-managed): usage rules, per-domain table format, optional contract details, agent readiness, no product capabilities
- [x] 1.3 `template/AI.md`: pointer to AI-FIRST.md, L1 table, Phase 1/2/6/7, Project Initialization Protocol (steps, rules, outputs, validation, report), missing-section handling

## 2. Related files

- [x] 2.1 `template/WORKFLOW.md`: flow with capability analysis and agentic impact; versioning paragraph
- [x] 2.2 `template/openspec/changes/_template/proposal.md`: `## Agentic Impact`; `tasks.md`: update CAPABILITIES.md; `template/openspec/README.md`: one rule
- [x] 2.3 `template/protocol/CLASSIFICATION.md`: business rules only in the frontend are not class A
- [x] 2.4 `template/PROJECT.md`: `## Agentic Strategy`, optional `## Product Agents`, link from Main capabilities; `template/ARCHITECTURE.md`: `## Agent surface`

## 3. Scripts, README and version

- [x] 3.1 `bootstrap/bootstrap.sh` and `bootstrap/bootstrap.ps1`: `CAPABILITIES.md` project-managed, help text, `MIGRATION REQUIRED` notice (identical behavior)
- [x] 3.2 Bump `template/.bootstrap-version` to 2.2.0
- [x] 3.3 `README.md`: two responsibilities, file tables and tree, L1 table, "Upgrading to 2.2.0"

## 4. Example and verification

- [x] 4.1 `--update --dry-run` and `--update` on a copy of the example at 2.1.0: L0 files and open changes byte-identical, new files created, MIGRATION REQUIRED printed, version 2.2.0
- [x] 4.2 Mirror into `examples/multi-repo-example/` with `bootstrap.sh --update`; fill its `CAPABILITIES.md` (orders) and add the new sections to its `PROJECT.md` / `ARCHITECTURE.md` (task-authorized edit of project-managed files); re-run shows no migration notice
- [x] 4.3 Fresh bootstrap into temp folders with `bootstrap.sh` and `bootstrap.ps1`: same file set, AI-FIRST.md in manifest, CAPABILITIES.md not in manifest
- [x] 4.4 `bootstrap.ps1 -Update` on a copy at 2.1.0 gives the same report as `bootstrap.sh`
- [x] 4.5 Relative links in changed files resolve; grep for mandatory runtime technologies; `node --test` over integration scripts (unchanged, sanity)
- [x] 4.6 Walk a realistic case (subscription cancellation) and edge cases (technical change, new empty project, existing project with only endpoints) through the text
- [x] 4.7 `openspec validate add-agent-first-architecture --strict`

## 5. Agent-completed updates

- [x] 5.1 Both scripts: compare and hash with line endings normalized; accept normalized or raw hash from older manifests; install mode uses the same comparison
- [x] 5.2 Both scripts: manifest keeps the delivered hash of customized framework files; customized file with unchanged template reported as kept (non-blocking)
- [x] 5.3 `bootstrap/UPDATE-INSTRUCTIONS.md` (agent-facing); both scripts write `.bootstrap-update/` (`<file>.new`, `<file>.base` from read-only bootstrap history, `conflicts`, `PENDING.md`, `INSTRUCTIONS.md`), print the agent prompt, recognize merged files, delete the directory when nothing is pending
- [x] 5.4 README (update steps, notes, Upgrading to 2.2.0) and WORKFLOW.md (transient `.bootstrap-update/`) no longer ask for manual merges
- [x] 5.5 Tests, `.sh` and `.ps1` with identical results: CRLF copy without conflicts; customized file with unchanged template kept; real conflict → pending dir with `.new` and `.base`; unmerged re-run still conflicts; agent-style merge → re-run recognizes it, version advances, dir removed; migration only → dir with PENDING, version advances; `--force` clears pending; fresh install and 2.1.0 update unchanged from section 4
- [x] 5.6 Re-run `openspec validate --strict` and `node --test`
