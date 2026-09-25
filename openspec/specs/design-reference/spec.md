# design-reference Specification

## Purpose

Defines how an agent uses the original design (the export of the design tool) as the contract for presentation and flow when implementing a builder-generated app, so that what must work comes from what the human designed and not from what the builder generated.

## Requirements

### Requirement: Design reference is the contract when present
A repository MAY carry a design reference: the design tool's export, one file per screen, under `design/<tool>/` on the design source branch. When a design reference is present, the agent SHALL treat it as the contract for presentation and flow, and SHALL treat the generated app as the starting implementation. When no design reference is present, the agent SHALL treat the generated app as the contract (the existing rule) and MUST state in the pull request that no design comparison was made.

#### Scenario: Design reference present
- **WHEN** the design source branch contains `design/<tool>/` with at least one screen
- **THEN** the agent reads the design reference before building the extraction table and uses it as the contract for presentation and flow

#### Scenario: No design reference
- **WHEN** the repository has no design reference
- **THEN** the agent applies the rules that take the generated app as the contract, and the pull request says "no design comparison: no design reference"

#### Scenario: Design reference not modified by the agent
- **WHEN** the agent implements the change
- **THEN** it does not create, edit or delete files under `design/`

### Requirement: The design is read by behavior
The agent SHALL classify each element of the design reference by behavior, without depending on a specific tool's format: an element that accepts input or triggers an action is a **requirement**; an element that only shows values (read-only input, fixed values, static text) is **display**; a link to another screen of the design reference is a **required flow**. A link whose target is not a screen of the design reference MUST be reported in the pull request and MUST NOT be built.

#### Scenario: Form in the design
- **WHEN** the design reference contains a form that submits data
- **THEN** the agent treats it as a requirement that must work for real, and it becomes a row of the extraction table

#### Scenario: Read-only preview in the design
- **WHEN** the design reference shows a read-only input and fixed values
- **THEN** the agent treats them as display: it preserves them and does not back them with a contract

#### Scenario: Link to a screen that does not exist
- **WHEN** a link in the design reference names a target that is not a screen of the design reference
- **THEN** the agent lists it under *Design gaps* in the pull request and does not create that screen

### Requirement: Two-way comparison with the generated code
The agent SHALL compare the design reference with the generated code in both directions. Every requirement of the design that is faked or missing in the code MUST become a row of the extraction table. Every behavior, screen, endpoint or document in the code with no origin in the design reference is an **invention**. The comparison result MUST be included in the pull request.

#### Scenario: Designed requirement faked in code
- **WHEN** a form in the design is implemented in the generated code against an in-memory generated endpoint
- **THEN** the extraction table has a row for it with status `proposed`

#### Scenario: Generated code matches the design
- **WHEN** every requirement of the design is backed in the code and the code has no invention
- **THEN** the pull request's *Design comparison* section says "no inventions, no gaps"

### Requirement: Inventions are handled by visibility
An invention not visible to the user (an endpoint no client calls, a generated document) SHALL be removed and listed in the pull request. An invention visible to the user (a screen, interactivity where the design shows display, an authentication flow) SHALL NOT be removed or kept silently: unless `DECISIONS.md` already records the outcome, the agent MUST stop the affected work with one Level 2 question offering keep or remove, and the answer MUST be recorded in `DECISIONS.md` so later runs apply it without asking. Inventions that stand or fall together (the screens behind one navigation bar) MAY be one invention and one question. The fake boundaries inside a visible invention that has no recorded outcome MUST NOT become rows of the extraction table or set the class until the answer is known.

#### Scenario: Orphan generated endpoint
- **WHEN** the generated server has an endpoint that no client calls and that has no origin in the design
- **THEN** the agent removes it and lists it under *Inventions removed* in the pull request

#### Scenario: Screen not in the design
- **WHEN** the generated app has a screen that is not in the design reference and `DECISIONS.md` has no entry for it
- **THEN** the agent stops the affected work with `WAITING_FOR_HUMAN` and one question offering keep or remove

#### Scenario: Screen generated behind a design gap
- **WHEN** a link in the design reference names a screen that is not in the design reference, and the generated app already has that screen
- **THEN** the link is listed under *Design gaps* and the screen is a visible invention: the agent asks keep or remove and neither builds nor finishes it before the answer

#### Scenario: Recorded answer
- **WHEN** a later run finds the same visible invention and `DECISIONS.md` records "remove"
- **THEN** the agent removes it without asking and cites the decision in the pull request

#### Scenario: Kept invention
- **WHEN** the human answered "keep" for a visible invention
- **THEN** the agent treats it as a requirement from then on, and its fake boundaries enter the extraction table

### Requirement: Generated documentation is a proposal
Documents written by the builder (architecture, schemas, feature descriptions) SHALL have the status of a generated server: proposed, never an L0 document, never a recorded decision, and never classification evidence. A technology or integration named only in generated documentation MUST NOT be adopted without a recorded decision.

#### Scenario: Generated architecture document names a database
- **WHEN** a generated document says the system uses a specific database and queue, and `DECISIONS.md` does not record that choice
- **THEN** the agent does not adopt them on the document's authority; the choice follows the decision policy

### Requirement: Additional fake-boundary signals
In addition to the existing signals, the agent SHALL report as fake boundaries: success faked in an error path (an error handler that shows success), fake authentication (access decided by credentials or roles chosen in the client), an action with no effect (a submit or button that only changes local state where the design requires an effect), and an orphan endpoint (a generated endpoint no client calls). These signals apply in both the start scan and the done scan.

#### Scenario: Error path shows success
- **WHEN** a form's error handler generates a confirmation code in the client and shows success
- **THEN** the agent reports it as a fake boundary and the done scan fails until it is removed

#### Scenario: Role picker as login
- **WHEN** a login form grants access based on a role the user selects, with no server check
- **THEN** the agent reports it as fake authentication

### Requirement: Empty extraction table is class A
When the start scan finds no fake boundary other than orphan endpoints (which are removed, not rows) and the design reference (or, without one, the generated app) has no requirement that needs data, the change SHALL be class A. The agent MUST NOT add backend work, and the pull request MUST state "no fake boundaries: presentation only".

#### Scenario: Static landing page
- **WHEN** a landing page has only static sections and no form or data-driven element
- **THEN** the change is class A, only the frontend repository is opened, and no backend work is done

### Requirement: Content belongs to the human
The agent SHALL NOT rewrite or invent content (copy, testimonials, metrics, names, images) in either the design reference or the generated app. Placeholder-looking content MAY be listed in the pull request under *Content to review*; it does not block the change.

#### Scenario: Testimonials with named people
- **WHEN** the page shows testimonials attributed to named people
- **THEN** the agent leaves them unchanged and may list them under *Content to review*
