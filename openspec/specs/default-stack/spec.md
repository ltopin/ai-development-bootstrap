# default-stack Specification

## Purpose

Defines how a bootstrapped workspace records the stack of its existing repositories and a default stack for new ones, and how an agent chooses which one to follow, so that new repositories get a consistent structure without imposing it on code that already exists.

## Requirements

### Requirement: Stack file with two sections
The layer SHALL contain a project-managed `STACK.md` with two sections: **Current stack**, describing the stack of each existing repository, and **Standard for new repositories**, describing the default stack, folder structure and conventions for repositories that do not exist yet. The standard delivered by the template SHALL be the lean React + NestJS + MongoDB standard, and SHALL list what it deliberately leaves out.

#### Scenario: Fresh bootstrap
- **WHEN** the bootstrap installs the layer into a workspace
- **THEN** `ai-development/STACK.md` exists, its Current stack section is empty (placeholder), and its Standard section contains the default React + NestJS + MongoDB standard

#### Scenario: Update keeps the project's stack file
- **WHEN** `--update` runs on a project whose `STACK.md` exists
- **THEN** `STACK.md` is not modified and is reported as a preserved project file

#### Scenario: Update on a project bootstrapped before this change
- **WHEN** `--update` runs on a project that has no `STACK.md`
- **THEN** `STACK.md` is created from the template and reported as created

### Requirement: Initialization records the detected stack
The Project Initialization Protocol SHALL fill the Current stack section from evidence (manifests, configuration, top-level structure), one entry per repository, marking unknown items as `unknown`. It MUST NOT modify the Standard section and MUST NOT describe a repository's stack from its name alone.

#### Scenario: Existing project with code
- **WHEN** initialization runs on a workspace whose repositories contain a React app and an Express API
- **THEN** Current stack lists both repositories with their detected technologies, and the Standard section is unchanged

#### Scenario: New project without repositories
- **WHEN** initialization runs on a workspace with no repositories
- **THEN** Current stack states that there are no repositories yet, and the Standard section is unchanged

#### Scenario: Unclear stack
- **WHEN** a repository's manifests do not show its framework
- **THEN** its entry marks the framework as `unknown` instead of guessing

### Requirement: Existing repositories follow their own stack
When changing an existing repository, the agent SHALL follow that repository's own stack and conventions, and MUST NOT migrate it, restructure it or add technologies to it in order to match the Standard section.

#### Scenario: Change in an Express repository
- **WHEN** the agent adds an endpoint to an existing Express API in a project whose standard is NestJS
- **THEN** the endpoint is written in the repository's Express conventions and no NestJS dependency is added

### Requirement: New repositories follow the standard
When the agent creates a new repository or its initial structure, it SHALL follow the Standard section of `STACK.md`, even when existing repositories use a different stack. Creating a new repository remains a human decision: the agent MUST NOT create one unless the human asked for it or an `ACTIVE` decision covers it.

#### Scenario: Human asks to create the project
- **WHEN** the human asks the agent to create the project in a workspace with no repositories
- **THEN** the agent creates `web/` and `api/` with the structure, tools and conventions of the Standard section and records them in REPOSITORIES.md and Current stack

#### Scenario: New repository in a project with another stack
- **WHEN** the human asks for a new API repository in a project whose existing API uses Express
- **THEN** the new repository follows the Standard section (NestJS), not the Express stack

#### Scenario: Agent thinks a new repository is needed
- **WHEN** during a change the agent concludes a new service or repository is needed and no decision covers it
- **THEN** it asks the human (Level 2) instead of creating it

### Requirement: Items outside the standard are human decisions
Anything the Standard section lists as deliberately left out (for example authentication model, deploy and CI, global state library) SHALL be treated as not decided: the agent MUST consult DECISIONS.md and, when no `ACTIVE` entry answers it, follow the decision policy instead of choosing silently.

#### Scenario: First feature needing authentication
- **WHEN** a new repository built from the standard needs authentication and DECISIONS.md has no active entry for it
- **THEN** the agent asks the human for the authentication model before implementing the parts that depend on it

### Requirement: The standard is changed only by the human
The agent MUST NOT change the Standard section unless the human explicitly asks for it. When the human changes the standard, repositories created before the change keep their stack and are not migrated automatically.

#### Scenario: Agent prefers another library
- **WHEN** the agent would prefer a library other than the one in the standard
- **THEN** it follows the standard, and at most mentions the suggestion to the human without editing `STACK.md`
