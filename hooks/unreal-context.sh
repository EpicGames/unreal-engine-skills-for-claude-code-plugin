#!/usr/bin/env bash
# Gate: only inject context when the session cwd looks like an Unreal project.
if [ ! -d "Engine" ] && [ ! -f "GenerateProjectFiles.bat" ] && [ ! -f "GenerateProjectFiles.sh" ] && [ ! -f "GenerateProjectFiles.command" ] && ! compgen -G "*.uproject" > /dev/null; then
  exit 0
fi

cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This working directory is an Unreal Engine project. Prefer Unreal Engine conventions (C++/UObject patterns, Slate, UHT reflection) when suggesting code. Use the `unreal-mcp` skill for tasks that involve driving the Unreal Editor via MCP."}}
EOF
