## 0. Preconditions

- [x] 0.1 Land `add-design-driven-implementation` (commit and archive), so `DESIGN-DRIVEN.md` is the baseline this change edits — archived 2026-09-25; committed in 24626a5
- [x] 0.2 Record in that change's `design.md` Open Questions what the sandbox test answered (builder commits to the default branch, with the connected human's identity, AI-generated message; full-stack layout: root `server.ts`, `src/`, `src/data/`, `metadata.json`)

## 1. Protocol: design reference

- [x] 1.1 Add *Design reference* to `template/protocol/DESIGN-DRIVEN.md`: `design/<tool>/`, one file per screen, committed by a human on the design source branch; contract for presentation and flow when present; the agent never writes under `design/`; no-reference fallback and its PR line
- [x] 1.2 Reword *Presentation is the human's contract* to name its source (design reference when present, generated app otherwise)
- [x] 1.3 Add *Reading the design*: requirement / display / required flow by behavior; link to a non-existent screen goes under *Design gaps* and is not built; tool markup (e.g. `data-path`) only as an example
- [x] 1.4 Add *Design comparison* and *Inventions*: two-way comparison; invisible inventions removed and listed; visible inventions as one Level 2 keep/remove question, recorded in `DECISIONS.md`; kept inventions become requirements
- [x] 1.5 Add the generated-documentation rule (proposed, never L0, never a decision, never evidence)
- [x] 1.6 Add four rows to the fake-boundary signals table: success faked in an error path, fake authentication, action with no effect, orphan endpoint
- [x] 1.7 Add the empty-table rule (class A, no backend work, PR line) and the content rule (*Content to review*, non-blocking)
- [x] 1.8 Update the definition of done: PR contains *Design comparison*, *Design gaps*, *Inventions removed* and *Content to review* (or "none")

## 2. Protocol: related files

- [x] 2.1 `template/protocol/CLASSIFICATION.md`: empty extraction table → A; generated documentation is not classification evidence
- [x] 2.2 `template/protocol/DECISION-POLICY.md`: visible invention listed as a Level 2 example
- [x] 2.3 `template/openspec/changes/_template/proposal.md`: optional *Design comparison* block
- [x] 2.4 `template/integrations/github/README.md`: in *Design-driven repositories*, how to commit the design export under `design/<tool>/` and that the design source branch allow-list covers it

## 3. Template versioning and example

- [x] 3.1 Bump `template/.bootstrap-version`
- [x] 3.2 Run the bootstrap `--update --dry-run` on a copy of a project at the previous version and confirm the edited files are reported as Updated — copy of the 1.2.0 example: the five edited files Updated, no conflicts
- [x] 3.3 Mirror every template change into `examples/multi-repo-example/ai-development/` (including `.bootstrap-version` and `.bootstrap-manifest`) — done with `bootstrap.sh --update`; every framework file compared equal

## 4. Documentation

- [x] 4.1 Add the design reference step to the design-driven flow in `README.md` (design tool export → `design/<tool>/` → comparison), tools named only as examples
- [x] 4.2 Add an *Upgrading to* note for the new version in `README.md`

## 5. Verification

- [x] 5.1 Walk the sandbox case (`landing-page-test` + its Stitch export) through the new text and confirm the outcome: form → backend work; preview kept as display; four screens, interactive preview and login → Level 2 questions; three orphan endpoints and two generated documents → removed; faked success → done scan fails
- [x] 5.2 Walk a static landing page with no form through the text and confirm class A with no backend work
- [x] 5.3 Check the new protocol text against `specs/design-reference/spec.md`: every requirement is stated somewhere in `template/`
- [x] 5.4 Search `template/protocol/` for tool names and confirm each appears only as an example
- [x] 5.5 Run `openspec validate design-source-as-contract --strict`
