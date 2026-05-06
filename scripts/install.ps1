[CmdletBinding()]
param(
    [switch]$Claude,
    [switch]$Codex,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $scriptPath
$repoRoot = Split-Path -Parent $scriptDir
$homeDir = [Environment]::GetFolderPath('UserProfile')

function Show-Usage {
    $scriptName = Split-Path -Leaf $scriptPath
    @"
Usage: $scriptName [-Claude] [-Codex] [-DryRun]

Copy agent config directories from this repo to your home directory.

Flags:
  -Claude   Copy canonical/ to ~/.claude/
  -Codex    Copy .codex/ to ~/.codex/ and .agents/ to ~/.agents/
  -DryRun   Show what would be copied without doing it

At least one of -Claude or -Codex is required.
Both can be specified together.
"@ | Write-Host
}

function Get-RelativePathCompat {
    param(
        [string]$BasePath,
        [string]$TargetPath
    )

    $pathType = [System.IO.Path]
    $bindingFlags = [System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::Static
    $method = $pathType.GetMethod('GetRelativePath', $bindingFlags, $null, [Type[]]@([string], [string]), $null)
    if ($method) {
        return $method.Invoke($null, @($BasePath, $TargetPath))
    }

    $baseFullPath = [System.IO.Path]::GetFullPath($BasePath)
    $targetFullPath = [System.IO.Path]::GetFullPath($TargetPath)

    if (-not $baseFullPath.EndsWith([System.IO.Path]::DirectorySeparatorChar) -and
        -not $baseFullPath.EndsWith([System.IO.Path]::AltDirectorySeparatorChar)) {
        $baseFullPath = $baseFullPath + [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = [System.Uri]::new($baseFullPath)
    $targetUri = [System.Uri]::new($targetFullPath)

    if ($baseUri.Scheme -ne $targetUri.Scheme) {
        return $targetFullPath
    }

    $relativeUri = $baseUri.MakeRelativeUri($targetUri)
    $relativePath = [System.Uri]::UnescapeDataString($relativeUri.ToString())
    return $relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Convert-BytesToHex {
    param([byte[]]$Bytes)

    $convertType = [Convert]
    $bindingFlags = [System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::Static
    $method = $convertType.GetMethod('ToHexString', $bindingFlags, $null, [Type[]]@([byte[]]), $null)
    if ($method) {
        return $method.Invoke($null, [object[]]@([byte[]]$Bytes))
    }

    return [BitConverter]::ToString($Bytes).Replace('-', '')
}

function Get-FileSha256Hex {
    param([string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $sha256Type = [System.Security.Cryptography.SHA256]
    $bindingFlags = [System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::Static
    $method = $sha256Type.GetMethod('HashData', $bindingFlags, $null, [Type[]]@([byte[]]), $null)
    if ($method) {
        return Convert-BytesToHex -Bytes $method.Invoke($null, [object[]]@([byte[]]$bytes))
    }

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        return Convert-BytesToHex -Bytes $sha256.ComputeHash($bytes)
    } finally {
        $sha256.Dispose()
    }
}

function Copy-MergeDirectory {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Destination -PathType Container)) {
        [void](New-Item -ItemType Directory -Path $Destination -Force)
    }

    $entries = Get-ChildItem -LiteralPath $Source -Force -Recurse | Sort-Object FullName
    foreach ($entry in $entries) {
        $relativePath = Get-RelativePathCompat -BasePath $Source -TargetPath $entry.FullName
        $targetPath = Join-Path $Destination $relativePath

        if ($entry.PSIsContainer) {
            if (-not (Test-Path -LiteralPath $targetPath -PathType Container)) {
                [void](New-Item -ItemType Directory -Path $targetPath -Force)
                Write-Host "cd+++++++++ $relativePath/"
            }

            continue
        }

        $parent = Split-Path -Parent $targetPath
        if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
            [void](New-Item -ItemType Directory -Path $parent -Force)
        }

        $targetExists = Test-Path -LiteralPath $targetPath -PathType Leaf
        $copyNeeded = $true
        if ($targetExists) {
            $sourceItem = Get-Item -LiteralPath $entry.FullName
            $targetItem = Get-Item -LiteralPath $targetPath
            $copyNeeded = -not (
                $sourceItem.Length -eq $targetItem.Length -and
                (Get-FileSha256Hex -Path $entry.FullName) -eq
                (Get-FileSha256Hex -Path $targetPath)
            )
        }

        if ($copyNeeded) {
            Copy-Item -LiteralPath $entry.FullName -Destination $targetPath -Force
            $status = if ($targetExists) { '>f.st......' } else { '>f+++++++++' }
            Write-Host "$status $relativePath"
        }
    }
}

function Copy-AgentDirectory {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        Write-Error "Error: source directory not found: $Source`n  Run scripts/create-codex-dir.ps1 first if installing -Codex"
    }

    Write-Host "Installing $Label`: $Source -> $Destination"

    if ($DryRun) {
        Write-Host "  [dry-run] would copy $Source/ to $Destination/"
        return
    }

    Copy-MergeDirectory -Source $Source -Destination $Destination
    Write-Host "Done: $Label installed to $Destination"
}

if (-not $Claude -and -not $Codex) {
    Write-Host 'Error: specify at least one of -Claude or -Codex' -ForegroundColor Red
    Show-Usage
    exit 1
}

if ($Claude) {
    Copy-AgentDirectory -Source (Join-Path $repoRoot 'canonical') -Destination (Join-Path $homeDir '.claude') -Label 'canonical -> ~/.claude'
}

if ($Codex) {
    Copy-AgentDirectory -Source (Join-Path $repoRoot '.codex') -Destination (Join-Path $homeDir '.codex') -Label '.codex'
    Copy-AgentDirectory -Source (Join-Path $repoRoot '.agents') -Destination (Join-Path $homeDir '.agents') -Label '.agents'
}

Write-Host ''
Write-Host 'Install complete.'
