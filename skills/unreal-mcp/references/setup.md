# First-Time MCP Server Setup

Read this when the `unreal-mcp` MCP server is not yet wired up to a project. Skip otherwise: once the three steps below are done (with auto-start enabled in step 2), the editor starts the server on every launch and the existing `.mcp.json` keeps working.

The goal is three things:
1. Enable the `ModelContextProtocol` plugin in the project.
2. Make the editor auto-start the MCP server on launch.
3. Generate the `.mcp.json` Claude Code reads to connect.

Walk the user through them in order. Do not skip the user's `.uproject` edit silently. Confirm the file path first.

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

The default is for the MCP server to stay stopped. To start it manually in a session, run `ModelContextProtocol.StartServer` from the editor console.

To start it automatically on every editor launch, add the snippet below to the per-user editor config file:

`<Project>/Saved/Config/<Platform>Editor/EditorPerProjectUserSettings.ini`

This is the file the editor writes when you toggle the setting in Editor Preferences. It is per-user and not source-controlled.

```ini
[/Script/ModelContextProtocolEngine.ModelContextProtocolSettings]
bAutoStartServer=True
```

Optional overrides if the defaults conflict with another local service:

```ini
ServerPortNumber=8000
ServerUrlPath=/mcp
```

A command-line alternative also works: pass `-ModelContextProtocolStartServer` (and optionally `-ModelContextProtocolPort=<port>`) to the editor. Prefer the `.ini` because it's persistent.

## 3. Generate `.mcp.json`

The editor does not write `.mcp.json` on its own. Either run a console command from inside the editor, or hand-write the file.

**From a running editor (preferred):** run `ModelContextProtocol.GenerateClientConfig ClaudeCode` in the console (or `All` to write configs for every supported client: `ClaudeCode`, `Cursor`, `VSCode`, `Gemini`, `Codex`). Re-running merges into the existing JSON, so it is safe after changing the port or URL. Codex is the exception: it uses TOML and the writer refuses to overwrite an existing `.codex/config.toml`. Edit that one by hand if it already exists.

The destination depends on the build kind:

- **Source build** (your repo contains `Engine/`): the file is written to the workspace root, alongside `Engine/`. Not next to the `.uproject`.
- **Installed/launcher build**: the file is written next to the `.uproject`.

**Without launching the editor first** (for example, scripting a fresh-project bootstrap), hand-write `.mcp.json` at the location matching your build kind above:

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

## Verifying

After the editor is running with the plugin enabled and auto-start on:

- The Output Log shows MCP server startup messages.
- `list_toolsets` (the deferred-loading discovery tool) returns successfully.
- `/mcp` in Claude Code lists `unreal-mcp` as connected.

If any of these fail, see `operations.md` for recovery commands.
