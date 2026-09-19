# ai-development-bootstrap

A universal, agent-agnostic context layer for AI-assisted development across **multiple repositories**.

It installs an `ai-development/` folder next to your repositories that teaches any AI agent to understand the system *before* opening code.

```
workspace/
├── ai-development/     ← created by this bootstrap
├── AGENTS.md           ← tiny adapters (also CLAUDE.md, GEMINI.md)
├── project-api/
├── project-web/
├── project-worker/
└── project-infra/
```

## Problem

Modern products span several repositories. When an AI agent is handed the whole workspace it tends to:

- burn context and tokens reading things that are irrelevant;
- investigate repositories the task never touches;
- lose the architectural relationships between systems;
- make a local change without noticing its impact on other repositories.

## Solution

A lightweight layer of context and orchestration above the repositories. It teaches the agent to work as:

```
Discover → Analyze → Scope → Plan → Implement → Validate → Document
```

The agent first reads a small map of the system, decides which repositories are actually affected, and only then opens code — expanding gradually if new dependencies appear.

## Quick start

```bash
git clone https://github.com/ltopin/ai-development-bootstrap
cd ai-development-bootstrap

./bootstrap/bootstrap.sh ~/projects/my-project
```

Windows (PowerShell):

```powershell
./bootstrap/bootstrap.ps1 C:\projects\my-project
```

Then fill in three short files in `my-project/ai-development/`:

1. `PROJECT.md` — what the product is (one screen);
2. `REPOSITORIES.md` — one row per repository, plus the contracts between them;
3. `ARCHITECTURE.md` — a Mermaid diagram of how the systems relate.

Start your agent at the workspace root (`my-project/`). It picks up `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`, which point to `ai-development/AI.md`.

Options: `--dry-run` shows what would happen; `--force` overwrites files that differ (the old version is saved as `<file>.bak`). By default nothing existing is overwritten, so re-running is always safe. See a filled-in result in [examples/multi-repo-example](examples/multi-repo-example/README.md).

## How it works

**Minimum necessary context.** Having 20 repositories available does not mean reading 20 repositories. Every file the agent opens must be justified by the task.

**Progressive disclosure.** Documentation is layered, and the agent stops at the cheapest layer that answers its question:

| Level | Content | When |
|---|---|---|
| L0 | `PROJECT.md`, `REPOSITORIES.md`, `ARCHITECTURE.md` | always, first |
| L1 | domain docs, ADRs, specs, open changes | when a domain/contract is involved |
| L2 | a selected repository's own docs | after deciding it is affected |
| L3 | source files | when you know what to look for |

**Source of truth.** The central layer documents only the system map, cross-repo contracts, cross-repo decisions and changes. Each repository keeps its own internal documentation.

**Changes are logical, not per-repo.** A feature crossing three repositories is one change (`openspec/changes/add-payment-method/`) with tasks grouped by repository, not three disconnected ones. Trivial single-repo edits need no formal change.

### What gets installed

```
my-project/
├── AGENTS.md  CLAUDE.md  GEMINI.md     adapters: "read ai-development/AI.md"
└── ai-development/
    ├── AI.md              the protocol every agent follows (canonical)
    ├── WORKFLOW.md        flow, and when a formal change is needed
    ├── PROJECT.md         L0: what the product is
    ├── REPOSITORIES.md    L0: repositories, dependencies, contracts
    ├── ARCHITECTURE.md    L0: macro diagrams (Mermaid)
    ├── docs/
    │   ├── architecture/  optional detailed diagrams
    │   ├── adr/           architecture decision records
    │   └── domains/       optional per-domain maps
    └── openspec/
        ├── specs/         current behavior and contracts
        └── changes/       proposals in flight (with a copyable _template)
```

The adapters live at the workspace root because that is where agents are started and where they look for instruction files. They are deliberately tiny and contain no rules of their own, so instructions exist in exactly one place: `AI.md`.

## Compatibility

Works with any agent that reads Markdown instructions:

- **Claude Code** — reads `CLAUDE.md`
- **OpenAI Codex** — reads `AGENTS.md`
- **Gemini** — reads `GEMINI.md`
- **Others** (Cursor, Copilot, Aider, …) — point them at `ai-development/AI.md`, or at the `AGENTS.md` convention

If the workspace already has an `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`, the bootstrap never overwrites it (not even with `--force`): it appends a short marked block pointing to `ai-development/AI.md`, once. Your existing content stays intact.

## Repository layout

```
bootstrap/    bootstrap.sh, bootstrap.ps1
template/     what gets installed (adapters/ go to the workspace root, the rest into ai-development/)
examples/     a filled-in example
```

Links inside `template/adapters/` are written for the installed layout, so they only resolve after bootstrapping.

## Customizing

Edit the files in `template/` to change what future projects receive. Already-bootstrapped projects are never touched unless you re-run with `--force`.

## License

[MIT](LICENSE)
