# add-agent-access: agent access foundation

> Reference for the `add-agent-access` change ([AI-FIRST.md](../../../AI-FIRST.md#agent-access-foundation)). Copy this folder to `openspec/changes/add-agent-access/`, fill it from the product's evidence, and delete these reference notes and the lines marked *(greenfield)* or *(brownfield)* that do not apply. It names no language, framework, protocol or provider: the product's choices go in the decisions below. Never write a secret value in any file of this change.

## Problem

Part 2 of the premise is not met: no agent can call the product's capabilities with an identity of its own. `<(greenfield) the product has no authentication yet | (brownfield) the capabilities authorize only human sessions<, and the only agent credential is restricted to <channel>>>`. An agent would have to borrow a human's session or credentials, which cannot be scoped, audited as an agent or revoked on its own. Every capability is therefore `PARTIALLY_AGENT_READY` at most.

## Goal

An authorized agent calls a capability with its own principal and credential, scoped to that capability and tenant, audited on behalf of whoever it represents, and revocable at once by an administrator. With no configuration, no agent gets in.

## Scope

The foundation only, applied at the application layer, so every capability can rely on it:

- agent principal, distinct from human users, services and integrations;
- one credential per agent, never shared with humans, stored only as a hash or in a secret store, never in a repository, log or response;
- explicit scope per capability and per tenant: least privilege, denied by default;
- represented user: when an agent acts on behalf of a user, that user is recorded, and the agent never has more permission than that user;
- delegation: an agent acts for a user only when that user delegated to it (a live session of their own, or a recorded consent with scope and expiry), and the user can revoke it;
- issuance, rotation, expiration and immediate revocation, by a human with an administrator role only;
- audit of every call: agent, credential, represented user, tenant, capability, result, correlation id;
- autonomy policy enforced in the backend, never only in the agent's prompt;
- rate limiting per credential; structured errors that do not leak data from other tenants;
- fail closed: without configuration, no agent is accepted.

*(brownfield)* Reuse what exists: `<existing agent credential, e.g. the chatbot's, and how it is migrated to the agent principal model without breaking its channel | none>`; `<existing audit, roles, tenant checks that are reused>`.

## Out of scope

- Making every capability Agent-Ready: each capability converges when a change touches it (touched capability rule).
- Refactoring the application, rewriting APIs, a capability manifest, a tool registry, an agent runtime or a specific protocol.
- Building Product Agents.
- Any secret value: only where each secret is configured is recorded.

## Decisions needed (Level 2)

Ask the human; apply an `ACTIVE` entry in DECISIONS.md when one exists. Record each answer in DECISIONS.md (or an ADR) in this change.

| Question | Options seen in the product | Answer |
|---|---|---|
| Authentication mechanism for agent principals | `<options that fit the stack; no default is assumed>` | `<pending | DECISIONS.md key>` |
| How a user delegates to an agent | `<live session exchanged by the backend (user present) / recorded consent with scope and expiry (user absent) / both / agents never act for users>` | `<pending | DECISIONS.md key>` |
| Who may issue, rotate and revoke agent credentials | `<existing admin roles>` | `<pending>` |
| Initial agents and scopes (capabilities, tenants) | `<e.g. the existing chatbot's current routes>` | `<pending>` |
| Default autonomy for agent calls | `<e.g. queries AUTO, commands REQUIRES_CONFIRMATION>` | `<pending>` |
| Credential lifetime and rotation period | `<...>` | `<pending>` |

## Agentic Impact

- Agent accessible: YES — this change is what makes agent access possible
- Capabilities: `agent-access` (Foundation in CAPABILITIES.md)
- Commands: `<issue_agent_credential, revoke_agent_credential, …: HUMAN_ONLY, administrators>`
- Authorization: administrators manage credentials; agents are authorized per capability and tenant, denied by default
- Agent principal: introduced by this change
- Audit requirements: every agent call and every credential lifecycle action
- Human approval: issuance, rotation and revocation are human-only
- Current Agent Readiness: `<(brownfield) NOT_AGENT_READY | PARTIALLY_AGENT_READY — evidence>`
- Target Agent Readiness: `AGENT_READY` for `agent-access`; capabilities that call the foundation become callable by agents, and their own gaps stay as recorded
- Known gaps intentionally left out of scope: `<capability gaps other than the missing agent principal>`

## Repositories potentially affected

| Repository | Why |
|---|---|
| `<repo holding authentication / application layer>` | principal, credential verification, scope checks, audit |
| `<admin UI or tooling repo, if any>` | human administration of credentials |

Repositories checked and found **not** affected: `<repo>` (<one-line reason>).
