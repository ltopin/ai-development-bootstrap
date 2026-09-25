## Purpose

Defines how an agent turns an app produced by a design or app-builder tool (with a fake data layer) into a working, integrated change that stops at a pull request, without depending on any specific tool.

## ADDED Requirements

### Requirement: Presentation is the human's contract
The agent SHALL preserve the layout, styling and visible behavior of the generated app. It MUST change presentation only when technically required (broken accessibility, stack incompatibility, a security problem, or data that cannot exist as drawn), and MUST list every such change with its reason in the pull request.

#### Scenario: Integration without visual change
- **WHEN** the agent replaces a fake data source with a real API call
- **THEN** the rendered screens keep the same layout, styles and visible behavior, and the pull request lists no presentation changes

#### Scenario: Required presentation change
- **WHEN** a drawn field cannot be backed by any real or proposed data
- **THEN** the agent changes the presentation only as far as needed and lists the change and its reason in the pull request

#### Scenario: No cosmetic improvements
- **WHEN** the agent notices a styling choice it considers poor but that works
- **THEN** the agent leaves it unchanged

### Requirement: Fake boundaries are detected by behavior
The protocol SHALL define fake boundaries as behavioral signals, not as file locations or folder conventions. The signals are: literal data used as a data source, simulated latency, browser storage used as a database for domain entities, client-generated identifiers for persisted entities, credentials or third-party/model calls made from the client, and generated server endpoints that return fixed data. The agent MUST scan both client and any generated server code.

#### Scenario: Mocks outside any conventional folder
- **WHEN** hardcoded domain data is defined inside a component file
- **THEN** the agent reports it as a fake boundary

#### Scenario: Generated server returning constants
- **WHEN** a generated server endpoint returns fixed data
- **THEN** the agent reports it as a fake boundary and as a proposed contract

#### Scenario: Client-side credential
- **WHEN** client code uses an API key or calls a model or third-party service directly
- **THEN** the agent reports it as a fake boundary to move server-side, and treats the key as a Level 3 secret whose value it never asks for

### Requirement: Extraction table as classification evidence
Before implementing, the agent SHALL produce an extraction table with one row per fake boundary: the element, what it needs, the matching real contract, and a status of `exists`, `partial`, `missing` or `proposed`. The class SHALL follow from the statuses (`exists` → B, `partial` → C, `missing` → D, highest wins). The table MUST be included in the pull request, or in `proposal.md` when a formal change is opened.

#### Scenario: Mixed statuses
- **WHEN** one row is `exists` and another is `missing`
- **THEN** the change is classified D, and the table is the recorded evidence

#### Scenario: Generated endpoint is not an existing contract
- **WHEN** the only matching contract is an endpoint in the generated server
- **THEN** the row status is `proposed`, never `exists`

### Requirement: Mode is decided from the workspace map
The agent SHALL decide between **new project** and **existing project** from the L0 documents, not from the generated code. In a new project, the generated app is the frontend and its server is the seed of the backend, which the agent hardens instead of rewriting. In an existing project, generated client code MUST be adapted to the existing frontend's conventions while preserving presentation. When the map does not settle the mode, the agent MUST ask a Level 2 question.

#### Scenario: New project
- **WHEN** `REPOSITORIES.md` lists no backend for the product
- **THEN** the agent treats the generated server as the backend seed and adds persistence, validation, authentication and tests to it

#### Scenario: Existing project
- **WHEN** `REPOSITORIES.md` lists an existing frontend and backend
- **THEN** the agent integrates generated screens using the existing frontend's HTTP client, authentication, routing and state conventions

#### Scenario: Ambiguous mode
- **WHEN** the L0 documents do not show whether a backend exists
- **THEN** the agent stops with `WAITING_FOR_HUMAN` and asks which mode applies

### Requirement: Parallel backend is never left silently
In an existing project, a generated server next to the real backend SHALL be treated as a parallel backend. Unless `DECISIONS.md` already records the choice, the agent MUST stop with a Level 2 question offering: absorb into the real backend, keep as a backend-for-frontend, or drop.

#### Scenario: Parallel backend without a recorded decision
- **WHEN** the generated app includes a server and the project already has a backend, and `DECISIONS.md` has no entry about it
- **THEN** the agent stops with `WAITING_FOR_HUMAN` before implementing the affected work

#### Scenario: Parallel backend with a recorded decision
- **WHEN** `DECISIONS.md` records that generated servers are absorbed into the real backend
- **THEN** the agent absorbs the generated endpoints without asking

### Requirement: New repositories are a human decision
The agent MUST NOT create repositories. When a new backend in a multi-repository setup needs a repository that does not exist, the agent SHALL stop with a Level 2 question.

#### Scenario: Backend repository missing
- **WHEN** a new project needs a backend and the workspace is multi-repository with no backend repository
- **THEN** the agent asks where the backend lives and does not create a repository

### Requirement: Definition of done
The agent SHALL declare the change ready only when: the fake-boundary scan run at the end finds no unexplained fake boundary, every client data call is backed by a real contract, the backend work (endpoints, persistence, migrations) is implemented with tests, and CI passes. Remaining matches that are legitimate (test fixtures, seeds, feature flags) MUST be listed in the pull request with the reason. Infrastructure and deploy are not part of done.

#### Scenario: Leftover fake data
- **WHEN** the final scan finds a hardcoded data source still used by a screen
- **THEN** the agent does not declare the change ready

#### Scenario: Legitimate fixture
- **WHEN** the final scan matches literal data used only by tests
- **THEN** the agent may declare ready and lists the match with its reason in the pull request

#### Scenario: Reintroduced mocks
- **WHEN** a later builder push reintroduces fake data into code the agent had integrated
- **THEN** the next agent execution reports it in the extraction table and removes it again

### Requirement: Tool independence
The protocol SHALL name design and builder tools, agents and platforms only as examples. No requirement MUST depend on a specific tool's file layout, commit identity or features.

#### Scenario: Different builder
- **WHEN** a builder other than the example tool produces the app
- **THEN** the same detection, extraction, mode and done rules apply unchanged
