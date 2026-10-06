## MODIFIED Requirements

### Requirement: New repositories follow the standard
When the agent creates a new repository or its initial structure, it SHALL follow the Standard section of `STACK.md`, even when existing repositories use a different stack. Creating a new repository remains a human decision: the agent MUST NOT create one unless the human asked for it or an `ACTIVE` decision covers it. The agent SHALL create only the repositories the human asked for and, when a request to create the project does not say which, SHALL ask whether it is backend only (`api/`), frontend only (`web/`) or full stack (both) before creating anything. It MUST NOT create both by default.

#### Scenario: Human asks to create the project
- **WHEN** the human asks the agent to create the project in a workspace with no repositories, without saying whether it is backend, frontend or full stack
- **THEN** the agent asks backend only, frontend only or full stack, and creates nothing until the human answers

#### Scenario: Human asks for the backend only
- **WHEN** the human asks the agent to create the backend following the standard
- **THEN** the agent creates only `api/` with the structure, tools and conventions of the Standard section, asks no repository question, creates no `web/`, and records `api/` in REPOSITORIES.md and Current stack with no consumer of its OpenAPI document

#### Scenario: Human asks for the frontend only
- **WHEN** the human asks the agent to create only the frontend following the standard
- **THEN** the agent creates only `web/` and asks which API it consumes before generating API types, generating none when there is no API yet

#### Scenario: Human asks for a full stack project
- **WHEN** the human answers or states full stack
- **THEN** the agent creates `web/` and `api/` with the structure, tools and conventions of the Standard section and records both and the OpenAPI contract between them in REPOSITORIES.md and Current stack

#### Scenario: New repository in a project with another stack
- **WHEN** the human asks for a new API repository in a project whose existing API uses Express
- **THEN** the new repository follows the Standard section (NestJS), not the Express stack

#### Scenario: Agent thinks a new repository is needed
- **WHEN** during a change the agent concludes a new service or repository is needed and no decision covers it
- **THEN** it asks the human (Level 2) instead of creating it
