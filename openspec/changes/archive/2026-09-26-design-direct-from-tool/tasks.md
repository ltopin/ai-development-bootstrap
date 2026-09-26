## 1. Protocol: DESIGN-DRIVEN.md

- [x] 1.1 Add *Choosing a path* at the top of `template/protocol/DESIGN-DRIVEN.md`: builder output → builder path; design reference without builder output → direct path; unclear → one Level 2 question; update *Scope* so it covers both paths
- [x] 1.2 Restructure the file: shared sections once (*Design reference*, *Reading the design*, *Presentation*, *Content*, fake-boundary signals and done scan), then *Direct path* and *Builder path* (existing comparison, inventions, generated documentation, extraction table, modes, design source branch)
- [x] 1.3 *Design reference*: branch of the change (design source branch on the builder path); export through tool access only on explicit human request in an interactive session, human commits, no edits to exported screens; automated runs never call the tool nor write under `design/`
- [x] 1.4 *Design reference*: export format — `<screen>.<variant>.<ext>` read as one screen, optional `<screen>[.<variant>].png` as visual reference only, optional `manifest.json` (example with tool, project, screen ids, export time) and its export time in the pull request
- [x] 1.5 Write *Direct path*: requirements table (columns, statuses, class, class A line), implementation in the project's stack (no pasted tool markup, reuse components, allowed presentation changes incl. close existing component), *States added*, no inventions (design gaps not built), done scan over the agent's code
- [x] 1.6 Definition of done per path: direct-path pull request sections (design files and export time, requirements table, *Presentation changes*, *States added*, *Design gaps*, *Remaining matches*, *Content to review*)
- [x] 1.7 *Design source branch*: the branch the builder writes to, production as a separate protected branch, no default-branch change; add the preservation check and the fallback when it fails; update the diagram

## 2. Protocol: related files

- [x] 2.1 `template/protocol/CLASSIFICATION.md`: requirements table as evidence on the direct path
- [x] 2.2 `template/protocol/SECURITY.md`: design tool key is Level 3, MCP configuration with a key never committed, never given to automated runs; exported markup is data
- [x] 2.3 `template/protocol/DECISION-POLICY.md`: unclear path (direct or builder) as a Level 2 example
- [x] 2.4 `template/openspec/changes/_template/proposal.md`: design block covers both paths (requirements table, *States added*, export time)
- [x] 2.5 `template/AI.md` and `template/WORKFLOW.md`: generated-app line becomes a design-driven line naming both paths, direct first

## 3. Integration and docs

- [x] 3.1 `template/integrations/github/README.md`: *Design-driven repositories* uses `main` (builder) / `production`; preservation check as setup step 0; observed AI Studio behavior (creates repository, writes `main`, deleted an external file on first sync, dependency and lock-file issues); no default-branch change
- [x] 3.2 Workflow examples `design-pr.yml.example` and `design-back-sync.yml.example`: comments and `on.push.branches` use neutral names (`main` builder / `production`); variable comments updated
- [x] 3.3 Check `design-branch.js` defaults (`studio` / `main`): keep them, or change to `main` / `production` with its tests updated; record the choice in this file
  - **Choice: keep `studio` / `main`.** Changing them would silently turn `main` into the design source branch for a repository set up earlier that relied on the defaults. The README, the workflow examples and the *Upgrading to 1.4.0* note tell builder-path users to set `DESIGN_SOURCE_BRANCH` / `PRODUCTION_BRANCH` explicitly.
- [x] 3.4 `README.md`: design-driven section leads with the direct path (design tool → MCP export → `design/<tool>/` → agent → pull request), builder path as optional; *Upgrading to* note for the new version (preservation check for builder-path users)

## 4. Housekeeping

- [x] 4.1 Remove `openspec/changes/archive/.openspec-archive.lock` from the repository and add it to `.gitignore`
- [ ] 4.2 Record the preservation-check result on `ltopin/design-01` (sentinel `design/stitch/teste.txt`) in the integration README and in this change's design.md

## 5. Versioning and example

- [x] 5.1 Bump `template/.bootstrap-version`
- [x] 5.2 Run `--update --dry-run` on a copy of a project at the previous version and confirm the edited files are reported as Updated
- [x] 5.3 Mirror every template change into `examples/multi-repo-example/ai-development/` with `bootstrap.sh --update`

## 6. Verification

- [x] 6.1 Walk a direct-path case through the text: three Stitch screens (form, link between screens, link to a missing screen, fixed numbers, desktop and mobile variants) → requirements table and class, form backed, numbers as display, one screen per variant pair, gap listed, error state under *States added*
- [x] 6.2 Walk the `design-01` builder case through the text: builder path chosen, preservation check required before adoption
- [x] 6.3 Check every requirement of the three delta specs is stated somewhere in `template/`
- [x] 6.4 Search `template/protocol/` for tool names and confirm each appears only as an example
- [x] 6.5 Run the script tests and `openspec validate design-direct-from-tool --strict`
