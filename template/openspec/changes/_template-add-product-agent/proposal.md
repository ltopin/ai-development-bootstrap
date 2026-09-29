# add-<agent>-agent: <agent name>

> Reference for a change that creates a Product Agent ([AI-FIRST.md](../../../AI-FIRST.md#creating-a-product-agent)). Copy this folder to `openspec/changes/add-<agent>-agent/` **only when the human asks for a Product Agent**, fill it from the product and the human's answers, and delete these reference notes. It fits any kind of agent (support, activation, sales, billing, operations, or one not listed) and names no language, framework, runtime, model or provider: those are the decisions below. Never write a secret value in any file of this change.

## Problem

`<the journey or work that is slow, manual or not done today, and for whom>`.

## Goal

`<agent name>` handles `<journey>` for `<whom it serves>` by calling the product's capabilities with its own agent principal, within the autonomy the catalog allows, and hands off to a human whenever it cannot or must not act.

## Mission and boundaries

- Serves: `<users of the product | the business | other systems>`
- Does: `<the outcomes it is responsible for>`
- Never does: `<explicit exclusions, e.g. give legal advice, change prices, act outside tenant X>`
- Success looks like: `<observable measures, e.g. share of requests resolved without a human, time to answer>`

## Capabilities used

Only rows that exist in [CAPABILITIES.md](../../../CAPABILITIES.md). This list is the agent's credential scope: anything not listed is denied.

| Capability | Type | Autonomy for this agent | Status |
|---|---|---|---|
| `<get_something>` | query | — | `<AGENT_READY>` |
| `<do_something>` | command | `<AUTO / AUTO_WITH_LIMITS / REQUIRES_CONFIRMATION / REQUIRES_APPROVAL>` | `<AGENT_READY>` |
| `<some_policy>` | knowledge | — | `<AGENT_READY>` |

An agent's autonomy for a command is never higher than the catalog's. A needed capability that is missing or not `AGENT_READY` is a premise gap: list it under *Known gaps* and ask the human whether to open its own change; this change does not build business capabilities.

## Scope

- the agent's instructions, versioned in the repository;
- its triggers and channel adapters (translation and routing only, no business rules);
- its credential scope and delegation, through `agent-access`;
- human handoff and escalation;
- evaluation before release, observability, and a way to stop it at once;
- the records that describe it: *Agentic Strategy*, *Agent surface*, DECISIONS.md.

## Out of scope

- Building or changing business capabilities (each is its own change).
- Raising autonomy above the catalog's level.
- Any secret value: only where each secret is configured is recorded.

## Prerequisites

- `agent-access` is `AGENT_READY` in CAPABILITIES.md. If it is not, this change waits for `add-agent-access`.
- Every capability above is `AGENT_READY`, or listed as a known gap that blocks only the part of the agent that needs it.

## Decisions needed (Level 2)

Ask the human; apply an `ACTIVE` entry in DECISIONS.md when one exists. Record each answer in DECISIONS.md (or an ADR) in this change.

| Question | Options seen in the product | Answer |
|---|---|---|
| Who it acts for | `<represented users (delegation per agent-access) / the business only / both>` | `<pending>` |
| Triggers and channels | `<messages in a channel / events / schedules / requests from other systems or agents>` | `<pending>` |
| Agent runtime and model | `<options that fit the stack; no default is assumed>` | `<pending>` |
| Where it runs | `<options that fit the product's hosting>` | `<pending>` |
| Knowledge sources | `<existing sources with owner and freshness>` | `<pending>` |
| Memory it keeps between interactions | `<none / per conversation / per user>`, retention `<period>` | `<pending>` |
| Human handoff | `<who receives it, through which channel, with what context>` | `<pending>` |
| Release plan | `<internal only / some tenants / everyone>`, and the evidence needed to widen it | `<pending>` |
| Owner | `<the person or team accountable for the agent in production>` | `<pending>` |

## Agentic Impact

- Agent accessible: NOT APPLICABLE — this change creates a consumer of capabilities, not a capability
- Capabilities: `<the list above; none added or changed>`
- Agent principal: `<agent id>`, issued by an administrator through `agent-access`, scoped to the capabilities above
- Authorization: `<tenants in scope>`; `<delegation mode, or "acts for the business only">`
- Audit requirements: every call through `agent-access`; every handoff
- Human approval: `<commands at REQUIRES_CONFIRMATION or REQUIRES_APPROVAL for this agent>`
- Known gaps: `<capabilities it needs that are missing or not AGENT_READY; human asked whether to open a change for each: <answer | pending> — or none>`

## Repositories potentially affected

| Repository | Why |
|---|---|
| `<repo where the agent runs>` | instructions, triggers, handoff, evaluation |
| `<repo holding channel adapters, if any>` | translation and routing |

Repositories checked and found **not** affected: `<repo>` (<one-line reason>).
