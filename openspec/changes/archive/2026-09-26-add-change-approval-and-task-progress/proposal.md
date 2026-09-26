## Why

In interactive sessions, agents write an OpenSpec change and then start implementing in the same flow: the human's answers to the change's open questions are read as a go-ahead, and the review of the change itself is skipped. During implementation, agents also tick every task in `tasks.md` at the end in one batch, so the file does not show progress while the work runs. Both were observed in a real project (a React + NestJS change implemented from a Stitch design) and the human asked for both to become rules of the protocol.

## What Changes

- **Approval gate.** In an interactive session, when the plan lives in a change, the agent writes the change, presents it and stops. It starts implementing only after the human explicitly says to implement. Answers to open questions and requested edits are not approval: the agent applies them to the change and presents it again. Automated runs keep their current gate, the pull request review.
- **Incremental task progress.** The agent ticks each task in `tasks.md` as soon as that task is finished and validated, before starting the next one, and notes deviations inline. Ticking in bulk at the end is not allowed.
- `AI.md` Phase 4 (Plan) gets the approval gate; Phase 5 (Implementation) replaces "tick tasks in `tasks.md` as you go" with the incremental rule.
- `WORKFLOW.md` Lifecycle gets a new step **Approve** between Design and Implement; the Implement step states the incremental rule. Steps after it are renumbered.
- `protocol/DECISION-POLICY.md`, *Approval is not implied*: an answer to a question does not approve implementing the change either.
- `openspec/changes/_template/tasks.md`: "Tick as you go" becomes "Tick each item as soon as it is done, not at the end".
- Version bump: **minor, 2.0.0 → 2.1.0**, not breaking. No file is added or removed; the rules only add a stop and tighten an existing instruction.

Files under `template/`:

| File | Managed by | Change |
|---|---|---|
| `template/AI.md` | framework | Phase 4 approval gate; Phase 5 incremental ticking |
| `template/WORKFLOW.md` | framework | Lifecycle: new Approve step, Implement wording |
| `template/protocol/DECISION-POLICY.md` | framework | *Approval is not implied* covers implementing a change |
| `template/openspec/changes/_template/tasks.md` | framework | ticking instruction |
| `template/.bootstrap-version` | framework | `2.1.0` |

On `--update` of an existing project: the four framework files are refreshed where the project never edited them; where it did, they are reported as conflicts to merge by hand (as usual). Project-managed files (`DECISIONS.md`, L0 docs, existing changes) are left untouched; changes already in progress keep their `tasks.md` as written. Nothing to delete by hand.

## Non-goals

- Gating automated runs on change approval: they have no interactive user, and their gate stays the pull request review.
- Tooling that enforces the gate or checks `tasks.md` (hooks, CI checks): the rules are protocol text read by agents.
- Changing when a formal change is required (the *When is a formal change required?* table is unchanged); direct edits without a change have no approval gate.
- The design export gaps seen in the same project (hidden screens, referenced assets, design system and docs in the export, freshness check): a separate change.

## Capabilities

### New Capabilities
- `change-lifecycle`: how an agent moves a change from proposal to implementation in an interactive session (explicit approval gate) and how it reports progress in `tasks.md` while implementing.

### Modified Capabilities
<!-- none: existing specs cover the default stack and design-driven implementation only -->

## Impact

- `template/AI.md`, `template/WORKFLOW.md`, `template/protocol/DECISION-POLICY.md`, `template/openspec/changes/_template/tasks.md`, `template/.bootstrap-version`.
- `README.md`: "Upgrading to 2.1.0" note.
- `examples/multi-repo-example/ai-development/`: refreshed with `bootstrap.sh --update`.
- `bootstrap/bootstrap.sh`, `bootstrap/bootstrap.ps1`: no change (they do not list these files explicitly).
- No integration scripts change.
