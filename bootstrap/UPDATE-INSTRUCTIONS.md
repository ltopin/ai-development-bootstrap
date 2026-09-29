# Finishing a bootstrap update

Written into `ai-development/.bootstrap-update/` by `bootstrap --update` for the **Development Agent**. The human does not merge anything by hand: you do. [PENDING.md](PENDING.md) lists what is left and the command to re-run.

Work only on the files PENDING.md names. Do not edit `.new` or `.base` files, `.bootstrap-manifest` or `.bootstrap-version`.

## 1. Merge each conflicting framework file

A conflict means the project customized a framework file **and** the new template changed it. For each one:

- `ai-development/<file>` — the project's copy, with its customizations;
- `.bootstrap-update/<file>.new` — the new template version;
- `.bootstrap-update/<file>.base` — the template version the project's copy started from, when it could be recovered.

**With a base**, merge three-way: changes from `.base` to `.new` are the framework's; changes from `.base` to the project's copy are the project's customizations. Write into `ai-development/<file>` the new version with every customization re-applied. Where both changed the same passage, keep the framework's new text and re-apply the customization's intent on top of it.

**Without a base**, start from `.new` and re-apply only what is clearly project-specific in the project's copy (project names, extra rules, local conventions, added sections). Text that merely matches an older template wording is not a customization.

Never drop a customization silently. If a customization contradicts a framework rule (for example it removes a safety or approval rule), keep the framework rule and raise it as a Level 2 question (`protocol/DECISION-POLICY.md`) instead of choosing.

## 2. Add missing sections

For each migration in PENDING.md, insert the skeleton from `AI-FIRST.md` ("Adopting in an existing project") into the named project file at the stated place. Keep all existing content; fill only what is known from the project's docs, the rest `unknown` or `needs validation`. This is the only edit to project files in this procedure.

## 3. Re-run the update

Run the command in PENDING.md. It recognizes each file you merged (changed since the conflict was recorded, merged against the same template version), advances `.bootstrap-version` when no conflict remains, and deletes `.bootstrap-update/` when nothing is pending. If a file you merged is still reported, the template changed again in the meantime: repeat step 1 for it with the new `.new`.

## 4. Report

Tell the human, briefly: files merged, customizations kept, judgment calls where the intent was unclear (especially merges without a base), sections added, and any question raised. The human reviews and commits; do not commit or push unless asked.
