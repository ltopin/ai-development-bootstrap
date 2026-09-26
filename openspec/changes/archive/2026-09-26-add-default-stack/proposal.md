## Why

The protocol tells agents to follow each repository's own conventions, but says nothing when a repository does not exist yet. On a new project, or when a new repository is added to an existing one, the agent has no stack to follow and either improvises or has to ask the human for every basic choice. A single, lean default stack (React + NestJS + MongoDB) fills that gap without making the rest of the protocol stack-specific.

## What Changes

- New project-managed file `STACK.md` in the template with two sections:
  - **Current stack**: the stack of the existing repositories, filled in by the Project Initialization Protocol from evidence (manifests, configs, folder structure). Empty on a new project.
  - **Standard for new repositories**: a lean default: `web/` (React + Vite + TypeScript, React Router, TanStack Query, Tailwind, Vitest) and `api/` (NestJS + Mongoose/MongoDB, class-validator, @nestjs/config, OpenAPI via @nestjs/swagger, Jest + supertest + mongodb-memory-server), their folder structure, the OpenAPI contract between them, the additive-schema rule for MongoDB, and what is deliberately left out (auth, deploy/CI, global state library, SSR, component library, i18n).
- `AI.md` Project Initialization Protocol: record the detected stack of existing repositories in `STACK.md` (Current stack), never overwrite the standard section.
- `AI.md` Phase 5: an existing repository follows its own stack and conventions; a **new** repository follows the standard in `STACK.md`, even when the existing repositories use a different stack.
- `AI.md` reading levels: `STACK.md` is read at L1 before creating a repository or scaffolding structure.
- Bootstrap scripts (`bootstrap.sh`, `bootstrap.ps1`): `STACK.md` is project-managed (never modified by `--update`).
- README and the multi-repo example mention the file.
- The bootstrap does **not** generate application code; the agent creates the structure from `STACK.md` when the human asks for it.

## Capabilities

### New Capabilities
- `default-stack`: how the workspace records the stack of existing repositories and the default stack for new ones, and how agents choose between them.

### Modified Capabilities
<!-- none: existing specs cover design-driven implementation only -->

## Impact

- `template/STACK.md` (new), `template/AI.md`.
- `bootstrap/bootstrap.sh`, `bootstrap/bootstrap.ps1` (project-managed list).
- `README.md`, `examples/multi-repo-example/ai-development/` (new STACK.md filled for the example).
- No change to existing projects' content: `--update` delivers the new framework text in `AI.md`; `STACK.md` is created only when missing.
