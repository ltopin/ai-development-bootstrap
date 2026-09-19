<#
.SYNOPSIS
  Installs the AI development layer into a multi-repository workspace.

.DESCRIPTION
  <Target>\ai-development\  <- template\ (except adapters\)
  <Target>\AGENTS.md        <- template\adapters\AGENTS.md (likewise CLAUDE.md, GEMINI.md)

  Safe by default: existing files are never overwritten. Re-running is harmless.

.PARAMETER Target
  Workspace directory to install into. Created if missing.

.PARAMETER DryRun
  Show what would happen; change nothing.

.PARAMETER Force
  Overwrite files that differ from the template. The previous version is kept as <file>.bak.

.EXAMPLE
  ./bootstrap/bootstrap.ps1 C:\projects\my-project
  ./bootstrap/bootstrap.ps1 C:\projects\my-project -DryRun
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Target,
  [Alias('n')][switch]$DryRun,
  [Alias('f')][switch]$Force
)

$ErrorActionPreference = 'Stop'

$templateDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'template'
if (-not (Test-Path -LiteralPath $templateDir -PathType Container)) {
  throw "template directory not found: $templateDir"
}
$templateDir = (Resolve-Path -LiteralPath $templateDir).Path

if (-not (Test-Path -LiteralPath $Target -PathType Container)) {
  if ($DryRun) { Write-Host "would create workspace directory: $Target" }
  else {
    New-Item -ItemType Directory -Path $Target | Out-Null
    Write-Host "created workspace directory: $Target"
  }
}
if (Test-Path -LiteralPath $Target -PathType Container) { $Target = (Resolve-Path -LiteralPath $Target).Path }

$script:created = 0; $script:skipped = 0; $script:overwritten = 0; $script:unchanged = 0

function Test-SameContent([string]$a, [string]$b) {
  if ((Get-Item -LiteralPath $a).Length -ne (Get-Item -LiteralPath $b).Length) { return $false }
  return (Get-FileHash -LiteralPath $a).Hash -eq (Get-FileHash -LiteralPath $b).Hash
}

function Install-One([string]$src, [string]$dest) {
  if (Test-Path -LiteralPath $dest) {
    if (Test-SameContent $src $dest) {
      Write-Host "  unchanged  $dest"; $script:unchanged++; return
    }
    if ($Force) {
      if ($DryRun) { Write-Host "  would overwrite  $dest (backup: $dest.bak)" }
      else {
        Copy-Item -LiteralPath $dest -Destination "$dest.bak" -Force
        Copy-Item -LiteralPath $src -Destination $dest -Force
        Write-Host "  overwrote  $dest (backup: $dest.bak)"
      }
      $script:overwritten++
    } else {
      Write-Host "  skipped    $dest (exists; use -Force to overwrite)"
      $script:skipped++
    }
    return
  }
  if ($DryRun) { Write-Host "  would create  $dest" }
  else {
    $parent = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dest
    Write-Host "  created    $dest"
  }
  $script:created++
}

function Get-RelativeFiles([string]$root) {
  Get-ChildItem -LiteralPath $root -Recurse -File -Force |
    ForEach-Object { $_.FullName.Substring($root.Length).TrimStart('\', '/') } |
    Sort-Object { $_ } -CaseSensitive
}

if ($DryRun) { Write-Host 'DRY RUN: no files will be changed.' }
Write-Host "Template: $templateDir"
Write-Host "Target:   $Target"
Write-Host ''

Write-Host "Installing layer into $Target\ai-development"
foreach ($rel in Get-RelativeFiles $templateDir) {
  if ($rel -like 'adapters\*' -or $rel -like 'adapters/*') { continue }
  Install-One (Join-Path $templateDir $rel) (Join-Path (Join-Path $Target 'ai-development') $rel)
}

Write-Host ''
Write-Host "Installing agent adapters into $Target"
$adapters = Join-Path $templateDir 'adapters'
foreach ($rel in Get-RelativeFiles $adapters) {
  Install-One (Join-Path $adapters $rel) (Join-Path $Target $rel)
}

Write-Host ''
Write-Host "Done. created: $script:created, overwritten: $script:overwritten, skipped: $script:skipped, unchanged: $script:unchanged"
if ($script:skipped -gt 0) {
  Write-Host 'Skipped files were left untouched. If an adapter (AGENTS.md, CLAUDE.md, GEMINI.md) already'
  Write-Host 'existed, add a line pointing to ai-development/AI.md instead of replacing it.'
}
Write-Host ''
Write-Host 'Next: fill in ai-development/PROJECT.md, REPOSITORIES.md and ARCHITECTURE.md.'
