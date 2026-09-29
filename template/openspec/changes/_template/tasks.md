# Tasks: <change-id>

Grouped by repository, in implementation order (contracts → providers → consumers → infra). Tick each item as soon as it is done, not at the end; note deviations inline.

## contracts
- [ ] Update contract definition / spec deltas

## <provider-repo>
- [ ] <implementation task>
- [ ] <tests>

## <consumer-repo>
- [ ] <implementation task>
- [ ] <tests>

## validation
- [ ] Build, tests, lint and typecheck pass in each repository above
- [ ] Cross-repository scenario verified: <scenario>
- [ ] Agent-Ready: an agent principal calls the capability with its own credential (or the gap is recorded and points to add-agent-access)

## documentation
- [ ] Update affected L0 / domain docs and CAPABILITIES.md (including the readiness of touched capabilities); merge spec deltas; ADR if needed; archive change
