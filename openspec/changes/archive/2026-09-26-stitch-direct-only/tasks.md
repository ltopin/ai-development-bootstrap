## 1. Protocol: DESIGN-DRIVEN.md

- [x] 1.1 Rewrite the intro and *Scope* for one flow (design reference → implementation in the project's stack); drop *Choosing a path* and every mention of generated apps and builders
- [x] 1.2 Delete the whole *Builder path* section (design comparison, inventions, generated documentation, start scan and extraction table, new or existing project, parallel backend, builder definition of done, design source branch, preservation check)
- [x] 1.3 *Fake boundaries*: one list of signals by behavior, merging the additional signals and dropping the builder-only ones (generated server as such, orphan endpoint); done scan over client and server code of the change
- [x] 1.4 Move *New repositories* into *Direct path* (keep the `#new-repositories` anchor); keep `#direct-path` and its subsection anchors
- [x] 1.5 *Presentation*: allowed reasons listed directly (no reference to the builder path), no cosmetic changes
- [x] 1.6 *Who writes it*: the agent only reads the design tool; naming screens in the tool is the export request; only named screens, tool output unedited, `manifest.json` updated; no named design and not in the reference → one Level 2 question; tool unreachable → stop, nothing written
- [x] 1.7 Export commit: its own commit before implementation, message `design: export <screens> from <tool> (<exportedAt>)`; push only when the human asks; automated runs never call the tool nor write under `design/`
- [x] 1.8 Builder-generated code in a change: ordinary code, design reference stays the contract; *Tool independence* without builders

## 2. Protocol: related files

- [x] 2.1 `template/protocol/CLASSIFICATION.md`: remove the builder-path block (extraction table, `proposed`, empty extraction table, generated documentation); requirements table is the evidence for designed input
- [x] 2.2 `template/protocol/DECISION-POLICY.md`: remove the unclear-path and parallel-backend/mode examples; add "no design reference and no named design" as a Level 2 example
- [x] 2.3 `template/protocol/SECURITY.md`: delete §8 and renumber; §9 adds read-only use of the design tool, and an example (Claude Code permissions allowing only the Stitch MCP read tools)
- [x] 2.4 `template/protocol/LOOP-PREVENTION.md`: reword the design-tool row (a design export commit pushed by the human is external intent) if it mentions a tool pushing on its own
- [x] 2.5 `template/AI.md` rule 7 and `template/WORKFLOW.md`: one design-driven line (named design → export commit → implementation → requirements table; push on request)
- [x] 2.6 `template/openspec/changes/_template/proposal.md`: design block has only the requirements table, *States added*, design files and export time; remove extraction table and design comparison

## 3. Integration

- [x] 3.1 Delete `template/integrations/github/workflows/design-pr.yml.example`, `design-back-sync.yml.example`, `scripts/design-branch.js`, `scripts/design-branch.test.js`
- [x] 3.2 `template/integrations/github/README.md`: remove the file-table rows, *Design-driven repositories* (builder), *What was observed with Google AI Studio*, mirror variant, and the `DESIGN_SOURCE_BRANCH` / `PRODUCTION_BRANCH` / design `AGENT_APP_ID` variables; keep one line saying designed changes need no setup
- [x] 3.3 `template/integrations/README.md`: remove builder mentions
- [x] 3.4 Run the remaining integration tests (`node --test` over `template/integrations/github/scripts/`) and confirm nothing imported `design-branch.js`

## 4. Scripts, README, version

- [x] 4.1 `bootstrap/bootstrap.sh` and `bootstrap/bootstrap.ps1`: remove builder files from any explicit list; confirm nothing else references them
- [x] 4.2 Bump `template/.bootstrap-version` to `2.0.0`
- [x] 4.3 `README.md`: design-driven section describes one flow (design tool → MCP read → `design/<tool>/` export commit → agent → pull request, push on request); remove builder path text, diagram and AI Studio notes; update the protocol table row and the Security row
- [x] 4.4 `README.md`: *Upgrading to 2.0.0* note: **breaking**, builder-path users stay on 1.5.x; list of files `--update` no longer ships, to delete by hand (two workflow examples, `design-branch.js` + test, workflows copied into repositories, design source branch rulesets); read-only design tool and export-commit behavior

## 5. Example and verification

- [x] 5.1 Run `--update --dry-run` on a copy of a 1.5.0 project and confirm the edited files are reported as Updated and no error comes from the removed files
- [x] 5.2 Mirror into `examples/multi-repo-example/ai-development/` with `bootstrap.sh --update`; delete its builder files by hand
- [x] 5.3 `grep -ri "builder\|extraction table\|design source\|AI Studio\|back-sync"` over `template/`, `examples/`, `README.md` and `bootstrap/` returns only the upgrade notes
- [x] 5.4 Walk a case through the text: "implement checkout and orders from Stitch project X" → export of the two screens, manifest, export commit, requirements table and class, implementation commit, no push; then "push" → push
- [x] 5.5 Walk the edge cases: screen not in the reference and nothing named (one question); tool unreachable (stop, nothing written); human asks to generate a screen in Stitch (declined)

## 6. Archive follow-up

- [x] 6.1 After archive, delete `openspec/specs/design-driven-implementation/` and `openspec/specs/design-source-branch/` (no requirements left) and update the *Purpose* of `design-reference` and `design-direct-implementation` so they no longer mention builders
