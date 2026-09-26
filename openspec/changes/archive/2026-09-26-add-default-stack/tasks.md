## 1. Stack file

- [x] 1.1 Create `template/STACK.md` with the *Current stack* section (placeholder table: repository, type, main technologies, notes) and the *Standard for new repositories* section (content of design.md Decision 4, including folder layouts and the "left out" list)
- [x] 1.2 Add to `STACK.md` the two usage rules in one short block: existing repository → its own stack; new repository → the standard; standard changed only by the human

## 2. Protocol

- [x] 2.1 `template/AI.md` reading-levels table: add `STACK.md` to L1 with "creating a repository or structure, or a repository's conventions are unclear"
- [x] 2.2 `template/AI.md` Initialization: fill *Current stack* from evidence, never touch *Standard*; add it to "What to produce", the validation checklist and the final report
- [x] 2.3 `template/AI.md` Phase 5: existing repositories follow their own stack (no migration to the standard); new repositories follow the standard; creating a repository stays Level 2 unless the human asked or an `ACTIVE` decision covers it
- [x] 2.4 `template/AI.md` autonomy section: items left out of the standard are not decided and go through DECISIONS.md and the decision policy

## 3. Bootstrap scripts

- [x] 3.1 `bootstrap/bootstrap.sh`: add `STACK.md` to `is_project_managed`
- [x] 3.2 `bootstrap/bootstrap.ps1`: same change in its project-managed list and help text
- [x] 3.3 Bump `template/.bootstrap-version` (minor)

## 4. Docs and example

- [x] 4.1 `README.md`: mention `STACK.md` in the file list and in "Starting a new project" (ask the agent to create the project from the standard)
- [x] 4.2 `examples/multi-repo-example`: run `--update` to refresh framework files and manifest; fill its `STACK.md` *Current stack* for the fictional `api`, `web`, `worker`

## 5. Validation

- [x] 5.1 Fresh bootstrap into a temp folder with `bootstrap.sh` and `bootstrap.ps1`: `STACK.md` is created with the default standard
- [x] 5.2 `--update` on a copy of the example without `STACK.md`: file is created; run again: file is preserved; edited `STACK.md` is never modified
- [x] 5.3 Relative links in `AI.md` and `STACK.md` resolve; `openspec validate add-default-stack --strict` passes
