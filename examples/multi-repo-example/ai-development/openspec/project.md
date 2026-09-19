# openspec project conventions

Project-level rules for specs and changes. Keep this short; identity and architecture live in [PROJECT.md](../PROJECT.md) and [ARCHITECTURE.md](../ARCHITECTURE.md).

## Capabilities

List the capability folders under `specs/` so agents can find the relevant spec without listing directories.

| Capability | Spec | Domain | Repositories |
|---|---|---|---|
| `<orders>` | `specs/<orders>/spec.md` | `<orders>` | `<api, web, worker>` |

## Conventions

- Change ids: kebab-case, verb-first (`add-…`, `change-…`, `remove-…`, `migrate-…`).
- Every change mentions the repositories potentially affected in `proposal.md`.
- `tasks.md` is grouped by repository, in implementation order.
- Contracts named in a change must match the *Contracts* table in [REPOSITORIES.md](../REPOSITORIES.md).
- Closed changes go to `changes/archive/YYYY-MM-DD-<change-id>/`.

## Project-specific rules

Add rules that apply to every change here (e.g. "every API change updates the OpenAPI file in the same PR"). Delete this section if there are none.
