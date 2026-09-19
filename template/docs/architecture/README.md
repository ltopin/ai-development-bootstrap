# docs/architecture

Optional detailed diagrams that do not fit in [ARCHITECTURE.md](../../ARCHITECTURE.md).

Add a file here when:

- a single diagram in ARCHITECTURE.md would exceed ~12 nodes;
- a cross-repository flow (auth, payments, data sync) needs its own sequence diagram;
- deployment or data-flow views matter for sequencing changes.

Conventions:

- One topic per file, named `<topic>.md` (e.g. `authentication-flow.md`).
- Prefer Mermaid. Show relationships between systems, not internal classes or modules.
- Use repository names exactly as in [REPOSITORIES.md](../../REPOSITORIES.md).
- Link each file from ARCHITECTURE.md ("Related") so it is discoverable at L0.

Leave this folder empty until you need it.
