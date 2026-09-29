## Context

2.3.0 checks part 1 of the premise (logic outside the UI) everywhere and part 2 (an agent can call it) nowhere. The fix has two halves: make every existing check ask about the agent principal (A), and make every product own one agent access foundation (B).

## Decisions

1. **One foundation capability, `agent-access`, per product.** Agent principals and credentials are solved once for the whole product, not per change. This is why the gap *no agent principal* is not a per-capability question to the human: it points to one change. The alternative, a per-change agent authorization, was rejected because it multiplies credentials and bypasses administration.
2. **Requirements only, no mechanism.** The requirements are the principal, a credential per agent, scope, represented user, delegation by that user, lifecycle, audit, backend policy, rate limit and fail closed. Mechanism is Level 2, recorded in DECISIONS.md or an ADR.
3. **The only self-opened change.** Writing `add-agent-access` is the explicit exception to "never open a change on your own initiative". It is justified as a security foundation the premise requires. It is still just documents: the approval gate applies and updates change no code. Every other gap keeps the 2.3.0 rule, except that a premise gap must now be recorded **and asked about**.
4. **Reference folder `openspec/changes/_template-add-agent-access/`.** It is a sibling of `_template/`, so openspec tooling and humans see it as a template, not an open change. The scripts classify `openspec/changes/_template*` as framework-managed, so it is refreshed on update. It was not put inside `_template/`, because "copy `_template/` to start a change" would then copy it into every change.
5. **Detection by the script, judgment by the agent.** The script cannot know whether a product authenticates agents. It only checks project markers, read-only: a filled `agent-access` table row (placeholder rows contain `<` and are ignored, so a catalog freshly created from the template does not count) or an `add-agent-access` change, open or archived. When no marker is found it hands the check to the agent through `.bootstrap-update/`. The agent's first action always writes a marker (a row in every outcome), so the check does not repeat, and a product that has agent access never receives the change.
6. **Non-blocking.** Like MIGRATION REQUIRED, the check never stops the version from advancing.
7. **Readiness vocabulary reused for the foundation row.** `AGENT_READY` means every requirement is met with evidence, and `planned` is used in greenfield. There is no new status vocabulary.
8. **A reference for Product Agents, never self-opened.** `_template-add-product-agent/` gives any kind of agent the same checklist: mission, capabilities as credential scope, autonomy never above the catalog, delegation, triggers, knowledge, memory, handoff, evaluation, observability, stop at once, owner. Unlike `add-agent-access`, a Development Agent copies it only when the human asks for an agent. The agent's change consumes capabilities and never builds them; a missing one is a premise gap.

## Anchors

New in `AI-FIRST.md`:

- `#agent-access-foundation`, linked from AI-FIRST.md, AI.md, WORKFLOW.md, openspec/README.md, CAPABILITIES.md and the reference template;
- `#premise-gaps`, linked from AI-FIRST.md, AI.md, WORKFLOW.md, openspec/README.md, the proposal template and ARCHITECTURE.md.

The agentic impact questions are renumbered (10 is new; old 10–12 become 11–13); nothing links to the numbers. No anchor is removed.

## Risks / Trade-offs

- An agent may call a single-channel credential "agent access in place". Mitigation: the text says explicitly that such a credential is a starting point to migrate, not proof.
- A human may reject `add-agent-access`. Its catalog row and gap remain, so the update does not re-propose it; the gap stays visible.
- Customized `AI.md` or `AI-FIRST.md` in a project are merged by the agent (the 2.2.0 mechanism).
