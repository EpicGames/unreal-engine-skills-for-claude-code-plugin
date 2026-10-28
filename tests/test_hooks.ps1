<#
.SYNOPSIS
Unit tests for unreal-context.ps1 hook
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$HookPs1 = Join-Path $RepoRoot "hooks" "unreal-context.ps1"

$TestTmp = Join-Path ([System.IO.Path]::GetTempPath()) ("ue-hook-tests-" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TestTmp | Out-Null

$passed = 0
$failed = 0

function Assert-OutputContains {
    param([string]$Desc, [string]$Haystack, [string]$Needle)
    if ($Haystack -like "*$Needle*") {
        Write-Host "  PASS: $Desc"
        $script:passed++
    } else {
        Write-Host "  FAIL: $Desc (expected '$Needle' in '$Haystack')"
        $script:failed++
    }
}

function Assert-Empty {
    param([string]$Desc, [string]$Haystack)
    if ([string]::IsNullOrWhiteSpace($Haystack)) {
        Write-Host "  PASS: $Desc"
        $script:passed++
    } else {
        Write-Host "  FAIL: $Desc (expected empty, got '$Haystack')"
        $script:failed++
    }
}

try {
    Write-Host "=== Running PowerShell Hook Tests ==="

    # Test 1: Non-Unreal directory
    Write-Host "[1] Non-Unreal directory"
    $nonUe = Join-Path $TestTmp "non_ue"
    New-Item -ItemType Directory -Path $nonUe | Out-Null
    $out1 = Push-Location $nonUe; try { & $HookPs1 } finally { Pop-Location }
    Assert-Empty "Produces no output when not in Unreal project" "$out1"

    # Test 2: Game project root without .mcp.json
    Write-Host "[2] Game project root without .mcp.json"
    $gameDir = Join-Path $TestTmp "MyGame"
    New-Item -ItemType Directory -Path $gameDir | Out-Null
    New-Item -ItemType File -Path (Join-Path $gameDir "MyGame.uproject") | Out-Null
    $out2 = Push-Location $gameDir; try { & $HookPs1 } finally { Pop-Location }
    $json2 = $out2 | ConvertFrom-Json
    Assert-OutputContains "Valid JSON contains project name" $json2.hookSpecificOutput.additionalContext "The project is \`MyGame.uproject\`"
    Assert-OutputContains "Reports missing .mcp.json" $json2.hookSpecificOutput.additionalContext "No \`.mcp.json\` is present"

    # Test 3: Game project root with .mcp.json
    Write-Host "[3] Game project root with .mcp.json"
    New-Item -ItemType File -Path (Join-Path $gameDir ".mcp.json") | Out-Null
    $out3 = Push-Location $gameDir; try { & $HookPs1 } finally { Pop-Location }
    $json3 = $out3 | ConvertFrom-Json
    Assert-OutputContains "Reports .mcp.json present" $json3.hookSpecificOutput.additionalContext "An \`.mcp.json\` is already present"

    # Test 4: Subdirectory walk-up
    Write-Host "[4] Subdirectory walk-up"
    $subDir = Join-Path $gameDir "Source\MyGame\Private"
    New-Item -ItemType Directory -Path $subDir | Out-Null
    $out4 = Push-Location $subDir; try { & $HookPs1 } finally { Pop-Location }
    $json4 = $out4 | ConvertFrom-Json
    Assert-OutputContains "Detects project when running from subfolder" $json4.hookSpecificOutput.additionalContext "The project is \`MyGame.uproject\`"

    # Test 5: Engine source tree
    Write-Host "[5] Engine source tree"
    $engineDir = Join-Path $TestTmp "UnrealEngine"
    New-Item -ItemType Directory -Path (Join-Path $engineDir "Engine") | Out-Null
    New-Item -ItemType File -Path (Join-Path $engineDir "GenerateProjectFiles.bat") | Out-Null
    $out5 = Push-Location $engineDir; try { & $HookPs1 } finally { Pop-Location }
    $json5 = $out5 | ConvertFrom-Json
    Assert-OutputContains "Detects engine source tree" $json5.hookSpecificOutput.additionalContext "It is an Engine source tree."

    Write-Host "`nTests completed: $passed passed, $failed failed."
    if ($failed -gt 0) {
        exit 1
    }
} finally {
    Remove-Item -Recurse -Force $TestTmp -ErrorAction SilentlyContinue
}
