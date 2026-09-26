## MODIFIED Requirements

### Requirement: Design reference is the contract when present
A repository MAY carry a design reference: the design tool's export, one file per screen, under `design/<tool>/` on the branch of the change (on the builder path, the design source branch). When a design reference is present, the agent SHALL treat it as the contract for presentation and flow; on the builder path it SHALL treat the generated app as the starting implementation. When no design reference is present, the agent SHALL treat the generated app as the contract (the existing rule) and MUST state in the pull request that no design comparison was made.

#### Scenario: Design reference present
- **WHEN** the branch of the change contains `design/<tool>/` with at least one screen
- **THEN** the agent reads the design reference before building the extraction or requirements table and uses it as the contract for presentation and flow

#### Scenario: No design reference
- **WHEN** the repository has no design reference
- **THEN** the agent applies the rules that take the generated app as the contract, and the pull request says "no design comparison: no design reference"

#### Scenario: Design reference not modified by the agent
- **WHEN** an automated run implements the change, or an interactive session implements it without an explicit export request
- **THEN** it does not create, edit or delete files under `design/`

## ADDED Requirements

### Requirement: Design export through tool access
An interactive session SHALL create or refresh `design/<tool>/` through the design tool's API or MCP server only when the human explicitly asks for it, and the human decides whether to commit the result. Without that request, an interactive session MUST NOT write under `design/`. Automated runs MUST NOT call the design tool. The export MUST contain only what the tool returns for the requested screens; the session MUST NOT edit the exported screens.

#### Scenario: Human asks for an export
- **WHEN** the human asks an interactive session to export the screens of a design project
- **THEN** the session writes them under `design/<tool>/` through the tool's access, shows what it wrote, and leaves the commit to the human

#### Scenario: Implementation request only
- **WHEN** the human asks an interactive session to implement the design and does not ask for an export
- **THEN** the session reads the existing design reference and does not write under `design/`

#### Scenario: Automated run with outdated design
- **WHEN** an automated run finds that the design reference looks outdated
- **THEN** it does not call the design tool; it reports the doubt in the pull request

### Requirement: Export format
Each screen of the design reference SHALL be one markup file named after the screen. Variants of the same screen (for example desktop and mobile) SHALL be named `<screen>.<variant>.<ext>` and MUST be read as one screen. An image of a screen or variant MAY sit next to it as `<screen>[.<variant>].png` and SHALL be used only as a visual reference for the markup of the same name. A `manifest.json` MAY record the tool, the design project, the screen identifiers and the export time; when present, the pull request MUST name the export time it implemented.

#### Scenario: Desktop and mobile variants
- **WHEN** the design reference has `home.desktop.html` and `home.mobile.html`
- **THEN** the agent treats them as one screen `home` with two variants, not as two screens and not as a design gap

#### Scenario: Image next to markup
- **WHEN** `checkout.png` sits next to `checkout.html`
- **THEN** the agent uses the image to check the visual result of `checkout` and reads requirements only from the markup

#### Scenario: Manifest present
- **WHEN** `design/<tool>/manifest.json` records an export time
- **THEN** the pull request states that export time as the version of the design it implements
