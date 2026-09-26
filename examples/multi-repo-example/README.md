# multi-repo-example

A filled-in example of the layer this bootstrap installs, for an imaginary order-management product.

```
multi-repo-example/
├── AGENTS.md, CLAUDE.md, GEMINI.md   adapters (installed by bootstrap)
├── ai-development/                   the layer (installed by bootstrap, then filled in)
├── api/                              placeholder — no real code
├── web/                              placeholder — no real code
└── worker/                           placeholder — no real code
```

Files worth reading, in the order an agent would:

1. [PROJECT.md](ai-development/PROJECT.md), [REPOSITORIES.md](ai-development/REPOSITORIES.md), [ARCHITECTURE.md](ai-development/ARCHITECTURE.md) — L0
2. [docs/domains/orders.md](ai-development/docs/domains/orders.md) — domain → repos → entry points
3. [openspec/changes/add-order-cancellation/](ai-development/openspec/changes/add-order-cancellation/) — a cross-repository change
4. [docs/adr/0001-use-events-for-side-effects.md](ai-development/docs/adr/0001-use-events-for-side-effects.md) — an ADR
5. [DECISIONS.md](ai-development/DECISIONS.md) — the decision ledger agents consult before asking a human (one fictional entry)
6. [STACK.md](ai-development/STACK.md) — *Current stack* of the three repositories, and the default standard any new repository would follow

`AI.md`, `WORKFLOW.md`, `protocol/`, `integrations/` and the `_template` folder are unmodified copies of the template (framework-managed).
`PROJECT.md`, `REPOSITORIES.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `STACK.md`, `docs/`, `openspec/specs/` and `openspec/changes/add-order-cancellation/` are project-managed: filled in for this product, and never touched by `bootstrap --update`.

`.bootstrap-version` says which template version this layer came from, and `.bootstrap-manifest` records the framework files as delivered. In a real product, `ai-development/` would be its own Git repository (for example `orders-platform-ai-development`) next to `api/`, `web/` and `worker/`. Running `./bootstrap/bootstrap.sh --update <this folder>` would refresh only the framework files, keep everything else, and report conflicts instead of overwriting edited framework files.
The names here are fictional; nothing in this example is a real application.
