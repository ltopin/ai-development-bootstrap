## 1. Protocol

- [x] 1.1 `template/AI.md` Phase 4: add the **Approval gate** paragraph — write the change and stop; answers to open questions and requested edits are not approval (apply them and present again); start Phase 5 only after an explicit instruction to implement; automated runs keep the pull request review as their gate (link `WORKFLOW.md`)
- [x] 1.2 `template/AI.md` Phase 5: replace "Implement in the order defined by the plan and tick tasks in `tasks.md` as you go." with the incremental rule — tick each task as soon as it is finished and validated, before the next one; note deviations inline; never tick in bulk at the end
- [x] 1.3 `template/protocol/DECISION-POLICY.md`, *Approval is not implied*: an answer approves its decision only, not implementing the change, the pull request or a deploy

## 2. Related files

- [x] 2.1 `template/WORKFLOW.md` Lifecycle: insert step 3 **Approve** (present the change and stop; implement only after an explicit instruction; answers or requested edits are applied and the change is presented again) and renumber the following steps
- [x] 2.2 `template/WORKFLOW.md` Lifecycle, Implement step: tick each item as soon as it is done, one at a time, never in bulk at the end; note deviations in the file
- [x] 2.3 `template/openspec/changes/_template/tasks.md`: "Tick as you go" → "Tick each item as soon as it is done, not at the end"

## 3. Integration

- [x] 3.1 Confirm no change is needed in `template/integrations/` (automated runs keep the pull request gate) and write that in the pull request; no integration script changes, so `node --test` is not required

## 4. Scripts, README and version

- [x] 4.1 Confirm `bootstrap/bootstrap.sh` and `bootstrap/bootstrap.ps1` need no change (no file added or removed, no explicit listing of these files)
- [x] 4.2 Bump `template/.bootstrap-version` to `2.1.0`
- [x] 4.3 `README.md`: add "Upgrading to 2.1.0" — `--update` refreshes `AI.md`, `WORKFLOW.md`, `protocol/DECISION-POLICY.md` and `openspec/changes/_template/tasks.md` where untouched (conflicts otherwise, naming the three paragraphs to merge by hand); not breaking; nothing to delete; changes in progress keep their `tasks.md`

## 5. Example and verification

- [x] 5.1 Refresh `examples/multi-repo-example/ai-development/` with `bootstrap.sh --update`; check the manifest and version were updated and no project-managed file changed
- [x] 5.2 `--update --dry-run` on a copy of a project at 2.0.0: the four framework files are reported as updated when untouched, as conflicts when edited; nothing else changes
- [x] 5.3 Fresh bootstrap into a temp folder with `bootstrap.sh` and `bootstrap.ps1`: the installed `AI.md`, `WORKFLOW.md`, `DECISION-POLICY.md` and `_template/tasks.md` carry the new text
- [x] 5.4 Grep `template/`, `examples/`, `README.md` and `bootstrap/` for "Tick as you go" and "tick tasks in `tasks.md` as you go": no match left
- [x] 5.5 Walk the cases through the text as an agent would: (a) interactive formal change — agent stops after writing it; (b) human answers open questions only — agent updates and stops again; (c) human says "pode implementar" — agent implements and ticks task by task; (d) direct single-repo fix — no gate; (e) automated run — no wait, pull request gate; (f) task blocked by a Level 2 question — stays unticked
- [x] 5.6 Relative links in the changed files resolve; `openspec validate add-change-approval-and-task-progress --strict` passes
