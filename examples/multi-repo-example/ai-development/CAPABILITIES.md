# CAPABILITIES

> L1 document. What this platform can do, for human interfaces, integrations, automations and Product Agents. Read only the section of the domain your task involves. Concepts and levels: [AI-FIRST.md](AI-FIRST.md).

Product-level catalog, not API documentation: shapes live in the Orders HTTP API contract (`../api/openapi.yaml`, illustrative path) and [docs/domains/orders.md](docs/domains/orders.md).

Status values ([Agent readiness](AI-FIRST.md#agent-readiness)): `AGENT_READY` | `PARTIALLY_AGENT_READY` | `NOT_AGENT_READY` | `UNKNOWN` | `planned`. Autonomy (commands only): `AUTO` | `AUTO_WITH_LIMITS` | `REQUIRES_CONFIRMATION` | `REQUIRES_APPROVAL` | `HUMAN_ONLY`, see [AI-FIRST.md](AI-FIRST.md#autonomy-levels).

## Agent readiness

| Domain | Readiness | Evidence / gaps |
|---|---|---|
| orders | PARTIALLY_AGENT_READY | Public HTTP API already used by third parties; cancellation rule lives in `api`. No Product Agent credential or actor in audit yet; no knowledge sources identified. |

## orders

| Name | Type | Purpose | Owner | Autonomy | Status |
|---|---|---|---|---|---|
| `get_order` | query | Current status and history of an order | `api` | — | UNKNOWN |
| `place_order` | command | Create an order for a customer | `api` | unknown | UNKNOWN |
| `cancel_order` | command | Cancel an order that has not shipped | `api` | REQUIRES_CONFIRMATION | PARTIALLY_AGENT_READY |
| `order.status_changed` | event | An order moved from one status to another | `api` | — | AGENT_READY |

Policy notes: `cancel_order`: the customer confirms before an agent cancels on their behalf; orders already `shipped` cannot be cancelled by anyone (domain rule in `api`).

Notes: `get_order` and `place_order` are evidenced by the Orders HTTP API and the product's capabilities, but their exact operations are not confirmed. `cancel_order` is reachable programmatically (`POST /orders/{id}/cancel`); an agent actor is not yet distinguished in audit. Knowledge sources for Product Agents: none identified.

### Contract details

#### cancel_order
- Agent Readiness: PARTIALLY_AGENT_READY
- Evidence: `POST /orders/{id}/cancel` in the Orders HTTP API; the shipped-order rule lives in `api`
- Gaps: missing auditability (agent actor not recorded); authorization not designed for agent credentials
- Purpose: cancel a customer's order before it ships
- Domain: orders
- Type: command
- Input / Output: `POST /orders/{id}/cancel` → updated order (Orders HTTP API)
- Side effects: status `cancelled`; emits `order.status_changed`
- Authorization: the order's customer or a shop operator (needs validation for agent credentials)
- Autonomy: REQUIRES_CONFIRMATION
- Idempotency: cancelling an already cancelled order returns the order unchanged (needs validation)
- Errors: order already shipped → structured error (code needs validation)
- Audit: status history records the transition; actor type not yet recorded
- Owner: `api`
