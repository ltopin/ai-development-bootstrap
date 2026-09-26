## MODIFIED Requirements

### Requirement: Design source branch
A repository that adopts builder-driven development SHALL use as its design source branch the branch the builder writes to (for a builder that creates the repository, usually its default branch, for example `main`), and the builder SHALL write only to it. Production SHALL be a separate branch (for example `production`) that MUST be protected so that it changes only through reviewed pull requests. Changing the repository's default branch MUST NOT be required.

#### Scenario: Builder push does not reach production
- **WHEN** the builder pushes
- **THEN** the commits land on the design source branch, and the production branch is unchanged

#### Scenario: Direct push to production refused
- **WHEN** anyone pushes directly to the production branch
- **THEN** the platform rejects the push

#### Scenario: Builder that creates its own repository
- **WHEN** the builder creates the repository and writes to `main`
- **THEN** `main` is the design source branch, production is another branch, and the default branch stays `main`

## ADDED Requirements

### Requirement: Preservation check before adoption
A repository SHALL adopt the design source branch model only after a preservation check shows that a builder sync keeps files the builder did not create and keeps commits pushed by others to the design source branch. When the check fails, the repository MUST NOT adopt the model and SHALL use the direct path, or the builder only as a prototype outside the repository.

#### Scenario: Builder keeps external files
- **WHEN** a file committed by a human to the design source branch is still present, with its commit in the history, after the builder's next sync
- **THEN** the check passes for that builder

#### Scenario: Builder deletes an external file
- **WHEN** the builder's next sync deletes a file it did not create, or replaces the branch history
- **THEN** the check fails and the model is not adopted
