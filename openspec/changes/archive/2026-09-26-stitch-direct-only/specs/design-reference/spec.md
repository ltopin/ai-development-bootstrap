## ADDED Requirements

### Requirement: The agent only reads the design tool
The agent SHALL use the design tool's API or MCP server only to read: list projects and screens, and fetch the screens it exports. It MUST NOT create, generate, edit, vary or delete screens, projects or design systems in the design tool, even when the tool's access allows it. A change to the design SHALL be made by the human in the design tool and reach the agent through a new export.

#### Scenario: Screen needs a change
- **WHEN** implementing a screen shows that the design should change (a missing state, a better layout)
- **THEN** the agent does not edit the design in the tool; it implements the design as it is, lists states added or presentation changes as usual, and may suggest the change to the human in the pull request

#### Scenario: Human asks the agent to generate a screen in the tool
- **WHEN** the human asks the agent to generate or edit a screen in the design tool
- **THEN** the agent does not do it and explains that the design stays human input under this protocol

## MODIFIED Requirements

### Requirement: Design reference is the contract when present
A repository carries the design reference: the design tool's export, one file per screen, under `design/<tool>/` on the branch of the change. The agent SHALL treat it as the contract for presentation and flow. Designed screens MUST NOT be implemented without a design reference. When the human asks to implement screens that the design reference does not have, and does not name them in the design tool, the agent MUST stop with a Level 2 question asking which design project and screens to use.

#### Scenario: Design reference present
- **WHEN** the branch of the change contains `design/<tool>/` with the screens to implement
- **THEN** the agent reads the design reference before building the requirements table and uses it as the contract for presentation and flow

#### Scenario: No design reference
- **WHEN** the human asks to implement a screen, the design reference does not have it, and the request names no design project or screen in the tool
- **THEN** the agent stops with `WAITING_FOR_HUMAN` and asks which design to use

#### Scenario: Design reference not modified by the agent
- **WHEN** an automated run implements the change, or an interactive session implements it without naming the design in the tool and without an export request
- **THEN** it does not create, edit or delete files under `design/`

### Requirement: The design is read by behavior
The agent SHALL classify each element of the design reference by behavior, without depending on a specific tool's format: an element that accepts input or triggers an action is a **requirement**; an element that only shows values (read-only input, fixed values, static text) is **display**; a link to another screen of the design reference is a **required flow**. A link whose target is not a screen of the design reference MUST be reported in the pull request under *Design gaps* and MUST NOT be built.

#### Scenario: Form in the design
- **WHEN** the design reference contains a form that submits data
- **THEN** the agent treats it as a requirement that must work for real, and it becomes a row of the requirements table

#### Scenario: Read-only preview in the design
- **WHEN** the design reference shows a read-only input and fixed values
- **THEN** the agent treats them as display: it preserves them and does not back them with a contract

#### Scenario: Link to a screen that does not exist
- **WHEN** a link in the design reference names a target that is not a screen of the design reference
- **THEN** the agent lists it under *Design gaps* in the pull request and does not create that screen

### Requirement: Content belongs to the human
The agent SHALL NOT rewrite or invent content (copy, testimonials, metrics, names, images) of the design reference. Placeholder-looking content MAY be listed in the pull request under *Content to review*; it does not block the change.

#### Scenario: Testimonials with named people
- **WHEN** the page shows testimonials attributed to named people
- **THEN** the agent leaves them unchanged and may list them under *Content to review*

### Requirement: Design export through tool access
An interactive session SHALL create or refresh `design/<tool>/` through the design tool's API or MCP server when the human asks for an export, or asks to implement screens and names their design project or screens in the tool; that request is the export request. The session MUST export only the named screens (with their variants), MUST write only what the tool returns, MUST NOT edit the exported screens, and SHALL update `manifest.json` with the export time. Without a named design, the session MUST NOT export on its own. The session SHALL commit the export on the change branch as its own commit, before the implementation commits, and MUST push only when the human asks. Automated runs MUST NOT call the design tool.

#### Scenario: Implementation request naming the design
- **WHEN** the human asks an interactive session to implement the screens "checkout" and "orders" of a design project in the tool
- **THEN** the session exports those screens under `design/<tool>/`, updates the manifest, commits the export alone, then implements and commits the implementation, and does not push

#### Scenario: Human asks for an export
- **WHEN** the human asks an interactive session to export the screens of a design project, without asking to implement them
- **THEN** the session writes them under `design/<tool>/` through the tool's access, updates the manifest, commits the export alone and does not push

#### Scenario: Human asks to push
- **WHEN** the export and implementation commits exist and the human asks to push
- **THEN** the session pushes the change branch

#### Scenario: Refresh of an exported screen
- **WHEN** the human asks to implement a screen that is already in the design reference and names it in the tool
- **THEN** the session exports it again, replacing only that screen's files, and the export commit shows the design change as a diff

#### Scenario: Implementation request only
- **WHEN** the human asks to implement screens that are already in the design reference and names nothing in the tool
- **THEN** the session reads the existing design reference and does not write under `design/`

#### Scenario: Design tool unreachable
- **WHEN** the export is requested and the design tool's access fails or is not configured
- **THEN** the session writes nothing under `design/`, does not implement from memory, and stops with `WAITING_FOR_HUMAN` saying the export failed

#### Scenario: Automated run with outdated design
- **WHEN** an automated run finds that the design reference looks outdated
- **THEN** it does not call the design tool; it reports the doubt in the pull request

## REMOVED Requirements

### Requirement: Two-way comparison with the generated code
**Reason**: There is no generated app to compare with: the builder path is removed.
**Migration**: None. The design reference is implemented directly (see `design-direct-implementation`).

### Requirement: Inventions are handled by visibility
**Reason**: Inventions were a builder output problem. On the direct path the agent does not invent (*The agent does not invent on the direct path*).
**Migration**: Keep/remove answers already recorded in `DECISIONS.md` stay valid as history; no new ones are asked.

### Requirement: Generated documentation is a proposal
**Reason**: No builder writes documentation into the repository any more.
**Migration**: None. Documents in the repository follow the usual rules of `AI.md`.

### Requirement: Additional fake-boundary signals
**Reason**: The signals are merged into the single list of `design-direct-implementation` (*Fake boundaries are detected by behavior*). The orphan-endpoint signal is dropped with the builder path.
**Migration**: None.

### Requirement: Empty extraction table is class A
**Reason**: The extraction table is removed. The class A case is covered by the requirements table (`design-direct-implementation`).
**Migration**: None.
