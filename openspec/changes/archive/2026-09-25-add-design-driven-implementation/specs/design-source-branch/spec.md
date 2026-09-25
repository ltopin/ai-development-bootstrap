## Purpose

Defines the branch model and triggers that let an app-builder tool, which only writes to a repository's default branch, feed the autonomous agent through reviewed pull requests, and receive the agent's integration back.

## ADDED Requirements

### Requirement: Design source branch
A repository that adopts builder-driven development SHALL use a design source branch (suggested name `studio`) as its default branch, and the builder SHALL write only to it. The production branch MUST be protected so that it changes only through reviewed pull requests.

#### Scenario: Builder push does not reach production
- **WHEN** the builder pushes
- **THEN** the commits land on the design source branch, and the production branch is unchanged

#### Scenario: Direct push to production refused
- **WHEN** anyone pushes directly to the production branch
- **THEN** the platform rejects the push

### Requirement: A builder push leads to exactly one design pull request
On a push to the design source branch, the integration SHALL ensure an open pull request from the design source branch to the production branch exists. It MUST open one only when none is open and the design source branch is ahead of production. It MUST open it with a credential whose events start workflows. It MUST NOT run the agent or push code itself.

#### Scenario: First push of a cycle
- **WHEN** the builder pushes, no design pull request is open, and the design source branch is ahead of production
- **THEN** a pull request from the design source branch to production is opened, and the existing gate starts one agent execution for it

#### Scenario: Subsequent push
- **WHEN** the builder pushes while the design pull request is open
- **THEN** no new pull request is opened, and the gate handles the push as external intent on the existing change

#### Scenario: Nothing to promote
- **WHEN** a push leaves the design source branch not ahead of production
- **THEN** no pull request is opened

### Requirement: Agent work stays on the design pull request
The agent's commits SHALL be published to the design source branch through the existing gate and publish step, with the existing provenance, duplicate and iteration rules unchanged. The agent's publish MUST NOT start a new agent execution.

#### Scenario: Agent publish
- **WHEN** the publish step pushes the agent's commits to the design source branch
- **THEN** CI runs on them and the gate classifies the push as an internal automation change

#### Scenario: Builder pushes during a run
- **WHEN** the builder pushes while an agent execution is running
- **THEN** that execution fails to publish with `branch-moved` without overwriting the builder's commits, and the builder's push is handled as new external intent

### Requirement: Back-sync after merge
When the design pull request is merged, the integration SHALL update the design source branch so it contains production: fast-forward when possible, otherwise a merge of production into it. It MUST NOT force-push the design source branch, MUST NOT modify production, and on conflict MUST stop and report on the merged pull request.

#### Scenario: Clean back-sync
- **WHEN** the design pull request is merged and the design source branch has no new commits
- **THEN** the design source branch is moved to production, and the builder can pull the integrated code

#### Scenario: Builder commits after merge
- **WHEN** the builder pushed to the design source branch after the merge, without conflicts
- **THEN** production is merged into the design source branch and the builder's commits are kept

#### Scenario: Conflict
- **WHEN** merging production into the design source branch conflicts
- **THEN** nothing is pushed and a report is posted on the merged pull request

#### Scenario: Back-sync does not start work
- **WHEN** the back-sync push leaves the design source branch not ahead of production
- **THEN** no design pull request is opened and no agent execution starts

### Requirement: Trust is decided by who can push to the design source branch
Because a push to the design source branch starts an agent that holds credentials, the design source branch SHALL be restricted to the builder's integration, the humans who design, and the automation identity. Commit author identity MUST NOT be used as a trust signal. Pushes from forks MUST NOT start the agent.

#### Scenario: Unauthorized pusher
- **WHEN** an identity outside the allowed set tries to push to the design source branch
- **THEN** the platform rejects the push and no agent execution starts

#### Scenario: Spoofed author
- **WHEN** an allowed pusher pushes a commit whose author claims to be the builder
- **THEN** it is handled like any other external intent; the author field grants nothing

### Requirement: Opt-in adoption
The branch model and its workflows SHALL be inert until a repository adopts them. Installing or updating the bootstrap MUST NOT change branches, defaults or protection of any repository.

#### Scenario: Bootstrap update
- **WHEN** a project runs the bootstrap `--update` that delivers this capability
- **THEN** only framework files are created or refreshed, and no repository setting changes
