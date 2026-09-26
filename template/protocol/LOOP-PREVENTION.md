# Loop prevention

How an automated agent avoids triggering itself. This file defines the **protocol**; it names no platform, agent or design tool. How a platform carries it is an integration ([integrations/github/](../integrations/github/README.md) is one).

The hazard: an automated run receives a change, implements it, commits and pushes; that push is itself an event that starts the agent again, which pushes again, and so on. Two things are needed and neither is enough alone: **classify each event correctly**, and **stop a run away anyway**.

## The rule

```
NOT:  "a commit written by an AI is ignored"
YES:  "changes produced by the CURRENT automated execution are a continuation of the intent that started it,
       and never start a new execution"
```

The classification depends on the origin of the **execution**, not on who or what wrote the code. A developer who runs Claude, Codex or any other tool locally and pushes the result under their own identity has produced a new intent.

| Event | Class | Starts the agent? | CI |
|---|---|---|---|
| A design export commit pushed by the human | EXTERNAL INTENT | yes | runs |
| A human commits and pushes | EXTERNAL INTENT | yes | runs |
| A developer runs Claude or Codex locally and pushes with their own identity | EXTERNAL INTENT | yes | runs |
| The automated pipeline runs the agent and publishes its commits | INTERNAL AUTOMATION CHANGE | **no** | runs |
| A human answers a question with `/agent answer …` | continuation of the same change | resumes it | n/a |
| A human asks `/agent retry <run-id>` for a failed run | continuation of the same change | re-runs it | n/a |

```
Human (code or design export) / local Claude / local Codex ──► push ──► platform ──► gate ──► agent run (commits locally) ─┐
                                                                                                          │
                                                          trusted publish step: records the commits, pushes ◄┘
                                                                     │
                               platform ─┬─► CI: lint, tests, typecheck, build, security   (always)
                                         └─► gate: IGNORE_AUTOMATION_CHANGE                (no new agent run)
```

## Vocabulary

| Term | Meaning |
|---|---|
| **external intent** | A change that did not come from the current automated execution. It may start **one** logical execution. |
| **change_id** | Stable id of the logical unit of work (`PR-42` on GitHub). Not the same as the OpenSpec change folder named in a question's `change:` field; that one names artifacts, this one names the thread of executions. |
| **source_sha** | The external commit that originated the execution. Everything the run produces belongs to it. |
| **run_id** | One agent execution. Unique. A resume or a retry is a new run of the same change. |
| **trigger** | Why a run exists: `external` (a new intent), `resume` (a human answered) or `retry` (a human asked to re-run a failed run). Each event has an **origin**: `external` or `automation`. |
| **start commit** | The branch head the run was started from (`head_sha`). For an external run it is the `source_sha`. |
| **run record** | The persisted entry for a run: `change_id`, `source_sha`, `head_sha`, `run_id`, `trigger`, `status`, `iteration`, `produced`, and the link to the run or question it continues. |
| **ledger** | All run records and questions of a change. It lives on the platform, never on the runner. It is append-mostly: nothing in it is deleted to reset anything. |
| **automation identity** | The single identity the automation pushes as (GitHub: `AGENT_PUSH_ACTOR`). **Mandatory** on a real platform. |

One external intent is one logical execution. The run may produce many commits; none of them is a new intent. Retries and resumes belong to the same change and are counted, not welcomed.

## Provenance trailers

Every commit made by an automated run ends with four git trailers, supplied by the runner:

```
Agent-Generated: true
Agent-Run: <run_id>
Agent-Change: <change_id>
Source-SHA: <source_sha>
```

Why trailers: they are part of the commit, machine-parseable, native to git (`git commit --trailer`, `git interpret-trailers`), independent of the free text, and survive rebases. Rules:

- exact keys, one of each, in the **last paragraph** of the message; `Agent-Generated` is exactly `true`; ids and the sha use fixed character sets. Anything else is not provenance;
- **the agent adds them only when the runner gave it the values** (`AGENT_RUN_ID`, `AGENT_CHANGE_ID`, `AGENT_SOURCE_SHA`). In an interactive or local session nobody supplies them, so nothing adds them: local Claude/Codex commits carry none, and stay external;
- they never contain a CI-skip marker: agent commits must run CI.

**A trailer is a claim, not a proof.** Anyone can type it, including a human who copies the trailers of a live run. On its own it qualifies nothing.

## What a run produced

A run's `produced` list is built from **evidence the execution controls**, never discovered afterwards by looking for trailers in the branch history.

The agent step commits **locally** and never pushes. A trusted step that the agent does not control (the *publish* step) then:

1. takes exactly the commits between the run's **start commit** and the job's own `HEAD`; the start commit must be an ancestor of `HEAD`, so none of them existed in the source state;
2. requires every one of them to carry **this** run's provenance (same `run_id`, `change_id`, `source_sha`); one commit without it fails the run and nothing is pushed;
3. requires the branch to still point at the start commit; if anyone pushed meanwhile, the run fails (`branch-moved`) and nothing is pushed over their work;
4. writes that list to the run record **before** pushing (write-ahead, the record stays `RUNNING`);
5. pushes with the **automation identity**, as a **compare-and-swap** on the branch: the platform updates it only if it still points at the start commit.

A commit is an internal automation change only if **all** hold:

1. it is in the `produced` list of a run record written by the automation identity for this change (so it was pushed by the publish step, and did not exist before the run);
2. its trailers parse strictly and name that run, change and source;
3. the event that delivered it came from the automation identity.

A commit that only *appears* in the history with valid-looking trailers, including one pushed by a human while the run was `RUNNING`, is an external intent. If the pushing identity does not match on an event whose commits are all recorded, nothing runs (there is nothing new) and the mismatch is reported. The gate judges the **whole set of unprocessed commits**, not only the event's own sha, so a replaced queued event does not lose a human's change.

Without a configured automation identity the gate fails closed and does not run the agent. Only an explicitly declared local/test mode may omit it, and that mode is refused on the real platform.

## Decisions

```
event ─► configured? ─► valid? ─► trusted source? ─► anything not produced by a run pending?
             │             │             │                      │ no
       REJECT_INVALID  REJECT_INVALID REJECT_UNTRUSTED   IGNORE_AUTOMATION_CHANGE / IGNORE_DUPLICATE
                                                                │ yes
                          waiting for a human? ──yes──► WAITING_FOR_HUMAN (open-question)
                                        │ no
                          iteration limit reached? ──yes──► WAITING_FOR_HUMAN (iteration-limit)
                                        │ no
                                     RUN_AGENT
```

| Decision | Meaning |
|---|---|
| `RUN_AGENT` | New external intent: claim a run, start the agent. |
| `RESUME_AGENT` | A trusted answer: new run, same `change_id` and `source_sha`. |
| `RETRY_AGENT` | A trusted `/agent retry`: new run, same `change_id` and `source_sha`, linked to the run it replaces. |
| `IGNORE_AUTOMATION_CHANGE` | Consequence of an automated run. No agent run. CI is unaffected. |
| `IGNORE_DUPLICATE` | The same intent, answer or retry was already processed. Nothing runs twice. |
| `WAITING_FOR_HUMAN` | A question is open, or the iteration limit was reached. Nothing runs. |
| `REJECT_UNTRUSTED` | Untrusted source (fork, non-trusted commenter, bot). |
| `REJECT_INVALID` | Malformed event, unknown question or run, bad option, missing configuration. |

For an answer (`/agent answer <question-id> <option>`) the same gate applies with these adaptations: a duplicate answer is `IGNORE_DUPLICATE`; an answer that leaves other questions open only records itself (`WAITING_FOR_HUMAN`); a valid one is `RESUME_AGENT`, unless the iteration limit holds it.

## State machines

### Run

```
       NEW_EXTERNAL_INTENT / answer / retry
                      │  claim: run record (RUNNING), before the agent starts
                      ▼
      ┌────────── RUNNING ───────────┬──────────────────┐
      │              │               │                  │ ledger says RUNNING, but no execution
      ▼              ▼               ▼                  ▼ of it exists any more (observed)
    READY   WAITING_FOR_HUMAN     FAILED              STALE
                     │               │                  │
       human answer  │ RESUME_AGENT  │ /agent retry     │ /agent retry
                     ▼               ▼ RETRY_AGENT      ▼ RETRY_AGENT
                  RUNNING …       RUNNING …          RUNNING …   (new run_id; same change_id and source_sha)

INTERNAL_AUTOMATION_CHANGE and duplicate events have no transition into RUNNING.
```

- `FAILED` is a run that ended and said so (invalid result, missing provenance, branch moved, push refused, …); the record keeps the `failure` reason.
- `STALE` is a different condition: nobody ended the run. The ledger still says `RUNNING`, but the platform reports that no execution of it is alive (for example the runner died after the claim). It is detected only when a retry asks, it is never guessed, and it stays diagnosable in the record: it is never rewritten as `FAILED`. If the execution state cannot be verified, the run is not retried.
- A run that is still executing is never retried.

### Question

```
             trusted valid answer X (the claim is the run record: resume-key = question id)
  OPEN ──────────────────────────────────────────────► CLAIMED(X)        derived: record exists,
    │                                                       │            header not yet projected
    │ trusted valid answer, no run owed                     │ header projected (idempotent, repairable)
    │ (other questions still open, or iteration limit)      ▼
    └──────────────────────────────────────────────────► ANSWERED(X)     who, which option, which comment, when
  OPEN ──► CANCELLED
```

The **ledger is the source of truth**; the question header is a projection of it. A question with a resume record is `CLAIMED` whatever its header says, and every later event that touches it repairs the header. Only one resume record per question can exist (see Idempotency), so two resumes for one answer, or for two different answers to the same question, are impossible.

## Idempotency

Every run record is the **claim** of a key. One logical run per key:

| Trigger | Key |
|---|---|
| `external` | `change_id` + `source_sha` |
| `resume` | `change_id` + question id |
| `retry` | `change_id` + the run it replaces |

The ledger is rebuilt from the platform on every event, so a runner that dies and a webhook that is delivered twice both find the same answer. If two deliveries race, each creates a record, both re-read the ledger, and the record with the **lowest platform id wins**; the loser removes its own record and stops. If the loser dies before removing it, the ledger still counts only the lowest id (the other is void). That tie-break is what makes the claim safe, not the platform's queueing.

## Recovery after a crash

Between a valid answer and the new run there are several writes. After a crash at any point, the next delivery of the same answer (or a different answer, or a re-run of the job) decides deterministically from the ledger:

| Crash point | Ledger state | Next event does |
|---|---|---|
| before the claim is written | question `OPEN`, no record | processes the answer normally (exactly one resume) |
| after the claim, before the tie-break or the header | question `CLAIMED` | reports `resume-already-created`, repairs the header, creates nothing |
| after the header, before the agent job starts | question `ANSWERED`, run `RUNNING` without execution | creates nothing; the run is `STALE` once its execution has ended and can be retried |
| answer held by the limit: after posting the limit question, before recording the answer | limit question `OPEN`, question `OPEN` | records the answer; the limit question is not posted twice |

A different answer that arrives while the question is `CLAIMED` completes the claimed one and is not applied.

The publish step writes `produced` before pushing, so a crash after the push still leaves the pushed commits recognised as automation.

## Retry

`/agent retry <run-id>` is the explicit way to re-run a run. It is a continuation of the change, never an external intent, and never needs an empty commit. It is accepted only if:

1. the author is a trusted actor (never a bot or the automation identity);
2. the run exists in this change's ledger and is `FAILED` or `STALE`;
3. it was not retried yet (otherwise `IGNORE_DUPLICATE`);
4. it is the latest run of the change (a later run supersedes it: retry that one instead);
5. no question is open (questions take precedence);
6. the iteration limit does not hold it.

The new run keeps `change_id` and `source_sha`, gets a new `run_id`, is recorded with `trigger: retry` and `retry-of: <run-id>`, and counts toward the limit. A failed retry can itself be retried: R1 → R2 → R3.

## Circuit breaker

`MAX_AGENT_ITERATIONS` (GitHub: `AGENT_MAX_ITERATIONS`, **default 3**, allowed 1 to 100) caps the runs, resumes and retries included, of one change in the current **budget window**.

It is a safety net against bugs, races, unexpected retries, duplicate events, misconfiguration and loops nobody predicted. It is **not** a budget for trying again: the normal case is one run per intent. 3 is the conservative default; larger values are a deliberate configuration choice.

When the limit is reached the agent is **not** started. The gate publishes a `HUMAN_DECISION` question with `reason: iteration-limit`, the single option `continue`, the window number, the last run, and every run of the window as diagnostics, then ends in `WAITING_FOR_HUMAN`. Only the gate may set `reason`; a question written by an agent that tries to is refused. The limit question is operational: it is not recorded in [DECISIONS.md](../DECISIONS.md).

### Budget windows

Answering `continue` is a **human authorisation for a new budget window**, not an erasure of history. All run records stay in the ledger, unchanged. The windows are derived, never stored as a counter:

```
R1 R2 R3 ─► iteration-limit-1 (window 1, last run R3) ─► carol: continue ─► window 2 ─► R4 …
```

From the ledger alone one can answer, at any time: how many runs the change had (all of them); how many times the breaker opened (the limit questions); who authorised each new window and when (the answer comment: platform identity and timestamp); and which run was active at that moment. The GitHub integration exposes this as `auditChange()`.

## Human in the loop

`/agent answer …` is a **continuation** of the change, never an external intent. The resumed run gets a new `run_id`, keeps `change_id` and `source_sha`, is recorded with `trigger: resume`, and counts toward the limit. Its commits carry trailers for the new `run_id`. See [HUMAN-IN-THE-LOOP.md](HUMAN-IN-THE-LOOP.md).

## Agent trigger versus CI trigger

Two separate switches. Loop protection lives only on the agent's; a commit produced by an agent must trigger lint, tests, typecheck, build, security checks and the rest of CI exactly like any other. Never protect against self-triggering with a path filter, a CI-skip marker or a condition on the CI workflows.

## Concurrency is not loop prevention

Serializing runs of a change (one at a time) prevents **parallel** execution over the same intent. It does nothing against a **sequence** of runs each triggered by the previous one. Loop prevention rests on provenance, idempotency and the circuit breaker; concurrency control is only an additional guard and the platform's queue may drop pending events.

## Defence in depth

| Layer | Stops | Fails when |
|---|---|---|
| `produced` built by the trusted step, write-ahead, compare-and-swap push | the agent re-triggering itself; forged trailers | the publish step is bypassed (then commits are external: costs runs, bounded by the breaker) |
| Automation identity (mandatory) | pushes by anyone else being taken as automation | not configured: the gate refuses to run |
| Idempotency (claim keys) | duplicate deliveries, re-runs, double resumes and retries | the ledger cannot be read |
| Claim tie-break | racing duplicates | none known |
| Circuit breaker | anything the layers above missed | limit set too high |
| Human review, CI, branch protection | bad changes reaching production | not an anti-loop layer |

## Known limits

- **A human push during a run costs that run's work.** If the branch moved while the agent worked, publish refuses to push over it (`branch-moved`) and the run fails; the human's change then starts a new run. Nothing is lost on the branch, but the agent's local commits are discarded. `/agent retry` is refused for it, because the new run supersedes it.
- **Retry needs the platform's view of executions.** A `RUNNING` run is `STALE` only if the platform confirms its execution ended; if that cannot be verified, the retry is refused.
- **Answers held by the circuit breaker, or answers to one of several open questions,** are recorded on the question itself, not in a run record. Two such answers racing without the per-change serialization would leave the last write on the header; no run is started by either, so no loop results.
- **The agent step shares its job with the publish step.** Publish ignores repository hooks and never uses the agent's git configuration for credentials, but the agent step is inside that job's trust boundary, as before.
- **More than 200 commits in one run** fail the run (`too-many-commits`).
- **A PR with more than the platform's commit-listing limit** (250 on GitHub) cannot be classified and is rejected as invalid.
- Everything above the platform layer assumes the automation identity's records cannot be forged by non-privileged users; if untrusted users can post as the automation identity, no comment-based ledger is safe.

## What an integration must provide

1. A place for run records that outlives a runner and is writable only by the automation identity.
2. Claim before start, seal after finish, by a step the agent does not control.
3. A trusted publish step that builds `produced` from the job's own commits, records it before pushing, and pushes with a compare-and-swap under the automation identity.
4. The commit list of a change, with messages, and the identity of the pusher of the event.
5. The execution state of a run (alive or ended), for retries of `RUNNING` records.
6. Separation of the agent trigger from CI triggers.
7. The four provenance trailers on every automated commit.
