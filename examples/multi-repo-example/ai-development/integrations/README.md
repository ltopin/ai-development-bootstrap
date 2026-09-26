# integrations

Optional adapters that wire the core protocol ([AI.md](../AI.md), [protocol/](../protocol/)) to a platform. The core never depends on them; deleting this folder changes nothing about how agents work.

| Integration | What it does |
|---|---|
| [github/](github/README.md) | Pull-request questions, `WAITING_FOR_HUMAN` labels, resumption and [loop prevention](../protocol/LOOP-PREVENTION.md) (run ledger, self-trigger gate, circuit breaker) through GitHub Actions |

An integration only carries the protocol's records (questions, answers, states, run records) over its platform and enforces [protocol/SECURITY.md](../protocol/SECURITY.md) there. It must not add or change policy: levels, question format and security rules live in `protocol/`.

Agents (Claude, Codex, Gemini or others) are plugged in at one adapter point per integration and consume the same protocol.
