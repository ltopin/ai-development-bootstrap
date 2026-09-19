# Orders

## Responsibility

Owns the lifecycle of an order: creation, status transitions, cancellation. Does not own payment or inventory.

## Repositories

| Repository | Role in this domain | Entry points (illustrative) |
|---|---|---|
| `api` | business rules, persistence, emits events | `../api/src/orders/` |
| `web` | order forms and status pages | `../web/src/features/orders/` |
| `worker` | reacts to status events, sends notifications | `../worker/src/jobs/order-notifications/` |

## Key entities

- `Order` — statuses: `placed → paid → shipped → delivered`, or `cancelled`. Owned by `api`.

## Contracts

- `POST /orders/{id}/cancel` — `api` → `web`; defined in the OpenAPI file.
- `order.status_changed` — `api` → `worker`.

## Events

| Event | Emitted by | Consumed by | Purpose |
|---|---|---|---|
| `order.status_changed` | `api` | `worker` | Trigger customer notification. Payload: `orderId`, `from`, `to`, `occurredAt` |

## Dependencies

Depends on no other domain in this example.
