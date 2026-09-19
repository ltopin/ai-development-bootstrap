# REPOSITORIES

> L0 document. The map agents use to decide *which repositories to open*. Keep rows to one line each. Replace the example rows.

## Repositories

Paths are relative to this `ai-development/` directory.

| Repository | Path | Responsibility | Tech | Depends on | Domains |
|---|---|---|---|---|---|
| `api` | `../api` | Backend / public API | `<language, framework>` | `database`, `queue` | `<domain, domain>` |
| `web` | `../web` | User-facing frontend | `<language, framework>` | `api` | `<domain>` |
| `worker` | `../worker` | Asynchronous jobs | `<language, framework>` | `queue`, `database` | `<domain>` |
| `infra` | `../infra` | Infrastructure as code, deploy | `<tool>` | — | — |

Columns:

- **Responsibility** — what this repo owns, in a few words. If two repos claim the same thing, fix it here.
- **Tech** — enough to know how to build/test it; details live in the repo.
- **Depends on** — repos or external systems it calls or consumes. Drives impact analysis: if X changes, look at everything that depends on X.
- **Domains** — links rows to `docs/domains/*.md`, so a domain leads to its repos.

External systems (databases, queues, third-party APIs) are not rows: name them in *Depends on* and list them on one line here, e.g. "External systems: `database`, `queue`."

## Contracts between repositories

Every boundary another repo relies on. This is what makes cross-repository impact analysis possible.

| Contract | Provider | Consumers | Type | Source of truth | Status |
|---|---|---|---|---|---|
| `<Orders HTTP API>` | `api` | `web` | HTTP / OpenAPI | `../api/<path to spec>` | confirmed |
| `<order.created event>` | `api` | `worker` | Async event | `<path or docs/domains/orders.md>` | needs validation |
| `<shared DB schema>` | `api` | `worker` | Database | `../api/<path to migrations>` | confirmed |

Guidance:

- **Type** is free-form: HTTP, gRPC, event, database, shared package, file format, environment/config.
- **Source of truth** points to where the contract is actually defined, so it is not duplicated here. If none exists, describe the contract in the relevant domain doc.
- **Status** is `confirmed` (there is evidence: a spec, config, code reference or a person confirmed it) or `needs validation`. Do not record guesses as confirmed. The same applies to the *Depends on* column: append `(?)` to a dependency that is not confirmed and list it below.
- When a contract changes, every consumer listed here is in the impact set.

## Needs validation

Unconfirmed repositories, dependencies or contracts, with what is missing. Empty means everything above is confirmed.

- `<none>`

## Conventions

- Where to find how to build/test a repository: `<its README / its agent file>`.
- Repositories may have their own agent instructions; read them when you enter that repo (L2), not before.
- Adding, renaming or removing a repository: update this file in the same change.
