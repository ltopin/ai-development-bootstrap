# Architecture Decision Records

An ADR records **one significant, lasting architectural decision** and why it was made, so nobody (human or agent) has to rediscover or re-litigate it.

## Write an ADR when

- the decision affects more than one repository, or a contract between them;
- it is expensive to reverse (data model, protocol, messaging, auth approach, major dependency);
- future contributors would reasonably ask "why did we do it this way?".

## Do not write an ADR for

- local implementation choices inside one repository;
- routine bug fixes, upgrades or refactors;
- anything already fully explained by a change's `design.md` and not durable beyond it.

## Convention

- File: `NNNN-short-title.md` — four-digit sequence, kebab-case (`0001-use-events-for-notifications.md`).
- Never rewrite history: to reverse a decision, add a new ADR and mark the old one `Superseded by NNNN`.
- Keep it to one page. Link it from the change that produced it.

## Template

Copy this into `NNNN-title.md`:

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Deprecated | Superseded by NNNN
- Date: YYYY-MM-DD
- Change: openspec/changes/<change-id> (optional)

## Context

The situation and forces at play: requirements, constraints, alternatives considered.

## Decision

What we decided, in active voice ("We will ...").

## Consequences

What becomes easier, what becomes harder, follow-ups, repositories impacted.
```

## Index

Add one line per ADR as they are created.

Format: `- [0001 Title](0001-title.md) — Accepted`
