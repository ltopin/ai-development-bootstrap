#!/usr/bin/env bash
# Installs the AI development layer into a multi-repository workspace.
#
#   <target>/ai-development/   <- template/ (except adapters/)
#   <target>/AGENTS.md         <- template/adapters/AGENTS.md  (likewise CLAUDE.md, GEMINI.md)
#
# Safe by default: existing files are never overwritten. Re-running is harmless.

set -eu

usage() {
  cat <<'EOF'
Usage: bootstrap.sh [--dry-run] [--force] <target-workspace-dir>

Installs the AI development layer into <target-workspace-dir>.

Options:
  -n, --dry-run   Show what would happen; change nothing.
  -f, --force     Overwrite files that differ from the template.
                  The previous version is kept as <file>.bak.
  -h, --help      Show this help.

Existing files are skipped by default, so customizations survive re-runs.
EOF
}

force=0
dry=0
target=""

while [ $# -gt 0 ]; do
  case "$1" in
    -f|--force) force=1 ;;
    -n|--dry-run) dry=1 ;;
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

if [ ! -d "$target" ]; then
  if [ "$dry" -eq 1 ]; then
    echo "would create workspace directory: $target"
  else
    mkdir -p "$target"
    echo "created workspace directory: $target"
  fi
fi
if [ -d "$target" ]; then target="$(cd "$target" && pwd)"; fi

created=0; skipped=0; overwritten=0; unchanged=0

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

[ "$dry" -eq 1 ] && echo "DRY RUN: no files will be changed."
echo "Template: $template_dir"
echo "Target:   $target"
echo

echo "Installing layer into $target/ai-development"
while IFS= read -r rel; do
  install_file "$template_dir/$rel" "$target/ai-development/$rel"
done < <(cd "$template_dir" && find . -type f -not -path './adapters/*' | sed 's|^\./||' | LC_ALL=C sort)

echo
echo "Installing agent adapters into $target"
while IFS= read -r rel; do
  install_file "$template_dir/adapters/$rel" "$target/$rel"
done < <(cd "$template_dir/adapters" && find . -type f | sed 's|^\./||' | LC_ALL=C sort)

echo
echo "Done. created: $created, overwritten: $overwritten, skipped: $skipped, unchanged: $unchanged"
if [ "$skipped" -gt 0 ]; then
  echo "Skipped files were left untouched. If an adapter (AGENTS.md, CLAUDE.md, GEMINI.md) already"
  echo "existed, add a line pointing to ai-development/AI.md instead of replacing it."
fi
echo
echo "Next: fill in ai-development/PROJECT.md, REPOSITORIES.md and ARCHITECTURE.md."
