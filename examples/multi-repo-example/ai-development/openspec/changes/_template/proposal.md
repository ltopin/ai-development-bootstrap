# <change-id>: <short title>

## Problem

What is wrong or missing, and for whom. One paragraph.

## Goal

The outcome when this change is done, in observable terms.

## Scope

- <what is included>

## Out of scope

- <what is deliberately not included>

## Classification

Class: `<A frontend-only | B frontend + existing API | C frontend + API change | D frontend + new backend capability>` — evidence: `<contract, spec or search that supports it>`. Delete for changes without a user-facing surface. See `protocol/CLASSIFICATION.md`.

For designed input, the evidence is the **requirements table**, one row per designed element that needs data or an effect; statuses `exists` / `partial` / `missing`. Delete otherwise. See `protocol/DESIGN-DRIVEN.md`.

| Element (design file) | Needs | Real contract | Status |
|---|---|---|---|
| `<element (file)>` | `<fields or behavior>` | `<contract, or none>` | `<status>` |

### Design

For designed input. Delete otherwise. See `protocol/DESIGN-DRIVEN.md`.

Design files used: `<files under design/<tool>/>` — export time: `<manifest.json exportedAt, or no manifest>`

Design gaps (links to screens that are not in the design reference): `<none, or list>`.

States added (loading, empty, error or validation states the design does not draw): `<none, or list>`.

## Agentic Impact

For changes that create or alter a business capability. Answer from `AI-FIRST.md#agentic-impact-analysis`; keep only the lines that apply. A purely technical change (dependency upgrade, lint, CI, internal refactor, technical docs) replaces this whole section with one line: `Agentic Impact: NOT APPLICABLE`.

- Agent accessible: `<YES | NO — justify why | NOT APPLICABLE>`
- Capabilities: `<names in CAPABILITIES.md, added or changed>`
- Queries: `<state an agent reads>`
- Knowledge: `<knowledge needed to decide safely, and its source>`
- Commands: `<state changes an agent may execute>`
- Events: `<events emitted>`
- Policies: `<command: autonomy level, limits>`
- Required context: `<what an agent must know before acting>`
- Authorization: `<who may call; agent scope; tenant rule>`
- Audit requirements: `<what is recorded>`
- Human approval: `<actions needing confirmation or approval, or none>`

## Repositories potentially affected

| Repository | Why |
|---|---|
| `<repo>` | <reason> |

Repositories checked and found **not** affected: `<repo>` (<one-line reason>).
