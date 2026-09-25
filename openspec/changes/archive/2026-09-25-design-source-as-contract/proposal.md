## Why

`protocol/DESIGN-DRIVEN.md` treats the **generated app** as the human's design ("the layout, styling and visible behavior of the generated app are what the human designed"). In the workflow we want (design in a design tool, build with an app builder, agent makes it real), that is false: the builder is a second, lossy translation, and it invents. A sandbox test (a Stitch landing page with one form, built by AI Studio) came back with four screens, an interactive cockpit, a fake login, three server endpoints nobody calls and two architecture documents describing Postgres, Redis, a CRM and LTI, none of which were designed. An agent that sees only the generated code treats all of it as requirements and builds a platform from a landing page.

The agent needs the original design as its reference, so that "what must work" comes from what the human designed, not from what the builder guessed.

## What Changes

- **Design reference.** A repository that adopts builder-driven development may carry the design tool's export next to the code (convention: `design/<tool>/`, one file per screen, committed by a human to the design source branch). When a design reference is present, it is the contract for **presentation and flow**. The generated app is the starting implementation, not the contract. **BREAKING** for the wording of `DESIGN-DRIVEN.md`'s "Presentation is the human's contract" (the rule is kept; its source moves from the generated app to the design reference when one exists).
- **Reading the design by behavior**, tool-independent:
  - an element that accepts input or triggers an action (form, enabled input, button with a destination) is a **requirement**: it must work for real;
  - an element that only shows values (read-only input, fixed numbers, static text) is **display**: preserved, never backed by a contract;
  - a navigation link to another screen of the design is a **required flow**; a link whose target does not exist in the design is reported, not built.
- **Two-way comparison** between the design reference and the generated code:
  - in the design, faked or missing in the code → a row of the extraction table (unchanged status → class rules);
  - in the code, with no origin in the design → an **invention**:
    - not visible to the user (an endpoint no client calls, a generated document) → removed and listed in the pull request;
    - visible to the user (a screen, interactivity, a login) → one Level 2 question (keep or remove), because the human may have asked the builder for it; the answer is recorded so later runs apply it.
- **Generated documentation is a proposal.** Documents the builder writes (architecture, schemas, "how it works") are never L0 documents or recorded decisions; they have the status of a generated server.
- **New fake-boundary signals** found in the test: success faked in an error path (a `catch` that shows success), fake authentication (credentials or role chosen in the client decide access), an action with no effect (submit or button that only changes local state), an orphan endpoint (a generated endpoint no client calls).
- **Empty extraction table → class A.** A page with no fake boundary and no design requirement that needs data is class A: no backend work; the pull request says so.
- **No design reference** → today's behavior, and the pull request states that no design comparison was made.
- The generated app's own content (testimonials, metrics, copy) and the design reference's content are the human's; the agent does not rewrite or invent them.

Tools are named only as examples (Stitch, AI Studio). Access through a tool's API or MCP server is a later option, not part of this change.

## Capabilities

### New Capabilities
- `design-reference`: the design reference as contract for presentation and flow, how it is read (requirement, display, flow), the two-way comparison with the generated code, invention handling, generated documentation as a proposal, the new fake-boundary signals, empty-table class A, and the no-reference fallback.

### Modified Capabilities
<!-- None: openspec/specs/ has no baseline yet (add-design-driven-implementation is not archived). This change builds on its design-driven-implementation capability and is ordered after it. -->

## Impact

- `template/protocol/DESIGN-DRIVEN.md`: new sections (design reference, reading the design, comparison, inventions), new signals in the fake-boundary table, empty-table rule, reworded presentation rule.
- `template/protocol/CLASSIFICATION.md`: empty table → A; generated documentation is not evidence.
- `template/protocol/DECISION-POLICY.md`: visible invention as a Level 2 example.
- `template/openspec/changes/_template/proposal.md`: optional *Design comparison* block (inventions and their outcome).
- `template/integrations/github/README.md`: where to commit the design export and that the design source branch allow-list covers it.
- `template/.bootstrap-version`, `examples/multi-repo-example/` mirror, `README.md`.
- Depends on `add-design-driven-implementation` landing first.
