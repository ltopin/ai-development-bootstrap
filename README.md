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

1. Create or clone the application repositories inside the workspace folder. For a project with no code yet, the folder can start empty (see step 7).
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

7. **No repositories yet?** Ask the agent to create them from the standard:

   > Create the project following the standard in ai-development/STACK.md.

   `STACK.md` holds a lean default for new repositories: `web/` (React + Vite + TypeScript, React Router, TanStack Query, Tailwind, Vitest) and `api/` (NestJS + MongoDB via Mongoose, class-validator, `@nestjs/config`, OpenAPI via `@nestjs/swagger`, Jest + supertest), their folder layout and the OpenAPI contract between them. It also lists what it deliberately leaves out (authentication, deploy and CI, global state, SSR, component library, i18n): the agent asks you about those when first needed. The bootstrap generates no application code; edit the standard in your project's copy if you want another one.

Existing repositories always keep their own stack: initialization records it in *Current stack* of `STACK.md`, and agents never migrate a repository to the standard. Only **new** repositories, created when you ask for them, follow the standard.

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
- `DECISIONS.md` (decisions humans made, so agents do not ask twice)
- `STACK.md` (current stack of each repository, and the standard for new ones)
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
| **Framework-managed** | `AI.md`, adapters (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`), `WORKFLOW.md`, `protocol/*`, `integrations/*`, `openspec/README.md`, `openspec/changes/_template/`, `docs/adr/README.md` | created if missing; refreshed only if untouched since install; **conflict if modified in the project** (kept as is) |
| **Project-managed** | `PROJECT.md`, `REPOSITORIES.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `STACK.md`, `openspec/project.md`, `openspec/specs/*`, `openspec/changes/*` (except `_template`), `docs/domains/*`, `docs/architecture/*`, `docs/adr/INDEX.md` and ADRs | never modified (only created if absent) |

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
     - DECISIONS.md
     - protocol/DECISION-POLICY.md
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
- **Upgrading to 1.1.0** (autonomous development, see below): `--update` adds `protocol/`, `integrations/` and an empty `DECISIONS.md`, and refreshes `AI.md`, `WORKFLOW.md`, `docs/adr/README.md` and `openspec/changes/_template/proposal.md` if you never edited them. If you did, they are reported as conflicts: merge the new *Autonomy and human decisions* section of `AI.md` (and the pointers in the others) by hand, then run `--update` again. Existing `DECISIONS.md` files are never touched. Versions before the manifest existed report every differing framework file as a conflict (see the first note).
- **Upgrading to 1.2.0** (loop prevention and design-driven implementation): `--update` creates `protocol/LOOP-PREVENTION.md`, `protocol/DESIGN-DRIVEN.md`, `scripts/loop-prevention.test.js`, `scripts/design-branch.js` (+ tests) and the `design-pr` / `design-back-sync` workflow examples under `integrations/github/`, and refreshes `AI.md`, `WORKFLOW.md`, `protocol/`, `integrations/` and `openspec/changes/_template/proposal.md` where you never edited them (otherwise they are reported as conflicts, as usual). Nothing changes in any repository's settings: the design source branch model is opt-in, adopted per repository by following [integrations/github/](template/integrations/github/README.md#design-driven-repositories). If you already copied the 1.1.0 workflows, re-copy `agent-run` and `agent-resume` and set the now-required `AGENT_PUSH_ACTOR`.
- **Upgrading to 1.3.0** (design reference): `--update` refreshes `protocol/DESIGN-DRIVEN.md`, `protocol/CLASSIFICATION.md`, `protocol/DECISION-POLICY.md`, `integrations/github/README.md` and `openspec/changes/_template/proposal.md` where you never edited them (otherwise they are reported as conflicts, as usual). No workflow or script changes. Rules that need no setup apply at once: four new fake-boundary signals (success faked in an error path, fake authentication, an action with no effect, an orphan endpoint), generated documentation treated as a proposal, an empty extraction table as class A, and content left untouched. The design comparison starts only when a repository commits a design export under `design/<tool>/` on its design source branch; until then pull requests say that no design comparison was made. A generated app whose design pull request is already open picks up the new rules on its next run: expect one keep/remove question per visible invention on that first run.
- **Upgrading to 1.4.0** (direct path from the design tool): `--update` refreshes `AI.md`, `WORKFLOW.md`, `protocol/DESIGN-DRIVEN.md`, `protocol/CLASSIFICATION.md`, `protocol/DECISION-POLICY.md`, `protocol/SECURITY.md`, `integrations/github/README.md`, the `design-pr` / `design-back-sync` workflow examples and `openspec/changes/_template/proposal.md` where you never edited them (otherwise they are reported as conflicts, as usual). No script changes. The direct path needs no setup: commit a design export under `design/<tool>/` and ask for it to be implemented. Keep any MCP configuration that holds a design tool key out of version control. **Builder-path users:** your setup keeps working (the scripts read the branch names from `DESIGN_SOURCE_BRANCH` / `PRODUCTION_BRANCH`, whose defaults are unchanged), but run the [preservation check](template/protocol/DESIGN-DRIVEN.md#preservation-check) against your builder; if it fails, move to the direct path. The workflow examples now use `main` (builder) / `production`: if you re-copy them, set both variables explicitly.
- **Upgrading to 1.5.0** (default stack): `--update` creates `STACK.md` (project-managed: created only if absent, never modified afterwards) and refreshes `AI.md` where you never edited it (otherwise it is reported as a conflict, as usual). *Current stack* stays a placeholder until you ask for a new initialization or fill it in; until then agents read each repository itself, as before. Existing repositories are never migrated to the standard.
- **Upgrading to 2.0.0** (direct-only design flow): **breaking**. The builder path (AI Studio / app builder generated apps, design source branch, `design-pr`, `design-back-sync`, extraction table, inventions) is removed in favor of the direct path from the design tool (Stitch). Projects that depend on the builder path should stay on bootstrap 1.5.x. `--update` does not delete files from existing projects; delete these by hand if your project had them:
  - `ai-development/integrations/github/workflows/design-pr.yml.example`
  - `ai-development/integrations/github/workflows/design-back-sync.yml.example`
  - `ai-development/integrations/github/scripts/design-branch.js`
  - `ai-development/integrations/github/scripts/design-branch.test.js`
  - any `.github/workflows/design-pr.yml` or `design-back-sync.yml` copied into repositories, and their design source branch rulesets.
  The design flow is now direct-only: the agent only reads the design tool (never edits or generates screens), commits the design export as its own commit before implementing, and pushes only when you ask. `--update` refreshes `AI.md`, `WORKFLOW.md`, `protocol/DESIGN-DRIVEN.md`, `protocol/CLASSIFICATION.md`, `protocol/DECISION-POLICY.md`, `protocol/SECURITY.md`, `protocol/LOOP-PREVENTION.md`, `integrations/README.md`, `integrations/github/README.md` and `openspec/changes/_template/proposal.md` where you never edited them (otherwise reported as conflicts, as usual).

## How it works

**Minimum necessary context.** Having 20 repositories available does not mean reading 20 repositories. Every file the agent opens must be justified by the task.

**Progressive disclosure.** Documentation is layered, and the agent stops at the cheapest layer that answers its question:

| Level | Content | When |
|---|---|---|
| L0 | `PROJECT.md`, `REPOSITORIES.md`, `ARCHITECTURE.md` | always, first |
| L1 | domain docs, ADRs, specs, open changes, `STACK.md` | when a domain/contract is involved; `STACK.md` when creating a repository |
| L2 | a selected repository's own docs | after deciding it is affected |
| L3 | source files | when you know what to look for |

**Source of truth.** The central layer documents only the system map, cross-repo contracts, cross-repo decisions and changes. Each repository keeps its own internal documentation.

**Changes are logical, not per-repo.** A feature crossing three repositories is one change (`openspec/changes/add-payment-method/`) with tasks grouped by repository, not three disconnected ones. Trivial single-repo edits need no formal change.

## Autonomous development (optional)

The same protocol supports agents that receive an external change and drive it to a pull request, stopping for a human when they must:

```
External change → Agent → Impact analysis → Classification (A–D) → Implementation → Validation → Pull request → CI → Human approval → Deploy
                                                                       │
                                                                       └─ needs a human ─► WAITING_FOR_HUMAN ─► human answers ─► agent resumes
```

| Piece | Where | What it defines |
|---|---|---|
| Classification | [protocol/CLASSIFICATION.md](template/protocol/CLASSIFICATION.md) | frontend-only / + existing API / + API change / + new backend capability, and the checks before implementing |
| Decision policy | [protocol/DECISION-POLICY.md](template/protocol/DECISION-POLICY.md) | Level 1 autonomous, Level 2 human decision, Level 3 human secret (never ask for the value) |
| Human-in-the-loop | [protocol/HUMAN-IN-THE-LOOP.md](template/protocol/HUMAN-IN-THE-LOOP.md) | `WAITING_FOR_HUMAN`, machine-readable questions, answers, safe resumption |
| Loop prevention | [protocol/LOOP-PREVENTION.md](template/protocol/LOOP-PREVENTION.md) | external intent vs internal automation change, provenance (`change_id`, `source_sha`, `run_id`), what a run produced, idempotency and crash recovery, retry, iteration limit and budget windows, resume identity |
| Design-driven | [protocol/DESIGN-DRIVEN.md](template/protocol/DESIGN-DRIVEN.md) | design reference as contract, read-only design tool access, export commit before implementation, requirements table, implementation in the project's stack, fake boundaries found by behavior, states added, definition of done |
| Security | [protocol/SECURITY.md](template/protocol/SECURITY.md) | secrets, trusted actors, prompt injection, least privilege, forks, cross-repository access, self-triggering, read-only design tool access |
| Decision ledger | `DECISIONS.md` (project-managed) | choices already made, consulted before asking; never overwritten by updates |
| GitHub integration | [integrations/github/](template/integrations/github/README.md) | optional workflow examples: questions as PR comments, labels, resume on reply, run ledger and self-trigger gate |

### Loop prevention: what starts the agent

An agent that pushes must not start itself, but a developer who runs Claude or Codex locally and pushes is a new request. So the rule is **not** "AI commits are ignored". It is: *changes produced by the current automated execution continue the intent that started it and never start a new one.* Classification follows the origin of the **execution**, not the author of the code.

```
Stitch (optional) ─┐
Human ─────────────┤
Claude local ──────┼─► commit/push ─► GitHub ─► gate: RUN_AGENT ─► agent run ─► commits with provenance ─► push
Codex local ───────┘                                                                                         │
                                                       CI: runs (always)  ◄──────────────────────────────────┤
                                                       gate: IGNORE_AUTOMATION_CHANGE  ◄──────────────────────┘  no new agent run
```

Provenance is a set of commit trailers (`Agent-Generated`, `Agent-Run`, `Agent-Change`, `Source-SHA`) on commits that a trusted publish step recorded in the run's ledger entry **before** pushing them itself, under a required automation identity (`AGENT_PUSH_ACTOR`); a trailer alone, or the bot identity alone, proves nothing. Duplicate events are `IGNORE_DUPLICATE`, a failed run is re-run only with an explicit `/agent retry <run-id>`, and a per-change limit (`AGENT_MAX_ITERATIONS`, default 3) ends in `WAITING_FOR_HUMAN` until a human opens a new budget window. CI is never affected. Details: [protocol/LOOP-PREVENTION.md](template/protocol/LOOP-PREVENTION.md).

### Design-driven: from a design to a working app

A human designs screens in a design tool (Stitch is one example). The agent reads the design through the tool's MCP server and implements it directly in the project's stack:

```
 design tool ──MCP read──► design/<tool>/ export commit ──► agent ──► pull request (push on request)
                               (agent creates, first)                 requirements table,
                                                                      project's stack, real data
```

- **The design reference is the contract.** The design tool's export sits under `design/<tool>/`, one file per screen (variants such as `home.desktop.html` / `home.mobile.html` are one screen; images and a `manifest.json` with the export time are optional).
- **The agent only reads the design tool.** It uses the tool's access only to read: list projects and screens, and fetch screen exports. It never creates, generates, edits or deletes screens, projects or design systems in the tool.
- **Export commit.** Naming the design in the tool counts as the export request. The agent exports the named screens into `design/<tool>/`, updates `manifest.json`, and commits the export as its own commit before the implementation commits. It pushes only when the human asks. Automated runs never call the design tool and never write under `design/`. The tool's key is a Level 3 secret.
- **Read by behavior.** Input or action → requirement that must work; values only → display; link to a designed screen → required flow; link to anything else → *design gap*, listed, not built.
- **Requirements table.** One row per requirement that needs data or an effect (`exists` / `partial` / `missing`), which sets the class (B / C / D) and goes into the PR. No such requirement: class A.
- **Project's stack, not the tool's markup.** Existing components and tokens are reused; any visible difference is listed under *Presentation changes*. Loading, empty, error and validation states the design does not draw are added minimally and listed under *States added*.
- **Fake boundaries found by behavior.** Literal data as data source, simulated latency, browser storage as database, client-generated identity, credentials in client, server endpoints returning constants, success in error path, fake authentication, actions with no effect. The done scan checks client and server code of the change.
- **Done** means every requirement backed by a real contract, no fake data left in the change, backend implemented with tests, CI green.

Details: [protocol/DESIGN-DRIVEN.md](template/protocol/DESIGN-DRIVEN.md).

The protocol is the source of truth and does not depend on GitHub, Claude, Codex, Gemini or any design tool; those are adapters. The agent adapters (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) are unchanged: they point to `AI.md`, which summarizes the policy and links to `protocol/`. The GitHub workflows are examples: they do nothing until you copy them into a repository, and cross-repository work needs a GitHub App or token you configure (see the integration README).

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
    ├── DECISIONS.md       L1: human decisions already made (project-managed)
    ├── STACK.md           L1: current stack per repository + standard for new ones (project-managed)
    ├── protocol/          autonomy: classification, decision policy, human-in-the-loop, loop prevention, design-driven, security
    ├── integrations/      optional platform wiring (GitHub workflow examples)
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
