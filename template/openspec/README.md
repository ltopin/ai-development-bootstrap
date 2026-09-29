# openspec

Lightweight spec-driven development for changes that cross repositories.

```
openspec/
├── project.md          conventions for specs and changes in this project
├── specs/              current behavior/contracts, one folder per capability
└── changes/
    ├── _template/      copy this to start a change
    ├── _template-add-agent-access/   reference for add-agent-access (agent access foundation)
    ├── _template-add-product-agent/  reference for add-<agent>-agent (a Product Agent, on request)
    ├── <change-id>/    open changes
    └── archive/        finished changes (create on first archive)
```

## Concepts

- **Spec** (`specs/<capability>/spec.md`) — what the system does *now*, from the outside: behavior and contracts, not implementation. The source of truth for cross-repository behavior.
- **Change** (`changes/<change-id>/`) — a proposed modification: why, how, and the spec deltas. One change = one logical product change, however many repositories it touches.

## Pragmatic rules

1. Not every task needs a change. See [WORKFLOW.md](../WORKFLOW.md#when-is-a-formal-change-required).
2. Only `proposal.md` is always required, and it may be five lines long.
3. `design.md`, `tasks.md` and `specs/` appear only when they add information. Never create empty or filler files.
4. Name changes by outcome: `add-payment-method`, `split-notification-preferences`. Never by repository.
5. Specs describe observable behavior and contracts. Keep implementation details in the repositories.
6. Settle contracts in the change *before* implementing them.
7. A change that creates or alters a business capability fills `## Agentic Impact` in its proposal ([AI-FIRST.md](../AI-FIRST.md#agentic-impact-analysis)); a purely technical one writes `Agentic Impact: NOT APPLICABLE`. A change that touches an existing capability also states its current and target readiness and the gaps left out of scope ([AI-FIRST.md](../AI-FIRST.md#touched-capability-rule)); Agent-First never widens a change's scope on its own. Every such change states its **agent principal** (or `none — gap`, pointing to `add-agent-access`) and its known premise gaps ([AI-FIRST.md](../AI-FIRST.md#premise-gaps)).
8. `changes/_template-add-agent-access/` is the reference for the one change every product needs: `add-agent-access`, the [agent access foundation](../AI-FIRST.md#agent-access-foundation). Copy it to `changes/add-agent-access/` only when the product has no `agent-access`.
9. `changes/_template-add-product-agent/` is the reference for creating a Product Agent of any kind ([AI-FIRST.md](../AI-FIRST.md#creating-a-product-agent)). Copy it to `changes/add-<agent>-agent/` only when the human asks for that agent.

## Spec format

Keep specs scannable. Requirements use SHALL/SHOULD language and each has at least one scenario:

```markdown
# <Capability>

## Requirements

### Requirement: <name>
The system SHALL <observable behavior>.

#### Scenario: <name>
- **WHEN** <trigger>
- **THEN** <result>
```

## Spec deltas in a change

Inside a change, `specs/<capability>/spec.md` contains only what changes, under these headings:

```markdown
## ADDED Requirements
## MODIFIED Requirements
## REMOVED Requirements
```

On close, merge the deltas into `openspec/specs/<capability>/spec.md` and archive the change.

## Starting a change

Copy [changes/_template/](changes/_template/) to `changes/<change-id>/` and delete what you do not need.

The layout follows the common OpenSpec directory convention, but no CLI or tooling is required.
