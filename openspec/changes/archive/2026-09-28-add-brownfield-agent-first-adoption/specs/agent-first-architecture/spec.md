## ADDED Requirements

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

## MODIFIED Requirements

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
