# Unreal Engine Skills for OpenCode

Control Unreal Editor from [OpenCode](https://opencode.ai) via MCP. This package is the OpenCode port of the
[Unreal Engine Skills for Claude Code](../README.md) plugin. It provides the same three skills, the same live-editor
MCP connection, and the same Unreal project context note.

## What it does

On load, the plugin:

- registers `unreal-mcp` as a remote MCP server at `http://127.0.0.1:8000/mcp` (unless you already configured
  `unreal-mcp` or `unreal-mcp-proxy`);
- registers the `unreal-mcp`, `create-toolset`, and `unreal-skill` skills from the repository's shared `skills/`
  directory;
- injects a short note into the system prompt when the working directory is inside an Unreal Engine project, so the
  model defaults to UE conventions and prefers the `unreal-mcp` skill.

The context note is implemented with an OpenCode session hook, so it has no bash dependency and works on native
Windows as well as macOS and Linux.

## Prerequisites

1. Unreal Editor with the **ModelContextProtocol** and **AllToolsets** plugins enabled in the `.uproject`.
   `AllToolsets` provides the tools; the server exposes none without it.
2. The editor running, with its MCP server started. Run `ModelContextProtocol.StartServer` in the console, or enable
   `bAutoStartServer` as described in [the setup reference](../skills/unreal-mcp/references/setup.md).
3. OpenCode V2.

No separate `.mcp.json` is needed. OpenCode reads its MCP configuration from `opencode.json(c)`; the plugin registers
the server at runtime. `ModelContextProtocol.GenerateClientConfig` does not support OpenCode.

## Install

Clone this repository somewhere stable, then add the `opencode/` directory to the `plugins` array in your OpenCode
configuration. Use the project configuration (`opencode.json` or `.opencode/opencode.json`) to enable it for one
project, or the global configuration (`~/.config/opencode/opencode.json`) to enable it everywhere.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/unreal-engine-skills-for-claude-code-plugin/opencode"]
}
```

Relative paths are resolved from the active OpenCode working directory, so a project-local checkout can use
`"./vendor/unreal-engine-skills-for-claude-code-plugin/opencode"`.

Restart OpenCode, or run `opencode reload`, after changing the configuration. OpenCode loads the plugin when it
starts a session for that directory; the skills become available once the plugin finishes loading.

### Configure the endpoint

The default endpoint is `http://127.0.0.1:8000/mcp`. If you changed the server port or URL path, pass the new URL as a
plugin option:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/absolute/path/to/unreal-engine-skills-for-claude-code-plugin/opencode",
      "options": {
        "url": "http://127.0.0.1:8001/mcp"
      }
    }
  ]
}
```

`UNREAL_MCP_URL` in the environment works too, and the `url` option takes precedence over it.

| Option       | Default                     | Purpose                                                        |
| ------------ | --------------------------- | -------------------------------------------------------------- |
| `url`        | `http://127.0.0.1:8000/mcp` | Remote MCP endpoint.                                            |
| `serverName` | `unreal-mcp`                | Name to register in OpenCode.                                   |
| `mcp`        | `true`                      | Set to `false` to manage MCP configuration yourself.            |
| `skills`     | `true`                      | Set to `false` to skip registering the three bundled skills.    |
| `context`    | `true`                      | Set to `false` to skip the Unreal project note.                 |

### Manual configuration

If you would rather not load the plugin, configure the same pieces by hand:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "unreal-mcp": {
        "type": "remote",
        "url": "http://127.0.0.1:8000/mcp",
        "oauth": false
      }
    }
  },
  "skills": ["/absolute/path/to/unreal-engine-skills-for-claude-code-plugin/skills"]
}
```

That gives you the MCP server and the skills, but not the project context note.

### Optional proxy

If your engine build includes `Engine/Plugins/Experimental/ModelContextProtocol/Extras/Proxy`, you can use
`unreal_mcp_proxy` to keep the client session open while the editor is stopped. The proxy installer rewrites
`.mcp.json` for the clients that `ModelContextProtocol.GenerateClientConfig` supports, which does not include
OpenCode.

Configure `unreal-mcp-proxy` as a local MCP server in `opencode.json(c)`, using the stdio command form documented in
the engine's `Extras/Proxy/README.md`. When the plugin sees `unreal-mcp-proxy` already configured, it leaves MCP
configuration alone and does not add a second direct connection.

## Verify

With the editor running and its MCP server started:

```sh
opencode mcp list
```

`unreal-mcp` should be listed as connected. A connected proxy does not prove that Unreal is reachable; confirm with a
read-only tool call.

In an OpenCode session, ask:

```text
List all actors in the current level.
```

The first load can take a few seconds while OpenCode starts the plugin. If the skills are not listed yet, run
`opencode reload` or restart OpenCode. You can also mention a skill directly, for example `@unreal-mcp`, to confirm
that it loads.

## Skills

- **`unreal-mcp`** - discover and dispatch Unreal toolsets through `list_toolsets`, `describe_toolset`, and
  `call_tool`; safety rules for live editor state.
- **`create-toolset`** - author or extend a C++ or Python toolset registered with `ToolsetRegistry`.
- **`unreal-skill`** - author or review an in-editor Unreal Agent Skill.

The skill bodies are the same files the Claude Code plugin uses under [`skills/`](../skills). Harness-specific setup
notes live in [`skills/unreal-mcp/references/setup.md`](../skills/unreal-mcp/references/setup.md).

## Differences from the Claude Code plugin

| Claude Code                                   | OpenCode                                                              |
| --------------------------------------------- | --------------------------------------------------------------------- |
| Installed from the plugin marketplace         | Added to `plugins` as a local package                                 |
| `.mcp.json` generated by the editor           | MCP server registered by the plugin, or set in `opencode.json(c)`     |
| `SessionStart` hook runs `unreal-context.sh`  | `session.hook("context")` runs in-process, no bash required           |
| `/mcp`                                        | `opencode mcp list` or `/mcps`                                        |
| `/plugin` lists installed plugins             | The `plugins` array in `opencode.json(c)`                             |

## Security

This plugin gives the model broad, live access to the running Unreal Editor. Treat that access the same way you would
treat running arbitrary code from an assistant, because in practice it is. In particular,
`ProgrammaticToolset.execute_tool_script` executes arbitrary Python inside the editor process.

Localhost is not a trust boundary: any process running as the same user can connect to the MCP server. Do not run the
server on shared or untrusted machines, and do not expose the port outside the loopback interface.

OpenCode permission rules decide whether an MCP tool call runs without asking. Keep destructive Unreal tools on
`ask` or `deny`, and prefer narrow prompts, read-heavy tasks, and a throwaway sandbox project when experimenting.
Save and commit (or shelve) before any long MCP-driven session so the working copy is recoverable.

See the [root README security section](../README.md#security) for the full threat model.

## Development

```sh
cd opencode
node --test test/
```

The tests cover project-root detection, skill discovery and frontmatter parsing, and the plugin's registration
behavior with a fake OpenCode context.

The package resolves skills in two places: the repository's `skills/` directory (used directly from a checkout) and
`opencode/skills/` (created by `scripts/sync-skills.mjs` for npm tarballs). `npm pack` runs the sync script
automatically. The generated copy is gitignored so the shared skill files stay the single source of truth.
