<#
.SYNOPSIS
    Creates Codex-compatible project structure from canonical/ source.

.DESCRIPTION
    Mapping:
      canonical/CLAUDE.md       -> .codex/AGENTS.md
      canonical/PLAN.md         -> .codex/PLAN.md
      canonical/skills/         -> .agents/skills/
      canonical/commands/       -> skipped (no Codex equivalent)
      canonical/hooks/          -> skipped (no Codex equivalent)
      canonical/settings.*.json -> skipped (Codex uses .codex/config.toml)
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$sourceDir = Join-Path $repoRoot 'canonical'

function Write-Log {
    param([string]$Message)
    Write-Host $Message
}

function Get-RewrittenContent {
    param([string]$Path)

    $content = [System.IO.File]::ReadAllText($Path)
    $content = $content.Replace('.claude', '.codex')
    $content = $content.Replace('CLAUDE.md', 'AGENTS.md')
    $content = $content.Replace('claude', 'codex')
    $content = $content.Replace('Claude', 'Codex')

    if ([System.IO.Path]::GetFileName($Path) -ceq 'SKILL.md') {
        $content = ConvertTo-YamlSafeSkillFrontmatter -Content $content
    }

    return $content
}

function ConvertTo-YamlSafeSkillFrontmatter {
    param([string]$Content)

    if (-not $Content.StartsWith("---")) {
        return $Content
    }

    $newline = if ($Content.Contains("`r`n")) { "`r`n" } else { "`n" }
    $hasTrailingNewline = $Content.EndsWith("`n")
    $lines = $Content -split '\r?\n', -1

    if ($lines.Length -lt 3 -or $lines[0] -ne '---') {
        return $Content
    }

    $endIndex = -1
    for ($i = 1; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -eq '---') {
            $endIndex = $i
            break
        }
    }

    if ($endIndex -lt 0) {
        return $Content
    }

    for ($i = 1; $i -lt $endIndex; $i++) {
        if ($lines[$i] -match '^(description|argument-hint):\s*(.*)$') {
            $key = $matches[1]
            $value = $matches[2]

            if (-not ($value.StartsWith('"') -or $value.StartsWith("'"))) {
                $escapedValue = $value.Replace('\', '\\').Replace('"', '\"')
                $lines[$i] = "${key}: `"$escapedValue`""
            }
        }
    }

    $rewritten = [string]::Join($newline, $lines)
    if ($hasTrailingNewline -and -not $rewritten.EndsWith($newline)) {
        $rewritten += $newline
    }

    return $rewritten
}

function Test-IsWindowsPlatform {
    $platform = [Environment]::OSVersion.Platform
    return (
        $platform -eq [PlatformID]::Win32NT -or
        $platform -eq [PlatformID]::Win32S -or
        $platform -eq [PlatformID]::Win32Windows -or
        $platform -eq [PlatformID]::WinCE
    )
}

function Set-ExecutableModeLikeSource {
    param(
        [string]$Source,
        [string]$Target
    )

    # File mode bits only relevant on non-Windows platforms running PowerShell Core.
    if (Test-IsWindowsPlatform) { return }

    try {
        $sourceItem = Get-Item -LiteralPath $Source
        $sourceMode = $sourceItem.UnixFileMode
        $hasAnyExecuteBit = (
            ($sourceMode -band [System.IO.UnixFileMode]::UserExecute) -ne 0 -or
            ($sourceMode -band [System.IO.UnixFileMode]::GroupExecute) -ne 0 -or
            ($sourceMode -band [System.IO.UnixFileMode]::OtherExecute) -ne 0
        )

        $targetMode = if ($hasAnyExecuteBit) {
            [System.IO.UnixFileMode]::UserRead -bor
            [System.IO.UnixFileMode]::UserWrite -bor
            [System.IO.UnixFileMode]::UserExecute -bor
            [System.IO.UnixFileMode]::GroupRead -bor
            [System.IO.UnixFileMode]::GroupExecute -bor
            [System.IO.UnixFileMode]::OtherRead -bor
            [System.IO.UnixFileMode]::OtherExecute
        } else {
            [System.IO.UnixFileMode]::UserRead -bor
            [System.IO.UnixFileMode]::UserWrite -bor
            [System.IO.UnixFileMode]::GroupRead -bor
            [System.IO.UnixFileMode]::OtherRead
        }

        [System.IO.File]::SetUnixFileMode($Target, $targetMode)
    } catch {
        # Ignore mode-setting failures so content mirroring still succeeds.
    }
}

function Copy-Rewritten {
    param(
        [string]$Source,
        [string]$Target,
        [string]$DisplayTarget
    )

    $tmpFile = [System.IO.Path]::GetTempFileName()

    try {
        $content = Get-RewrittenContent -Path $Source
        [System.IO.File]::WriteAllText($tmpFile, $content)

        # Skip if target exists and content is identical.
        if ((Test-Path -LiteralPath $Target -PathType Leaf) -and
            ([System.IO.File]::ReadAllText($tmpFile) -ceq [System.IO.File]::ReadAllText($Target))) {
            Write-Log "Unchanged $DisplayTarget"
            return
        }

        $verb = if (Test-Path -LiteralPath $Target -PathType Leaf) { 'Updating' } else { 'Copying' }

        # Build a repo-relative display path for the source.
        $relSource = $Source.Substring($repoRoot.Length + 1).Replace('\', '/')
        Write-Log "$verb $relSource -> $DisplayTarget"

        # Ensure parent directory exists.
        $parentDir = Split-Path -Parent $Target
        if (-not (Test-Path -LiteralPath $parentDir -PathType Container)) {
            [void](New-Item -ItemType Directory -Path $parentDir -Force)
        }

        Move-Item -LiteralPath $tmpFile -Destination $Target -Force
        $tmpFile = $null
        Set-ExecutableModeLikeSource -Source $Source -Target $Target
    } finally {
        if ($tmpFile -and (Test-Path -LiteralPath $tmpFile)) {
            Remove-Item -LiteralPath $tmpFile -Force
        }
    }
}

# --- Main ---

if (-not (Test-Path -LiteralPath $sourceDir -PathType Container)) {
    Write-Error "Error: source directory not found: $sourceDir"
}

Write-Log 'Creating Codex project structure from canonical/'

# 1. CLAUDE.md -> .codex/AGENTS.md
$codexDir = Join-Path $repoRoot '.codex'
if (-not (Test-Path -LiteralPath $codexDir -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $codexDir -Force)
}

$claudeMd = Join-Path $sourceDir 'CLAUDE.md'
if (Test-Path -LiteralPath $claudeMd -PathType Leaf) {
    Copy-Rewritten -Source $claudeMd -Target (Join-Path $codexDir 'AGENTS.md') -DisplayTarget '.codex/AGENTS.md'
}

# 2. Skills -> .agents/skills/ (each skill is a subdirectory with SKILL.md)
$skillsDir = Join-Path $sourceDir 'skills'
$agentsRoot = Join-Path $repoRoot '.agents'
$agentsDir = Join-Path $agentsRoot 'skills'

if (Test-Path -LiteralPath $skillsDir -PathType Container) {
    if (-not (Test-Path -LiteralPath $agentsDir -PathType Container)) {
        [void](New-Item -ItemType Directory -Path $agentsDir -Force)
    }
    Write-Log 'Creating .agents/skills/'

    # Walk each skill subdirectory.
    $skillDirs = Get-ChildItem -LiteralPath $skillsDir -Directory | Sort-Object Name
    foreach ($skillDir in $skillDirs) {
        $skillName = $skillDir.Name
        $targetSkillDir = Join-Path $agentsDir $skillName

        if (-not (Test-Path -LiteralPath $targetSkillDir -PathType Container)) {
            [void](New-Item -ItemType Directory -Path $targetSkillDir -Force)
        }

        # Copy all files within the skill directory.
        $skillFiles = Get-ChildItem -LiteralPath $skillDir.FullName -File -Recurse | Sort-Object FullName
        foreach ($skillFile in $skillFiles) {
            $relFile = $skillFile.FullName.Substring($skillDir.FullName.Length + 1).Replace('\', '/')
            Copy-Rewritten `
                -Source $skillFile.FullName `
                -Target (Join-Path $targetSkillDir $relFile) `
                -DisplayTarget ".agents/skills/$skillName/$relFile"
        }
    }
}

# 3. Log skipped directories
foreach ($skipped in @('commands', 'hooks')) {
    $skippedPath = Join-Path $sourceDir $skipped
    if (Test-Path -LiteralPath $skippedPath -PathType Container) {
        Write-Log "Skipping canonical/$skipped/ (no Codex equivalent)"
    }
}

$settingsFiles = Get-ChildItem -LiteralPath $sourceDir -Filter 'settings*.json' -ErrorAction SilentlyContinue
if ($settingsFiles) {
    Write-Log 'Skipping canonical/settings*.json (Codex uses .codex/config.toml)'
}

# 4. Copy PLAN.md if present -> .codex/PLAN.md
$planMd = Join-Path $sourceDir 'PLAN.md'
if (Test-Path -LiteralPath $planMd -PathType Leaf) {
    Copy-Rewritten -Source $planMd -Target (Join-Path $codexDir 'PLAN.md') -DisplayTarget '.codex/PLAN.md'
}

Write-Log 'Done.'
