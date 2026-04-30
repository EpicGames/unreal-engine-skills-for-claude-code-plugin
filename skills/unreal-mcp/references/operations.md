# Operations: Console Commands, CVars, Recovery

Read this when something is misbehaving with the MCP server — tools missing, port collision, stale tool registry — or when you need a non-default configuration.

## Console commands

Run these from the Unreal Editor console (`~`).

| Command                                              | Use it for                                                                              |
|------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `ModelContextProtocol.StartServer [port]`            | Start the MCP server. Pass a port to override the default (e.g. when 8000 is in use).   |
| `ModelContextProtocol.StopServer`                    | Stop the server. Useful if the registry is in a bad state and you want a clean restart. |
| `ModelContextProtocol.RefreshTools`                  | Re-register every toolset. Run this after the user enables a new toolset plugin.        |
| `ModelContextProtocol.GenerateClientConfig <client>` | Regenerate `.mcp.json` (and equivalents). Args: `ClaudeCode`, `Cursor`, `VSCode`, `Gemini`, `Codex`, `All`. |

## Console variables

| CVar                                       | Default | What it does                                                                                                   |
|--------------------------------------------|---------|----------------------------------------------------------------------------------------------------------------|
| `ModelContextProtocol.DeferredToolLoading` | `true`  | When on, `tools/list` returns only `list_toolsets`, `describe_toolset`, `load_toolset`. Toolsets load on demand to keep your context window small. Turn it off only if you specifically want every tool's schema visible upfront. |

## Troubleshooting matrix

| Symptom                                                     | What to do                                                                                                                                                                                                |
|-------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `unreal-mcp` not in `/mcp`, or `list_toolsets` errors       | The editor isn't running, or the MCP server isn't started. Ask the user to launch the editor and open **Tools > Claude Code**. Then check the Output Log for startup errors.                              |
| Editor logs "Failed to listen on port"                      | Another process holds the default port. Ask the user to run `ModelContextProtocol.StartServer <other-port>` and update `.mcp.json` accordingly (or use auto-regenerate).                                  |
| A toolset you expect (e.g. `NiagaraTools`) is missing       | Run `ModelContextProtocol.RefreshTools`. If still missing, the toolset's plugin may not be enabled in the `.uproject`. Check there.                                                                       |
| Tool calls hang or return errors                            | Editor may be busy compiling, loading a level, or in PIE. Wait and retry. For long compiles, prefer `LiveCodingToolset.CompileLiveCoding` — it returns when the compile actually finishes.                |
| `AIAssistantToolset.GetDockedContext` returns empty         | The Claude Code tab must be docked inside an asset editor (Blueprint, Material, etc.) to provide docked context. If undocked, that tool has nothing to report.                                            |
| Sequential tool calls collide                               | Tool calls execute on the game thread. Don't issue them in parallel, even when they look independent. Serialize.                                                                                          |
