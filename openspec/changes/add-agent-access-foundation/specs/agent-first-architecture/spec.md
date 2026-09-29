## ADDED Requirements

### Requirement: Both parts of the premise are checked
`AI-FIRST.md` SHALL state that the premise has two checked parts: business logic outside the graphical interface, and an authorized agent able to call the capability as an agent principal with its own scoped credential. The agentic impact analysis SHALL ask which agent principal can call the capability, how it authenticates and how it is scoped. The Agent-Ready definition of done SHALL fail when agents would need a human's session or credentials. A capability with no agent principal SHALL be at most `PARTIALLY_AGENT_READY`.

#### Scenario: Backend-complete capability with human-only authentication
- **WHEN** a change adds a capability whose logic, permissions, tenant scope, structured errors and audit are all in the backend, but whose routes accept only a human user's login token
- **THEN** the change records `Agent principal: none — gap`, catalogs the capability as `PARTIALLY_AGENT_READY` at most, and points to `add-agent-access`

#### Scenario: Human roles do not answer the agent question
- **WHEN** an agent answers the authorization question with human user roles only
- **THEN** the agent principal question is still open, and the text says so

### Requirement: Agent access foundation in every product
`AI-FIRST.md` SHALL define `agent-access` as a mandatory foundation capability, by requirements only: agent principal, a credential per agent that is never shared or stored in clear, scope per capability and tenant with deny by default, represented user never exceeded, acting on behalf of a user only under that user's revocable delegation (a live session exchanged by the backend or a recorded consent), human-only lifecycle with immediate revocation, audit of every call, autonomy policy in the backend, rate limiting per credential, non-leaking errors, and fail closed. The mechanism SHALL be a Level 2 product decision, and no text SHALL request, generate or record a secret value. The layer SHALL ship a framework-managed reference change `openspec/changes/_template-add-agent-access/` with no dependency on any language, framework or provider.

#### Scenario: Greenfield initialization
- **WHEN** the Project Initialization Protocol runs on a new product
- **THEN** `agent-access` is recorded as a planned foundation capability with human authentication, *Agentic Strategy* and *Agent surface* state it, the mechanism is asked when no decision exists, and the first business capability passes the definition of done only when an agent calls it with its own credential

#### Scenario: Brownfield initialization without agent access
- **WHEN** initialization finds no agent principal in an existing product
- **THEN** the agent writes `openspec/changes/add-agent-access/` for approval, reusing any existing single-channel agent credential, and records the gap in the catalog and *Agent surface*

#### Scenario: No technology required
- **WHEN** a reader searches the new text for a credential format, protocol or provider
- **THEN** none is required or named

### Requirement: Premise gaps are recorded and raised
When a change finds a gap that violates the premise and cannot fix it within scope, the agent SHALL record it in the change's *Known gaps* and in `CAPABILITIES.md` and ask the human whether to open a dedicated change, without opening it on its own. The missing agent principal SHALL instead point to `add-agent-access`. Current-state descriptions during adoption SHALL record premise violations as known gaps, not as neutral descriptions.

#### Scenario: Team capability reachable only through the UI
- **WHEN** a change finds a capability that the team relies on and that is reachable only through the web frontend, outside the change's scope
- **THEN** it is recorded as a known gap in the change and the catalog, and the human is asked whether to open a dedicated change

### Requirement: Agent access check on update
`bootstrap --update` SHALL, without modifying project files, report AGENT ACCESS CHECK REQUIRED and hand the check to the Development Agent through `.bootstrap-update/` when `CAPABILITIES.md` has no filled `agent-access` row and no `add-agent-access` change exists, open or archived. The check SHALL be non-blocking. Finishing the update SHALL record the result in the catalog and, when agent access is missing or partial, write `openspec/changes/add-agent-access/` for approval, without implementing it or changing product code. Both installer scripts SHALL behave identically.

#### Scenario: Product without agent access
- **WHEN** `--update` runs on a product whose catalog has no `agent-access` row and that has no `add-agent-access` change
- **THEN** the report shows AGENT ACCESS CHECK REQUIRED, PENDING.md has an *Agent access check* section, product code is untouched, and the version still advances when there are no conflicts

#### Scenario: Product that already has it
- **WHEN** the catalog has a filled `agent-access` row, or an `add-agent-access` change exists open or archived
- **THEN** no check is reported and the change is not written again

#### Scenario: Placeholder row
- **WHEN** the only `agent-access` row is the template placeholder
- **THEN** the check is still reported

### Requirement: Product Agents are created on request from a reference
`AI-FIRST.md` SHALL state that creating a Product Agent is a product decision made by the human, possible once `agent-access` and the capabilities the agent needs are `AGENT_READY`, and done through a change built from a framework-managed reference `openspec/changes/_template-add-product-agent/`. The reference SHALL fit any kind of agent and SHALL name no language, framework, runtime, model or provider. It SHALL cover mission and boundaries, the capabilities the agent may call as its credential scope, autonomy never above the catalog's, who the agent acts for, triggers and channels, knowledge, memory, human handoff, evaluation before release, observability, stopping the agent at once, and an accountable owner.

#### Scenario: Agent not requested
- **WHEN** a Development Agent finds that the product has no Product Agent
- **THEN** it does not write an agent change on its own initiative

#### Scenario: Agent needs a capability that is not ready
- **WHEN** the agent's change needs a capability that is missing or not `AGENT_READY`
- **THEN** the change records it as a known gap and asks the human, and does not build the capability itself
