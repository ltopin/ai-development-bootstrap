# Design: add-order-cancellation

## Solution

`web` calls a new `api` endpoint. The `api` rejects the request if the order is `shipped` or later, otherwise sets status `cancelled` and emits `order.status_changed` (existing event). The `worker` already consumes that event and gains a template for `to = cancelled`.

## Contracts

| Contract | Change | Provider → Consumers | Compatibility |
|---|---|---|---|
| `POST /orders/{id}/cancel` | added | `api` → `web` | additive |
| `order.status_changed` | shape unchanged; new value `cancelled` for `to` | `api` → `worker` | additive; worker must ignore unknown values until deployed |

## Decisions

- **Reuse the existing event** instead of a new `order.cancelled` event — consumers already handle status changes ([ADR 0001](../../../docs/adr/0001-use-events-for-side-effects.md)).

## Risks

| Risk | Mitigation |
|---|---|
| `api` deployed before `worker` handles `cancelled` | worker ignores unknown statuses; deploy order api → worker → web |
| Cancel racing with shipping | status check and update in one transaction |

## Validation

Per-repo tests, plus a scenario: cancel a `paid` order in staging and observe status and email; cancel a `shipped` order and observe rejection.
