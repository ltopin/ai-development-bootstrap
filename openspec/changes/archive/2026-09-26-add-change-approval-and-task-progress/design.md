## Context

See proposal.md (Why). Today the only related text is:

- `AI.md` Phase 4 (*Plan*) says what the plan contains, not that the agent waits for it to be approved; Phase 5 says "tick tasks in `tasks.md` as you go".
- `WORKFLOW.md` Lifecycle, step 1: "Get agreement on scope if the user is available" — soft, and about scope only.
- `protocol/DECISION-POLICY.md`, *Approval is not implied*: an answer approves its decision only, "not the pull request and not a deploy".
- `protocol/HUMAN-IN-THE-LOOP.md`: "tick only what is truly done" for tasks blocked by a question.

The rules are agent-facing protocol text; there is no runtime to change.

## Goals / Non-Goals

**Goals:**
- One unambiguous stop between planning and implementing in interactive sessions, stated where agents read the phases (`AI.md`) and where they read the change lifecycle (`WORKFLOW.md`).
- Close the loophole that caused the observed failure: answers to open questions read as a go-ahead.
- Make `tasks.md` a live progress record.

**Non-Goals:**
- See proposal.md (Non-goals). No change to the automated-run flow, the integrations or the installers.

## Decisions

1. **The gate lives in Phase 4 of `AI.md`, not in a new phase.** Phase 4 is where the plan (and the change) is produced; ending it with "stop and wait" keeps the phase list (and the `DISCOVER → … → DOCUMENT` line) stable. *Alternative:* a new "Approve" phase between 4 and 5 — rejected because it renumbers phases that other text refers to by name and number.
2. **`WORKFLOW.md` gets an explicit Approve step.** The Lifecycle list is the checklist agents follow for a change, so the stop must be a step there too. Steps 3–5 become 4–6. Nothing links to step numbers (checked with a grep over `template/`, `examples/`, `README.md` and `openspec/specs/`).
3. **Interactive sessions only.** Automated runs have no interactive user; blocking them on approval would stop every run. Their gate stays the pull request review. *Alternative:* require a committed approval marker for automated runs — rejected as new mechanism outside this change's scope (see Non-goals).
4. **Approval must be explicit and is defined negatively too.** The text names what is *not* approval (answers, requested edits, agreement) because that was the failure mode, and gives examples of what is ("implement", "pode implementar") without making them the only accepted words.
5. **`DECISION-POLICY.md` is extended instead of duplicating the rule.** *Approval is not implied* already covers answers vs. pull request and deploy; adding "implementing the change" keeps one source for that principle, and `AI.md` links the gate to it.
6. **Ticking rule stated where the work happens.** `AI.md` Phase 5, the Lifecycle Implement step and the `tasks.md` template header all carry the same short rule. The template matters most: it is in front of the agent when it edits `tasks.md`.

Anchors: no heading is added, moved or removed. `#phase-4--plan`, `#phase-5--implementation`, `#lifecycle` and `#level-2--human-decision` keep their names. *Approval is not implied* is a bullet, not an anchor.

## Risks / Trade-offs

- [An agent treats a vague "ok" or "sounds good" as approval] → The text requires an explicit instruction to implement and lists agreement as not approval; when in doubt the agent asks.
- [More round-trips for small single-repo features that use a lightweight change] → Accepted: the human asked for the stop on every change; direct edits without a change are unaffected.
- [Projects that customized `AI.md` or `WORKFLOW.md` get a conflict on `--update`] → Standard behavior; the upgrading note lists the three paragraphs to merge by hand.
- [Existing in-progress changes were ticked in bulk] → Not rewritten; the rule applies from the next ticking on.

## Migration Plan

Release as 2.1.0. `--update` refreshes the four framework files where untouched and reports conflicts otherwise; nothing to delete. Rollback: re-run the bootstrap of 2.0.0 on the project (framework files only).
