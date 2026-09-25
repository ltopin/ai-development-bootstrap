## Context

See proposal.md for motivation. Current state that shapes the approach:

- `protocol/DESIGN-DRIVEN.md` (from `add-design-driven-implementation`) takes the generated app as the presentation contract and finds fake boundaries in its code. It has no notion of a design separate from the generated app.
- Sandbox test (repository `landing-page-test`, one Stitch landing page with one form, built by AI Studio):
  - Stitch export: a single HTML screen; navigation links carry a `data-path` naming the target screen; the simulator preview is read-only with fixed values; one form section; design tokens in a Tailwind config.
  - AI Studio output: React + Vite client and an Express `server.ts` at the root (in-memory arrays), literal data in `src/data/`, an AI Studio `metadata.json`, and two generated documents. It added four screens (one per `data-path` name), made the preview interactive, added a role-picker login, three endpoints no client calls, and an error path that fakes success on the form.
  - AI Studio commits to the default branch, with the connected human's identity, with an AI-generated message. It has no documented persistent instruction mechanism in Build mode.
- The design reference must reach the agent without depending on the builder: the builder does not carry the design export into the repository.

## Goals / Non-Goals

**Goals:**
- The agent can tell designed requirements, designed display, and builder inventions apart.
- Inventions that change nothing visible are cleaned up without human effort; visible ones cost one question per invention, once.
- Works for any design tool whose export can be committed as files.

**Non-Goals:**
- Reading the design tool through its API or MCP server (later option).
- Pixel comparison or visual regression between design and generated app.
- Restoring design tokens the builder flattened (visual result is identical; not required).
- Driving the design tool or the builder.

## Decisions

### D1. The design reference is committed files under `design/<tool>/`

A human exports the screens and commits them to the design source branch. The agent reads them from the checked-out commit.

- Versioned with the code; the design diff appears in the design pull request.
- No credential in CI, no network dependency, same trust boundary as the builder (the design source branch allow-list).
- The agent never writes under `design/`: it is human input.

*Alternative considered:* the design tool's MCP server or API from the agent job. Always current and no manual export, but needs a Level 3 credential, a recorded link between repository and design project, and network access from CI; and the design would not be versioned with the change. Left as a later option.

*Alternative considered:* instructing the builder to carry the design. No documented mechanism for persistent builder instructions; rejected.

### D2. Read the design by behavior, not by tool markup

Rules are stated as behavior (accepts input / triggers an action → requirement; only shows values → display; links to another screen → flow). Tool-specific hints (Stitch's `data-path`) are examples in the text, never the rule. A link target counts as a screen only if a file for it exists in the design reference.

*Alternative considered:* a per-tool parser. Brittle and tool-bound; the agent reads HTML well enough to apply behavioral rules.

### D3. Inventions split by visibility

| Invention | Visible | Action |
|---|---|---|
| orphan endpoint, generated document | no | remove, list in PR |
| screen, interactivity over display, login | yes | Level 2 keep/remove, recorded in `DECISIONS.md` |

Removing an invisible invention changes nothing the human sees, so it needs no question. A visible one may be something the human asked the builder for while iterating; the agent cannot know, so it asks once. The recorded answer follows the parallel-backend pattern already in `DESIGN-DRIVEN.md`.

*Alternative considered:* remove every invention. Would silently delete work the human requested in the builder.

*Alternative considered:* keep every invention. Reproduces the failure seen in the test (a platform built from a landing page).

### D4. Where the new text goes

| File | Change |
|---|---|
| `protocol/DESIGN-DRIVEN.md` | new *Design reference*, *Reading the design*, *Design comparison*, *Inventions* sections; four new rows in the signals table; generated documentation rule; empty-table rule; presentation rule reworded to name its source; PR sections *Design comparison*, *Design gaps*, *Inventions removed*, *Content to review* added to the definition of done |
| `protocol/CLASSIFICATION.md` | empty table → A; generated documentation is not evidence |
| `protocol/DECISION-POLICY.md` | visible invention as a Level 2 example |
| `openspec/changes/_template/proposal.md` | optional *Design comparison* block |
| `integrations/github/README.md` | commit the export under `design/<tool>/` on the design source branch; the allow-list covers it |

No gate or workflow code changes: the design reference is just files in the pull request.

## Risks / Trade-offs

- [The human forgets to commit the export, or commits a stale one] → the agent compares against what is there; a stale design yields false inventions, which become questions, not deletions. The PR states which design files were used. Recommend committing the export in the same push cycle.
- [A visible invention per screen means many questions on the first run] → one question per invention, answers recorded; later runs are silent. The test case would produce about three questions (screens, interactive preview, login).
- [HTML exports from other tools differ] → rules are behavioral; tool-specific hints are examples only.
- [The builder could modify `design/` while syncing] → commit authors cannot tell builder from human, so the agent cannot block it by identity. Accepted: any change under `design/` is visible in the design pull request diff, and the reviewer sees it before merge.

## Migration Plan

- Framework files change: bump `template/.bootstrap-version`; `--update` refreshes untouched protocol files and reports conflicts otherwise.
- Opt-in per repository: nothing changes until a `design/<tool>/` folder is committed. Without it, the no-reference fallback is today's behavior.
- Ordered after `add-design-driven-implementation` (it edits the file that change creates).
