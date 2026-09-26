# change-lifecycle Specification

## Purpose

Defines how an agent moves an OpenSpec change from proposal to implementation, so that in interactive sessions the human reviews and explicitly approves every change before any code is written, and can follow implementation progress in `tasks.md` while it happens.

## Requirements

### Requirement: Interactive sessions wait for explicit approval of the change
In an interactive session, when the work requires a change under `openspec/changes/<change-id>/`, the agent SHALL write the change, present it to the human and stop. The agent MUST NOT edit application code, scaffold repositories or run implementation tasks of that change until the human explicitly instructs it to implement (for example "implement", "pode implementar"). Answers to the change's open questions, requested edits and general agreement MUST NOT be taken as that instruction.

#### Scenario: Change written
- **WHEN** an agent finishes writing a change's proposal, design, specs and tasks in an interactive session
- **THEN** it presents the change to the human and ends its turn without implementing any task

#### Scenario: Human answers open questions
- **WHEN** the human answers the change's open questions, without saying to implement
- **THEN** the agent records the answers in the change (and in DECISIONS.md when they are decisions), presents the updated change and stops again, without implementing

#### Scenario: Human requests edits
- **WHEN** the human asks for changes to the proposal, design, specs or tasks
- **THEN** the agent applies them to the change, presents it again and waits for the instruction to implement

#### Scenario: Human says to implement
- **WHEN** the human explicitly instructs the agent to implement the change
- **THEN** the agent starts implementing, in the order of `tasks.md`

#### Scenario: Work without a change
- **WHEN** the work is a direct edit that the workflow does not require a change for (a bug fix or small tweak inside one repository)
- **THEN** no approval gate applies and the agent proceeds as the workflow describes

### Requirement: Automated runs keep the pull request as their gate
An automated run SHALL NOT wait for interactive approval of a change: it proceeds from change to implementation and its gate remains the pull request review, CI and human approval, as before this change.

#### Scenario: Automated run with a formal change
- **WHEN** an automated run creates or follows a change and has no Level 2 or Level 3 question pending
- **THEN** it implements the change and opens a pull request, which a human reviews before merge

### Requirement: An answer approves only its decision
A human answer to a question SHALL approve only the decision it answers. It MUST NOT be read as approval of implementing the change, of the pull request or of a deploy.

#### Scenario: Answer followed by no instruction
- **WHEN** the human answers a Level 2 question raised while planning a change and says nothing else
- **THEN** the agent records the decision and does not start implementing

### Requirement: Tasks are ticked one at a time as they finish
While implementing a change, the agent SHALL tick each task in `tasks.md` as soon as that task is finished and validated, before starting the next task, and SHALL note deviations inline in the same file. The agent MUST NOT tick several tasks in one batch at the end of the work, and MUST NOT tick a task that is not truly done.

#### Scenario: Progress visible during implementation
- **WHEN** the human opens `tasks.md` while the agent is implementing
- **THEN** every task finished so far is ticked and the tasks not yet finished are not

#### Scenario: Deviation from a task
- **WHEN** a task is done differently from what `tasks.md` says
- **THEN** the agent ticks it and writes the deviation inline on that task

#### Scenario: Task blocked by a question
- **WHEN** a task depends on a pending Level 2 question
- **THEN** the task stays unticked and is marked as blocked by that question

### Requirement: The change template states the ticking rule
The `tasks.md` template installed in `openspec/changes/_template/` SHALL instruct agents to tick each item as soon as it is done, not at the end.

#### Scenario: Fresh bootstrap
- **WHEN** the bootstrap installs the layer
- **THEN** `ai-development/openspec/changes/_template/tasks.md` says to tick each item as soon as it is done, not at the end
