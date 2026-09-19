# specs (change deltas)

Delete this folder if the change does not alter behavior or contracts.

Otherwise, create `<capability>/spec.md` here containing only the delta:

```markdown
# <Capability>

## ADDED Requirements

### Requirement: <name>
The system SHALL <observable behavior>.

#### Scenario: <name>
- **WHEN** <trigger>
- **THEN** <result>

## MODIFIED Requirements
## REMOVED Requirements
```

On close, merge into `openspec/specs/<capability>/spec.md`.
