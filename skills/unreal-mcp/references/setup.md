# First-Time MCP Server Setup

Read this when the `unreal-mcp` MCP server is not yet wired up to a project. Skip otherwise — once the editor regenerates `.mcp.json` on launch, the server is self-configuring.

The goal is three things:
1. Enable the `ModelContextProtocol` plugin in the project.
2. Make the editor auto-start the MCP server on launch.
3. Generate the `.mcp.json` Claude Code reads to connect.

Walk the user through them in order. Do not skip the user's `.uproject` edit silently — confirm the file path first.

## 1. Enable the plugin in the `.uproject`

Open the project's `.uproject` file. In the `Plugins` array, ensure an entry like:

```json
{
  "Name": "ModelContextProtocol",
  "Enabled": true
}
```

If the array doesn't exist, create it. If a `ModelContextProtocol` entry exists with `"Enabled": false`, flip it to `true`.

## 2. Enable auto-start

The default behavior is to start the MCP server only when the user opens **Tools > Claude Code** in the editor. To start it automatically on every editor launch, write the following to `Config/DefaultEditorPerProjectUserSettings.ini` in the project:

```ini
[/Script/ModelContextProtocolEngine.ModelContextProtocolSettings]
bAutoStartServer=True
```

Optional overrides if the defaults conflict with another local service:

```ini
ServerPortNumber=8000
ServerUrlPath=/mcp
```

A command-line alternative also works: pass `-StartModelContextProtocolServer` (and optionally `-ModelContextProtocolPort=<port>`) to the editor. Prefer the `.ini` because it's persistent.

## 3. Generate `.mcp.json`

The editor regenerates `.mcp.json` on startup from the live port and URL settings. **Prefer launching the editor and letting it write the file** — that way the file always reflects the runtime config.

Only write `.mcp.json` directly when the editor is not about to run (for example, when scripting a fresh-project bootstrap before the user opens the editor for the first time). Place it next to the `.uproject`:

```json
{
  "mcpServers": {
    "unreal-mcp": {
      "type": "http",
      "url": "http://127.0.0.1:8000/mcp"
    }
  }
}
```

Adjust the URL if the port or path was overridden in step 2.

If the user already has the editor open and just needs the file regenerated, run the console command `ModelContextProtocol.GenerateClientConfig ClaudeCode` from inside the editor (or `All` to write configs for every supported client: `ClaudeCode`, `Cursor`, `VSCode`, `Gemini`, `Codex`).

## Verifying

After the editor is running with the plugin enabled and auto-start on:

- The Output Log shows MCP server startup messages.
- `list_toolsets` (the deferred-loading discovery tool) returns successfully.
- `/mcp` in Claude Code lists `unreal-mcp` as connected.

If any of these fail, see `operations.md` for recovery commands.
