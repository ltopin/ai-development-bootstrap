# CAPABILITIES

> L1 document. What this platform can do, for human interfaces, integrations, automations and Product Agents. Read only the section of the domain your task involves. Concepts and levels: [AI-FIRST.md](AI-FIRST.md).

Product-level catalog, not API documentation: name, purpose and owner here; request/response shapes stay in each repository's contracts (OpenAPI, schemas, specs) and are linked, never copied.

Rules:

- One section per domain, one row per capability. Add rows in the same change that creates or alters a capability.
- Names are stable identifiers: `snake_case` for queries, knowledge and commands (`get_invoice`, `refund_policy`, `change_plan`); `<domain>.<past_tense>` for events (`invoice.overdue`).
- **Type**: `query` | `knowledge` | `command` | `event`.
- **Autonomy** (commands only, else `—`): `AUTO` | `AUTO_WITH_LIMITS` | `REQUIRES_CONFIRMATION` | `REQUIRES_APPROVAL` | `HUMAN_ONLY` — see [AI-FIRST.md](AI-FIRST.md#autonomy-levels). `unknown` until decided.
- **Status**: `agent-ready` (meets the Agent-Ready definition) | `partial` (reachable programmatically, but missing something: say what in *Notes*) | `ui-only` (logic or access only through the UI) | `planned` | `needs validation`.
- **Owner**: the repository (name in [REPOSITORIES.md](REPOSITORIES.md)) or source that owns it.
- Only record capabilities with evidence. An endpoint is not automatically a capability, and a document is not Product Agent knowledge until someone says it is.
- Add *Contract details* only for capabilities that need them (sensitive, cross-repository, or unclear). Most rows need none.

A new product starts with no domains here; the catalog grows with the product.

## Agent readiness

One line per domain, from evidence. Replace the example.

| Domain | Readiness | Evidence / gaps |
|---|---|---|
| `<domain>` | `<agent-ready / partial / ui-only / unknown>` | `<e.g. commands via API; no audit of actor>` |

## `<domain>`

| Name | Type | Purpose | Owner | Autonomy | Status |
|---|---|---|---|---|---|
| `<get_something>` | query | `<what it answers>` | `<repo>` | — | `<status>` |
| `<some_policy>` | knowledge | `<what it explains>` | `<source>` | — | `<status>` |
| `<do_something>` | command | `<what it changes>` | `<repo>` | `<autonomy>` | `<status>` |
| `<domain.something_happened>` | event | `<what it signals>` | `<repo>` | — | `<status>` |

Policy notes: `<limits and confirmation/approval rules, e.g. "do_something: AUTO up to 10 units, REQUIRES_APPROVAL above">`

Notes: `<gaps, needs validation>`

### Contract details (optional)

Only when needed. Keep keys, drop the ones that do not apply.

```markdown
#### <do_something>
- Purpose:
- Domain:
- Type: command
- Input: <fields, or link to the contract>
- Output: <fields, or link>
- Side effects: <state changed, events emitted>
- Authorization: <who may call; agent scope; tenant rule>
- Autonomy: <level and limits>
- Idempotency: <key or natural idempotency, or not idempotent>
- Errors: <structured error codes>
- Audit: <what is recorded>
- Owner: <repo>

#### <some_policy>
- Type: knowledge
- Source: <file, table or service>
- Owner: <team or person>
- Freshness: <how and when it is updated>
- Access: <who may read; tenant isolation; sensitivity>
```
