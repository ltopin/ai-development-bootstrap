## REMOVED Requirements

### Requirement: Presentation is the human's contract
**Reason**: It was written for a generated app. On the direct path the same rule lives in `design-direct-implementation` (*The design is implemented in the project's stack*: allowed reasons, *Presentation changes*, no cosmetic changes).
**Migration**: None.

### Requirement: Fake boundaries are detected by behavior
**Reason**: Moved to `design-direct-implementation` with the same name, merged with the additional signals, and without the builder-only signals.
**Migration**: None.

### Requirement: Extraction table as classification evidence
**Reason**: The builder path is removed. The requirements table of `design-direct-implementation` is the only classification evidence for designed input.
**Migration**: Repositories that depend on the builder path stay on bootstrap 1.5.x.

### Requirement: Mode is decided from the workspace map
**Reason**: The new/existing project mode existed to decide what to do with a generated server. Without generated apps, the requirements table and the decision policy cover backend work.
**Migration**: None.

### Requirement: Parallel backend is never left silently
**Reason**: A parallel backend could only come from a generated server.
**Migration**: Parallel-backend answers already recorded in `DECISIONS.md` stay as history.

### Requirement: New repositories are a human decision
**Reason**: Moved to `design-direct-implementation` with the same name.
**Migration**: None.

### Requirement: Definition of done
**Reason**: The builder definition of done is removed. The done rules live in `design-direct-implementation` (*No fake data at done on the direct path*, *Direct path pull request*).
**Migration**: None.

### Requirement: Tool independence
**Reason**: Moved to `design-direct-implementation` with the same name, without builders.
**Migration**: None.
