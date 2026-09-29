#!/usr/bin/env bash
# Installs or updates the AI development layer of a multi-repository workspace.
#
#   <target>/ai-development/   <- template/ (except adapters/)
#   <target>/AGENTS.md         <- template/adapters/AGENTS.md  (likewise CLAUDE.md, GEMINI.md)
#
# Install (default): safe by default. Existing files are never overwritten, so
# re-running is harmless. Existing adapters are never overwritten either, even
# with --force: a reference block is appended instead (once).
#
# Update (--update): refreshes only the FRAMEWORK-MANAGED files of a project that
# was bootstrapped before. PROJECT-MANAGED files are never modified. A framework
# file that was changed in the project is reported as a conflict and preserved.
#
# Conflicts (framework files customized in the project AND changed in the
# template) are handed to the Development Agent through ai-development/.bootstrap-update/:
# nobody merges by hand. See bootstrap/UPDATE-INSTRUCTIONS.md.
#
# This script never runs git in the target workspace. To recover the version a
# conflicting file started from, it may read this bootstrap repository's own
# history (git log / git show, read-only) when git is available.

set -eu

usage() {
  cat <<'EOF'
Usage: bootstrap.sh [--update] [--dry-run] [--force] <target-workspace-dir>

Installs the AI development layer into <target-workspace-dir>.

Options:
  -u, --update    Update the framework layer of an already bootstrapped project.
                  Project files (PROJECT.md, REPOSITORIES.md, ARCHITECTURE.md, DECISIONS.md, STACK.md,
                  CAPABILITIES.md, openspec changes/specs, domain docs, ADRs) are never touched.
                  A customized framework file is kept when the template did not
                  change it; otherwise it is left as it is and handed to your
                  agent through ai-development/.bootstrap-update/ (no manual merge).
  -n, --dry-run   Show what would happen; change nothing.
  -f, --force     Overwrite files that differ from the template.
                  The previous version is kept as <file>.bak.
                  With --update, this also overwrites conflicting framework files.
  -h, --help      Show this help.

Existing files are skipped by default, so customizations survive re-runs.
EOF
}

force=0
dry=0
update=0
target=""

while [ $# -gt 0 ]; do
  case "$1" in
    -f|--force) force=1 ;;
    -n|--dry-run) dry=1 ;;
    -u|--update) update=1 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "error: unknown option: $1" >&2; usage >&2; exit 2 ;;
    *)
      if [ -n "$target" ]; then echo "error: only one target directory allowed" >&2; exit 2; fi
      target="$1" ;;
  esac
  shift
done

if [ -z "$target" ]; then usage >&2; exit 2; fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
template_dir="$script_dir/../template"
[ -d "$template_dir" ] || { echo "error: template directory not found: $template_dir" >&2; exit 1; }
template_dir="$(cd "$template_dir" && pwd)"

version_file=".bootstrap-version"
manifest_file=".bootstrap-manifest"
nl=$'\n'

available_version="$(head -n 1 "$template_dir/$version_file" 2>/dev/null | tr -d '\r ' || true)"
[ -n "$available_version" ] || { echo "error: $template_dir/$version_file is missing or empty" >&2; exit 1; }

if [ "$update" -eq 1 ]; then
  if [ ! -d "$target/ai-development" ]; then
    echo "error: $target/ai-development not found; nothing to update." >&2
    echo "       Run without --update to install the layer first." >&2
    exit 1
  fi
else
  if [ ! -d "$target" ]; then
    if [ "$dry" -eq 1 ]; then
      echo "would create workspace directory: $target"
    else
      mkdir -p "$target"
      echo "created workspace directory: $target"
    fi
  fi
fi
if [ -d "$target" ]; then target="$(cd "$target" && pwd)"; fi

fresh_install=0
[ -d "$target/ai-development" ] || fresh_install=1

sha_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  else shasum -a 256 | cut -d' ' -f1; fi
}
# Content hash and comparison with line endings normalized (CRLF == LF), so a
# checkout that converts line endings is never mistaken for a local edit.
hash_of() { tr -d '\r' < "$1" | sha_stdin; }
raw_hash_of() { sha_stdin < "$1"; }
same_content() { cmp -s <(tr -d '\r' < "$1") <(tr -d '\r' < "$2"); }
# base_matches <manifest-hash> <file>. Manifests written before 2.2.0 hold raw hashes.
base_matches() { [ -n "$1" ] && { [ "$1" = "$(hash_of "$2")" ] || [ "$1" = "$(raw_hash_of "$2")" ]; }; }

# PROJECT-MANAGED: content belongs to the project. Never modified by --update.
# Everything else in template/ is FRAMEWORK-MANAGED. Paths are relative to template/.
is_project_managed() {
  case "$1" in
    PROJECT.md|REPOSITORIES.md|ARCHITECTURE.md|DECISIONS.md|STACK.md|CAPABILITIES.md) return 0 ;;
    openspec/project.md|openspec/specs/*) return 0 ;;
    openspec/changes/_template/*) return 1 ;;
    openspec/changes/*) return 0 ;;
    docs/adr/INDEX.md|docs/adr/[0-9]*) return 0 ;;  # the ADR index and real ADRs; README.md stays framework
    docs/domains/*|docs/architecture/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Files copied into ai-development/, one relative path per line.
template_files() {
  (cd "$template_dir" && find . -type f -not -path './adapters/*' -not -name "$version_file" \
    | sed 's|^\./||' | LC_ALL=C sort)
}
adapter_files() {
  (cd "$template_dir/adapters" && find . -type f | sed 's|^\./||' | LC_ALL=C sort)
}

# ---------------------------------------------------------------------------
# Baseline manifest: "<sha256>  <path>" for each framework file: the template
# version the project's copy is based on (as delivered, or as last merged). It
# lets --update tell "unchanged since install" (safe to refresh) from "modified
# in the project", and "customized, but the template did not change" (kept) from
# "customized and changed upstream" (conflict). Paths are relative to the
# workspace. Written on fresh install and by --update; never hand-edited.
# ---------------------------------------------------------------------------
manifest_path="$target/ai-development/$manifest_file"
pending_dir="$target/ai-development/.bootstrap-update"
merged_keys="$nl"   # files recognized as merged in this run, one manifest key per line

manifest_hash() {
  [ -f "$manifest_path" ] || return 0
  awk -v k="$1" '{ h = $1; $1 = ""; sub(/^ /, ""); if ($0 == k) { print h; exit } }' "$manifest_path"
}

# manifest_entry <template-file> <project-file> <key>: the base of the project's copy.
manifest_entry() {
  [ -f "$2" ] || return 0
  case "$merged_keys" in *"$nl$3$nl"*) echo "$(hash_of "$1")  $3"; return ;; esac
  if same_content "$1" "$2"; then echo "$(hash_of "$1")  $3"; return; fi
  old="$(manifest_hash "$3")"
  if [ -n "$old" ]; then echo "$old  $3"; fi   # customized: keep the base it came from
}

write_manifest() {
  out=""
  while IFS= read -r rel; do
    is_project_managed "$rel" && continue
    entry="$(manifest_entry "$template_dir/$rel" "$target/ai-development/$rel" "ai-development/$rel")"
    if [ -n "$entry" ]; then out="$out$entry$nl"; fi
  done < <(template_files)
  while IFS= read -r rel; do
    entry="$(manifest_entry "$template_dir/adapters/$rel" "$target/$rel" "$rel")"
    if [ -n "$entry" ]; then out="$out$entry$nl"; fi
  done < <(adapter_files)
  printf '%s' "$out" > "$manifest_path"
}

append_adapter_block() {
  { printf '\n<!-- ai-development:begin -->\n'; tail -n +2 "$1"; printf '<!-- ai-development:end -->\n'; } >> "$2"
}

# ===========================================================================
# INSTALL MODE
# ===========================================================================
created=0; skipped=0; overwritten=0; unchanged=0; appended=0

# install_file <source> <destination>
install_file() {
  src="$1"; dest="$2"
  if [ -e "$dest" ]; then
    if same_content "$src" "$dest"; then
      echo "  unchanged  $dest"; unchanged=$((unchanged + 1)); return
    fi
    if [ "$force" -eq 1 ]; then
      if [ "$dry" -eq 1 ]; then
        echo "  would overwrite  $dest (backup: $dest.bak)"
      else
        cp -p "$dest" "$dest.bak"
        cp "$src" "$dest"
        echo "  overwrote  $dest (backup: $dest.bak)"
      fi
      overwritten=$((overwritten + 1))
    else
      echo "  skipped    $dest (exists; use --force to overwrite)"
      skipped=$((skipped + 1))
    fi
    return
  fi
  if [ "$dry" -eq 1 ]; then
    echo "  would create  $dest"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "  created    $dest"
  fi
  created=$((created + 1))
}

# install_adapter <source> <destination>
# Never overwrites. If the file exists without a reference to ai-development/AI.md,
# appends a marked block (everything after the title line of the template adapter).
install_adapter() {
  src="$1"; dest="$2"
  if [ ! -e "$dest" ]; then install_file "$src" "$dest"; return; fi
  if grep -q "ai-development/AI.md" "$dest"; then
    echo "  unchanged  $dest (already references ai-development/AI.md)"; unchanged=$((unchanged + 1)); return
  fi
  if [ "$dry" -eq 1 ]; then
    echo "  would append  reference block to existing $dest"
  else
    append_adapter_block "$src" "$dest"
    echo "  appended   reference block to existing $dest"
  fi
  appended=$((appended + 1))
}

run_install() {
  [ "$dry" -eq 1 ] && echo "DRY RUN: no files will be changed."
  echo "Template: $template_dir"
  echo "Target:   $target"
  echo

  echo "Installing layer into $target/ai-development"
  while IFS= read -r rel; do
    install_file "$template_dir/$rel" "$target/ai-development/$rel"
  done < <(template_files)

  echo
  echo "Installing agent adapters into $target"
  while IFS= read -r rel; do
    install_adapter "$template_dir/adapters/$rel" "$target/$rel"
  done < <(adapter_files)

  # The version and baseline describe a whole install, so they are recorded only
  # when ai-development/ did not exist. Re-running never rewrites them; use --update.
  if [ "$fresh_install" -eq 1 ] && [ "$dry" -eq 0 ]; then
    cp "$template_dir/$version_file" "$target/ai-development/$version_file"
    write_manifest
  fi

  echo
  echo "Done. created: $created, appended: $appended, overwritten: $overwritten, skipped: $skipped, unchanged: $unchanged"
  if [ "$skipped" -gt 0 ]; then
    echo "Skipped files were left untouched (use --force to overwrite; the old version is kept as .bak)."
  fi
  if [ "$appended" -gt 0 ]; then
    echo "Existing adapters were kept; a short reference to ai-development/AI.md was appended to them."
  fi
  if [ "$fresh_install" -eq 0 ]; then
    echo "To refresh the framework files of an existing project, use --update."
  fi
  echo
  echo "Next: open the workspace in your AI agent and ask:"
  echo "  Initialize this project following ai-development/AI.md."
}

# ===========================================================================
# UPDATE MODE
# ===========================================================================
l_updated=""; l_created=""; l_preserved=""; l_conflicts=""; l_migrations=""; l_kept=""; l_merged=""
conflict_rels=""
n_updated=0; n_created=0; n_conflicts=0; n_unchanged=0

# pending_hash <key>: the project file's hash recorded when its conflict was handed to the agent.
pending_hash() {
  [ -f "$pending_dir/conflicts" ] || return 0
  awk -v k="$1" '{ h = $1; $1 = ""; sub(/^ /, ""); if ($0 == k) { print h; exit } }' "$pending_dir/conflicts"
}

# merged_by_agent <source> <destination> <label> <key>: the agent merged this conflict
# against the current template (the file changed since the conflict was recorded).
merged_by_agent() {
  recorded="$(pending_hash "$4")"
  [ -n "$recorded" ] && [ -f "$pending_dir/$3.new" ] && same_content "$pending_dir/$3.new" "$1" \
    && [ "$recorded" != "$(hash_of "$2")" ]
}

# update_framework <source> <destination> <label> <manifest-key>
update_framework() {
  src="$1"; dest="$2"; label="$3"; key="$4"
  if [ ! -e "$dest" ]; then
    if [ "$dry" -eq 0 ]; then mkdir -p "$(dirname "$dest")"; cp "$src" "$dest"; fi
    l_created="$l_created  - $label$nl"; n_created=$((n_created + 1)); return
  fi
  if same_content "$src" "$dest"; then n_unchanged=$((n_unchanged + 1)); return; fi
  base="$(manifest_hash "$key")"
  if base_matches "$base" "$dest"; then
    # Untouched since install: the template moved on, the project did not.
    if [ "$dry" -eq 0 ]; then cp "$src" "$dest"; fi
    l_updated="$l_updated  - $label$nl"; n_updated=$((n_updated + 1)); return
  fi
  if base_matches "$base" "$src"; then
    # Customized in the project; the template has not changed it since: keep it.
    l_kept="$l_kept  - $label$nl"; return
  fi
  if [ "$force" -eq 1 ]; then
    if [ "$dry" -eq 0 ]; then cp -p "$dest" "$dest.bak"; cp "$src" "$dest"; fi
    l_updated="$l_updated  - $label (overwritten by --force; backup: $label.bak)$nl"; n_updated=$((n_updated + 1)); return
  fi
  if merged_by_agent "$src" "$dest" "$label" "$key"; then
    merged_keys="$merged_keys$key$nl"
    l_merged="$l_merged  - $label$nl"; return
  fi
  conflict_rels="$conflict_rels$label$nl"
  l_conflicts="$l_conflicts  - $label$nl"; n_conflicts=$((n_conflicts + 1))
}

# update_adapter <source> <destination> <label>
# Adapters live in the user's workspace root and often hold their own content, so a
# customized adapter is preserved rather than flagged, unless it lacks the reference.
update_adapter() {
  src="$1"; dest="$2"; label="$3"
  if [ ! -e "$dest" ] || same_content "$src" "$dest"; then update_framework "$src" "$dest" "$label" "$label"; return; fi
  base="$(manifest_hash "$label")"
  if base_matches "$base" "$dest"; then update_framework "$src" "$dest" "$label" "$label"; return; fi
  if grep -q "ai-development/AI.md" "$dest"; then
    l_preserved="$l_preserved  - $label (customized adapter)$nl"; return
  fi
  if [ "$dry" -eq 0 ]; then append_adapter_block "$src" "$dest"; fi
  l_updated="$l_updated  - $label (reference to ai-development/AI.md appended)$nl"; n_updated=$((n_updated + 1))
}

# Sections that later template versions added to project-managed files, as
# "<file>|<heading>|<placed after>". --update never edits those files: a missing
# section is reported as MIGRATION REQUIRED and handed to the agent. Non-blocking.
migration_checks() {
  printf '%s\n' \
    'PROJECT.md|## Agentic Strategy|## Main capabilities' \
    'ARCHITECTURE.md|## Agent surface|## System context'
}

check_migrations() {
  while IFS='|' read -r file heading after; do
    dest="$target/ai-development/$file"
    [ -f "$dest" ] || continue
    grep -q "^$heading" "$dest" \
      || l_migrations="$l_migrations  - $file: add section \"$heading\" (after \"$after\")$nl"
  done < <(migration_checks)
}

# recover_base <template-relative-path> <sha256> <out>: find the template version with
# that hash in this bootstrap repository's own history (read-only). Fails quietly.
recover_base() {
  command -v git >/dev/null 2>&1 || return 1
  repo="$(cd "$template_dir/.." && pwd)"
  git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 1
  for c in $(git -C "$repo" log --format=%H -- "template/$1" 2>/dev/null); do
    if [ "$(git -C "$repo" show "$c:template/$1" 2>/dev/null | tr -d '\r' | sha_stdin)" = "$2" ]; then
      git -C "$repo" show "$c:template/$1" | tr -d '\r' > "$3"; return 0
    fi
  done
  return 1
}

# write_pending: hand conflicts and migrations to the Development Agent in
# ai-development/.bootstrap-update/, or remove that directory when nothing is pending.
write_pending() {
  rm -rf "$pending_dir"
  [ -n "$conflict_rels" ] || [ -n "$l_migrations" ] || return 0
  mkdir -p "$pending_dir"
  cp "$script_dir/UPDATE-INSTRUCTIONS.md" "$pending_dir/INSTRUCTIONS.md"
  : > "$pending_dir/conflicts"
  conflict_md=""
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    mkdir -p "$(dirname "$pending_dir/$rel")"
    tr -d '\r' < "$template_dir/$rel" > "$pending_dir/$rel.new"
    base="$(manifest_hash "ai-development/$rel")"
    if [ -n "$base" ] && recover_base "$rel" "$base" "$pending_dir/$rel.base"; then
      base_md="\`.bootstrap-update/$rel.base\`"
    else
      base_md="not available (merge without a base)"
    fi
    echo "$(hash_of "$target/ai-development/$rel")  ai-development/$rel" >> "$pending_dir/conflicts"
    conflict_md="$conflict_md- \`$rel\` — new: \`.bootstrap-update/$rel.new\`; base: $base_md$nl"
  done <<EOF
$conflict_rels
EOF
  {
    echo "# Pending bootstrap update"
    echo
    echo "Template version: $available_version (installed: ${installed_version:-unknown})"
    echo "How to finish: [INSTRUCTIONS.md](INSTRUCTIONS.md)"
    echo
    echo "## Conflicts to merge"
    echo
    if [ -n "$conflict_md" ]; then printf '%s' "$conflict_md"; else echo "None."; fi
    echo
    echo "## Sections to add"
    echo
    if [ -n "$l_migrations" ]; then printf '%s' "$l_migrations" | sed 's/^  //'; else echo "None."; fi
    echo
    echo "## Re-run when done"
    echo
    echo '```'
    echo "\"$script_dir/bootstrap.sh\" --update \"$target\""
    echo '```'
  } > "$pending_dir/PENDING.md"
}

run_update() {
  installed_version=""
  [ -f "$target/ai-development/$version_file" ] && installed_version="$(head -n 1 "$target/ai-development/$version_file" | tr -d '\r ')"

  [ "$dry" -eq 1 ] && echo "DRY RUN: no files will be changed."
  echo "Template: $template_dir"
  echo "Target:   $target"
  echo
  echo "Current bootstrap version: ${installed_version:-unknown (installed before versioning)}"
  echo "Available bootstrap version: $available_version"
  echo

  while IFS= read -r rel; do
    if is_project_managed "$rel"; then
      if [ -e "$target/ai-development/$rel" ]; then
        l_preserved="$l_preserved  - $rel$nl"
      else
        # Only ever created when absent; never modified afterwards.
        if [ "$dry" -eq 0 ]; then mkdir -p "$(dirname "$target/ai-development/$rel")"; cp "$template_dir/$rel" "$target/ai-development/$rel"; fi
        l_created="$l_created  - $rel$nl"; n_created=$((n_created + 1))
      fi
    else
      update_framework "$template_dir/$rel" "$target/ai-development/$rel" "$rel" "ai-development/$rel"
    fi
  done < <(template_files)

  while IFS= read -r rel; do
    update_adapter "$template_dir/adapters/$rel" "$target/$rel" "$rel"
  done < <(adapter_files)

  section() { # <title> <list>
    echo "$1"
    if [ -n "$2" ]; then printf '%s' "$2"; else echo "  (none)"; fi
    echo
  }
  section "Updated:" "$l_updated"
  section "Created:" "$l_created"
  section "Preserved project files:" "$l_preserved"
  echo "(Other project files, such as openspec changes, domain docs and ADRs, are never read or modified.)"
  echo
  section "Conflicts handed to the agent (customized in the project and changed in the template):" "$l_conflicts"
  if [ -n "$l_kept" ]; then section "Customized framework files kept (template unchanged since your copy):" "$l_kept"; fi
  if [ -n "$l_merged" ]; then section "Merged by the agent (now based on $available_version):" "$l_merged"; fi
  echo "Unchanged framework files: $n_unchanged"
  echo

  check_migrations
  if [ -n "$l_migrations" ]; then
    echo "MIGRATION REQUIRED (non-blocking; this script never edits project files, the agent adds them):"
    printf '%s' "$l_migrations"
    echo
  fi

  if [ "$n_conflicts" -gt 0 ]; then
    echo "Bootstrap version NOT updated (still ${installed_version:-unknown}): $n_conflicts conflict(s) handed to the agent."
    echo "To take the template version instead, discarding those customizations (old file kept as <file>.bak): --update --force."
  elif [ "$dry" -eq 1 ]; then
    echo "Bootstrap version would be updated to: $available_version"
  else
    cp "$template_dir/$version_file" "$target/ai-development/$version_file"
    echo "Bootstrap version updated to: $available_version"
  fi
  if [ "$dry" -eq 0 ]; then
    write_pending
    # Refresh the baseline in every case: each entry is the template version the file is based on.
    write_manifest
  fi
  echo
  if [ -n "$conflict_rels" ] || [ -n "$l_migrations" ]; then
    echo "AGENT FOLLOW-UP (nothing to do by hand). Open the workspace in your agent and ask:"
    echo "  Finish the bootstrap update following ai-development/.bootstrap-update/INSTRUCTIONS.md."
    if [ "$dry" -eq 1 ]; then echo "  (dry run: ai-development/.bootstrap-update/ would be written)"; fi
    echo
  fi
  echo "Review the changes and commit them in the project's ai-development repository."
}

if [ "$update" -eq 1 ]; then run_update; else run_install; fi
