# Human-in-the-loop

How an agent stops for a human decision and resumes afterwards without losing context. This file defines the **protocol**; it does not depend on any platform. How a platform carries questions and answers is an integration ([integrations/github/](../integrations/github/README.md) is one).

When a [Level 2 or Level 3](DECISION-POLICY.md) situation appears, the agent does not wait inside a running process. It **records the question, leaves the work in a safe state and ends the run**. A later run, started by the answer, continues from the record.

## Run states

```
RUNNING ──► READY               work finished, awaiting human review (CI, approval)
   │
   ├──────► WAITING_FOR_HUMAN   blocked on an OPEN question; the run has ended
   │              │
   │              └─ valid answer ─► RUNNING (a new run resumes)
   ├──────► FAILED              could not proceed; reported, not retried silently
   │              └─ /agent retry ─► RUNNING (a new run, same change)
   └ (STALE)                    no execution of the run exists any more; retryable, diagnosed as such
```

`WAITING_FOR_HUMAN` is a state of the *work*, not of a process. Nothing stays blocked, running or consuming a runner while waiting.

It has two causes: an agent question (Level 2/3, below) and the [circuit breaker](LOOP-PREVENTION.md#circuit-breaker) (`reason: iteration-limit`). A valid answer is a **continuation of the same change**, never a new external intent: the resumed run gets a new run id, keeps the change id and source sha, and counts toward the iteration limit ([LOOP-PREVENTION.md](LOOP-PREVENTION.md)).

## Interrupting safely

Where to stop depends on what the question is about.

### `HUMAN_DECISION` (Level 2): stop before the dependent part

Interrupt **before implementing any part whose architecture, contract or behavior depends on the pending decision**. Test for dependence: *would this part be shaped, discarded or rewritten differently for another answer?* If yes, it is dependent and is not started.

1. **Independent work may stay.** Work that does not depend on the answer can remain implemented and committed, provided it is consistent (builds, nothing half-applied, no migration run partially, no external side effect pending) and validated (its own checks ran and passed).
2. **No speculative implementation.** Never write code only to reach a "committed and consistent" state. Consistency comes from *not writing* dependent code: no stubs, placeholders, feature flags, adapters, interfaces or abstractions shaped by a presumed answer, and no provider-, model- or vendor-specific integration before the decision. If nothing is independent, nothing is committed: the question record alone is the correct state.
3. **Dependent code already written** (the dependency was noticed late) is not committed or pushed. Discard it and say so in the handoff.
4. Mark the dependent tasks in `tasks.md` (if a change exists) as blocked by the question `id`, and tick only what is truly done.
5. Publish the question record (below) with its handoff. Do not pick an alternative "for now".

Example: a feature needs a payment gateway and none is defined. The agent may implement and commit the parts that are independent of the provider (for instance the order state model, screens that do not call it, tests for those), validated. It must not choose Stripe or Adyen, must not create a payment abstraction modeled on an assumed provider, and must not implement any provider-specific integration until a human answers.

### `HUMAN_SECRET` (Level 3): work until the credential is needed

The design is not in question here, only the value. Implement normally up to the point where the credential is actually required: code that reads it by name from the environment or secret store, configuration keys, variable *names* in `.env.example`, documentation, tests with test doubles that need no real credential. No secret is requested or persisted at any point.

Stop at the first step that needs the real value (a live call, an integration test against the real service, a deploy). Everything before it is committed as normal work, and the handoff states what could not be validated without the secret.

## Question record

A question is a Markdown block with a machine-readable header in an HTML comment (invisible when rendered) followed by human-readable content.

```markdown
<!-- agent-question
id: Q1
type: HUMAN_DECISION
status: OPEN
options: A,B,other
decision-key: payments.gateway
change: add-payment-method
-->

## Decision required: payment gateway

**Why this needs a human:** choosing a provider creates recurring cost and a third-party dependency (Level 2).

| Option | Summary | Consequences |
|---|---|---|
| A | Provider X | ... |
| B | Provider Y | ... |
| other | Something else: say which | ... |

**Recommendation (optional):** A, because ...

### Handoff
- Classification / impact set: D — `web`, `api`
- Completed independent work: order state model and order screens committed on `agent/add-payment-method` in `api`, `web` (tests pass); or `none`
- Not started (depends on this decision): tasks.md "payment provider integration", "checkout call"
- If A / If B / If other: what happens next in each case

**Reply with:** `/agent answer Q1 <option>` (add a note after the option if useful)
```

The `### Handoff` section is mandatory, with these labelled lines:

| Question type | Required lines |
|---|---|
| `HUMAN_DECISION` | `- Completed independent work:` (what is committed and validated, or `none`) and `- Not started (depends on this decision):` |
| `HUMAN_SECRET` | `- Completed work:` (what is committed, or `none`) and `- Blocked step (needs the secret):` including what could not be validated |

The GitHub integration refuses to publish a question without them.

Header fields (one `key: value` per line; all values restricted to `[A-Za-z0-9_.,:+-]`):

| Field | Meaning |
|---|---|
| `id` | Identifier, unique among the questions of the same thread/PR (`Q1`, `Q2`, …). |
| `type` | `HUMAN_DECISION` (Level 2) or `HUMAN_SECRET` (Level 3). |
| `status` | `OPEN` → `ANSWERED` or `CANCELLED`. Only the protocol runtime changes it; it never goes back to `OPEN`. The header is a projection: a question whose resume was already claimed in the ledger is `CLAIMED` (answered) even before its header says so ([LOOP-PREVENTION.md](LOOP-PREVENTION.md#question)). |
| `options` | Accepted answer keys. Defaults to `configured` for `HUMAN_SECRET`. Include `other` to allow a free-text answer in the note. |
| `decision-key` | Optional ledger key the answer will be recorded under (see [DECISIONS.md](../DECISIONS.md)). |
| `change` | Optional OpenSpec change id, so the resumed run can find `openspec/changes/<change-id>/`. Not the loop-prevention `change_id`. |
| `reason` | Reserved for the runtime: `iteration-limit` marks the circuit-breaker question (option `continue`), with `window` and `last-run`. An agent never writes these; the integration refuses a question that does. |
| `answered-by`, `answer`, `answer-comment`, `answered-at` | Written by the runtime when it records the answer. An agent never writes them. |

A `HUMAN_SECRET` question names the secret and where to configure it, and offers only `configured`. It never contains, requests or echoes a value.

## Answer

The answer is a single line, first in the reply, in a fixed grammar:

```
/agent answer <question-id> <option> [free-text note]
```

- `<option>` must be one of the question's `options`. Anything else is not an answer.
- The note is data for the agent (context, name of the "other" choice). It is never executed and never overrides the policy.
- Free-form replies ("go with A") are not machine-accepted: the runtime answers by asking for the exact form. This is deliberate: the agent must never infer which question a sentence answers.

## Determinism

| Need | Rule |
|---|---|
| Identify an open question | Header parses, `status: OPEN`, and it was published by the agent's own identity (an identical block posted by anyone else is ignored). |
| Relate an answer | The answer names the question `id`; one `id` maps to exactly one question in the thread, otherwise the answer is refused. |
| Reject duplicates | The first valid answer that claims the question wins: its resume run record is the claim (one per question, lowest platform id on a race), and the header is then set to `ANSWERED` (who, when, which option, which comment). Later answers are ignored; an answer arriving while the claim is not yet projected completes the claimed one. A crash between steps is recovered by the next event ([LOOP-PREVENTION.md](LOOP-PREVENTION.md#recovery-after-a-crash)). |
| Resume the right run | The answer carries the `id`; the question's handoff carries the branch/change; the run re-reads both. |
| Identity of the resume | New run id; same change id and source sha as the run that asked ([LOOP-PREVENTION.md](LOOP-PREVENTION.md)). It counts toward the iteration limit. |
| Several open questions | Each answer is recorded. Work resumes only when no `OPEN` question remains in the thread. |
| Who may answer | Trusted actors only ([SECURITY.md](SECURITY.md)). |

## Resuming

A resumed run starts cold, so the record is its memory:

1. Read L0 ([PROJECT.md](../PROJECT.md), [REPOSITORIES.md](../REPOSITORIES.md), [ARCHITECTURE.md](../ARCHITECTURE.md)) and the thread's question record, its answer and its handoff.
2. Record the decision in [DECISIONS.md](../DECISIONS.md) (`decision-key` if given), unless the answer was `HUMAN_SECRET`: then verify the secret is present without printing it.
3. Use the recorded impact set and classification; do not re-run discovery. Expand only on evidence ([AI.md](../AI.md) prime directive).
4. Implement the items listed as "Not started" (or the "Blocked step" of a secret question), applying the chosen option, then follow Phases 5–7 as usual. Independent work already committed is kept, not redone.
5. If the answer creates a new Level 2 question, stop again with a new `id`. If it makes an earlier assumption wrong, say so; do not patch silently.
6. Commits of a resumed run carry the provenance trailers the runner supplies for **its** run id ([LOOP-PREVENTION.md](LOOP-PREVENTION.md)).

After an `iteration-limit` stop, `continue` opens a new budget window (the run history is kept) and resumes the change from the current head: read the most recent handoff in the thread (of any answered question) for what remains, and check the run diagnostics in the limit question for why it stopped. An operational answer such as `continue` is not a decision and is not recorded in [DECISIONS.md](../DECISIONS.md).

## Retrying a failed run

A run that ended `FAILED` (or is `STALE`: it never ended, but no execution of it exists any more) is re-run only when a trusted actor asks, with one line:

```
/agent retry <run-id>
```

It is the same change: same change id and source sha, a new run id linked to the failed one, counted toward the iteration limit. It is refused for a run that is not the latest of the change, for a run that already has a retry, while a question is open, and at the iteration limit. See [LOOP-PREVENTION.md](LOOP-PREVENTION.md#retry).

An answer is a decision, not an approval of the resulting code. Review, CI and deploy approval remain separate human steps, and agents never deploy.

## Without an integration

In an interactive session there is no platform to carry the record. Ask in the conversation using the same content (why, options, consequences, recommendation), do not proceed until answered, and record the outcome in [DECISIONS.md](../DECISIONS.md). If the session must end first, put the question record in the change's `proposal.md` or `design.md` so the next session can find it.
