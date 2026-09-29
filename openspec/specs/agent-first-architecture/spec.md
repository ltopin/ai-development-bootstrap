# agent-first-architecture Specification

## Purpose
Defines how the layer makes every product built with it Agent-Ready (each relevant capability usable by human interfaces and by authorized Product Agents without depending on the UI), through the Agent-First constitution, the capability catalog and agentic impact in analysis, initialization, changes and validation, how existing projects adopt it through updates that never require a manual merge, and how brownfield products converge toward Agent-First by evolution (evidence-based Agent Readiness, the touched capability rule) while a framework update never migrates the product.

## Requirements
### Requirement: Agent-First constitution installed
The layer SHALL contain a framework-managed `AI-FIRST.md` that defines Agent-Ready capabilities, the primitives QUERY, KNOWLEDGE, COMMAND, EVENT and POLICY, the separation of UI / application layer / domain, security, autonomy levels, auditability, observability, human-in-the-loop and progressive autonomy for Product Agents, external channels, knowledge governance, and the difference between Development Agents and Product Agents. It MUST NOT require any agent runtime, protocol, provider, vector database or RAG.

#### Scenario: Fresh bootstrap
- **WHEN** the bootstrap installs the layer into a new workspace
- **THEN** `ai-development/AI-FIRST.md` exists and is listed in `.bootstrap-manifest`

#### Scenario: No runtime technology required
- **WHEN** a reader searches `AI-FIRST.md` for MCP, RAG, vector databases, message brokers or agent frameworks
- **THEN** every mention presents them as optional implementation choices of the product, never as requirements

#### Scenario: Business logic outside the UI
- **WHEN** an agent reads `AI-FIRST.md`
- **THEN** it finds the explicit rule that business logic must not live exclusively in the UI, and that Product Agents do not click screens or access the database directly as the normal way to use the product's own capabilities

### Requirement: Knowledge is distinct from transactional queries
`AI-FIRST.md` SHALL define KNOWLEDGE as non-transactional context (policies, procedures, documentation) distinct from QUERY (current transactional state), SHALL state that RAG is an optional retrieval strategy and not an architectural requirement, and SHALL state that RAG does not replace transactional queries and direct database access does not replace domain capabilities.

#### Scenario: Agent designing a knowledge need
- **WHEN** a feature needs a Product Agent to know the refund policy and the current invoice status
- **THEN** the invoice status is modeled as a query and the refund policy as knowledge with an identifiable source, and no vector database is introduced unless the simpler options do not solve the problem

### Requirement: Capability catalog installed as project file
The layer SHALL contain a project-managed `CAPABILITIES.md`: a product-level catalog of capabilities grouped by domain, each entry with a stable name, type (query, knowledge, command, event), purpose, owning repository, autonomy for commands and an agent-readiness status, with optional contract details. The template MUST NOT contain product capabilities.

#### Scenario: Fresh bootstrap
- **WHEN** the bootstrap installs the layer
- **THEN** `ai-development/CAPABILITIES.md` exists with placeholders only

#### Scenario: Update on an older project
- **WHEN** `--update` runs on a project that has no `CAPABILITIES.md`
- **THEN** the file is created and reported as created

#### Scenario: Update keeps the project's catalog
- **WHEN** `--update` runs on a project whose `CAPABILITIES.md` exists
- **THEN** the file is not modified and is reported as a preserved project file

### Requirement: Development agents route to AI-FIRST.md without loading it for every task
`AI.md` SHALL direct Development Agents to `AI-FIRST.md` when a task involves product design, business capabilities, architecture, feature implementation, integrations, automation or Product Agents, and SHALL place `AI-FIRST.md` and `CAPABILITIES.md` at L1, reading only the domain section of `CAPABILITIES.md` that the task involves. Adapters MUST stay free of Agent-First rules.

#### Scenario: Business feature
- **WHEN** a Development Agent starts a feature that changes a business capability
- **THEN** it reads the relevant section of `CAPABILITIES.md` and the parts of `AI-FIRST.md` it needs, and does not open repositories outside its impact set

#### Scenario: Technical task
- **WHEN** the task is a dependency upgrade or a lint fix
- **THEN** the agent does not need to read `AI-FIRST.md` or `CAPABILITIES.md`

### Requirement: Impact analysis includes agentic impact
Phase 2 of `AI.md` SHALL analyse `Request → Domain → Capability → Agentic impact (Query / Knowledge / Command / Event / Policy) → Repositories → Contracts → Files` for changes that create or alter a business capability, using the questions in `AI-FIRST.md`, as part of the design and not as an after-the-fact review.

#### Scenario: New cancellation feature
- **WHEN** an agent analyses a request to let customers cancel subscriptions
- **THEN** it identifies the capability, the query for current state, the knowledge needed (cancellation policy), the command, the event, the autonomy level and whether confirmation or approval is required, before choosing repositories and files

### Requirement: Changes record agentic impact proportionally
The change template SHALL contain an `## Agentic Impact` section covering agent accessibility, capabilities, queries, knowledge, commands, events, policies, required context, authorization, audit and human approval. A change that does not alter a business capability MAY state `Agentic Impact: NOT APPLICABLE` in one line. A relevant business capability marked `Agent accessible: NO` MUST carry a justification.

#### Scenario: Purely technical change
- **WHEN** a change upgrades a dependency
- **THEN** its proposal carries `Agentic Impact: NOT APPLICABLE` and nothing more about agents

#### Scenario: Business capability not agent accessible
- **WHEN** a change adds a business capability and marks it `Agent accessible: NO`
- **THEN** the proposal states why

### Requirement: Initialization discovers capabilities and agent surface from cheap evidence
The Project Initialization Protocol SHALL also discover capabilities, knowledge sources and the agent surface (existing programmatic and automation entry points), assess agent readiness only where evidence supports it and write `CAPABILITIES.md`, using only evidence gathered at the cheap discovery levels. It MUST NOT list endpoints as capabilities without evidence of a business capability, MUST NOT treat documentation as Product Agent knowledge without evidence, and MUST NOT read code broadly to fill the catalog. For an existing (brownfield) product it SHALL produce a map, not an audit: start from the central docs, READMEs, API contracts, obvious application services, existing integrations and automation interfaces; MUST NOT read every endpoint, service, screen, database model, repository or document; MUST NOT refactor, create changes or tasks, or aim for Agent-Ready; SHALL record `Adoption mode` in `PROJECT.md` only when the evidence tells; and SHALL describe the architecture as it exists.

#### Scenario: Existing project with an API description
- **WHEN** initialization finds an OpenAPI file and a README describing order management
- **THEN** `CAPABILITIES.md` lists the order capabilities evidenced there with readiness from evidence (`UNKNOWN` where it does not tell), and does not enumerate every route

#### Scenario: New project
- **WHEN** initialization runs on a workspace with no repositories
- **THEN** `CAPABILITIES.md` stays essentially empty and states that capabilities are added as the product grows, and `Adoption mode` is `GREENFIELD`

#### Scenario: Brownfield multi-repository workspace
- **WHEN** initialization runs on a workspace with frontend, backend and worker repositories that already implement the product
- **THEN** the agent reads manifests, READMEs and contracts only, records `Adoption mode: BROWNFIELD`, leaves unevidenced readiness as `UNKNOWN`, draws only the existing architecture, and proposes no refactoring or migration change

### Requirement: Agent-Ready definition of done
`AI-FIRST.md` SHALL define when a business feature that Product Agents need is not architecturally complete (logic only in UI, state not queryable, capability not executable programmatically, missing authorization, missing policy for sensitive actions, not auditable, unstructured errors, knowledge without identifiable source, unnecessary channel coupling). It MUST NOT require real Product Agents to exist. Phase 6 of `AI.md` SHALL reference it.

#### Scenario: Feature logic only in the frontend
- **WHEN** a feature's discount rule is implemented only in the web client and the product is Agent-First
- **THEN** validation reports the feature as not Agent-Ready

### Requirement: Existing projects adopt without overwriting
`--update` SHALL NOT modify `PROJECT.md` or `ARCHITECTURE.md`. When an existing `PROJECT.md` lacks `## Agentic Strategy` or an existing `ARCHITECTURE.md` lacks `## Agent surface`, it SHALL print `MIGRATION REQUIRED` with the manual step, without blocking the version update. `AI-FIRST.md` SHALL provide the section skeletons and agents SHALL treat missing sections as not yet defined.

#### Scenario: Project at 2.1.0 updated
- **WHEN** `--update` runs on a project at 2.1.0 with filled-in L0 files and no conflicts
- **THEN** L0 files are byte-identical afterwards, `AI-FIRST.md` and `CAPABILITIES.md` are created, `MIGRATION REQUIRED` lists both files, and `.bootstrap-version` becomes 2.2.0

#### Scenario: Project already migrated
- **WHEN** `--update` runs on a project whose L0 files have both sections
- **THEN** no `MIGRATION REQUIRED` notice is printed

### Requirement: Updates never require a manual merge
`--update` SHALL ignore line-ending differences when comparing and hashing files, SHALL keep a customized framework file without reporting a conflict when the template has not changed it since the project's copy was delivered, and SHALL hand every real conflict and every pending migration to the Development Agent through `ai-development/.bootstrap-update/` (new template version, base version when recoverable read-only from the bootstrap repository's history, `PENDING.md`, `INSTRUCTIONS.md`) and a single printed prompt. A later `--update` SHALL recognize a file merged against the same template version, record it as based on that version, advance `.bootstrap-version` when no conflict remains, and delete `.bootstrap-update/` when nothing is pending. The script MUST NOT edit project-managed files and MUST NOT run git in the target workspace.

#### Scenario: CRLF checkout
- **WHEN** `--update` runs on a project whose framework files equal the delivered versions except for CRLF line endings
- **THEN** no conflict is reported and the files are treated as untouched

#### Scenario: Customized file, template unchanged
- **WHEN** a project customized `docs/adr/README.md` and the new template's `docs/adr/README.md` is the version the project received
- **THEN** the file is reported as a kept customization, is not modified, and the version advances

#### Scenario: Real conflict handed to the agent
- **WHEN** a project customized `AI.md` and the new template changed `AI.md`
- **THEN** `AI.md` is left as it is, `.bootstrap-update/AI.md.new` holds the template version, `.bootstrap-update/AI.md.base` holds the delivered version when the bootstrap repository's history has it, the version does not advance, and the output tells the human which sentence to give the agent

#### Scenario: Merge recognized
- **WHEN** the agent has merged `AI.md` and `--update` runs again with the same template
- **THEN** `AI.md` is reported as merged and not modified, its manifest entry becomes the current template's hash, the version advances, and `.bootstrap-update/` is deleted if no migration is pending

#### Scenario: Unmerged file is not accepted
- **WHEN** `--update` runs again without the agent having changed the conflicting file
- **THEN** the file is still reported as a conflict and the version does not advance

### Requirement: Greenfield by design, brownfield by evolution
`AI-FIRST.md` SHALL state that new products and new capabilities are Agent-First by design, and that existing capabilities of a product that predates the bootstrap become Agent-First by evolution, when work touches them. For brownfield products it MUST forbid, as an agent's own initiative, refactoring the whole application, creating commands, events, knowledge or policies for everything that exists, opening a large migration change, generating tasks, issues or backlog for readiness gaps, deep-scanning repositories and targeting 100% Agent-Ready. Greenfield rules MUST NOT be weakened.

#### Scenario: Greenfield product
- **WHEN** a Development Agent designs a new business capability in a new project
- **THEN** it considers QUERY, KNOWLEDGE, COMMAND, EVENT and POLICY in the design and applies the Agent-Ready definition of done

#### Scenario: New capability in an existing product
- **WHEN** a brownfield product receives a request for a capability that does not exist yet
- **THEN** that capability is designed Agent-First by design, like in a greenfield product

#### Scenario: Legacy capability nobody touches
- **WHEN** a capability is known to be `PARTIALLY_AGENT_READY` and no request touches it
- **THEN** the agent does not refactor it and creates no change or task for it; at most it records the gap in `CAPABILITIES.md`

### Requirement: Evidence-based Agent Readiness
`AI-FIRST.md` SHALL define the readiness levels `AGENT_READY`, `PARTIALLY_AGENT_READY`, `NOT_AGENT_READY` and `UNKNOWN`, require that a level other than `UNKNOWN` is supported by stated evidence, state that an endpoint, controller, service, button, webhook or document alone does not establish readiness, and treat `UNKNOWN` as a valid state preferable to exploring code only to classify. Classification MUST be optional (only where it adds value) and MUST NOT produce a global score, percentage or dashboard. `AI-FIRST.md` SHALL state how status values written before 2.3.0 map to the levels. `CAPABILITIES.md` SHALL use the levels as its status values and allow recording evidence and gaps per capability.

#### Scenario: Endpoint without further evidence
- **WHEN** initialization finds `POST /subscriptions/:id/cancel` in an API description and nothing else about cancellation
- **THEN** `cancel_subscription` is recorded as `UNKNOWN` (or not recorded), never as `AGENT_READY`

#### Scenario: Catalog from 2.2.0
- **WHEN** an agent reads a `CAPABILITIES.md` whose status column says `partial` or `needs validation`
- **THEN** it reads them as `PARTIALLY_AGENT_READY` and `UNKNOWN` without rewriting the file

### Requirement: Touched capability rule bounds the scope
When a change touches an existing capability, the Development Agent SHALL determine its readiness from the context the change already needs, identify the gaps relevant to the change, improve those that fit in its scope and record the rest as known gaps, and MUST NOT widen the change into unrelated capabilities, endpoints or domains in the name of Agent-First. The change's `## Agentic Impact` SHALL offer optional lines for current readiness, target readiness, relevant gaps, improvements included and gaps left out; they MUST NOT be required for purely technical changes.

#### Scenario: WhatsApp cancellation touches a partial capability
- **WHEN** a request adds cancellation over WhatsApp and `cancel_subscription` holds its rules in the frontend
- **THEN** the proposal states current `PARTIALLY_AGENT_READY`, target `AGENT_READY`, includes moving the cancellation rules to the application layer, and lists unrelated billing endpoints and a domain redesign as out of scope

#### Scenario: Technical change
- **WHEN** a change only upgrades a dependency
- **THEN** its proposal says `Agentic Impact: NOT APPLICABLE` and has no readiness lines

### Requirement: Framework update is not product migration
The layer SHALL state that `bootstrap --update` updates the development framework only and never modifies application, domain, frontend or backend code, APIs, database or infrastructure to make the product Agent-First, and that finishing an update through `.bootstrap-update/` never includes product changes. An update to 2.3.0 MUST NOT require new sections in project-managed files.

#### Scenario: Project at 2.2.0 updated
- **WHEN** `--update` runs on a project at 2.2.0 whose L0 files already have *Agentic Strategy* and *Agent surface* and whose framework files are untouched
- **THEN** framework files are refreshed, `PROJECT.md`, `REPOSITORIES.md`, `ARCHITECTURE.md`, `CAPABILITIES.md` and open changes are byte-identical, no `MIGRATION REQUIRED` is printed, no file outside `ai-development/` changes, and `.bootstrap-version` becomes 2.3.0
