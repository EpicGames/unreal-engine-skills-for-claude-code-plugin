#!/usr/bin/env bash
# SessionStart hook: inject a short note identifying the session as operating
# inside an Unreal Engine project. Walks upward from $PWD so sessions started
# in subdirectories (Source/, Content/, Plugins/, ...) are still detected.
# Opt-in debug logging: set CLAUDE_UE_HOOK_DEBUG to any non-empty value.

debug() {
  if [ -n "$CLAUDE_UE_HOOK_DEBUG" ]; then
    echo "unreal-context.sh: $*" >&2
  fi
}

is_project_root() {
  # Reliable top-level markers only. A bare `Engine` directory is NOT a marker:
  # the Unreal source tree contains an `Engine` module at
  # `Engine/Source/Runtime/Engine`, so walking up from a Runtime module would
  # otherwise short-circuit at `Source/Runtime` and mis-identify it as the root.
  local directory="$1"
  [ -f "$directory/GenerateProjectFiles.bat" ] && return 0
  [ -f "$directory/GenerateProjectFiles.sh" ] && return 0
  [ -f "$directory/GenerateProjectFiles.command" ] && return 0
  for candidate in "$directory"/*.uproject; do
    [ -e "$candidate" ] && return 0
  done
  return 1
}

find_project_root() {
  local directory="$1"
  while [ -n "$directory" ]; do
    if is_project_root "$directory"; then
      echo "$directory"
      return 0
    fi
    local parent
    parent="$(dirname "$directory")"
    [ "$parent" = "$directory" ] && break
    directory="$parent"
  done
  return 1
}

project_root="$(find_project_root "$PWD")"
if [ -z "$project_root" ]; then
  debug "no Unreal Engine project marker found walking up from $PWD"
  exit 0
fi

project_type="game"
[ -d "$project_root/Engine" ] && project_type="engine"

uproject_filename=""
for candidate in "$project_root"/*.uproject; do
  if [ -e "$candidate" ]; then
    uproject_filename="$(basename "$candidate")"
    break
  fi
done

mcp_config_present="false"
[ -f "$project_root/.mcp.json" ] && mcp_config_present="true"

debug "project root: $project_root (type=$project_type, uproject=$uproject_filename, mcp_json=$mcp_config_present)"

# Build the injected context. Keep it short; append only signals we actually detected.
context="This working directory is an Unreal Engine project."
if [ "$project_type" = "engine" ]; then
  context="$context It is an Engine source tree."
elif [ -n "$uproject_filename" ]; then
  context="$context The project is \`$uproject_filename\`."
fi
context="$context Prefer Unreal Engine conventions (C++/UObject patterns, Slate, UHT reflection) when suggesting code."
context="$context Use the \`unreal-mcp\` skill for tasks that involve driving the Unreal Editor via MCP."
if [ "$mcp_config_present" = "true" ]; then
  context="$context An \`.mcp.json\` is already present at the project root."
else
  context="$context No \`.mcp.json\` is present at the project root yet; the editor will generate one at startup."
fi

# JSON-escape the dynamic content: backslash first, then double quote.
escaped_context="${context//\\/\\\\}"
escaped_context="${escaped_context//\"/\\\"}"

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$escaped_context"
