# Design-driven implementation

How an agent implements an app that a human produced with a design or app-builder tool. This file defines the **protocol**; it names tools only as examples (Stitch for design, Google AI Studio for app building, Claude or Codex for the agent) and depends on none of them. How a platform carries the branch model is an integration ([integrations/github/](../integrations/github/README.md) is one).

## Scope

Applies when an external change is a **generated app or screen**: a runnable result whose presentation is real and whose data layer is fake (hardcoded data, browser storage used as a database, simulated latency, keys used in the client, sometimes a generated server that returns fixed data). The agent's job is to make it work for real (integrate with the existing backend, extend it, or build one) and stop at a pull request.

Everything else in [AI.md](../AI.md) and this folder still applies: impact analysis, [classification](CLASSIFICATION.md), the [decision levels](DECISION-POLICY.md), [human-in-the-loop](HUMAN-IN-THE-LOOP.md), [loop prevention](LOOP-PREVENTION.md) and [security](SECURITY.md). This file adds what is specific to generated input.

A builder may generate **full-stack** code (a client plus its own server). "Frontend in, backend out" is wrong: the input may already contain a server that duplicates or contradicts the real backend. Both sides are part of the change.

## Design reference

A builder is a second, lossy translation of the design, and it invents: screens, interactivity, logins, endpoints and documents nobody designed. An agent that sees only the generated code takes all of it as requirements. So a repository may carry the **design reference**: the design tool's export, next to the code.

- **Where.** `design/<tool>/` on the design source branch (for example `design/stitch/`), **one file per screen**, committed by a human. The builder does not carry the design into the repository; a person exports it and commits it, ideally in the same push cycle as the builder's changes.
- **What it decides.** When a design reference is present, it is the contract for **presentation and flow**, and the generated app is the **starting implementation**, not the contract. Read it before building the extraction table. The pull request names the design files used.
- **Human input only.** The agent never creates, edits or deletes anything under `design/`.
- **No design reference.** The generated app is the contract (the rules below that name "the contract" then mean the generated app), no comparison is made, and the pull request says: "no design comparison: no design reference".

## Presentation is the human's contract

What the human designed is the contract for presentation: the **design reference** when one is present, otherwise the **generated app**. Preserve its layout, styling and visible behavior. With a design reference, the generated app's rendering of designed elements is kept as the implementation; the agent does not restyle it to chase pixel fidelity, and does not restore design tokens the builder flattened when the visual result is the same.

Change presentation only when it is technically required:

- broken accessibility;
- incompatibility with the target stack;
- a security problem;
- data that cannot exist as drawn (a field no real or proposed contract can supply).

Change only as far as needed, and list every such change with its reason in the pull request under *Presentation changes*. Working styling you consider poor is not a reason: the visual result is not "improved".

### Content belongs to the human

Copy, testimonials, metrics, names and images, in the design reference or in the generated app, are the human's. The agent does not rewrite or invent them. Content that looks like a placeholder (invented testimonials, round-number metrics, lorem ipsum) may be listed in the pull request under *Content to review*; it never blocks the change.

## Reading the design

Classify each element of the design reference by **behavior**, not by a tool's markup:

| Element | Kind | What the agent does |
|---|---|---|
| accepts input or triggers an action (a form that submits, an enabled input, a button with a destination) | **requirement** | it must work for real; if the code fakes or lacks it, it is a row of the extraction table |
| only shows values (a read-only input, fixed numbers, static text, a preview) | **display** | preserve it; never back it with a contract |
| links to another screen of the design reference | **required flow** | the navigation must exist and reach that screen |
| links to a target that is not a screen of the design reference | **design gap** | list it under *Design gaps* in the pull request; do not build the target |

A link target counts as a screen only if a file for it exists in the design reference. If the generated app already has a screen for a design gap, that screen is a visible invention (see below), not something the agent builds or finishes. Tools mark links and inputs in their own ways (Stitch, for example, puts the target screen's name in a `data-path` attribute); such markup is a hint for applying the rules above, never a rule of its own.

## Design comparison

With a design reference, compare it with the generated code **in both directions**:

- **In the design, faked or missing in the code** → a row of the extraction table (the status → class rules below are unchanged).
- **In the code, with no origin in the design** → an **invention** (a behavior, screen, endpoint or document).

The result goes into the pull request under *Design comparison*: the requirements found, their rows, and each invention with its outcome. When every requirement is backed and there is no invention, it says "no inventions, no gaps".

### Inventions

An invention is handled by whether the user can see it:

| Invention | Visible | Action |
|---|---|---|
| an endpoint no client calls, a generated document | no | remove it and list it under *Inventions removed* in the pull request |
| a screen, interactivity where the design shows display, an authentication flow | yes | never remove or keep it silently: unless [DECISIONS.md](../DECISIONS.md) records the outcome, stop the affected work with `WAITING_FOR_HUMAN` and one [Level 2](DECISION-POLICY.md#level-2--human-decision) question per invention: **keep** or **remove** |

Removing an invisible invention changes nothing the human sees. A visible one may be something the human asked the builder for while iterating; the agent cannot know, so it asks once. Inventions that stand or fall together (the screens behind one navigation bar) are one invention and one question. The answer is recorded in `DECISIONS.md`, and later runs apply it without asking and cite the decision in the pull request.

The fake boundaries inside a visible invention wait for its answer: they are listed with the question, not as rows, and they do not set the class. A **kept** invention is a requirement from then on: its fake boundaries enter the extraction table and the class is re-evaluated. A **removed** one takes its fake boundaries with it.

A stale or incomplete design reference produces false inventions. That is why visible ones become questions, not deletions.

### Generated documentation

Documents the builder writes (architecture, schemas, "how it works", feature descriptions) have the status of a generated server: **proposed**. They are never an L0 document, never a recorded decision and never [classification](CLASSIFICATION.md) evidence. A technology or integration named only in generated documentation (a database, a queue, a third-party service) is not adopted on its authority; the choice follows the [decision policy](DECISION-POLICY.md). Generated documents with no origin in the design are invisible inventions.

## Fake boundaries

A **fake boundary** is a place where the app pretends to have data or behavior that a real system should provide. Find them by **behavior**, not by location: there is no conventional mock folder, and the protocol must not assume one.

| Signal | Example |
|---|---|
| literal data used as a data source | `const ORDERS = [...]` read by a component, hook or service |
| simulated latency | `setTimeout`, `Promise.resolve(data)` pretending to be I/O |
| browser storage as a database | `localStorage`, `sessionStorage` or IndexedDB holding domain entities |
| client-generated identity for persisted entities | `Date.now()`, `Math.random()`, `crypto.randomUUID()` used as a record id |
| credentials or third-party/model calls in the client | a key in client code or in environment variables exposed to the bundle; a direct call to a model or paid API |
| generated server returning fixed data | an endpoint whose handler returns constants |
| success faked in an error path | a `catch` that generates a confirmation code in the client and shows success |
| fake authentication | access decided by credentials or a role chosen in the client (a role picker as login), with no server check |
| action with no effect | a submit or button that only changes local state where the contract requires an effect |
| orphan endpoint | a generated endpoint that no client calls |

Scan the client **and** any generated server code. A client-side credential is also a [Level 3](DECISION-POLICY.md#level-3--human-secret) matter: the call moves server-side, and the agent names the secret it needs but never asks for its value.

The scan runs **twice**:

1. **Start scan**, after impact analysis: every match becomes a row of the extraction table, except an **orphan endpoint**, which nothing needs: it is removed and listed under *Inventions removed* (with or without a design reference), and matches inside a visible invention still waiting for its answer (see [Inventions](#inventions)).
2. **Done scan**, before declaring the change ready: every remaining match is either removed or listed in the pull request under *Remaining matches* with the reason it is legitimate (test fixtures, seeds, feature flags).

The done scan runs on every agent execution, so a later builder push that reintroduces fake data into integrated code shows up again in the table and is removed again.

## Extraction table

Before implementing, produce one row per fake boundary:

```markdown
| Element (file)           | Needs                  | Real contract            | Status   |
|--------------------------|------------------------|--------------------------|----------|
| OrdersList (ORDERS)      | id, status, total      | GET /orders              | exists   |
| column "tracking"        | tracking_code          | GET /orders, no field    | partial  |
| cancel button            | cancel mutation        | none                     | missing  |
| server GET /api/summary  | aggregate by status    | none (generated server)  | proposed |
```

| Status | Meaning | Class |
|---|---|---|
| `exists` | a real contract already returns what the element needs | B |
| `partial` | a real contract exists but must be extended | C |
| `missing` | no real contract exists | D |
| `proposed` | the only matching contract is in the generated server | D (there is no real contract yet) |

A generated endpoint is a **proposed** contract, never an existing one. The highest status sets the class, as in [CLASSIFICATION.md](CLASSIFICATION.md). The table is the classification evidence: it goes into the pull request, or into `proposal.md` when a formal change is opened.

**Empty table.** When the start scan leaves the table empty (no fake boundary, or only orphan endpoints, which are removed) and the contract (the design reference, or the generated app without one) has no requirement that needs data, the change is **class A**: only the frontend is touched, no backend work is added, and the pull request says "no fake boundaries: presentation only". A static landing page is the typical case.

## New project or existing project

Decide the mode from the workspace map (the L0 documents, [REPOSITORIES.md](../REPOSITORIES.md) above all), never from the generated code.

| Mode | When | What the agent does |
|---|---|---|
| **New project** | the map lists no backend for this product, or `PROJECT.md` is being initialized | The generated app is the frontend and its server is the **seed of the backend**. Harden it (persistence, migrations, validation, authentication, tests) instead of rewriting it, unless it contradicts a recorded decision. |
| **Existing project** | the map lists a frontend and a backend for this product | Generated client code is adapted to the existing frontend's conventions (HTTP client, authentication, routing, state, components) while keeping what the user sees. |

When the map does not settle the mode, that is a Level 2 question: stop with `WAITING_FOR_HUMAN` and ask which mode applies.

### Parallel backend

In an existing project, a generated server next to the real backend is a **parallel backend**. It is never left in place silently. Unless [DECISIONS.md](../DECISIONS.md) already records the choice, stop before implementing the affected work with a Level 2 question offering:

- **absorb** the generated endpoints into the real backend;
- **keep** the generated server as a backend-for-frontend;
- **drop** it.

The first answer is recorded in `DECISIONS.md`, so later runs apply it without asking.

### New repositories

The agent never creates repositories. When a new backend in a multi-repository workspace needs a repository that does not exist, stop with a Level 2 question asking where the backend lives.

## Definition of done

The change is ready only when:

- the done scan finds no unexplained fake boundary;
- every client data call is backed by a real contract;
- every invisible invention is removed, and every visible one has a recorded outcome;
- the backend work (endpoints, persistence, migrations) is implemented with tests;
- CI passes.

The pull request contains the extraction table and these lists, each with "none" when empty:

- *Presentation changes*;
- *Remaining matches*;
- *Design comparison* (or "no design comparison: no design reference");
- *Design gaps*;
- *Inventions removed*;
- *Content to review*.

Infrastructure, provisioning, preview environments and deploy are not part of done.

## Design source branch

A builder that commits to Git may only write to one branch (often the repository's default branch) and may sync both ways. So that generated code never reaches production without review, and the agent's integration reaches the builder, a repository that adopts builder-driven development uses this model:

```
 builder ──sync──► design source branch (default) ── pull request ──► production branch (protected)
                     ▲   │                                                     │
                     │   └─ agent commits here (trusted publish step)          │
                     └──────────────── back-sync after merge ◄─────────────────┘
```

- **Design source branch.** A dedicated branch (suggested name `studio`) is the repository's default branch and the only branch the builder writes to.
- **Protected production.** The production branch changes only through reviewed pull requests; direct pushes are rejected.
- **One design pull request.** A push to the design source branch ensures that one pull request from it to production is open. It is opened only when none is open and the design source branch is ahead of production. That pull request is the change: the agent runs on it through the usual gate, and its commits are published to the design source branch with the usual provenance, duplicate and iteration rules ([LOOP-PREVENTION.md](LOOP-PREVENTION.md)). Each later builder push is new external intent on the same change. Opening the pull request never runs the agent or pushes code by itself.
- **Back-sync.** After the design pull request is merged, the design source branch is updated to contain production: fast-forward when possible, otherwise a merge of production into it. It is never force-pushed, production is never modified, and a conflict stops the back-sync and is reported on the merged pull request. A back-sync that leaves the design source branch not ahead of production opens nothing and starts no run.
- **Trust.** Who may push to the design source branch decides who may start the agent: see [SECURITY.md](SECURITY.md#8-design-source-branch).
- **Opt-in.** Nothing changes until a repository adopts the model. Installing or updating this framework never changes branches, defaults or protection.

The builder should wait for the agent: a builder push while a run is in progress makes that run fail to publish (the branch moved), without overwriting anything, and the push starts a new run. Every design push counts toward the per-change iteration limit.

## Tool independence

Tools, agents and platforms appear here only as examples. No rule depends on a specific tool's file layout, commit identity or features: a different builder, a different agent or a different platform gets the same detection, extraction, mode and done rules.
