## ADDED Requirements

### Requirement: Designed screens are implemented directly
The agent SHALL implement designed screens and flows directly from the design reference, in the project's stack. The protocol MUST NOT define a second path for app-builder output: app code in a change, whatever tool produced it, SHALL be treated as ordinary code under the usual rules, and it MUST NOT replace the design reference as the contract for presentation and flow.

#### Scenario: Request to implement designed screens
- **WHEN** the human asks to implement screens of a design project
- **THEN** the agent implements them from the design reference, with no question about which path applies

#### Scenario: Change carries builder-generated code
- **WHEN** a change contains app code produced by an app builder for the designed screens
- **THEN** the agent treats that code as ordinary code, keeps the design reference as the contract, and applies the direct-path rules and the done scan to it

### Requirement: Fake boundaries are detected by behavior
The protocol SHALL define fake boundaries as behavioral signals, not as file locations or folder conventions. The signals are: literal data used as a data source, simulated latency, browser storage used as a database for domain entities, client-generated identifiers for persisted entities, credentials or third-party or model calls made from the client, server endpoints that return fixed data, success faked in an error path, fake authentication (access decided by credentials or roles chosen in the client), and an action with no effect (a submit or button that only changes local state where the design requires an effect). The done scan MUST cover both client and server code of the change.

#### Scenario: Data defined inside a component
- **WHEN** hardcoded domain data is defined inside a component file and rendered as the result of a requirement
- **THEN** the done scan reports it as a fake boundary

#### Scenario: Error path shows success
- **WHEN** a form's error handler shows success to the user
- **THEN** the done scan reports it and the change is not ready until it is removed

#### Scenario: Client-side credential
- **WHEN** client code uses an API key or calls a model or third-party service directly
- **THEN** the agent reports it as a fake boundary to move server-side, and treats the key as a Level 3 secret whose value it never asks for

### Requirement: New repositories are a human decision
The agent MUST NOT create repositories. When a requirement needs a backend or another repository that does not exist in a multi-repository setup, the agent SHALL stop with a Level 2 question.

#### Scenario: Backend repository missing
- **WHEN** a `missing` row needs a backend and the workspace is multi-repository with no backend repository
- **THEN** the agent asks where the backend lives and does not create a repository

### Requirement: Tool independence
The protocol SHALL name design tools, agents and platforms only as examples. No requirement MUST depend on a specific design tool's file layout, API or features beyond the export format of the design reference.

#### Scenario: Different design tool
- **WHEN** the screens come from a design tool other than the example
- **THEN** the same reading, requirements table, implementation and done rules apply unchanged, with its export under `design/<tool>/`

## MODIFIED Requirements

### Requirement: Requirements table as classification evidence
Before implementing, the agent SHALL produce a requirements table with one row per requirement of the design reference that needs data or an effect: the element (with its design file), what it needs, the matching real contract, and a status of `exists`, `partial` or `missing`. The class SHALL follow from the statuses (`exists` → B, `partial` → C, `missing` → D, highest wins). When no requirement needs data or an effect, the change SHALL be class A and the agent MUST NOT add backend work. The table MUST be included in the pull request, or in `proposal.md` when a formal change is opened.

#### Scenario: Form backed by an existing endpoint
- **WHEN** the design has a form whose data an existing API already accepts
- **THEN** the table has a row with status `exists` and the change is class B unless another row is higher

#### Scenario: Mixed statuses
- **WHEN** one row is `exists` and another is `missing`
- **THEN** the change is classified D, and the table is the recorded evidence

#### Scenario: Design with only display elements
- **WHEN** every element of the designed screens is display or navigation between designed screens
- **THEN** the change is class A, no backend work is done, and the pull request says "no requirements need data: presentation only"

### Requirement: The design is implemented in the project's stack
The agent SHALL take layout, flow and content from the design reference and implement them with the project's stack and conventions, reusing the project's existing components and design tokens where they produce the designed result. The design tool's markup MUST NOT be pasted as the implementation (for example its CDN styles or inline scripts). The agent MUST NOT make cosmetic changes to the design. Every visible difference from the design that the agent introduces MUST be listed with its reason under *Presentation changes*. The allowed reasons are: accessibility, stack incompatibility, security, data that cannot exist as drawn, and an existing project component that is close but not identical.

#### Scenario: Existing button component
- **WHEN** the project has a button component that renders the designed button
- **THEN** the agent uses it instead of recreating the design tool's markup

#### Scenario: Component differs slightly
- **WHEN** the closest existing component differs visibly from the design
- **THEN** the agent either matches the design or uses the component and lists the difference under *Presentation changes*

#### Scenario: No cosmetic improvements
- **WHEN** the agent notices a styling choice in the design it considers poor but that works
- **THEN** the agent implements it as designed

### Requirement: No fake data at done on the direct path
The done scan SHALL run over the code of the change and look for every fake-boundary signal. A requirement MUST NOT be declared done while it is backed by a fake boundary. A remaining match that is legitimate (test fixtures, seeds, feature flags) MUST be listed under *Remaining matches* with its reason; any other match MUST be removed.

#### Scenario: Temporary literal data left behind
- **WHEN** the agent used literal data to render a list while building and the list has a real contract
- **THEN** the done scan fails until the list reads from the contract

#### Scenario: Legitimate fixture
- **WHEN** the done scan matches literal data used only by tests
- **THEN** the agent may declare the change ready and lists the match with its reason under *Remaining matches*

## REMOVED Requirements

### Requirement: Choosing the direct path
**Reason**: The builder path is removed, so there is no path to choose. Replaced by *Designed screens are implemented directly*.
**Migration**: None needed for direct-path users. Repositories that depend on the builder path stay on bootstrap 1.5.x.
