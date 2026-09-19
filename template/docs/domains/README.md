# docs/domains

Optional, one file per business domain (e.g. `payments.md`, `identity.md`, `notifications.md`).

Purpose: let an agent go **domain → repositories → contracts** without exploring the workspace. Write a domain file when a domain spans several repositories or when locating its code is not obvious.

Keep each file short (about one screen). Link to repositories for details; do not copy their docs.

## Template

Copy this into `<domain>.md`:

```markdown
# <Domain>

## Responsibility

What this domain owns and what it explicitly does not.

## Repositories

| Repository | Role in this domain | Entry points (paths/modules) |
|---|---|---|
| `api` | owns business rules and persistence | `../api/<module>` |
| `web` | user interface | `../web/<feature>` |

## Key entities

- `<Entity>` — one-line meaning, owning repo.

## Contracts

- `<HTTP endpoint / event / schema>` — provider → consumers, where it is defined.

## Events

| Event | Emitted by | Consumed by | Purpose |
|---|---|---|---|

## Dependencies

Other domains this one relies on, and domains that rely on it.
```

Listing entry points is the highest-value part: it turns "search the codebase" into "open this directory".
