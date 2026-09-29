# Design: add-agent-access

Pending the Level 2 decisions in the [proposal](proposal.md). Nothing here assumes a mechanism.

## Solution

Every agent call to the Orders HTTP API passes one check in `api`'s application layer, before any orders capability runs: verify the agent's own credential → resolve agent principal, represented customer and tenant → check scope (deny by default) → apply the capability's autonomy policy → run → audit.

- **Principal.** A principal type of its own, next to customer, shop operator and third-party integration.
- **Credential.** Mechanism per the decision. One per agent; stored only as a hash or in a secret store; the value is shown once at issuance and never logged or returned again.
- **Represented customer.** Established only from the customer's delegation (per the decision in the proposal), never from a customer id the agent names. Effective permission = agent scope ∩ delegated scope ∩ that customer's permission. The confirmation `cancel_order` requires is given by the customer with their own session. An agent cancelling for a customer can never cancel another customer's order.
- **Policy.** `cancel_order: REQUIRES_CONFIRMATION` is enforced in `api`: the customer's confirmation is a recorded step.
- **Audit.** The order status history gains the actor type and agent credential id; every agent call is audited with the fields in the proposal.
- **Fail closed.** Without configuration, every agent call is rejected.

## Existing access

Third-party integrations authenticate to the Orders HTTP API (mechanism needs validation; nothing about its secrets is recorded here). They stay unchanged. No agent credential exists, so there is nothing to migrate.

## Contracts

| Contract | Change | Provider → Consumers | Compatibility |
|---|---|---|---|
| Agent authentication on the Orders HTTP API | added | `api` → agents | additive; customers, operators and integrations unchanged |
| Agent credential administration | added | `api` → shop operators | additive |

## Risks

| Risk | Mitigation |
|---|---|
| Agent scope wider than needed | deny by default; first agent limited to `get_order` and `cancel_order` for one shop |
| Integration authentication affected | agent principal is a separate type; integration path untouched and regression-tested |

## Validation

- An agent with its own credential reads an order in scope; the audit record has every field.
- Out-of-scope capability or shop, revoked or expired credential, and missing configuration: rejected with structured errors, no data from other shops.
- An agent acting for a customer cannot act on another customer's order.
- A customer's or operator's session is not accepted as an agent credential.
