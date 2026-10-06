## 1. Protocol

- [x] 1.1 `template/AI.md` Phase 5: create only the repositories asked for; ask backend only / frontend only / full stack when unspecified; single-repository contract rules

## 2. Related files

- [x] 2.1 `template/STACK.md`: *New repository* bullet, "up to two" repositories, contract convention with a single repository

## 3. Scripts, README and version

- [x] 3.1 No change needed in `bootstrap.sh` / `bootstrap.ps1` (no file added, removed or renamed)
- [x] 3.2 Bump `template/.bootstrap-version` to 2.4.1
- [x] 3.3 `README.md`: step 7 and "Upgrading to 2.4.1"

## 4. Example and verification

- [x] 4.1 `--update --dry-run` on a copy of a project at 2.4.0: only `AI.md` refreshed, `STACK.md` preserved, version 2.4.1 (`.sh` and `.ps1`)
- [x] 4.2 Mirror into `examples/multi-repo-example/` with `bootstrap.sh --update`
- [x] 4.3 Grep template/, examples/, README.md and bootstrap/ for "Two separate repositories": only `examples/multi-repo-example/ai-development/STACK.md`, project-managed and correctly left as installed
- [x] 4.4 Walk the cases through the text: "create the project" with no hint (asks), "create the backend" (only `api/`, no question), "create the frontend" (only `web/`, asks which API), full stack (both, contract recorded)
- [x] 4.5 `openspec validate ask-repositories-to-create --strict`
