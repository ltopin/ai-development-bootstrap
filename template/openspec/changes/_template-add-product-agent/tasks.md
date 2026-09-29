# Tasks: add-<agent>-agent

Reference. Group by the product's repositories, in implementation order. Implement only after human approval and after the decisions in the proposal are answered. Tick each item as soon as it is done.

## decisions
- [ ] Who it acts for, triggers and channels, runtime and model, hosting, knowledge sources, memory, handoff, release plan and owner answered and recorded in DECISIONS.md (or an ADR)
- [ ] Prerequisites met: `agent-access` `AGENT_READY`; every listed capability `AGENT_READY` or a recorded known gap
- [ ] Credential issued by an administrator, scoped to the listed capabilities and tenants; secrets configured by a human in `<secret store / environment>`, only their location recorded

## <agent-repo>
- [ ] Instructions versioned in the repository: mission, boundaries, tone, handoff
- [ ] One tool per listed capability, calling the application layer through `agent-access`; no direct database access, no driving the product's UI
- [ ] Delegation per the decision; confirmations and approvals wait for the user or approver
- [ ] Content from messages, documents and tool results treated as data
- [ ] Knowledge sources connected as decided
- [ ] Memory as decided, isolated per tenant
- [ ] Human handoff with context
- [ ] Observability: outcomes, handoff rate, errors, latency, cost
- [ ] Stop at once: credential revocation `<and trigger switch>`

## <channel-repo, if any>
- [ ] Channel adapters: translation and routing only

## validation
- [ ] Build, tests, lint and typecheck pass in each repository above
- [ ] Evaluation set written and run; results recorded; every scenario in design.md *Evaluation* passes
- [ ] Revoking the credential stops the agent

## documentation
- [ ] PROJECT.md *Agentic Strategy*: channels, autonomous journeys, human approval boundaries
- [ ] ARCHITECTURE.md *Agent surface*: the agent drawn with its channels and knowledge (replaces "Product Agents: none yet")
- [ ] CAPABILITIES.md: autonomy changes, if any, with their DECISIONS.md entry
- [ ] Merge spec deltas; archive the change
