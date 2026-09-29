# add-agent-access: agent access foundation

Written by the Development Agent while finishing the 2.4.0 bootstrap update ([AI-FIRST.md](../../../AI-FIRST.md#agent-access-foundation)). **Awaiting human approval: not implemented.**

## Problem

Part 2 of the premise is not met: no agent can call the orders capabilities with an identity of its own. The Orders HTTP API authorizes the order's customer, shop operators and third-party integrations. None of these is an agent principal. An agent would have to borrow a customer's or operator's credentials, which cannot be scoped, audited as an agent or revoked on their own. So `cancel_order` and every other orders capability is `PARTIALLY_AGENT_READY` at most.

## Goal

An authorized agent calls an orders capability with its own principal and credential, scoped to that capability and tenant, audited on behalf of the customer it represents, and revocable at once by an administrator. With no configuration, no agent gets in.

## Scope

The foundation only, in `api`'s application layer:

- agent principal, distinct from customers, shop operators, services and third-party integrations;
- one credential per agent, never shared with humans, stored only as a hash or in a secret store, never in a repository, log or response;
- explicit scope per capability and per tenant: least privilege, denied by default;
- represented user: when an agent acts for a customer, that customer is recorded, and the agent never has more permission than that customer;
- delegation: an agent acts for a customer only when that customer delegated to it (a live session of their own, or a recorded consent with scope and expiry), and the customer can revoke it;
- issuance, rotation, expiration and immediate revocation, by a shop operator with an administrator role only;
- audit of every call: agent, credential, represented user, tenant, capability, result, correlation id;
- autonomy policy enforced in `api` (for example `cancel_order: REQUIRES_CONFIRMATION`), never only in the agent's prompt;
- rate limiting per credential; structured errors that do not leak data from other tenants;
- fail closed: without configuration, no agent is accepted.

Reuse: third-party integrations already authenticate to the Orders HTTP API (mechanism needs validation), and the order status history already records transitions. No agent credential exists today, so there is nothing to migrate.

## Out of scope

- Making every orders capability Agent-Ready: each converges when a change touches it.
- Changing how customers, operators or third-party integrations authenticate.
- Building a Product Agent, a capability manifest, a tool registry or an agent runtime.
- Any secret value.

## Decisions needed (Level 2)

| Question | Options seen in the product | Answer |
|---|---|---|
| Authentication mechanism for agent principals | reuse the third-party integration mechanism with a distinct principal type, or a separate mechanism | pending |
| How a customer delegates to an agent | the customer's own session exchanged by `api` (customer present), recorded consent (customer absent), or both | pending |
| Who may issue, rotate and revoke agent credentials | shop operators with an administrator role | pending |
| Initial agents and scopes | none yet; first candidate: `get_order`, `cancel_order` for one shop | pending |
| Default autonomy for agent calls | queries `AUTO`; commands as in CAPABILITIES.md | pending |
| Credential lifetime and rotation period | — | pending |

## Agentic Impact

- Agent accessible: YES — this change is what makes agent access possible
- Capabilities: `agent-access` (Foundation in CAPABILITIES.md)
- Commands: `issue_agent_credential`, `revoke_agent_credential`: `HUMAN_ONLY`, administrators
- Authorization: administrators manage credentials; agents are authorized per capability and tenant, denied by default
- Agent principal: introduced by this change
- Audit requirements: every agent call and every credential lifecycle action
- Human approval: issuance, rotation and revocation are human-only
- Current Agent Readiness: `NOT_AGENT_READY` — evidence: no agent principal or agent credential; audit does not record an actor type
- Target Agent Readiness: `AGENT_READY` for `agent-access`
- Known gaps intentionally left out of scope: `get_order` and `place_order` contracts still need validation

## Repositories potentially affected

| Repository | Why |
|---|---|
| `api` | principal, credential verification, scope checks, audit |

Repositories checked and found **not** affected: `web` (customers and operators keep their own sign-in), `worker` (consumes events only).
