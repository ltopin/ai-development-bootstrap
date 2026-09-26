# STACK

> L1 document. Answers "which stack?": the stack of each existing repository, and the standard for repositories that do not exist yet. Read it before creating a repository or its structure, or when a repository's conventions are unclear.

## How to use this file

- **Existing repository** → follow its own stack and conventions (see *Current stack* and the repository itself). Never migrate, restructure or add technologies to it to match the standard.
- **New repository** → follow *Standard for new repositories*, even when existing repositories use another stack. Creating a repository is a human decision (Level 2): only when the human asked for it or an `ACTIVE` entry in [DECISIONS.md](DECISIONS.md) covers it.
- **The standard is changed only by the human.** Agents may suggest another library; they do not edit the standard. Repositories created before a change of standard keep their stack.

## Current stack

Filled in by the [Project Initialization Protocol](AI.md#project-initialization-protocol) from evidence (manifests, configuration, top-level structure). Unknown items stay `unknown`. Placeholder rows mean "read the repository itself".

| Repository | Type | Main technologies | Notes |
|---|---|---|---|
| `api` | api | generic backend, relational database, message broker | illustrative; details in [../api](../api/README.md). Not the standard: kept as is |
| `web` | frontend | generic SPA | illustrative; details in [../web](../web/README.md) |
| `worker` | worker | generic job runner, message broker | illustrative; details in [../worker](../worker/README.md) |

## Standard for new repositories

Lean default for new repositories. Two separate repositories, `web/` and `api/` (no monorepo tooling). TypeScript in strict mode everywhere. Use the current stable version of each tool when creating a repository.

### web — React

| Concern | Choice |
|---|---|
| Build | Vite, React, TypeScript |
| Routing | React Router |
| Server data | TanStack Query |
| Local state | `useState` / Context (no global state library) |
| Styling | Tailwind CSS |
| Tests | Vitest + Testing Library |
| API types | generated from the API's OpenAPI document with `openapi-typescript` |

```
web/
└── src/
    ├── app/                     entry, router, providers
    ├── features/<feature>/
    │   ├── api/                 queries and mutations (TanStack Query)
    │   └── components/
    └── shared/                  reusable components, hooks, utilities, generated API types
```

### api — NestJS + MongoDB

| Concern | Choice |
|---|---|
| Framework | NestJS, TypeScript |
| Persistence | MongoDB via Mongoose (`@nestjs/mongoose`) |
| Validation | `class-validator` DTOs with a global `ValidationPipe` |
| Configuration | `@nestjs/config`, with a committed `.env.example` (never real values) |
| API contract | OpenAPI via `@nestjs/swagger`, served at `/docs` |
| Tests | Jest (unit) + supertest (e2e) with `mongodb-memory-server` |

```
api/
└── src/
    ├── modules/<feature>/
    │   ├── <feature>.controller.ts
    │   ├── <feature>.service.ts
    │   ├── schemas/             Mongoose schemas
    │   └── dto/                 request/response DTOs
    ├── common/                  filters, guards, interceptors, pipes
    └── config/                  configuration loading and validation
```

### Conventions

- **Contract:** the API's OpenAPI document is the source of truth between `api` and `web`; `web` regenerates its types from it. Record it in [REPOSITORIES.md](REPOSITORIES.md) as a contract.
- **Schema changes:** MongoDB has no native migrations. Changes are additive by default (new optional fields, defaults for old documents). A destructive change is a human decision (Level 2) and ships with an explicit script.
- **Local development:** a `docker-compose.yml` with MongoDB only.
- **Tooling:** ESLint + Prettier; npm.

### Deliberately left out

Not decided by this standard. When first needed, check [DECISIONS.md](DECISIONS.md); if no `ACTIVE` entry answers it, it is a human decision under the [decision policy](protocol/DECISION-POLICY.md):

- authentication model;
- deploy and CI;
- global state library;
- SSR / Next.js;
- component library;
- internationalization (i18n).
