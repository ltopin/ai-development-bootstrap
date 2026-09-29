# PROJECT

> L0 document — keep it under one screen. Replace every `<placeholder>`. Delete this note.

## Initialization

Status: NOT_INITIALIZED

<!-- Set by the agent when the Project Initialization Protocol (see AI.md) completes:
     replace NOT_INITIALIZED with INITIALIZED and add a line "Last reviewed: YYYY-MM-DD". -->

## Name

`<project name>`

## Purpose

`<One or two sentences: what problem this product solves and for whom.>`

## Domain

`<Business area, e.g. "online ordering", "learning management", "internal tooling".>`

## Users

| User | Goal |
|---|---|
| `<end user>` | `<what they do with the product>` |
| `<admin / operator>` | `<what they manage>` |

## Main capabilities

- `<capability 1>`
- `<capability 2>`
- `<capability 3>`

Group larger products by domain and link to `docs/domains/<domain>.md`. The detailed catalog (queries, knowledge, commands, events, policies) is [CAPABILITIES.md](CAPABILITIES.md).

## Agentic Strategy

Agent-First: YES
<!-- YES: new capabilities are built Agent-Ready (see AI-FIRST.md). Set NO only with an ACTIVE entry in DECISIONS.md. -->

Adoption mode: `<GREENFIELD | BROWNFIELD>`
<!-- GREENFIELD: a new product, Agent-First by design. BROWNFIELD: an existing product, Agent-First by evolution:
     existing capabilities converge as work touches them, never through a rewrite (AI-FIRST.md#greenfield-and-brownfield).
     Set during initialization from evidence; delete the line if unclear. -->

Primary agent channels: `<e.g. chat, WhatsApp, API — or none yet>`
Autonomous journeys: `<only journeys that exist: acquisition, sales, onboarding, activation, support, retention, billing, operations — or none yet>`
Human approval boundaries: `<actions that always need a human, or unknown>`
Knowledge strategy: `<where Product Agents get non-transactional knowledge, e.g. docs/ Markdown — or not defined>`

## Product Agents

Optional. Only agents that exist or are decided; delete this section otherwise.

### `<Support Agent>`

Purpose: `<what it does for whom>`
Capabilities: `<names from CAPABILITIES.md>`
Autonomy: `<summary, e.g. queries AUTO; cancellations REQUIRES_CONFIRMATION>`

## Constraints

Things an agent must not violate. Only list real ones.

- `<e.g. regulatory / privacy requirements>`
- `<e.g. backward compatibility promised to API clients>`
- `<e.g. mandatory review or release process>`

## Environments

| Environment | Purpose | Notes |
|---|---|---|
| local | development | `<how it is run, pointer to a repo README>` |
| staging | pre-release validation | `<...>` |
| production | live | `<deploy is done by ..., agents never deploy>` |

## Glossary

Only terms whose meaning is not obvious or is overloaded in this project.

| Term | Meaning |
|---|---|
| `<term>` | `<definition>` |

## Where to go next

- Repository map: [REPOSITORIES.md](REPOSITORIES.md)
- System architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Capability catalog: [CAPABILITIES.md](CAPABILITIES.md)
- Agent protocol: [AI.md](AI.md); Agent-First architecture: [AI-FIRST.md](AI-FIRST.md)
