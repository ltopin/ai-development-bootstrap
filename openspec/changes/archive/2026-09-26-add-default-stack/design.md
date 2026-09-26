## Context

The layer is stack-independent by design: `AI.md` tells agents to follow each repository's own conventions (Phase 5) and to discover stacks from evidence (Initialization, rule 1). Nothing tells an agent what to build when there is no repository yet. Requirements are in `specs/default-stack/spec.md`; motivation in `proposal.md`.

## Goals / Non-Goals

**Goals:**
- One file that answers "which stack?" for both existing and new repositories.
- A default standard lean enough to be read in one sitting.
- No new bootstrap flags or mechanisms.

**Non-Goals:**
- Generating application code from the bootstrap (no scaffolds, no templates of `web/` or `api/`).
- Several selectable stack profiles.
- Migrating existing repositories to the standard.
- Pinning library versions (the agent uses current stable versions when creating a repository).

## Decisions

**1. A single `STACK.md` with two sections, instead of a file whose content switches between "detected" and "default".**
In a mixed project (the human chose that new repositories follow the standard), both descriptions are needed at the same time. Two fixed sections avoid a mode flag and make the rule trivial: existing repo → Current stack; new repo → Standard.
Alternative: `Source: detected | default` header. Rejected: loses the standard as soon as a project has code.

**2. `STACK.md` at the layer root, project-managed.**
`docs/architecture/` is project-managed but its README restricts it to system-level diagrams, not internal structure. A root file sits next to the other project documents and is easy to find. Added to `is_project_managed` in both scripts, so `--update` creates it only when absent.
Alternative: `docs/architecture/STACK.md`. Rejected: contradicts that folder's own convention.

**3. Read at L1, on demand.**
`STACK.md` is not L0: most tasks change an existing repository whose conventions are in the repository itself. It is read when creating a repository or structure, or when a repository's conventions are unclear. Added to the L1 row of the reading-levels table.

**4. The standard content.**
Separate `web/` and `api/` repositories (fits the multi-repo model; no monorepo tooling). TypeScript strict.
- web: Vite, React Router, TanStack Query for server data, `useState`/Context for local state, Tailwind CSS, Vitest + Testing Library. Structure `src/app`, `src/features/<feature>/{api,components}`, `src/shared`.
- api: NestJS, Mongoose via `@nestjs/mongoose`, `class-validator` with a global `ValidationPipe`, `@nestjs/config` + `.env.example`, OpenAPI via `@nestjs/swagger` at `/docs`, Jest unit + supertest e2e with `mongodb-memory-server`. Structure `src/modules/<feature>/{controller,service,schemas,dto}`, `src/common`, `src/config`.
- Contract: the API's OpenAPI document is the source of truth; web generates types with `openapi-typescript`. This makes Phase 6 contract checks mechanical.
- Persistence: MongoDB has no native migrations; schema changes are additive by default, destructive changes are Level 2 (already so in the decision policy) and need an explicit script.
- Local: `docker-compose.yml` with MongoDB only; ESLint + Prettier; npm.
- Deliberately left out: authentication model, deploy and CI, global state library, SSR/Next.js, component library, i18n. Each is a human decision when first needed.

**5. The agent creates the structure; the bootstrap does not.**
Keeping code out of the bootstrap avoids maintaining scaffolds whose dependencies age quickly. The trade-off is less deterministic structure; mitigated by the explicit folder layout in the standard.

## Risks / Trade-offs

- [Two stacks coexist in a mixed project, e.g. Express and NestJS APIs] → Accepted by the human's choice; Current stack makes it explicit so agents don't mix conventions across repositories.
- [Agent-created structure varies between runs] → Standard gives concrete folder layout and tools; review happens in the pull request as for any change.
- [Standard ages (library choices)] → It is project-managed: each project edits its own copy; the template's copy is updated in future bootstrap versions without touching existing projects.
- [Agents treat the standard as permission to create repositories] → Spec keeps repository creation a human decision.

## Migration Plan

Existing projects run `--update`: they get the new `AI.md` text and a fresh `STACK.md` (only if absent). Its Current stack stays a placeholder until the human asks for a new initialization or fills it in; agents treat a placeholder Current stack as "read the repository itself", which is today's behavior.
