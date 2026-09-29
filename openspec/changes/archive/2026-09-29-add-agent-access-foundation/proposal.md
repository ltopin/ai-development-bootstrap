## Why

The Agent-First premise has two parts: (1) business logic lives outside the graphical interface; (2) an authorized agent can actually call the capability. 2.3.0 enforces part 1 in several steps, but no step a Development Agent runs checks part 2, and no project ever receives an agent credential.

In a real brownfield product on 2.3.0, a new capability (expenses paid to third parties) went through the agentic impact analysis and the definition of done without a single warning. Its logic, permissions, tenant scope, structured errors and audit were all in the backend, yet no agent could use it. The routes accepted only a human's login token, and the product's only agent credential belonged to a chatbot and was restricted to that chatbot's routes.

Causes in the framework text:

1. Question 9 ("How is the operation authorized?") was accepted with human roles only.
2. The definition of done asks only for "proper authorization".
3. Distinguishable principals appear only in *Security*, marked "when applicable".
4. "Real Product Agents are not required" reads as "part 2 can wait".
5. The brownfield rules push a product-wide gap outside every change, without asking the human.
6. The adoption skeleton let "other capabilities are reached only through the web frontend" stand as a neutral description.
7. Neither initialization nor adoption creates a safe way for an agent to authenticate.

## What Changes

- `AI-FIRST.md` (framework-managed):
  - the premise is split into its two checked parts;
  - Agent-Ready adds *callable by an agent principal*;
  - no agent principal caps readiness at `PARTIALLY_AGENT_READY`, and it is a new gap category;
  - agentic impact question 10 asks which agent principal can call the capability;
  - the definition of done fails when agents would need a human's session or credentials;
  - "Real Product Agents are not required" now says that an authorized path for an agent is required;
  - *Security* points to the foundation as not optional;
  - new `## Agent access foundation` (`agent-access`): requirements only, mechanism is a Level 2 decision, greenfield and brownfield paths, `add-agent-access` as the only change written on the agent's own initiative;
  - new `### Premise gaps`: record in the change's *Known gaps* and in CAPABILITIES.md, and ask the human;
  - two explicit brownfield exceptions;
  - framework update runs an agent access check;
  - the adoption skeletons gain *Agent access* and *Known gaps* lines, and premise violations are recorded as known gaps.
- `AI.md`: Phase 2 (agent principal; premise gaps), Phase 6 (definition of done), and the Project Initialization Protocol (CHECK AGENT ACCESS, greenfield foundation, brownfield `add-agent-access`, validation, report).
- `WORKFLOW.md`: agent principal in AGENTIC IMPACT, the definition of done, the foundation paragraph, and the two exceptions.
- `openspec/README.md`: rules 7 and 8, and the layout.
- `openspec/changes/_template/proposal.md`: `Agent principal` and `Known gaps` lines. `tasks.md`: an Agent-Ready validation item.
- **New** `openspec/changes/_template-add-agent-access/` (framework-managed): proposal, design, tasks and `specs/agent-access/spec.md`, with no dependency on any technology.
- **New** `openspec/changes/_template-add-product-agent/` (framework-managed): reference for creating a Product Agent of any kind (support, activation, sales, or any other), with no dependency on any language, framework, runtime, model or provider; `AI-FIRST.md` gains `## Creating a Product Agent` (who, when, how) and `openspec/README.md` rule 9. It is used only when the human asks for an agent.
- `CAPABILITIES.md` template: a *Foundation* section with the `agent-access` row, type `foundation`, and an `Agent principal` contract key. `PROJECT.md` and `ARCHITECTURE.md` templates: *Agent access* line; `ARCHITECTURE.md` also gets a *Known gaps* line.
- Scripts, `bootstrap.sh` and `bootstrap.ps1` in parity:
  - `openspec/changes/_template*` is framework-managed;
  - a read-only agent access check on `--update` (a filled `agent-access` row in CAPABILITIES.md, or an open or archived `add-agent-access` change), printed as AGENT ACCESS CHECK REQUIRED;
  - an `## Agent access check` section in PENDING.md;
  - the check is non-blocking.
- `bootstrap/UPDATE-INSTRUCTIONS.md`: new step 3, *Agent access check*.
- README: premise and foundation, *Greenfield and brownfield*, initialization, the file table, and "Upgrading to 2.4.0".

Version: **2.3.0 → 2.4.0** (minor, new capability). **Not breaking.**

### Files under template/

| File | Change | Management |
|---|---|---|
| `AI-FIRST.md`, `AI.md`, `WORKFLOW.md`, `openspec/README.md` | changed | framework-managed |
| `openspec/changes/_template/proposal.md`, `tasks.md` | changed | framework-managed |
| `openspec/changes/_template-add-agent-access/{proposal,design,tasks}.md`, `specs/agent-access/spec.md` | added | framework-managed |
| `openspec/changes/_template-add-product-agent/{proposal,design,tasks}.md`, `specs/product-agent/spec.md` | added | framework-managed |
| `CAPABILITIES.md`, `PROJECT.md`, `ARCHITECTURE.md` | changed | project-managed |
| `.bootstrap-version` | 2.4.0 | version |

### Existing projects on `--update`

- The framework files above are refreshed when untouched and merged by the agent when customized (the 2.2.0 mechanism). The reference folder is created.
- Project files are never modified by the script. When there is no filled `agent-access` row and no `add-agent-access` change, the update reports AGENT ACCESS CHECK REQUIRED. The agent then checks the product from cheap evidence:
  - in place: it records the row;
  - missing or partial: it writes `openspec/changes/add-agent-access/` for approval and records the gap in the catalog, *Agent surface* and *Agentic Strategy*.
- No product code is changed and no secret is asked for or written. A product that already has `agent-access`, or the change, is not asked again. Existing catalogs and changes stay valid. Nothing to delete.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `agent-first-architecture`: both parts of the premise checked, agent access foundation, premise gaps, agent access check on update.

## Non-goals

- No required runtime, protocol, provider, credential format, manifest, tool registry or MCP.
- No secret value requested, generated or recorded.
- No weakening of the other brownfield rules: no refactoring, API rewrites or self-opened changes for any other gap.
- No automatic implementation of `add-agent-access`, and no product code change from an update.

## Impact

- The `template/` files above, `bootstrap/bootstrap.sh`, `bootstrap/bootstrap.ps1`, `bootstrap/UPDATE-INSTRUCTIONS.md` and `README.md`.
- `examples/multi-repo-example/`: framework files mirrored; the agent's step 3 applied as a worked case (the `add-agent-access` change, the *Foundation* row, and *Agent access* lines).
