#!/usr/bin/env bash
# tests/test_hooks.sh - Unit test suite for unreal-context hook
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_SH="$REPO_ROOT/hooks/unreal-context.sh"

TEST_TMP="$(mktemp -d -t ue-hook-tests-XXXXXX)"
trap 'rm -rf "$TEST_TMP"' EXIT

passed=0
failed=0

assert_output_contains() {
  local desc="$1"
  local haystack="$2"
  local needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  PASS: $desc"
    passed=$((passed + 1))
  else
    echo "  FAIL: $desc (expected to contain '$needle')"
    echo "        Got: '$haystack'"
    failed=$((failed + 1))
  fi
}

assert_empty() {
  local desc="$1"
  local haystack="$2"
  if [[ -z "$haystack" ]]; then
    echo "  PASS: $desc"
    passed=$((passed + 1))
  else
    echo "  FAIL: $desc (expected empty, got '$haystack')"
    failed=$((failed + 1))
  fi
}

echo "=== Running Hook Tests ==="

# Test 1: Non-Unreal directory
echo "[1] Non-Unreal directory"
NON_UE="$TEST_TMP/non_ue"
mkdir -p "$NON_UE"
OUTPUT_1="$(cd "$NON_UE" && bash "$HOOK_SH")"
assert_empty "Produces no output when not in Unreal project" "$OUTPUT_1"

# Test 2: Game project root without .mcp.json
echo "[2] Game project root without .mcp.json"
GAME_DIR="$TEST_TMP/MyGame"
mkdir -p "$GAME_DIR"
touch "$GAME_DIR/MyGame.uproject"
OUTPUT_2="$(cd "$GAME_DIR" && bash "$HOOK_SH")"
echo "$OUTPUT_2" | python3 -m json.tool > /dev/null
assert_output_contains "Valid JSON contains project name" "$OUTPUT_2" "The project is \`MyGame.uproject\`"
assert_output_contains "Reports missing .mcp.json" "$OUTPUT_2" "No \`.mcp.json\` is present"

# Test 3: Game project root with .mcp.json
echo "[3] Game project root with .mcp.json"
touch "$GAME_DIR/.mcp.json"
OUTPUT_3="$(cd "$GAME_DIR" && bash "$HOOK_SH")"
echo "$OUTPUT_3" | python3 -m json.tool > /dev/null
assert_output_contains "Reports .mcp.json present" "$OUTPUT_3" "An \`.mcp.json\` is already present"

# Test 4: Subdirectory walk-up
echo "[4] Subdirectory walk-up"
SUBDIR="$GAME_DIR/Source/MyGame/Private"
mkdir -p "$SUBDIR"
OUTPUT_4="$(cd "$SUBDIR" && bash "$HOOK_SH")"
echo "$OUTPUT_4" | python3 -m json.tool > /dev/null
assert_output_contains "Detects project when running from subfolder" "$OUTPUT_4" "The project is \`MyGame.uproject\`"

# Test 5: Engine source tree
echo "[5] Engine source tree"
ENGINE_DIR="$TEST_TMP/UnrealEngine"
mkdir -p "$ENGINE_DIR/Engine"
touch "$ENGINE_DIR/GenerateProjectFiles.sh"
OUTPUT_5="$(cd "$ENGINE_DIR" && bash "$HOOK_SH")"
echo "$OUTPUT_5" | python3 -m json.tool > /dev/null
assert_output_contains "Detects engine source tree" "$OUTPUT_5" "It is an Engine source tree."

echo ""
echo "Tests completed: $passed passed, $failed failed."
if [ "$failed" -gt 0 ]; then
  exit 1
fi
