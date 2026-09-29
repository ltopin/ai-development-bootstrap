# CAPABILITIES

> L1 document. What this platform can do, for human interfaces, integrations, automations and Product Agents. Read only the section of the domain your task involves. Concepts and levels: [AI-FIRST.md](AI-FIRST.md).

Product-level catalog, not API documentation: shapes live in the Orders HTTP API contract (`../api/openapi.yaml`, illustrative path) and [docs/domains/orders.md](docs/domains/orders.md).

Status values ([Agent readiness](AI-FIRST.md#agent-readiness)): `AGENT_READY` | `PARTIALLY_AGENT_READY` | `NOT_AGENT_READY` | `UNKNOWN` | `planned`. Autonomy (commands only): `AUTO` | `AUTO_WITH_LIMITS` | `REQUIRES_CONFIRMATION` | `REQUIRES_APPROVAL` | `HUMAN_ONLY`, see [AI-FIRST.md](AI-FIRST.md#autonomy-levels).

## Foundation

| Name | Type | Purpose | Owner | Autonomy | Status |
|---|---|---|---|---|---|
| `agent-access` | foundation | Agent principals, scoped credentials, represented user and delegation, audit, revocation | `api` | — | NOT_AGENT_READY |

Notes: Known gap: no agent principal. The Orders HTTP API authorizes customers, shop operators and third-party integrations only, so agents would need a human's credentials. See [openspec/changes/add-agent-access/](openspec/changes/add-agent-access/) (awaiting approval; mechanism not decided).

## Agent readiness

| Domain | Readiness | Evidence / gaps |
|---|---|---|
| orders | PARTIALLY_AGENT_READY | Public HTTP API already used by third parties; cancellation rule lives in `api`. No agent principal (see `add-agent-access`); no actor in audit yet; no knowledge sources identified. |

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
- Gaps: no agent principal (see `add-agent-access`); missing auditability (agent actor not recorded)
- Purpose: cancel a customer's order before it ships
- Domain: orders
- Type: command
- Input / Output: `POST /orders/{id}/cancel` → updated order (Orders HTTP API)
- Side effects: status `cancelled`; emits `order.status_changed`
- Authorization: the order's customer or a shop operator
- Agent principal: none — gap: only human sessions and third-party integrations are authorized; see `add-agent-access`
- Autonomy: REQUIRES_CONFIRMATION
- Idempotency: cancelling an already cancelled order returns the order unchanged (needs validation)
- Errors: order already shipped → structured error (code needs validation)
- Audit: status history records the transition; actor type not yet recorded
- Owner: `api`
