<#
.SYNOPSIS
  Installs or updates the AI development layer of a multi-repository workspace.

.DESCRIPTION
  <Target>\ai-development\  <- template\ (except adapters\)
  <Target>\AGENTS.md        <- template\adapters\AGENTS.md (likewise CLAUDE.md, GEMINI.md)

  Install (default): safe by default. Existing files are never overwritten, so
  re-running is harmless. Existing adapters are never overwritten either, even
  with -Force: a reference block is appended instead (once).

  Update (-Update): refreshes only the FRAMEWORK-MANAGED files of a project that
  was bootstrapped before. PROJECT-MANAGED files are never modified. A framework
  file that was changed in the project is reported as a conflict and preserved.

  This script never runs git.

.PARAMETER Target
  Workspace directory to install into. Created if missing (install mode only).

.PARAMETER Update
  Update the framework layer of an already bootstrapped project. Project files
  (PROJECT.md, REPOSITORIES.md, ARCHITECTURE.md, DECISIONS.md, openspec changes/specs, domain
  docs, ADRs) are never touched. Framework files modified in the project are
  reported as conflicts and left as they are.

.PARAMETER DryRun
  Show what would happen; change nothing.

.PARAMETER Force
  Overwrite files that differ from the template. The previous version is kept as <file>.bak.
  With -Update, this also overwrites conflicting framework files.

.EXAMPLE
  ./bootstrap/bootstrap.ps1 C:\projects\my-project
  ./bootstrap/bootstrap.ps1 C:\projects\my-project -DryRun
  ./bootstrap/bootstrap.ps1 -Update C:\projects\my-project
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Target,
  [Alias('u')][switch]$Update,
  [Alias('n')][switch]$DryRun,
  [Alias('f')][switch]$Force
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)

$templateDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'template'
if (-not (Test-Path -LiteralPath $templateDir -PathType Container)) {
  throw "template directory not found: $templateDir"
}
$templateDir = (Resolve-Path -LiteralPath $templateDir).Path

$versionFile = '.bootstrap-version'
$manifestFile = '.bootstrap-manifest'

$templateVersionPath = Join-Path $templateDir $versionFile
if (-not (Test-Path -LiteralPath $templateVersionPath)) { throw "$templateVersionPath is missing" }
$availableVersion = ([IO.File]::ReadAllText($templateVersionPath) -split "`n")[0].Trim()
if (-not $availableVersion) { throw "$templateVersionPath is empty" }

if ($Update) {
  if (-not (Test-Path -LiteralPath (Join-Path $Target 'ai-development') -PathType Container)) {
    throw "$Target\ai-development not found; nothing to update. Run without -Update to install the layer first."
  }
} elseif (-not (Test-Path -LiteralPath $Target -PathType Container)) {
  if ($DryRun) { Write-Host "would create workspace directory: $Target" }
  else {
    New-Item -ItemType Directory -Path $Target | Out-Null
    Write-Host "created workspace directory: $Target"
  }
}
if (Test-Path -LiteralPath $Target -PathType Container) { $Target = (Resolve-Path -LiteralPath $Target).Path }

$aiDir = Join-Path $Target 'ai-development'
$freshInstall = -not (Test-Path -LiteralPath $aiDir -PathType Container)
$manifestPath = Join-Path $aiDir $manifestFile

function Test-SameContent([string]$a, [string]$b) {
  if ((Get-Item -LiteralPath $a).Length -ne (Get-Item -LiteralPath $b).Length) { return $false }
  return (Get-FileHash -LiteralPath $a).Hash -eq (Get-FileHash -LiteralPath $b).Hash
}

function Get-RelativeFiles([string]$root) {
  Get-ChildItem -LiteralPath $root -Recurse -File -Force |
    ForEach-Object { $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/') } |
    Sort-Object { $_ } -CaseSensitive
}

# Files copied into ai-development/ (forward-slash relative paths).
function Get-TemplateFiles {
  Get-RelativeFiles $templateDir | Where-Object { $_ -notlike 'adapters/*' -and $_ -ne $versionFile }
}
function Get-AdapterFiles { Get-RelativeFiles (Join-Path $templateDir 'adapters') }

function Join-Rel([string]$root, [string]$rel) { Join-Path $root ($rel.Replace('/', '\')) }

# PROJECT-MANAGED: content belongs to the project. Never modified by -Update.
# Everything else in template\ is FRAMEWORK-MANAGED. Paths are relative to template\.
function Test-ProjectManaged([string]$rel) {
  switch -Wildcard ($rel) {
    'PROJECT.md' { return $true }
    'REPOSITORIES.md' { return $true }
    'ARCHITECTURE.md' { return $true }
    'DECISIONS.md' { return $true }
    'openspec/project.md' { return $true }
    'openspec/specs/*' { return $true }
    'openspec/changes/_template/*' { return $false }
    'openspec/changes/*' { return $true }
    'docs/adr/INDEX.md' { return $true }
    'docs/adr/[0-9]*' { return $true }  # the ADR index and real ADRs; README.md stays framework
    'docs/domains/*' { return $true }
    'docs/architecture/*' { return $true }
    default { return $false }
  }
}

function Get-Hash([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }

# Baseline manifest: "<sha256>  <path>" for each framework file exactly as the
# template delivered it. It lets -Update tell "unchanged since install" (safe to
# refresh) from "modified in the project" (conflict). Paths are relative to the
# workspace. Written on fresh install and by -Update; never hand-edited.
function Get-ManifestHash([string]$key) {
  if (-not (Test-Path -LiteralPath $manifestPath)) { return $null }
  foreach ($line in [IO.File]::ReadAllLines($manifestPath)) {
    if ($line.Length -gt 66 -and $line.Substring(66) -ceq $key) { return $line.Substring(0, 64) }
  }
  return $null
}

function Write-Manifest {
  $out = New-Object Text.StringBuilder
  foreach ($rel in Get-TemplateFiles) {
    if (Test-ProjectManaged $rel) { continue }
    $dest = Join-Rel $aiDir $rel
    if ((Test-Path -LiteralPath $dest) -and (Test-SameContent (Join-Rel $templateDir $rel) $dest)) {
      [void]$out.Append("$(Get-Hash $dest)  ai-development/$rel`n")
    }
  }
  foreach ($rel in Get-AdapterFiles) {
    $dest = Join-Rel $Target $rel
    if ((Test-Path -LiteralPath $dest) -and (Test-SameContent (Join-Rel (Join-Path $templateDir 'adapters') $rel) $dest)) {
      [void]$out.Append("$(Get-Hash $dest)  $rel`n")
    }
  }
  [IO.File]::WriteAllText($manifestPath, $out.ToString(), $utf8)
}

function Add-AdapterBlock([string]$src, [string]$dest) {
  $body = (Get-Content -LiteralPath $src | Select-Object -Skip 1) -join "`n"
  $block = "`n<!-- ai-development:begin -->`n$body`n<!-- ai-development:end -->`n"
  [IO.File]::AppendAllText($dest, $block, $utf8)
}

function Copy-Creating([string]$src, [string]$dest) {
  $parent = Split-Path -Parent $dest
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item -LiteralPath $src -Destination $dest
}

# ===========================================================================
# INSTALL MODE
# ===========================================================================
$script:created = 0; $script:skipped = 0; $script:overwritten = 0; $script:unchanged = 0; $script:appended = 0

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
    Copy-Creating $src $dest
    Write-Host "  created    $dest"
  }
  $script:created++
}

# Never overwrites. If the file exists without a reference to ai-development/AI.md,
# appends a marked block (everything after the title line of the template adapter).
function Install-Adapter([string]$src, [string]$dest) {
  if (-not (Test-Path -LiteralPath $dest)) { Install-One $src $dest; return }
  if (Select-String -LiteralPath $dest -SimpleMatch 'ai-development/AI.md' -Quiet) {
    Write-Host "  unchanged  $dest (already references ai-development/AI.md)"; $script:unchanged++; return
  }
  if ($DryRun) { Write-Host "  would append  reference block to existing $dest" }
  else {
    Add-AdapterBlock $src $dest
    Write-Host "  appended   reference block to existing $dest"
  }
  $script:appended++
}

function Invoke-Install {
  if ($DryRun) { Write-Host 'DRY RUN: no files will be changed.' }
  Write-Host "Template: $templateDir"
  Write-Host "Target:   $Target"
  Write-Host ''

  Write-Host "Installing layer into $aiDir"
  foreach ($rel in Get-TemplateFiles) {
    Install-One (Join-Rel $templateDir $rel) (Join-Rel $aiDir $rel)
  }

  Write-Host ''
  Write-Host "Installing agent adapters into $Target"
  $adapters = Join-Path $templateDir 'adapters'
  foreach ($rel in Get-AdapterFiles) {
    Install-Adapter (Join-Rel $adapters $rel) (Join-Rel $Target $rel)
  }

  # The version and baseline describe a whole install, so they are recorded only
  # when ai-development\ did not exist. Re-running never rewrites them; use -Update.
  if ($freshInstall -and -not $DryRun) {
    Copy-Item -LiteralPath $templateVersionPath -Destination (Join-Path $aiDir $versionFile)
    Write-Manifest
  }

  Write-Host ''
  Write-Host "Done. created: $script:created, appended: $script:appended, overwritten: $script:overwritten, skipped: $script:skipped, unchanged: $script:unchanged"
  if ($script:skipped -gt 0) {
    Write-Host 'Skipped files were left untouched (use -Force to overwrite; the old version is kept as .bak).'
  }
  if ($script:appended -gt 0) {
    Write-Host 'Existing adapters were kept; a short reference to ai-development/AI.md was appended to them.'
  }
  if (-not $freshInstall) {
    Write-Host 'To refresh the framework files of an existing project, use -Update.'
  }
  Write-Host ''
  Write-Host 'Next: open the workspace in your AI agent and ask:'
  Write-Host '  Initialize this project following ai-development/AI.md.'
}

# ===========================================================================
# UPDATE MODE
# ===========================================================================
$script:lUpdated = New-Object Collections.Generic.List[string]
$script:lCreated = New-Object Collections.Generic.List[string]
$script:lPreserved = New-Object Collections.Generic.List[string]
$script:lConflicts = New-Object Collections.Generic.List[string]
$script:nUnchanged = 0

function Update-Framework([string]$src, [string]$dest, [string]$label, [string]$key) {
  if (-not (Test-Path -LiteralPath $dest)) {
    if (-not $DryRun) { Copy-Creating $src $dest }
    $script:lCreated.Add($label); return
  }
  if (Test-SameContent $src $dest) { $script:nUnchanged++; return }
  $base = Get-ManifestHash $key
  if ($base -and $base -eq (Get-Hash $dest)) {
    # Untouched since install: the template moved on, the project did not.
    if (-not $DryRun) { Copy-Item -LiteralPath $src -Destination $dest -Force }
    $script:lUpdated.Add($label); return
  }
  if ($Force) {
    if (-not $DryRun) {
      Copy-Item -LiteralPath $dest -Destination "$dest.bak" -Force
      Copy-Item -LiteralPath $src -Destination $dest -Force
    }
    $script:lUpdated.Add("$label (overwritten by -Force; backup: $label.bak)"); return
  }
  $script:lConflicts.Add($label)
}

# Adapters live in the user's workspace root and often hold their own content, so a
# customized adapter is preserved rather than flagged, unless it lacks the reference.
function Update-Adapter([string]$src, [string]$dest, [string]$label) {
  if (-not (Test-Path -LiteralPath $dest) -or (Test-SameContent $src $dest)) {
    Update-Framework $src $dest $label $label; return
  }
  $base = Get-ManifestHash $label
  if ($base -and $base -eq (Get-Hash $dest)) { Update-Framework $src $dest $label $label; return }
  if (Select-String -LiteralPath $dest -SimpleMatch 'ai-development/AI.md' -Quiet) {
    $script:lPreserved.Add("$label (customized adapter)"); return
  }
  if (-not $DryRun) { Add-AdapterBlock $src $dest }
  $script:lUpdated.Add("$label (reference to ai-development/AI.md appended)")
}

function Write-Section([string]$title, $items) {
  Write-Host $title
  if ($items.Count -eq 0) { Write-Host '  (none)' } else { foreach ($i in $items) { Write-Host "  - $i" } }
  Write-Host ''
}

function Invoke-Update {
  $installedVersion = ''
  $installedPath = Join-Path $aiDir $versionFile
  if (Test-Path -LiteralPath $installedPath) {
    $installedVersion = ([IO.File]::ReadAllText($installedPath) -split "`n")[0].Trim()
  }
  $shownInstalled = if ($installedVersion) { $installedVersion } else { 'unknown (installed before versioning)' }

  if ($DryRun) { Write-Host 'DRY RUN: no files will be changed.' }
  Write-Host "Template: $templateDir"
  Write-Host "Target:   $Target"
  Write-Host ''
  Write-Host "Current bootstrap version: $shownInstalled"
  Write-Host "Available bootstrap version: $availableVersion"
  Write-Host ''

  foreach ($rel in Get-TemplateFiles) {
    $src = Join-Rel $templateDir $rel
    $dest = Join-Rel $aiDir $rel
    if (Test-ProjectManaged $rel) {
      if (Test-Path -LiteralPath $dest) { $script:lPreserved.Add($rel) }
      else {
        # Only ever created when absent; never modified afterwards.
        if (-not $DryRun) { Copy-Creating $src $dest }
        $script:lCreated.Add($rel)
      }
    } else {
      Update-Framework $src $dest $rel "ai-development/$rel"
    }
  }
  $adapters = Join-Path $templateDir 'adapters'
  foreach ($rel in Get-AdapterFiles) {
    Update-Adapter (Join-Rel $adapters $rel) (Join-Rel $Target $rel) $rel
  }

  Write-Section 'Updated:' $script:lUpdated
  Write-Section 'Created:' $script:lCreated
  Write-Section 'Preserved project files:' $script:lPreserved
  Write-Host '(Other project files, such as openspec changes, domain docs and ADRs, are never read or modified.)'
  Write-Host ''
  Write-Section 'Conflicts requiring review:' $script:lConflicts
  Write-Host "Unchanged framework files: $script:nUnchanged"
  Write-Host ''

  if ($script:lConflicts.Count -gt 0) {
    Write-Host "Bootstrap version NOT updated (still $shownInstalled): $($script:lConflicts.Count) conflict(s) need review."
    Write-Host 'These framework files were modified in the project and were left as they are.'
    Write-Host 'Compare each with the template, merge what you want, then run -Update again:'
    Write-Host "  Compare-Object (Get-Content <project>\ai-development\<file>) (Get-Content $templateDir\<file>)"
    Write-Host 'To take the template version instead (old one kept as <file>.bak): -Update -Force.'
  } elseif ($DryRun) {
    Write-Host "Bootstrap version would be updated to: $availableVersion"
  } else {
    Copy-Item -LiteralPath $templateVersionPath -Destination $installedPath -Force
    Write-Host "Bootstrap version updated to: $availableVersion"
  }
  # Refresh the baseline in every case: it only lists files identical to the template.
  if (-not $DryRun) { Write-Manifest }
  Write-Host ''
  Write-Host "Review the changes and commit them in the project's ai-development repository."
}

if ($Update) { Invoke-Update } else { Invoke-Install }
