## ADDED Requirements

### Requirement: Agent principal
The system SHALL identify every agent call as an agent principal, distinct from human users, services and integrations, and SHALL reject agent calls that present a human session or credentials.

#### Scenario: Agent calls with its own credential
- **WHEN** an agent calls a capability in its scope with its own valid credential
- **THEN** the call is authorized as that agent principal and audited as such

#### Scenario: Borrowed human session
- **WHEN** an agent presents a human user's session or credentials as its identity
- **THEN** the call is not treated as an agent principal

### Requirement: Scoped, least-privilege authorization
The system SHALL authorize each agent per capability and per tenant, deny by default, and never grant an agent acting on behalf of a user more permission than that user has.

#### Scenario: Out of scope
- **WHEN** an agent calls a capability or tenant outside its scope
- **THEN** the call is denied with a structured error that contains no data from another tenant

#### Scenario: Represented user
- **WHEN** an agent acts on behalf of a user who lacks a permission
- **THEN** the agent is denied that permission and the represented user is recorded

### Requirement: Delegation by the represented user
The system SHALL let an agent act on behalf of a user only when that user delegated to it, through the user's own live session exchanged by the backend or a recorded consent with scope and expiry, and SHALL let the user revoke a delegation with immediate effect; the delegated scope SHALL never exceed the agent's scope or the user's permission.

#### Scenario: No delegation
- **WHEN** an agent asks to act on behalf of a user who has not delegated to it
- **THEN** the request is rejected and nothing is executed on that user's behalf

#### Scenario: Delegation revoked
- **WHEN** the user revokes a delegation
- **THEN** the next call by that agent on that user's behalf is rejected

### Requirement: Credential lifecycle
The system SHALL store agent credentials only as a hash or in a secret store, never in a repository, log or response, and SHALL let only a human administrator issue, rotate and revoke them; credentials SHALL expire, and revocation SHALL take effect immediately.

#### Scenario: Revocation
- **WHEN** an administrator revokes an agent credential
- **THEN** the next call with that credential is rejected

### Requirement: Audit, policy and limits
The system SHALL audit every agent call (agent, credential id, represented user, tenant, capability, result, correlation id), enforce the capability's autonomy policy in the application layer, and rate-limit per credential.

#### Scenario: Audited call
- **WHEN** an agent calls a capability
- **THEN** an audit record with every listed field exists

### Requirement: Fail closed
The system SHALL reject every agent call when agent access is not configured.

#### Scenario: No configuration
- **WHEN** agent access configuration is absent
- **THEN** no agent call is accepted
