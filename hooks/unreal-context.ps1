<#
.SYNOPSIS
SessionStart hook for Unreal Engine projects in Claude Code.
Mirrors hooks/unreal-context.sh for native Windows PowerShell users.

.DESCRIPTION
Injects a short note identifying the session as operating inside an Unreal Engine project.
Walks upward from current directory so sessions started in subdirectories
(Source/, Content/, Plugins/, ...) are still detected.
Opt-in debug logging: set $env:CLAUDE_UE_HOOK_DEBUG to any non-empty value.
#>

[CmdletBinding()]
param()

function Write-DebugLog {
    param([string]$Message)
    if ($env:CLAUDE_UE_HOOK_DEBUG) {
        [Console]::Error.WriteLine("unreal-context.ps1: $Message")
    }
}

function Test-ProjectRoot {
    param([string]$Directory)

    if ((Test-Path (Join-Path $Directory "GenerateProjectFiles.bat")) -or
        (Test-Path (Join-Path $Directory "GenerateProjectFiles.sh")) -or
        (Test-Path (Join-Path $Directory "GenerateProjectFiles.command"))) {
        return $true
    }

    $uprojects = Get-ChildItem -Path $Directory -Filter "*.uproject" -File -ErrorAction SilentlyContinue
    if ($uprojects -and $uprojects.Count -gt 0) {
        return $true
    }

    return $false
}

function Find-ProjectRoot {
    param([string]$StartDirectory)

    $current = (Get-Item -LiteralPath $StartDirectory).FullName
    while ($current) {
        if (Test-ProjectRoot -Directory $current) {
            return $current
        }
        $parent = Split-Path -Path $current -Parent
        if (-not $parent -or $parent -eq $current) {
            break
        }
        $current = $parent
    }
    return $null
}

$currentLocation = (Get-Location).ProviderPath
$projectRoot = Find-ProjectRoot -StartDirectory $currentLocation

if (-not $projectRoot) {
    Write-DebugLog "no Unreal Engine project marker found walking up from $currentLocation"
    exit 0
}

$projectType = "game"
if (Test-Path (Join-Path $projectRoot "Engine") -PathType Container) {
    $projectType = "engine"
}

$uprojectFilename = ""
$uprojectFiles = Get-ChildItem -Path $projectRoot -Filter "*.uproject" -File -ErrorAction SilentlyContinue
if ($uprojectFiles -and $uprojectFiles.Count -gt 0) {
    $uprojectFilename = $uprojectFiles[0].Name
}

$mcpConfigPresent = Test-Path (Join-Path $projectRoot ".mcp.json") -PathType Leaf

Write-DebugLog "project root: $projectRoot (type=$projectType, uproject=$uprojectFilename, mcp_json=$mcpConfigPresent)"

$context = "This working directory is an Unreal Engine project."
if ($projectType -eq "engine") {
    $context += " It is an Engine source tree."
} elseif ($uprojectFilename) {
    $context += " The project is \`$uprojectFilename\`."
}

$context += " Prefer Unreal Engine conventions (C++/UObject patterns, Slate, UHT reflection) when suggesting code."
$context += " Use the \`unreal-mcp\` skill for tasks that involve driving the Unreal Editor via MCP."

if ($mcpConfigPresent) {
    $context += " An \`.mcp.json\` is already present at the project root."
} else {
    $context += " No \`.mcp.json\` is present at the project root yet. Run \`ModelContextProtocol.GenerateClientConfig ClaudeCode\` in the editor console to generate one."
}

$payload = @{
    hookSpecificOutput = @{
        hookEventName     = "SessionStart"
        additionalContext = $context
    }
}

Write-Output ($payload | ConvertTo-Json -Compress)
