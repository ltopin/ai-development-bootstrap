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

For a generated app (design or app-builder tool), the evidence is the extraction table. Delete otherwise. See `protocol/DESIGN-DRIVEN.md`.

| Element (file) | Needs | Real contract | Status (`exists` / `partial` / `missing` / `proposed`) |
|---|---|---|---|
| `<component or endpoint (file)>` | `<fields or behavior>` | `<contract, or none>` | `<status>` |

### Design comparison

For a generated app with a design reference (`design/<tool>/`). Delete otherwise. Without a design reference, write "no design comparison: no design reference". See `protocol/DESIGN-DRIVEN.md`.

Design files used: `<files under design/<tool>/>`

| Invention (file) | Visible | Outcome (`removed` / `kept` / `waiting`) | Decision |
|---|---|---|---|
| `<screen, behavior, endpoint or document (file)>` | `<yes / no>` | `<outcome>` | `<DECISIONS.md entry, or none>` |

Design gaps (links to screens that are not in the design reference): `<none, or list>`.

## Repositories potentially affected

| Repository | Why |
|---|---|
| `<repo>` | <reason> |

Repositories checked and found **not** affected: `<repo>` (<one-line reason>).
