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
# This script never runs git.

set -eu

usage() {
  cat <<'EOF'
Usage: bootstrap.sh [--update] [--dry-run] [--force] <target-workspace-dir>

Installs the AI development layer into <target-workspace-dir>.

Options:
  -u, --update    Update the framework layer of an already bootstrapped project.
                  Project files (PROJECT.md, REPOSITORIES.md, ARCHITECTURE.md, DECISIONS.md, STACK.md,
                  openspec changes/specs, domain docs, ADRs) are never touched.
                  Framework files modified in the project are reported as
                  conflicts and left as they are.
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

hash_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# PROJECT-MANAGED: content belongs to the project. Never modified by --update.
# Everything else in template/ is FRAMEWORK-MANAGED. Paths are relative to template/.
is_project_managed() {
  case "$1" in
    PROJECT.md|REPOSITORIES.md|ARCHITECTURE.md|DECISIONS.md|STACK.md) return 0 ;;
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
# Baseline manifest: "<sha256>  <path>" for each framework file exactly as the
# template delivered it. It lets --update tell "unchanged since install" (safe
# to refresh) from "modified in the project" (conflict). Paths are relative to
# the workspace. Written on fresh install and by --update; never hand-edited.
# ---------------------------------------------------------------------------
manifest_path="$target/ai-development/$manifest_file"

manifest_hash() {
  [ -f "$manifest_path" ] || return 0
  awk -v k="$1" '{ h = $1; $1 = ""; sub(/^ /, ""); if ($0 == k) { print h; exit } }' "$manifest_path"
}

write_manifest() {
  out=""
  while IFS= read -r rel; do
    is_project_managed "$rel" && continue
    dest="$target/ai-development/$rel"
    if [ -f "$dest" ] && cmp -s "$template_dir/$rel" "$dest"; then
      out="$out$(hash_of "$dest")  ai-development/$rel$nl"
    fi
  done < <(template_files)
  while IFS= read -r rel; do
    dest="$target/$rel"
    if [ -f "$dest" ] && cmp -s "$template_dir/adapters/$rel" "$dest"; then
      out="$out$(hash_of "$dest")  $rel$nl"
    fi
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
    if cmp -s "$src" "$dest"; then
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
l_updated=""; l_created=""; l_preserved=""; l_conflicts=""
n_updated=0; n_created=0; n_conflicts=0; n_unchanged=0

# update_framework <source> <destination> <label> <manifest-key>
update_framework() {
  src="$1"; dest="$2"; label="$3"; key="$4"
  if [ ! -e "$dest" ]; then
    if [ "$dry" -eq 0 ]; then mkdir -p "$(dirname "$dest")"; cp "$src" "$dest"; fi
    l_created="$l_created  - $label$nl"; n_created=$((n_created + 1)); return
  fi
  if cmp -s "$src" "$dest"; then n_unchanged=$((n_unchanged + 1)); return; fi
  base="$(manifest_hash "$key")"
  if [ -n "$base" ] && [ "$base" = "$(hash_of "$dest")" ]; then
    # Untouched since install: the template moved on, the project did not.
    if [ "$dry" -eq 0 ]; then cp "$src" "$dest"; fi
    l_updated="$l_updated  - $label$nl"; n_updated=$((n_updated + 1)); return
  fi
  if [ "$force" -eq 1 ]; then
    if [ "$dry" -eq 0 ]; then cp -p "$dest" "$dest.bak"; cp "$src" "$dest"; fi
    l_updated="$l_updated  - $label (overwritten by --force; backup: $label.bak)$nl"; n_updated=$((n_updated + 1)); return
  fi
  l_conflicts="$l_conflicts  - $label$nl"; n_conflicts=$((n_conflicts + 1))
}

# update_adapter <source> <destination> <label>
# Adapters live in the user's workspace root and often hold their own content, so a
# customized adapter is preserved rather than flagged, unless it lacks the reference.
update_adapter() {
  src="$1"; dest="$2"; label="$3"
  if [ ! -e "$dest" ] || cmp -s "$src" "$dest"; then update_framework "$src" "$dest" "$label" "$label"; return; fi
  base="$(manifest_hash "$label")"
  if [ -n "$base" ] && [ "$base" = "$(hash_of "$dest")" ]; then update_framework "$src" "$dest" "$label" "$label"; return; fi
  if grep -q "ai-development/AI.md" "$dest"; then
    l_preserved="$l_preserved  - $label (customized adapter)$nl"; return
  fi
  if [ "$dry" -eq 0 ]; then append_adapter_block "$src" "$dest"; fi
  l_updated="$l_updated  - $label (reference to ai-development/AI.md appended)$nl"; n_updated=$((n_updated + 1))
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
  section "Conflicts requiring review:" "$l_conflicts"
  echo "Unchanged framework files: $n_unchanged"
  echo

  if [ "$n_conflicts" -gt 0 ]; then
    echo "Bootstrap version NOT updated (still ${installed_version:-unknown}): $n_conflicts conflict(s) need review."
    echo "These framework files were modified in the project and were left as they are."
    echo "Compare each with the template, merge what you want, then run --update again:"
    echo "  diff <project>/ai-development/<file> $template_dir/<file>"
    echo "To take the template version instead (old one kept as <file>.bak): --update --force."
  elif [ "$dry" -eq 1 ]; then
    echo "Bootstrap version would be updated to: $available_version"
  else
    cp "$template_dir/$version_file" "$target/ai-development/$version_file"
    echo "Bootstrap version updated to: $available_version"
  fi
  # Refresh the baseline in every case: it only lists files identical to the template.
  if [ "$dry" -eq 0 ]; then write_manifest; fi
  echo
  echo "Review the changes and commit them in the project's ai-development repository."
}

if [ "$update" -eq 1 ]; then run_update; else run_install; fi
