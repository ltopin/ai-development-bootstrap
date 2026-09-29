# Tasks: add-agent-access

Implement only after human approval and after the decisions in the [proposal](proposal.md) are answered.

## decisions
- [ ] Mechanism, customer delegation, credential administrators, initial agents and scopes, default autonomy and credential lifetime answered and recorded in DECISIONS.md
- [ ] Secrets configured by a human in the `api` deployment's secret store; only their location is recorded

## api
- [ ] Agent principal distinct from customers, operators and third-party integrations
- [ ] Credential verification per the decided mechanism; stored only as a hash or in a secret store
- [ ] Scope per capability and tenant, denied by default
- [ ] Represented customer recorded; effective permission never above that customer's
- [ ] Delegation by the customer, per the decision; revocable by the customer; no delegation means no acting on their behalf
- [ ] Autonomy policy checked in the application layer (`cancel_order: REQUIRES_CONFIRMATION`)
- [ ] Audit of every agent call (agent, credential id, represented user, tenant, capability, result, correlation id)
- [ ] Rate limiting per credential; structured errors without data from other tenants
- [ ] Fail closed without configuration
- [ ] Issuance, rotation, expiration and immediate revocation, by administrators only
- [ ] Tests: in scope, out of scope, revoked, expired, represented user, missing or revoked delegation, borrowed human session, unconfigured

## validation
- [ ] Build, tests, lint and typecheck pass in `api`
- [ ] An agent calls `get_order` with its own credential; out-of-scope, revoked and unconfigured cases rejected

## documentation
- [ ] CAPABILITIES.md: `agent-access` `AGENT_READY` with evidence; `cancel_order` re-evaluated
- [ ] PROJECT.md *Agentic Strategy* and ARCHITECTURE.md *Agent surface*: known gap removed
- [ ] Archive the change
