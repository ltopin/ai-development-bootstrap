# 0001. Use events for side effects of state changes

- Status: Accepted
- Date: 2026-01-15
- Change: none (initial architecture)

## Context

Notifications and fulfilment sync must react to order state changes. Doing this inside API requests makes requests slow and couples the API to third parties.

## Decision

The `api` persists state and emits an event to the queue; the `worker` performs side effects asynchronously. The `api` never calls third-party notification services directly.

## Consequences

- API latency is independent of email provider availability.
- Consumers must be idempotent (events may be delivered more than once).
- New reactions to state changes need no API change; they subscribe to the event.
