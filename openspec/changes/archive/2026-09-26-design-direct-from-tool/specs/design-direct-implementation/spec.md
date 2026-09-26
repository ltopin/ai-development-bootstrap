## Purpose

Defines how an agent implements a change directly from the design reference, with no app-builder output in between, so that the design is translated once, into the project's real stack, with real data from the start.

## ADDED Requirements

### Requirement: Choosing the direct path
The agent SHALL take the direct path when the change asks to implement screens or flows of the design reference and the change carries no generated app for them. When the change carries a generated app (a runnable result produced by a builder), the agent SHALL take the builder path instead. When neither the change nor the workspace makes this clear, the agent MUST ask one Level 2 question naming both paths.

#### Scenario: Design reference and no generated code
- **WHEN** the change adds or updates `design/<tool>/` and asks for its screens to be implemented, and no builder output is part of the change
- **THEN** the agent follows the direct path

#### Scenario: Generated app present
- **WHEN** the change contains a generated app for the designed screens
- **THEN** the agent follows the builder path and its invention and extraction rules

#### Scenario: Unclear input
- **WHEN** the change has app code whose origin (builder or human) cannot be told from the change or the workspace documents
- **THEN** the agent stops with `WAITING_FOR_HUMAN` and one question offering the direct path or the builder path

### Requirement: Requirements table as classification evidence
On the direct path, before implementing, the agent SHALL produce a requirements table with one row per requirement of the design reference that needs data or an effect: the element (with its design file), what it needs, the matching real contract, and a status of `exists`, `partial` or `missing`. The class SHALL follow from the statuses as for the extraction table (`exists` → B, `partial` → C, `missing` → D, highest wins). When no requirement needs data or an effect, the change SHALL be class A. The table MUST be included in the pull request, or in `proposal.md` when a formal change is opened.

#### Scenario: Form backed by an existing endpoint
- **WHEN** the design has a form whose data an existing API already accepts
- **THEN** the table has a row with status `exists` and the change is class B unless another row is higher

#### Scenario: Design with only display elements
- **WHEN** every element of the designed screens is display or navigation between designed screens
- **THEN** the change is class A and the pull request says "no requirements need data: presentation only"

### Requirement: The design is implemented in the project's stack
On the direct path, the agent SHALL take layout, flow and content from the design reference and implement them with the project's stack and conventions, reusing the project's existing components and design tokens where they produce the designed result. The design tool's markup MUST NOT be pasted as the implementation (for example its CDN styles or inline scripts). Every visible difference from the design that the agent introduces MUST be listed with its reason under *Presentation changes*, with the same allowed reasons as the builder path (accessibility, stack incompatibility, security, data that cannot exist as drawn) plus an existing project component that is close but not identical.

#### Scenario: Existing button component
- **WHEN** the project has a button component that renders the designed button
- **THEN** the agent uses it instead of recreating the design tool's markup

#### Scenario: Component differs slightly
- **WHEN** the closest existing component differs visibly from the design
- **THEN** the agent either matches the design or uses the component and lists the difference under *Presentation changes*

### Requirement: States the design does not draw
When a requirement needs a loading, empty, error or validation state that the design reference does not draw, the agent SHALL add a minimal state in the design's style and list it under *States added* in the pull request. Such states MUST NOT be treated as inventions and MUST NOT stop the change.

#### Scenario: Form without an error state
- **WHEN** a designed form submits to an API and the design shows no error state
- **THEN** the agent adds a minimal error message in the design's style and lists it under *States added*

### Requirement: The agent does not invent on the direct path
On the direct path, the agent SHALL NOT add screens, navigation, interactivity or content that the design reference does not show, other than the states of the previous requirement. A link to a screen that is not in the design reference MUST be listed under *Design gaps* and MUST NOT be built.

#### Scenario: Link to an undesigned screen
- **WHEN** a designed button links to a screen that has no file in the design reference
- **THEN** the agent leaves the link without a new screen and lists it under *Design gaps*

### Requirement: No fake data at done on the direct path
The done scan SHALL run on the direct path over the code the agent wrote. A requirement MUST NOT be declared done while it is backed by literal data, simulated latency, browser storage used as a database, a client-generated identity for persisted entities, or a client-side credential. A remaining match MUST be removed or listed under *Remaining matches* with its reason.

#### Scenario: Temporary literal data left behind
- **WHEN** the agent used literal data to render a list while building and the list has a real contract
- **THEN** the done scan fails until the list reads from the contract

### Requirement: Direct path pull request
The pull request of a direct-path change SHALL contain: the design files used (and the manifest's export time when a manifest exists), the requirements table and class, *Presentation changes*, *States added*, *Design gaps*, *Remaining matches* and *Content to review*, each with "none" when empty.

#### Scenario: Complete pull request
- **WHEN** a direct-path change is ready
- **THEN** its pull request contains every listed section, and empty ones say "none"
