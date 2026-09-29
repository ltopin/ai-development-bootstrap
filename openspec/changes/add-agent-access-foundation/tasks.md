## 1. Protocol

- [x] 1.1 `template/AI-FIRST.md`: two-part premise; Agent-Ready *callable by an agent principal*; readiness cap and gap category; question 10; definition of done item and authorized-path paragraph; *Security*; `## Agent access foundation`; brownfield exceptions; `### Premise gaps`; agent access check in *Framework update is not product migration*; adoption skeletons and known gaps
- [x] 1.2 `template/AI.md`: Phase 2, Phase 6, Project Initialization Protocol (flow, greenfield, brownfield, what to produce, validation, report)

## 2. Related files

- [x] 2.1 `template/WORKFLOW.md`: AGENTIC IMPACT line, definition of done, foundation paragraph, the two exceptions
- [x] 2.2 `template/openspec/README.md`; `_template/proposal.md` (`Agent principal`, `Known gaps`); `_template/tasks.md`
- [x] 2.3 New `template/openspec/changes/_template-add-agent-access/` (proposal, design, tasks, spec), with no dependency on any technology
- [x] 2.4 `template/CAPABILITIES.md` (*Foundation*, `Agent principal` key), `PROJECT.md`, `ARCHITECTURE.md`
- [x] 2.5 `bootstrap/UPDATE-INSTRUCTIONS.md`: step 3 *Agent access check*
- [x] 2.6 New `template/openspec/changes/_template-add-product-agent/` (proposal, design, tasks, spec), agnostic to agent kind and technology; `AI-FIRST.md` `## Creating a Product Agent`; `openspec/README.md` layout and rule 9; README file table, layout and upgrade note

## 3. Scripts, README and version

- [x] 3.1 `bootstrap.sh` and `bootstrap.ps1` in parity: `_template*` framework-managed; read-only agent access check; PENDING.md section; follow-up message
- [x] 3.2 Bump `template/.bootstrap-version` to 2.4.0
- [x] 3.3 `README.md`: premise and foundation, brownfield bullet, initialization, file table, layout, "Upgrading to 2.4.0"

## 4. Example and verification

- [x] 4.1 `--update --dry-run` and `--update` on a copy of the example at 2.3.0 (`.sh` and `.ps1`): product and project files byte-identical; framework files refreshed; reference folder created; AGENT ACCESS CHECK REQUIRED; version 2.4.0
- [x] 4.2 Detection cases with both scripts: placeholder row → check; filled row → no check and `.bootstrap-update/` removed; archived change → no check; open change → no check
- [x] 4.3 Mirror into `examples/multi-repo-example/` with `bootstrap.sh --update`; apply step 3 as the agent would (task-authorized edit of project-managed files): `add-agent-access` change, *Foundation* row, *Agent access* lines; re-run clears `.bootstrap-update/`
- [x] 4.4 Fresh bootstrap with both scripts: same file set and manifest content, version 2.4.0
- [x] 4.5 Links and anchors in changed files resolve (only the two pre-existing 1.x anchors in README fail); grep of the new text for technology or provider names and secret requests; `node --test`: 101 pass
- [x] 4.6 Walk the cases through the text: the expenses change (brownfield, human-only authentication), a greenfield first business capability, an update without agent access, an update with agent access, a premise gap other than the agent principal
- [x] 4.7 `openspec validate add-agent-access-foundation --strict` (if the CLI is available)
