# PROJECT

## Name

Order Desk (fictional example)

## Purpose

Lets small shops take customer orders online and fulfil them, with automatic notifications when an order changes state.

## Domain

Online ordering and fulfilment.

## Users

| User | Goal |
|---|---|
| Customer | Place, track and cancel orders |
| Shop operator | Review and fulfil orders |

## Main capabilities

- Place and track orders — [orders](docs/domains/orders.md)
- Cancel orders before they ship — [orders](docs/domains/orders.md)
- Email notifications on order state changes

## Constraints

- The public HTTP API is used by third-party integrations: changes must be additive.
- Customer emails are personal data: never log them.
- Production deploys are done by the release pipeline; agents never deploy.

## Environments

| Environment | Purpose | Notes |
|---|---|---|
| local | development | see each repository's README |
| staging | pre-release validation | deployed from `main` of each repo |
| production | live | released by the pipeline |

## Glossary

| Term | Meaning |
|---|---|
| Order | A customer's request to buy items; has a status |
| Fulfilment | Packing and shipping an order |
| Shipped | Status after which an order can no longer be cancelled |

## Where to go next

- Repository map: [REPOSITORIES.md](REPOSITORIES.md)
- System architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Agent protocol: [AI.md](AI.md)
