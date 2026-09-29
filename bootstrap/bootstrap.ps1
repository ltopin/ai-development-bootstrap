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

  Conflicts (framework files customized in the project AND changed in the
  template) are handed to the Development Agent through ai-development\.bootstrap-update\:
  nobody merges by hand. See bootstrap\UPDATE-INSTRUCTIONS.md.

  This script never runs git in the target workspace. To recover the version a
  conflicting file started from, it may read this bootstrap repository's own
  history (git log / git show, read-only) when git is available.

.PARAMETER Target
  Workspace directory to install into. Created if missing (install mode only).

.PARAMETER Update
  Update the framework layer of an already bootstrapped project. Project files
  (PROJECT.md, REPOSITORIES.md, ARCHITECTURE.md, DECISIONS.md, STACK.md, CAPABILITIES.md, openspec
  changes/specs, domain docs, ADRs) are never touched. A customized framework file is kept when the
  template did not change it; otherwise it is left as it is and handed to your agent through
  ai-development\.bootstrap-update\ (no manual merge).

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
$latin1 = [Text.Encoding]::GetEncoding(28591)  # byte-preserving round trip
$emDash = [string][char]0x2014

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
$pendingDir = Join-Path $aiDir '.bootstrap-update'

# Content hash and comparison with line endings normalized (CRLF == LF), so a
# checkout that converts line endings is never mistaken for a local edit.
function Get-NormBytes([string]$path) {
  $bytes = [IO.File]::ReadAllBytes($path)
  if ([Array]::IndexOf($bytes, [byte]13) -lt 0) { return ,$bytes }
  return ,$latin1.GetBytes($latin1.GetString($bytes).Replace("`r", ''))
}
function Get-BytesHash([byte[]]$bytes) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
}
function Get-Hash([string]$path) { Get-BytesHash (Get-NormBytes $path) }
function Get-RawHash([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Test-SameContent([string]$a, [string]$b) { (Get-Hash $a) -eq (Get-Hash $b) }
# Manifests written before 2.2.0 hold raw hashes.
function Test-BaseMatches([string]$base, [string]$path) {
  if (-not $base) { return $false }
  return ($base -eq (Get-Hash $path)) -or ($base -eq (Get-RawHash $path))
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
    'STACK.md' { return $true }
    'CAPABILITIES.md' { return $true }
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

# "<sha256>  <key>" lookup in a manifest-style file.
function Get-KeyedHash([string]$file, [string]$key) {
  if (-not (Test-Path -LiteralPath $file)) { return $null }
  foreach ($line in [IO.File]::ReadAllLines($file)) {
    if ($line.Length -gt 66 -and $line.Substring(66) -ceq $key) { return $line.Substring(0, 64) }
  }
  return $null
}

# Baseline manifest: "<sha256>  <path>" for each framework file: the template
# version the project's copy is based on (as delivered, or as last merged). It
# lets -Update tell "unchanged since install" (safe to refresh) from "modified
# in the project", and "customized, but the template did not change" (kept) from
# "customized and changed upstream" (conflict). Paths are relative to the
# workspace. Written on fresh install and by -Update; never hand-edited.
$script:mergedKeys = New-Object 'Collections.Generic.HashSet[string]'

function Get-ManifestHash([string]$key) { Get-KeyedHash $manifestPath $key }

# The base of the project's copy, or $null.
function Get-ManifestEntry([string]$tpl, [string]$dest, [string]$key) {
  if (-not (Test-Path -LiteralPath $dest)) { return $null }
  if ($script:mergedKeys.Contains($key) -or (Test-SameContent $tpl $dest)) { return "$(Get-Hash $tpl)  $key" }
  $old = Get-ManifestHash $key
  if ($old) { return "$old  $key" }  # customized: keep the base it came from
  return $null
}

function Write-Manifest {
  $out = New-Object Text.StringBuilder
  foreach ($rel in Get-TemplateFiles) {
    if (Test-ProjectManaged $rel) { continue }
    $entry = Get-ManifestEntry (Join-Rel $templateDir $rel) (Join-Rel $aiDir $rel) "ai-development/$rel"
    if ($entry) { [void]$out.Append("$entry`n") }
  }
  $adapters = Join-Path $templateDir 'adapters'
  foreach ($rel in Get-AdapterFiles) {
    $entry = Get-ManifestEntry (Join-Rel $adapters $rel) (Join-Rel $Target $rel) $rel
    if ($entry) { [void]$out.Append("$entry`n") }
  }
  [IO.File]::WriteAllText($manifestPath, $out.ToString(), $utf8)
}

function Add-AdapterBlock([string]$src, [string]$dest) {
  $body = (Get-Content -LiteralPath $src | Select-Object -Skip 1) -join "`n"
  $block = "`n<!-- ai-development:begin -->`n$body`n<!-- ai-development:end -->`n"
  [IO.File]::AppendAllText($dest, $block, $utf8)
}

function New-ParentDir([string]$path) {
  $parent = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
}

function Copy-Creating([string]$src, [string]$dest) {
  New-ParentDir $dest
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
$script:lKept = New-Object Collections.Generic.List[string]
$script:lMerged = New-Object Collections.Generic.List[string]
$script:lMigrations = New-Object Collections.Generic.List[string]
$script:nUnchanged = 0

# The agent merged this conflict against the current template: the file changed
# since the conflict was recorded, and the recorded template version is the current one.
function Test-MergedByAgent([string]$src, [string]$dest, [string]$label, [string]$key) {
  $recorded = Get-KeyedHash (Join-Path $pendingDir 'conflicts') $key
  $new = Join-Rel $pendingDir "$label.new"
  return [bool]($recorded -and (Test-Path -LiteralPath $new) -and (Test-SameContent $new $src) -and
    ($recorded -ne (Get-Hash $dest)))
}

function Update-Framework([string]$src, [string]$dest, [string]$label, [string]$key) {
  if (-not (Test-Path -LiteralPath $dest)) {
    if (-not $DryRun) { Copy-Creating $src $dest }
    $script:lCreated.Add($label); return
  }
  if (Test-SameContent $src $dest) { $script:nUnchanged++; return }
  $base = Get-ManifestHash $key
  if (Test-BaseMatches $base $dest) {
    # Untouched since install: the template moved on, the project did not.
    if (-not $DryRun) { Copy-Item -LiteralPath $src -Destination $dest -Force }
    $script:lUpdated.Add($label); return
  }
  if (Test-BaseMatches $base $src) {
    # Customized in the project; the template has not changed it since: keep it.
    $script:lKept.Add($label); return
  }
  if ($Force) {
    if (-not $DryRun) {
      Copy-Item -LiteralPath $dest -Destination "$dest.bak" -Force
      Copy-Item -LiteralPath $src -Destination $dest -Force
    }
    $script:lUpdated.Add("$label (overwritten by -Force; backup: $label.bak)"); return
  }
  if (Test-MergedByAgent $src $dest $label $key) {
    [void]$script:mergedKeys.Add($key)
    $script:lMerged.Add($label); return
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
  if (Test-BaseMatches $base $dest) { Update-Framework $src $dest $label $label; return }
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

# Sections that later template versions added to project-managed files. -Update never
# edits those files: a missing section is reported as MIGRATION REQUIRED and handed
# to the agent. Non-blocking.
$migrationChecks = @(
  @{ File = 'PROJECT.md'; Heading = '## Agentic Strategy'; After = '## Main capabilities' },
  @{ File = 'ARCHITECTURE.md'; Heading = '## Agent surface'; After = '## System context' }
)

function Find-Migrations {
  foreach ($m in $migrationChecks) {
    $dest = Join-Rel $aiDir $m.File
    if (-not (Test-Path -LiteralPath $dest)) { continue }
    $found = [IO.File]::ReadAllLines($dest) | Where-Object { $_.StartsWith($m.Heading) }
    if (-not $found) { $script:lMigrations.Add("$($m.File): add section `"$($m.Heading)`" (after `"$($m.After)`")") }
  }
}

# Runs git with its output captured as bytes (no console encoding involved). $null on failure.
function Invoke-GitBytes([string[]]$gitArgs) {
  $psi = New-Object Diagnostics.ProcessStartInfo 'git'
  $psi.Arguments = ($gitArgs | ForEach-Object { '"' + $_ + '"' }) -join ' '
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  try { $p = [Diagnostics.Process]::Start($psi) } catch { return $null }
  $errTask = $p.StandardError.ReadToEndAsync()
  $ms = New-Object IO.MemoryStream
  $p.StandardOutput.BaseStream.CopyTo($ms)
  $p.WaitForExit()
  [void]$errTask.Result
  if ($p.ExitCode -ne 0) { return $null }
  return ,$ms.ToArray()
}

# Find the template version with that hash in this bootstrap repository's own
# history (read-only) and write it to $out. Fails quietly.
function Restore-Base([string]$rel, [string]$hash, [string]$out) {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return $false }
  $repo = Split-Path -Parent $templateDir
  if ($null -eq (Invoke-GitBytes @('-C', $repo, 'rev-parse', '--is-inside-work-tree'))) { return $false }
  $log = Invoke-GitBytes @('-C', $repo, 'log', '--format=%H', '--', "template/$rel")
  if ($null -eq $log) { return $false }
  foreach ($c in ($utf8.GetString($log) -split "`n" | Where-Object { $_.Trim() })) {
    $blob = Invoke-GitBytes @('-C', $repo, 'show', "$($c.Trim()):template/$rel")
    if ($null -eq $blob) { continue }
    $norm = $latin1.GetBytes($latin1.GetString($blob).Replace("`r", ''))
    if ((Get-BytesHash $norm) -eq $hash) { [IO.File]::WriteAllBytes($out, $norm); return $true }
  }
  return $false
}

# Hand conflicts and migrations to the Development Agent in
# ai-development\.bootstrap-update\, or remove that directory when nothing is pending.
function Write-Pending([string]$installedVersion) {
  if (Test-Path -LiteralPath $pendingDir) { Remove-Item -LiteralPath $pendingDir -Recurse -Force }
  if ($script:lConflicts.Count -eq 0 -and $script:lMigrations.Count -eq 0) { return }
  New-Item -ItemType Directory -Path $pendingDir -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'UPDATE-INSTRUCTIONS.md') -Destination (Join-Path $pendingDir 'INSTRUCTIONS.md')
  $conflicts = New-Object Text.StringBuilder
  $conflictMd = New-Object Text.StringBuilder
  foreach ($rel in $script:lConflicts) {
    $new = Join-Rel $pendingDir "$rel.new"
    New-ParentDir $new
    [IO.File]::WriteAllBytes($new, (Get-NormBytes (Join-Rel $templateDir $rel)))
    $base = Get-ManifestHash "ai-development/$rel"
    $baseMd = 'not available (merge without a base)'
    if ($base -and (Restore-Base $rel $base (Join-Rel $pendingDir "$rel.base"))) { $baseMd = "``.bootstrap-update/$rel.base``" }
    [void]$conflicts.Append("$(Get-Hash (Join-Rel $aiDir $rel))  ai-development/$rel`n")
    [void]$conflictMd.Append("- ``$rel`` $emDash new: ``.bootstrap-update/$rel.new``; base: $baseMd`n")
  }
  [IO.File]::WriteAllText((Join-Path $pendingDir 'conflicts'), $conflicts.ToString(), $utf8)
  $shown = if ($installedVersion) { $installedVersion } else { 'unknown' }
  $lines = New-Object Collections.Generic.List[string]
  $lines.Add('# Pending bootstrap update'); $lines.Add('')
  $lines.Add("Template version: $availableVersion (installed: $shown)")
  $lines.Add('How to finish: [INSTRUCTIONS.md](INSTRUCTIONS.md)'); $lines.Add('')
  $lines.Add('## Conflicts to merge'); $lines.Add('')
  if ($conflictMd.Length -gt 0) { $lines.Add($conflictMd.ToString().TrimEnd("`n")) } else { $lines.Add('None.') }
  $lines.Add(''); $lines.Add('## Sections to add'); $lines.Add('')
  if ($script:lMigrations.Count -gt 0) { foreach ($m in $script:lMigrations) { $lines.Add("- $m") } } else { $lines.Add('None.') }
  $lines.Add(''); $lines.Add('## Re-run when done'); $lines.Add('')
  $lines.Add('```')
  $lines.Add("& `"$(Join-Path $PSScriptRoot 'bootstrap.ps1')`" -Update `"$Target`"")
  $lines.Add('```')
  [IO.File]::WriteAllText((Join-Path $pendingDir 'PENDING.md'), (($lines -join "`n") + "`n"), $utf8)
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
  Write-Section 'Conflicts handed to the agent (customized in the project and changed in the template):' $script:lConflicts
  if ($script:lKept.Count -gt 0) { Write-Section 'Customized framework files kept (template unchanged since your copy):' $script:lKept }
  if ($script:lMerged.Count -gt 0) { Write-Section "Merged by the agent (now based on $availableVersion):" $script:lMerged }
  Write-Host "Unchanged framework files: $script:nUnchanged"
  Write-Host ''

  Find-Migrations
  if ($script:lMigrations.Count -gt 0) {
    Write-Host 'MIGRATION REQUIRED (non-blocking; this script never edits project files, the agent adds them):'
    foreach ($m in $script:lMigrations) { Write-Host "  - $m" }
    Write-Host ''
  }

  if ($script:lConflicts.Count -gt 0) {
    Write-Host "Bootstrap version NOT updated (still $shownInstalled): $($script:lConflicts.Count) conflict(s) handed to the agent."
    Write-Host 'To take the template version instead, discarding those customizations (old file kept as <file>.bak): -Update -Force.'
  } elseif ($DryRun) {
    Write-Host "Bootstrap version would be updated to: $availableVersion"
  } else {
    Copy-Item -LiteralPath $templateVersionPath -Destination $installedPath -Force
    Write-Host "Bootstrap version updated to: $availableVersion"
  }
  if (-not $DryRun) {
    Write-Pending $installedVersion
    # Refresh the baseline in every case: each entry is the template version the file is based on.
    Write-Manifest
  }
  Write-Host ''
  if ($script:lConflicts.Count -gt 0 -or $script:lMigrations.Count -gt 0) {
    Write-Host 'AGENT FOLLOW-UP (nothing to do by hand). Open the workspace in your agent and ask:'
    Write-Host '  Finish the bootstrap update following ai-development/.bootstrap-update/INSTRUCTIONS.md.'
    if ($DryRun) { Write-Host '  (dry run: ai-development/.bootstrap-update/ would be written)' }
    Write-Host ''
  }
  Write-Host "Review the changes and commit them in the project's ai-development repository."
}

if ($Update) { Invoke-Update } else { Invoke-Install }
