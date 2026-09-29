# Finishing a bootstrap update

Written into `ai-development/.bootstrap-update/` by `bootstrap --update` for the **Development Agent**. The human does not merge anything by hand: you do. [PENDING.md](PENDING.md) lists what is left and the command to re-run.

Work only on the files PENDING.md names. Do not edit `.new` or `.base` files, `.bootstrap-manifest` or `.bootstrap-version`.

This is a **framework** update, not a product migration: never change application, domain, frontend or backend code, APIs, database or infrastructure here, and do not create changes or tasks to make the product Agent-First (`AI-FIRST.md`, "Framework update is not product migration"). The only exception is the `add-agent-access` change of step 3, which is a document written for approval, never implemented here.

## 1. Merge each conflicting framework file

A conflict means the project customized a framework file **and** the new template changed it. For each one:

- `ai-development/<file>` — the project's copy, with its customizations;
- `.bootstrap-update/<file>.new` — the new template version;
- `.bootstrap-update/<file>.base` — the template version the project's copy started from, when it could be recovered.

**With a base**, merge three-way: changes from `.base` to `.new` are the framework's; changes from `.base` to the project's copy are the project's customizations. Write into `ai-development/<file>` the new version with every customization re-applied. Where both changed the same passage, keep the framework's new text and re-apply the customization's intent on top of it.

**Without a base**, start from `.new` and re-apply only what is clearly project-specific in the project's copy (project names, extra rules, local conventions, added sections). Text that merely matches an older template wording is not a customization.

Never drop a customization silently. If a customization contradicts a framework rule (for example it removes a safety or approval rule), keep the framework rule and raise it as a Level 2 question (`protocol/DECISION-POLICY.md`) instead of choosing.

## 2. Add missing sections

For each migration in PENDING.md, insert the skeleton from `AI-FIRST.md` ("Adopting in an existing project") into the named project file at the stated place. Keep all existing content; fill only what is known from the project's docs, the rest `unknown` or `needs validation`. Record points that violate the premise as known gaps, never as a neutral description of the current state.

## 3. Agent access check

Only when PENDING.md lists it. The catalog has no `agent-access` row and there is no `add-agent-access` change (`AI-FIRST.md`, "Agent access foundation").

1. From cheap evidence only (the project's docs, API descriptions, authentication configuration, existing bot or integration credentials; no deep scan), decide whether the product already meets the agent access foundation: its own agent principal, a scoped and revocable credential per agent, represented user acted for only under that user's delegation, audit, fail closed.
2. **In place:** add the `agent-access` row to the *Foundation* section of `CAPABILITIES.md` as `AGENT_READY`, with the evidence.
3. **Missing or partial:** copy `openspec/changes/_template-add-agent-access/` to `openspec/changes/add-agent-access/` and fill it from the evidence. Reuse what exists; an agent credential restricted to one channel is migrated, not replaced. List the open decisions (mechanism, who issues credentials, initial scopes, default autonomy) as questions. Then add the `agent-access` row with its level and gaps, pointing to `add-agent-access`, and the *Agent access* line (`Known gap: no agent principal — see openspec/changes/add-agent-access/`) in `ARCHITECTURE.md` *Agent surface* and `PROJECT.md` *Agentic Strategy*, when those sections exist.
4. Never implement the change, never ask for, generate or write a secret value, and do not write this change when the product already has `agent-access`.

These, with step 2, are the only edits to project files in this procedure.

## 4. Re-run the update

Run the command in PENDING.md. It recognizes each file you merged (changed since the conflict was recorded, merged against the same template version), advances `.bootstrap-version` when no conflict remains, and deletes `.bootstrap-update/` when nothing is pending. If a file you merged is still reported, the template changed again in the meantime: repeat step 1 for it with the new `.new`.

## 5. Report

Tell the human, briefly: files merged, customizations kept, judgment calls where the intent was unclear (especially merges without a base), sections added, the agent access result (in place, or `add-agent-access` written and awaiting approval, with its open questions), and any question raised. The human reviews and commits; do not commit or push unless asked.
