param([string]$Destination)
$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $PSScriptRoot '../docs/superpowers.lock.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $Destination) {
  $codexRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex' }
  $Destination = Join-Path $codexRoot 'skills'
}
$Destination = [IO.Path]::GetFullPath($Destination)
if ($manifest.revision -notmatch '^[a-f0-9]{40}$') { throw 'Expected a pinned Git commit.' }
foreach ($skill in $manifest.skills) {
  if ($skill -notmatch '^[a-z0-9-]+$') { throw 'Invalid skill name.' }
  if (Test-Path -LiteralPath (Join-Path $Destination $skill)) {
    throw "Skill already exists: $skill. Nothing copied; use a separate -Destination to review an update."
  }
}
$checkout = Join-Path ([IO.Path]::GetTempPath()) ('family-superpowers-' + [guid]::NewGuid().ToString('N'))
git clone --filter=blob:none --no-checkout $manifest.repository $checkout
if ($LASTEXITCODE -ne 0) { throw 'Unable to clone Superpowers.' }
git -C $checkout checkout --detach $manifest.revision
if ($LASTEXITCODE -ne 0) { throw 'Unable to check out the pinned revision.' }
foreach ($skill in $manifest.skills) {
  if (-not (Test-Path -LiteralPath (Join-Path $checkout "skills/$skill/SKILL.md"))) { throw "Missing upstream skill: $skill" }
}
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
foreach ($skill in $manifest.skills) {
  $target = Join-Path $Destination $skill
  if (Test-Path -LiteralPath $target) { throw "Destination appeared during setup: $target. Existing files preserved." }
  Copy-Item -LiteralPath (Join-Path $checkout "skills/$skill") -Destination $target -Recurse
  Write-Output "Installed $skill"
}
Write-Output "Installed pinned skills to $Destination. Open a new agent turn/session to discover them."
Write-Output "Review checkout retained at $checkout"
