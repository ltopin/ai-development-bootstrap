## Context

`protocol/DESIGN-DRIVEN.md` (334 lines) holds a shared part (design reference, reading by behavior, presentation, content, fake boundaries), the direct path (lines 126–190) and the builder path (lines 192–331). The builder path is also spread over `CLASSIFICATION.md`, `DECISION-POLICY.md`, `SECURITY.md` §8, `AI.md` rule 7, `WORKFLOW.md`, the proposal template, `integrations/README.md`, `integrations/github/` (README section, two workflow examples, `design-branch.js` and its tests) and the README. `bootstrap.ps1` also mentions it. `examples/multi-repo-example/ai-development/` mirrors all of this. The current version is 1.5.0 (`add-default-stack`, applied and not yet committed).

The bootstrap scripts keep a `.bootstrap-manifest` of framework-file hashes and refresh files the user never edited. They have no notion of a file that stops being shipped.

## Goals / Non-Goals

**Goals:**
- One design-driven flow with no path choice and no builder vocabulary in the template.
- Keep every rule the direct flow still depends on (see the specs).
- Make the whole flow runnable in one interactive session: a request that names designed screens exports, commits and implements them; pushing waits for the human.

**Non-Goals:**
- Syncing the design tool's design system with the project's tokens (Tailwind config of `STACK.md`). That is a possible later change.
- Changing archived changes or `DECISIONS.md` entries in existing projects.
- Teaching the scripts to delete files.

## Decisions

**D1. One flow; keep the term "direct path" only where it names things.** `DESIGN-DRIVEN.md` drops *Choosing a path* and the whole *Builder path*. The remaining text describes one flow. The shared sections stay where they are, and *Direct path* keeps its anchor (`#direct-path`) and its subsections so existing links keep working. Requirement names in the specs keep "direct path" so that archive applies as MODIFIED without renames. *Alternative:* rename everything to drop "direct". Rejected: it churns anchors, specs and upgrade notes for no change in behavior.

**D2. Consolidate specs into `design-direct-implementation` and `design-reference`; retire the other two.** After archive, `design-driven-implementation` and `design-source-branch` have no requirements, and their spec directories are deleted. Rules still needed (fake boundaries, new repositories, tool independence) are re-added in `design-direct-implementation`. The additional fake-boundary signals are merged into one list, without the builder-only ones (generated server as such, orphan endpoint). *Alternative:* keep `design-driven-implementation` as the home of the shared rules. Rejected: its name and purpose describe the builder.

**D3. Naming the design is the export request.** "Implement checkout from Stitch project X" exports the named screens. "Implement checkout" when the reference already has it reads the reference. "Implement checkout" when the reference does not have it costs one Level 2 question. *Alternative:* always re-export on every implementation request. Rejected: it makes each run depend on the tool being reachable and silently changes the contract mid-change.

**D4. The export is its own commit, first; push only on request.** Message form: `design: export <screens> from <tool> (<exportedAt>)`. A separate commit makes the design change reviewable as a diff in the pull request, revertable alone, and makes a refresh visible (D3). *Alternative:* one commit with export and implementation. Rejected: it hides design changes inside code changes.

**D5. Read-only use of the design tool is a protocol rule, backed by tool permissions where the agent supports them.** `SECURITY.md` §9 states the rule. The integration text gives an example: in Claude Code, allow the read tools of the Stitch MCP server (`list_projects`, `get_project`, `list_screens`, `get_screen`, `list_design_systems`) and deny the rest (`generate_*`, `edit_screens`, `create_*`, `update_*`, `apply_*`, `upload_*`, `delete_project`). Permissions are an example, not part of the protocol (tool independence).

**D6. Removed files: upgrade note only.** The removed builder files are inert examples (`*.example`, scripts called only by them). The *Upgrading to 2.0.0* note lists them for manual deletion. `--update` stops shipping them and leaves existing copies alone. *Alternative:* add an obsolete-files report to both scripts. Rejected: code in two scripts for a one-time cleanup.

**D7. Version 2.0.0.** Removing a documented, workflow-backed path is breaking. Builder-path users are told to stay on 1.5.x.

## Risks / Trade-offs

- [Someone still uses a builder and brings generated code] → The spec covers it: generated code is ordinary code, the design reference stays the contract, and the done scan catches fake data. Without the invention rules, visible extras are no longer asked about. The reviewer sees them in the pull request.
- [An export commit lands but the implementation is abandoned] → The export commit is on the change branch only and never pushed without a request. Dropping the branch drops it.
- [A tool whose MCP server offers no read/write split] → The protocol rule still binds the agent. Permissions are defense in depth, not the control.
- [Losing the builder text loses the AI Studio lessons] → They stay in git history and in the archived 1.3.0/1.4.0 changes.

## Migration Plan

1. Template edits. 2. Scripts: remove builder files from the shipped list if listed, and set the version. 3. `--update --dry-run` on a 1.5.0 copy to confirm the edited files are reported. 4. Mirror into the example, and delete its builder files by hand. 5. Archive: apply deltas, then delete the two emptied spec directories. Rollback: revert the commit; 1.5.0 is intact in history.
