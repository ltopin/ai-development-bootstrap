# Change classification

Applies after impact analysis ([AI.md](../AI.md) Phase 2), to any change with a user-facing surface, including changes that arrive from outside the workspace (a design export, a ticket, a webhook). "Frontend" below means the client/presentation layer, whatever its repository is called (web, mobile, admin UI).

Classification decides **how much to verify before implementing** and **which repositories to open**. It never justifies opening more than the impact set.

## Classes

| Class | Meaning | Typical signals |
|---|---|---|
| **A. frontend-only** | Presentation, layout, client state, copy. No contract or data changes. | Existing endpoints, fields and permissions cover everything the UI needs. |
| **B. frontend + existing API integration** | The UI needs to call an API that already exists and already returns what is needed. | An endpoint/event is documented in [REPOSITORIES.md](../REPOSITORIES.md) contracts or a spec, and the UI simply does not use it yet. |
| **C. frontend + change to an existing API** | An existing contract must be extended or altered: new field, filter, permission, behavior. | The capability exists but does not expose what the UI needs. |
| **D. frontend + new backend capability** | Something the backend cannot do today: new entity, endpoint family, integration, job, service. | No equivalent model/service/contract exists. |

Rules:

- Classify from **evidence** (contracts, specs, a targeted search of the provider), not from how the change is worded. "Just a button" can be class D.
- Reclassify as soon as evidence contradicts the class (a B whose endpoint lacks a field becomes C). Say so, and re-run the checks below for the new class.
- When two classes fit, take the higher one.
- Record the class and the evidence in the change's `proposal.md` (see the template) or, for direct edits, in the PR description.

### Designed input

When the change asks to implement screens of a **design reference** ([DESIGN-DRIVEN.md](DESIGN-DRIVEN.md)):

- The evidence is the **requirements table**: one row per designed element that needs data or an effect (`exists` → B, `partial` → C, `missing` → D; highest wins).
- Display elements and navigation between designed screens are not rows. When no element needs data or an effect, the change is class **A** and the pull request says "no requirements need data: presentation only".

## Checks before implementing

Do each check at the cheapest level that answers it. A check that does not apply is answered with one line ("no persistence change"), not skipped silently.

| Check | Verify | Where to look first | Required for |
|---|---|---|---|
| Existing contracts/endpoints | Does the needed endpoint/event exist, and does it return everything needed? | contracts table in REPOSITORIES.md → spec or the contract's source of truth → one targeted search in the provider | B, C, D (A: confirm that none is needed) |
| Equivalent models/services | Is there already a model, service or repository that does this? | domain doc → targeted search by entity/route name in the provider | C, D |
| Reuse | Can the need be met by composing what exists, before adding anything? | result of the two checks above | B, C, D |
| Authentication / authorization | New roles, scopes, ownership rules, unauthenticated access, token or session changes? | ARCHITECTURE.md boundaries, provider's auth code at the affected route | B, C, D |
| Multi-tenancy | Is every new read/write scoped by tenant? Any cross-tenant data path? | ARCHITECTURE.md data ownership, provider's tenant-scoping convention | B, C, D |
| Persistence | New tables/columns/indexes, changed semantics of stored data, retention? | domain doc, provider's schema/migrations | C, D |
| Migrations | Is there a migration, is it reversible, is it additive, does it lock or destroy data? | provider's migration folder | C, D whenever persistence changes |
| External integrations | New or changed third-party calls, webhooks, providers, quotas, costs? | REPOSITORIES.md dependencies, [DECISIONS.md](../DECISIONS.md) | any class |
| Other repositories | Who else consumes each changed contract or table? | Depends-on column and contracts table | C, D (B when a consumer's behavior is affected) |

Any check that reveals a **Level 2** situation (see [DECISION-POLICY.md](DECISION-POLICY.md)) stops the affected work with `WAITING_FOR_HUMAN`; it is not resolved by choosing quietly.

## What to open, per class

Progressive disclosure still applies. Repositories outside the impact set stay closed.

| Class | Open (L2/L3) | Read only as contract (L1) |
|---|---|---|
| A | the frontend repo | the contract, only to confirm nothing changes |
| B | the frontend repo | the API's contract/spec; provider source only if the contract is ambiguous |
| C | frontend + provider + every consumer of the changed contract | specs, domain doc |
| D | frontend + provider + data owner + infra if deploy order matters + consumers of anything touched | specs, domain doc, [DECISIONS.md](../DECISIONS.md) |

## Implementation order

Same as [WORKFLOW.md](../WORKFLOW.md): contract/schema (additive) → provider → consumers → infrastructure. Classes A and B have only the consumer step; C and D start at the contract.

## Recording

```markdown
## Classification

Class: B — frontend + existing API integration
Evidence: `GET /orders/{id}` in `openspec/specs/orders/spec.md` already returns `status` and `history`.
Checks: auth — existing session, no change; tenancy — provider already scopes by tenant; persistence — none.
```
