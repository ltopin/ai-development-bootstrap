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

Then let the agent fill in the central docs (next section), or fill them yourself:

1. `PROJECT.md` — what the product is (one screen);
2. `REPOSITORIES.md` — one row per repository, plus the contracts between them;
3. `ARCHITECTURE.md` — a Mermaid diagram of how the systems relate.

Options: `--dry-run` shows what would happen; `--force` overwrites files that differ (the old version is saved as `<file>.bak`); `--update` refreshes the framework layer of an already bootstrapped project (see [Updating an existing project](#updating-an-existing-project)). By default nothing existing is overwritten, so re-running is always safe. The bootstrap never runs `git init` and never creates remote repositories. See a filled-in result in [examples/multi-repo-example](examples/multi-repo-example/README.md).

## Starting a new project

1. Create or clone the application repositories inside the workspace folder.
2. Run the bootstrap on that folder:

   ```bash
   ./bootstrap/bootstrap.sh ~/projects/my-project
   ```

   ```powershell
   ./bootstrap/bootstrap.ps1 C:\projects\my-project
   ```

3. Open the project root (`my-project/`) in your AI-enabled development environment. The agent picks up `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`, which point to `ai-development/AI.md`.
4. Ask the agent:

   > Initialize this project following ai-development/AI.md.

   `PROJECT.md` starts as `Status: NOT_INITIALIZED`, so agents are directed to the **Project Initialization Protocol**: a cheap survey (folders, READMEs, manifests, configs — not source code), classification of repositories, evidence-based dependencies and domains, then `PROJECT.md`, `REPOSITORIES.md` and `ARCHITECTURE.md`. Unknowns stay marked as unknown; existing content is preserved. It ends with a short report of what needs your validation.
5. Review the generated `PROJECT.md`, `REPOSITORIES.md` and `ARCHITECTURE.md`.
6. Start development. From now on (`Status: INITIALIZED`) agents use those files as the map and do not re-survey the workspace for each task.

To repeat the full discovery later (repositories added or restructured), ask for a new initialization.

## Versioning `ai-development/`

In a multi-repository workspace, `ai-development/` is best versioned as **its own Git repository**, independent from the application repositories:

```
my-project/
├── ai-development/      # repository: my-project-ai-development
├── backend/             # repository
├── frontend/            # repository
└── worker/              # repository
```

Two repositories, two roles:

| Repository | Role |
|---|---|
| `ai-development-bootstrap` | template/framework, universal and product-agnostic |
| `my-project-ai-development` | context and architectural memory of *that* product |

The product-specific repository versions:

- `PROJECT.md`, `REPOSITORIES.md`, `ARCHITECTURE.md`
- `WORKFLOW.md` when customized
- OpenSpec changes and specs
- ADRs
- domain documentation

The bootstrap does **not** run `git init` or create remote repositories; turning the folder into a repository is your decision:

```bash
cd my-project/ai-development
git init
```

`ai-development/.bootstrap-version` records which template version the folder came from (for example `1.0.0`). `ai-development/.bootstrap-manifest` lists the framework files as delivered, so updates can tell untouched files from edited ones. Commit both; do not edit them by hand.

## Updating an existing project

The template evolves; installed projects do not change by themselves. `--update` means: *"update the framework layer of this project"*. It is deliberately conservative and is not a re-copy of the template.

Files fall in two groups:

| Group | Files | On `--update` |
|---|---|---|
| **Framework-managed** | `AI.md`, adapters (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`), `WORKFLOW.md`, `openspec/README.md`, `openspec/changes/_template/`, `docs/adr/README.md` | created if missing; refreshed only if untouched since install; **conflict if modified in the project** (kept as is) |
| **Project-managed** | `PROJECT.md`, `REPOSITORIES.md`, `ARCHITECTURE.md`, `openspec/project.md`, `openspec/specs/*`, `openspec/changes/*` (except `_template`), `docs/domains/*`, `docs/architecture/*`, `docs/adr/INDEX.md` and ADRs | never modified (only created if absent) |

Steps:

1. Update the bootstrap repository:

   ```bash
   cd ai-development-bootstrap
   git pull
   ```

2. Run the update on the project:

   ```powershell
   .\bootstrap\bootstrap.ps1 -Update D:\Projetos\my-project
   ```

   ```bash
   ./bootstrap/bootstrap.sh --update ~/projects/my-project
   ```

   Add `--dry-run` (`-DryRun`) first to preview.

3. Review the report:

   ```
   Current bootstrap version: 1.0.0
   Available bootstrap version: 1.1.0

   Updated:
     - AI.md
   Created:
     - docs/adr/TEMPLATE.md
   Preserved project files:
     - PROJECT.md
     - REPOSITORIES.md
     - ARCHITECTURE.md
   Conflicts requiring review:
     - WORKFLOW.md

   Bootstrap version NOT updated (still 1.0.0): 1 conflict(s) need review.
   ```

4. Resolve conflicts, if any. A conflict means a framework file was edited in the project, so it was left untouched. Compare it with the template copy, merge what you want, and run `--update` again. `.bootstrap-version` moves to the new version only on a run with no conflicts. If you would rather take the template version, `--update --force` overwrites it and keeps the old one as `<file>.bak`.
5. Review and commit the changes in the project's own `ai-development` repository.

Notes:

- Projects bootstrapped before `.bootstrap-manifest` existed have no record of what was delivered, so any framework file that differs from the template is reported as a conflict, even if it is merely outdated. Nothing is overwritten.
- A framework file you customize on purpose (for example `WORKFLOW.md`) keeps being reported until it matches the template again. That is the price of never overwriting silently.
- Running the bootstrap **without** `--update` on an existing project stays as before: nothing is overwritten, and the version and manifest are not touched.

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
    ├── .bootstrap-version  template version this folder came from
    ├── .bootstrap-manifest framework files as delivered (for updates)
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

Edit the files in `template/` to change what future projects receive. Already-bootstrapped projects are never touched unless you run with `--update` (conservative) or `--force`. When you change framework files in a way projects should pick up, bump `template/.bootstrap-version`.

## License

[MIT](LICENSE)
