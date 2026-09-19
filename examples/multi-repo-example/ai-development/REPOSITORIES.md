# REPOSITORIES

## Repositories

Paths are relative to this `ai-development/` directory.

| Repository | Path | Responsibility | Tech | Depends on | Domains |
|---|---|---|---|---|---|
| `api` | [../api](../api/README.md) | Public HTTP API, business rules, persistence | generic backend | `database`, `queue` | orders |
| `web` | [../web](../web/README.md) | Customer and operator frontend | generic SPA | `api` | orders |
| `worker` | [../worker](../worker/README.md) | Async jobs: notifications, fulfilment sync | generic job runner | `queue`, `database`, `email-provider` | orders |

External systems: `database` (relational, owned by `api`), `queue` (message broker), `email-provider` (third party).

## Contracts between repositories

| Contract | Provider | Consumers | Type | Source of truth |
|---|---|---|---|---|
| Orders HTTP API | `api` | `web`, third parties | HTTP / OpenAPI | `../api/openapi.yaml` (illustrative path) |
| `order.status_changed` event | `api` | `worker` | Async event | [docs/domains/orders.md](docs/domains/orders.md) |
| Orders tables | `api` | `worker` (read-only) | Database | `../api/migrations/` (illustrative path) |

## Conventions

- Build/test commands live in each repository's README.
- Adding, renaming or removing a repository: update this file in the same change.
