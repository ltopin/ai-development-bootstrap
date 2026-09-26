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

For designed input, the evidence is a table. Delete otherwise. See `protocol/DESIGN-DRIVEN.md`.

- **Direct path** (design reference, no generated app): the **requirements table**, one row per designed element that needs data or an effect; statuses `exists` / `partial` / `missing`.
- **Builder path** (generated app): the **extraction table**, one row per fake boundary; statuses `exists` / `partial` / `missing` / `proposed`.

| Element (design file, or code file) | Needs | Real contract | Status |
|---|---|---|---|
| `<element (file)>` | `<fields or behavior>` | `<contract, or none>` | `<status>` |

### Design

For designed input. Delete otherwise. See `protocol/DESIGN-DRIVEN.md`.

Design files used: `<files under design/<tool>/>` — export time: `<manifest.json exportedAt, or no manifest>`

Design gaps (links to screens that are not in the design reference): `<none, or list>`.

States added (direct path: loading, empty, error or validation states the design does not draw): `<none, or list>`.

Design comparison (builder path only). Without a design reference, write "no design comparison: no design reference".

| Invention (file) | Visible | Outcome (`removed` / `kept` / `waiting`) | Decision |
|---|---|---|---|
| `<screen, behavior, endpoint or document (file)>` | `<yes / no>` | `<outcome>` | `<DECISIONS.md entry, or none>` |

## Repositories potentially affected

| Repository | Why |
|---|---|
| `<repo>` | <reason> |

Repositories checked and found **not** affected: `<repo>` (<one-line reason>).
