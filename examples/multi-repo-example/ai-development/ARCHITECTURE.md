# ARCHITECTURE

Macro view: how systems relate. Internal details live in each repository.

## System context

```mermaid
flowchart LR
    Customer([Customer]) --> Web[web]
    Operator([Operator]) --> Web
    Web --> API[api]
    Partner([Third-party integration]) --> API
    API --> DB[(Database)]
    API --> Queue[[Queue]]
    Queue --> Worker[worker]
    Worker --> DB
    Worker --> Email[/Email provider/]
```

## Key flows

Order status change with notification:

```mermaid
sequenceDiagram
    participant Web as web
    participant API as api
    participant Worker as worker
    Web->>API: POST /orders/{id}/cancel
    API->>API: validate, persist status
    API-->>Web: 200 order
    API->>Worker: event order.status_changed
    Worker->>Worker: send notification email
```

## Boundaries and rules

- `web` never talks to the database or queue; it only calls the `api`.
- `worker` reads order tables but never writes them; state changes go through the `api`.
- The HTTP API changes additively; breaking changes need a new version.

## Data ownership

| Data | Owner | Others may |
|---|---|---|
| Orders | `api` | `worker` read-only |

## Related

- Domain: [docs/domains/orders.md](docs/domains/orders.md)
- Decision: [docs/adr/0001-use-events-for-side-effects.md](docs/adr/0001-use-events-for-side-effects.md)
