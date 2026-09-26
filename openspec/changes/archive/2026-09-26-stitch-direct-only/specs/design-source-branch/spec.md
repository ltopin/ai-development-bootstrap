## REMOVED Requirements

### Requirement: Design source branch
**Reason**: The builder path is removed. No builder writes to the repository, so there is no design source branch.
**Migration**: Repositories that adopted the model stay on bootstrap 1.5.x, or remove their `design-pr` / `design-back-sync` workflows and rulesets and use the direct path.

### Requirement: A builder push leads to exactly one design pull request
**Reason**: Removed with the design source branch. Designed changes are ordinary pull requests.
**Migration**: Delete `design-pr.yml` from repositories that copied it.

### Requirement: Agent work stays on the design pull request
**Reason**: Removed with the design pull request.
**Migration**: None.

### Requirement: Back-sync after merge
**Reason**: With no builder, nothing needs to pull production back.
**Migration**: Delete `design-back-sync.yml` from repositories that copied it.

### Requirement: Trust is decided by who can push to the design source branch
**Reason**: Removed with the design source branch. The general trust rules of `SECURITY.md` still apply.
**Migration**: Rulesets created for the design source branch may be dropped once its workflows are deleted.

### Requirement: Opt-in adoption
**Reason**: Nothing is left to adopt.
**Migration**: None.

### Requirement: Preservation check before adoption
**Reason**: The check tested whether a builder could safely write to the repository. With no builder, it has no purpose.
**Migration**: None.
