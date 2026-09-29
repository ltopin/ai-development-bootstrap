## 1. Protocol

- [x] 1.1 `template/AI-FIRST.md`: principle 8; `## Agent readiness`; brownfield lines in agentic impact analysis; `## Greenfield and brownfield` (touched capability rule, knowledge, framework vs product migration); `Adoption mode` and current-state architecture in the adoption section
- [x] 1.2 `template/CAPABILITIES.md`: readiness levels as Status; progressive catalog; optional readiness table; readiness keys in contract details
- [x] 1.3 `template/AI.md`: Phase 2/5/7; brownfield initialization; readiness from evidence; Adoption mode; validation and report

## 2. Related files

- [x] 2.1 `template/WORKFLOW.md`: greenfield/brownfield paragraph and existing-capability flow
- [x] 2.2 `template/openspec/changes/_template/proposal.md` brownfield lines; `tasks.md`; `template/openspec/README.md`
- [x] 2.3 `template/PROJECT.md` (`Adoption mode`), `template/ARCHITECTURE.md` (as it exists)
- [x] 2.4 `bootstrap/UPDATE-INSTRUCTIONS.md`: framework update is not product migration

## 3. Scripts, README and version

- [x] 3.1 Scripts: no file list or behavior change needed (they iterate the template; no new migration check)
- [x] 3.2 Bump `template/.bootstrap-version` to 2.3.0
- [x] 3.3 `README.md`: Greenfield and brownfield subsection, initialization note, "Upgrading to 2.3.0"

## 4. Example and verification

- [x] 4.1 `--update --dry-run` and `--update` on a copy of the example at 2.2.0 (`.sh` and `.ps1`): project files, open changes and product folders byte-identical; framework files refreshed; no MIGRATION REQUIRED; version 2.3.0
- [x] 4.2 Mirror into `examples/multi-repo-example/` with `bootstrap.sh --update`; update its `CAPABILITIES.md` status values and `PROJECT.md` `Adoption mode` (task-authorized edit of project-managed files)
- [x] 4.3 Fresh bootstrap into a temp folder with both scripts: same file set as 2.2.0, version 2.3.0
- [x] 4.4 Relative links and anchors in changed files resolve (only pre-existing install-time and placeholder links unresolved); grep for old status values (remaining `needs validation` refers to dependencies and knowledge candidates); `node --test` over `*.test.js`: 101 pass (sanity)
- [x] 4.5 Walk scenarios A–F (greenfield, brownfield small, brownfield multi-repo, existing capability, future change, bootstrap update) through the text
- [x] 4.6 `openspec validate add-brownfield-agent-first-adoption --strict`
