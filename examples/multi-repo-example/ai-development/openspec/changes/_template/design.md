# Design: <change-id>

> Needed for cross-repository or non-obvious changes. Delete for trivial ones.

## Solution

How it works end to end, in a few paragraphs. Add a Mermaid diagram if the flow crosses repositories.

## Contracts

Every contract that is added or changed. Match names in REPOSITORIES.md.

| Contract | Change | Provider → Consumers | Compatibility |
|---|---|---|---|
| `<endpoint / event / schema>` | added / modified / removed | `<api → web>` | additive / breaking (migration: ...) |

## Decisions

- **<Decision>** — because <reason>; alternative rejected: <alternative>.

Durable architectural decisions also get an ADR in `docs/adr/`.

## Risks

| Risk | Mitigation |
|---|---|
| `<e.g. consumers deployed before provider>` | `<additive first, feature flag, ordered rollout>` |

## Validation

How we will know it works: checks per repository plus one cross-repository scenario.
