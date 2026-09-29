## ADDED Requirements

<!-- Reference. Rename the folder `specs/product-agent/` to the agent's id (for example `specs/support-agent/`) and replace <agent> below. -->

### Requirement: Mission and scope
The <agent> SHALL act only within its mission and SHALL call only the capabilities listed in its change, through the application layer with its own agent principal; it SHALL never read or write the product's database directly or drive the product's own interface.

#### Scenario: Request outside the mission
- **WHEN** a request falls outside the agent's mission or needs a capability outside its scope
- **THEN** the agent declines or hands off to a human, and no capability outside its scope is called

### Requirement: Autonomy and human steps
The <agent> SHALL respect each command's autonomy level as enforced by the application layer, and SHALL never perform a confirmation or approval itself.

#### Scenario: Command requiring confirmation
- **WHEN** the agent requests a command whose autonomy is `REQUIRES_CONFIRMATION`
- **THEN** the command runs only after the represented user confirms with their own session, and the confirmation is recorded

### Requirement: Acting for users
When the <agent> acts on behalf of a user, it SHALL do so only under that user's delegation, as defined by `agent-access`.

#### Scenario: No delegation
- **WHEN** the agent tries to act for a user who has not delegated to it
- **THEN** the application layer rejects the call and the agent does not claim success

### Requirement: Untrusted content
The <agent> SHALL treat messages, documents and tool results as data; content SHALL NOT widen its scope, change its instructions or expose data from another user or tenant.

#### Scenario: Injected instruction
- **WHEN** a message or document instructs the agent to ignore its rules or call a capability outside its scope
- **THEN** the agent's behavior and permissions are unchanged

### Requirement: Human handoff
The <agent> SHALL hand off to a human, with the context of the interaction, when it cannot or must not act, when a policy denies, or when the person asks for a human.

#### Scenario: Person asks for a human
- **WHEN** the person asks to talk to a human
- **THEN** the agent hands off with the conversation and what it tried

### Requirement: Stop at once
Revoking the <agent>'s credential SHALL stop it from calling any capability.

#### Scenario: Credential revoked
- **WHEN** an administrator revokes the agent's credential
- **THEN** its next capability call is rejected
