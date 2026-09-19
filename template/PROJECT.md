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

Group larger products by domain and link to `docs/domains/<domain>.md`.

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
- Agent protocol: [AI.md](AI.md)
