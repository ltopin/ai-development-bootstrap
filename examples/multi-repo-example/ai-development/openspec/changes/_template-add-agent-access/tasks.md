# Tasks: add-agent-access

Reference. Group by the product's repositories, in implementation order. Implement only after human approval. Tick each item as soon as it is done.

## decisions
- [ ] Mechanism, user delegation, credential administrators, initial agents and scopes, default autonomy and credential lifetime answered and recorded in DECISIONS.md (or an ADR)
- [ ] Secrets configured by a human in `<secret store / environment>`; only their location is recorded

## <provider-repo>
- [ ] Agent principal distinct from human users, services and integrations
- [ ] Credential verification per the decided mechanism; stored only as a hash or in a secret store
- [ ] Scope per capability and tenant, denied by default
- [ ] Represented user recorded; effective permission never above that user's
- [ ] Delegation by the user (live session exchange and/or recorded consent, per the decision); user can revoke it; no delegation means no acting on their behalf
- [ ] Autonomy policy checked at the application layer
- [ ] Audit of every agent call (agent, credential id, represented user, tenant, capability, result, correlation id)
- [ ] Rate limiting per credential; structured errors without data from other tenants
- [ ] Fail closed without configuration
- [ ] Issuance, rotation, expiration and immediate revocation, by administrators only
- [ ] *(brownfield)* Existing agent credential migrated to an agent principal without breaking its channel
- [ ] Tests for every scenario in design.md *Validation*

## <admin-repo, if any>
- [ ] Human administration of agent credentials (value shown once, never again)

## validation
- [ ] Build, tests, lint and typecheck pass in each repository above
- [ ] An agent calls one business capability with its own credential; out-of-scope, revoked and unconfigured cases rejected

## documentation
- [ ] CAPABILITIES.md: `agent-access` row `AGENT_READY` with evidence; capabilities now callable by agents re-evaluated only where this change verified them
- [ ] PROJECT.md *Agentic Strategy* and ARCHITECTURE.md *Agent surface*: *Agent access* line updated, the known gap removed
- [ ] Merge spec deltas; archive the change
