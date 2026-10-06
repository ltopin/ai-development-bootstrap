## Why

Asked to "create the project following the standard in ai-development/STACK.md", an agent always creates both `web/` and `api/`. The standard says "Two separate repositories, `web/` and `api/`", the main spec's scenario says the same, and no text tells the agent to ask which ones the product needs. In a real backend-only project, the agent created a full `web/` repository that the human then had to delete.

## What Changes

- `AI.md` (framework-managed), Phase 5: create only the repositories the human asked for; when the request does not say which, ask before creating anything: backend only (`api/`), frontend only (`web/`) or full stack (both). Never both by default. `api/` alone still serves OpenAPI with no consumer; `web/` alone asks which API it consumes before generating types.
- `STACK.md` (project-managed): the *New repository* bullet repeats the question; the standard says "up to two" repositories, and the contract convention notes that a single repository has no contract between them yet. Only fresh installs get this text; existing projects get the rule through `AI.md`.
- `README.md`: step 7 of *Starting a new project* says the agent asks, and how to skip the question; "Upgrading to 2.4.1".

Version: **2.4.0 → 2.4.1** (patch, fix). **Not breaking.**

### Files under template/

| File | Change | Management |
|---|---|---|
| `AI.md` | changed | framework-managed |
| `STACK.md` | changed | project-managed |
| `.bootstrap-version` | 2.4.1 | version |

### Existing projects on `--update`

`AI.md` is refreshed where never edited; a customized copy is kept or merged by the agent, as usual. `STACK.md` is not modified. Repositories already created are not touched; an unwanted one is deleted by hand.

## Non-goals

- No new standard (for example a worker or mobile repository) and no change to the technologies of `web/` or `api/`.
- No script change: the installers copy the template as it is.
- No removal of repositories already created in existing projects.
