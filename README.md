# Unreal Engine Skills for Claude Code

Control Unreal Editor directly from Claude Code via MCP. Hundreds of tools exposed via Unreal's ToolsetRegistry across 30+ toolsets: actors, blueprints, materials, Niagara, Control Rigs, Sequencer, State Trees, widgets, Gameplay Ability System, automation testing, and more.

## Contents

### Skills

- **`unreal-mcp`** (`skills/unreal-mcp`) - instructions and workflows for driving the Unreal Editor via MCP.

### Hooks

- **SessionStart** (`hooks/unreal-context.sh`) - injects a short note identifying the repo as an Unreal Engine project so Claude defaults to UE conventions (C++/`UObject`, Slate, UHT) and prefers the `unreal-mcp` skill. Runs on `startup`, `resume`, and `clear`.

## Prerequisites

1. **Unreal Editor** with the **ModelContextProtocol** plugin enabled
2. **Editor running** with the MCP server started - run `ModelContextProtocol.StartServer` in the console, or enable `bAutoStartServer` per `skills/unreal-mcp/references/setup.md`
3. **A bash shell on `PATH`** - required for the `SessionStart` hook (see **Platform Support**)

## Platform Support

Supported: **macOS**, **Linux**, and **Windows via Git Bash or WSL**.

The `SessionStart` hook is a bash script (`hooks/unreal-context.sh`) invoked by `hooks/hooks.json` as `bash ${CLAUDE_PLUGIN_ROOT}/hooks/unreal-context.sh`. It requires a working `bash` on `PATH`:

- **macOS / Linux:** works out of the box.
- **Windows:** install **Git for Windows** (provides Git Bash) or run Claude Code under **WSL**. Native PowerShell without one of those does not have `bash` on `PATH`, and the hook will not run. The plugin's MCP tools still work; you just lose the short project-context note the hook injects at session start. There is no separate PowerShell companion script today.

## Installation

Claude Code plugins are installed via the `/plugin` slash command family, backed by marketplaces. This repo is a standalone plugin (one `.claude-plugin/plugin.json`, no `marketplace.json`), so it is installed by registering the repo directory as a marketplace, then installing the `unreal-engine-skills-for-claude-code` plugin from it.

### Option A: Interactive, for a single developer

In Claude Code:

```
/plugin marketplace add /path/to/unreal-engine-skills-for-claude-code
/plugin install unreal-engine-skills-for-claude-code@unreal-engine-skills-for-claude-code
```

The marketplace name (`unreal-engine-skills-for-claude-code`) is taken from the directory name when the repo is added via `/plugin marketplace add`. If you add the repo from a differently-named directory, substitute that name in the second command.

### Option B: Project `.claude/settings.json`, for a team

Commit this to `.claude/settings.json` in the project that should use the plugin. Anyone who trusts the project folder is prompted to install it automatically:

```json
{
  "extraKnownMarketplaces": {
    "unreal-engine-skills-local": {
      "source": {
        "source": "directory",
        "path": "/path/to/unreal-engine-skills-for-claude-code"
      }
    }
  },
  "enabledPlugins": {
    "unreal-engine-skills-for-claude-code@unreal-engine-skills-local": true
  }
}
```

The marketplace name (`unreal-engine-skills-local`) is the key under `extraKnownMarketplaces` and is whatever you choose; the plugin reference in `enabledPlugins` must use that same name after the `@`.

## Verification

1. Launch Unreal Editor, then run `ModelContextProtocol.StartServer` in the console to start the MCP server.
2. Check the Output Log for MCP server startup messages.
3. In Claude Code, run `/plugin`. The **Installed** tab should list `unreal-engine-skills-for-claude-code` as enabled. This confirms the plugin itself (skills, hooks) is loaded.
4. Run `/mcp`. You should see `unreal-mcp` listed as a connected server. This confirms the plugin's MCP server is reachable.
5. Try: "List all actors in the current level".

## Configuration

The default port is **8000** with URL path `/mcp`. If the port is in use, run `ModelContextProtocol.StartServer <port>` in the console with a different port number.

> **Note:** This plugin does not ship a static `.mcp.json` file. Run `ModelContextProtocol.GenerateClientConfig ClaudeCode` in the editor console to generate it from the current server port and URL; re-run after changing either.

**Tool search** is enabled by default: the MCP server exposes three meta-tools (`list_toolsets`, `describe_toolset`, `call_tool`) instead of the full tool catalog, so Claude discovers toolsets on demand, the prompt cache stays warm, and discovered tools are callable on the same turn through `call_tool`. Toggle with the `bEnableToolSearch` setting in `[/Script/ModelContextProtocolEngine.ModelContextProtocolSettings]`; when disabled, every tool is registered upfront (path used by the hash-mapping commandlet). The model-facing usage contract lives in `skills/unreal-mcp/SKILL.md`.

## Security

Installing this plugin gives Claude broad, live access to the running Unreal Editor. Treat that access the same way you would treat running arbitrary code from an assistant, because in practice it is.

**Localhost is not a trust boundary.** The MCP server binds to `localhost:8000` with origin validation. Origin validation protects against a browser tab talking to the server, but any process running as the same user on the same machine can connect. Do not run the MCP server on shared or untrusted machines, and do not expose the port outside the loopback interface.

**`ProgrammaticToolset.execute_tool_script` executes arbitrary Python** inside the editor process. That script has full access to every toolset API, the project on disk, the asset database, and editor-privileged functions. Treat every invocation as a privileged operation that can mutate, move, or delete project content, and expect it to succeed without a second confirmation when approvals are disabled.

**`--dangerously-skip-permissions` removes the per-tool approval gate.** In that mode Claude can drive the editor and run Python through `execute_tool_script` with no further consent. A bad prompt in that mode can reach into the project and modify a large amount of state before you notice. Prefer not to run Claude Code with `--dangerously-skip-permissions` while this plugin is loaded; if you do, keep the blast radius small (narrow prompts, read-heavy tasks, a throwaway sandbox project).

**Source-control hygiene.** MCP tools edit live `UObject` state and can mutate, move, or delete VCS-tracked assets in a single call. Save and commit (or shelve) before any long MCP-driven session so the working copy is recoverable if Claude produces an unexpected result. Review the diff before submitting.

## What's Available

All tools are auto-discovered by Claude Code via MCP. No manual configuration needed. Tools cover the full editor surface across these domains:

- **Actors and Scene** - spawn, transform, inspect, and delete actors; manage components and outliner folders
- **Blueprints** - create, edit graphs, add nodes, connect pins, manage variables, compile
- **Assets and Content** - find, load, save, move, duplicate assets; edit Data Tables, Curve Tables, String Tables
- **Materials** - author material graphs, create and configure material instances
- **Meshes and Textures** - inspect/edit static and skeletal meshes, LODs, collisions, Nanite, sockets, bones
- **Animation** - build Control Rigs, inspect State Trees and Behavior Trees
- **Sequencer** - create and edit Level Sequences, keyframe animation, manage cameras, Control Rig integration, FBX import/export
- **VFX** - author Niagara systems and Dataflow graphs
- **UI** - build UMG widget blueprints, automate Slate UI interaction
- **Gameplay** - manage gameplay tags, inspect GAS state, create Game Feature Plugins, edit physics assets
- **Testing** - discover, run, and inspect C++ automation tests with detailed results
- **Editor** - screenshots, camera control, actor/asset selection, content browser, log inspection
- **Scripting** - batch multiple tool calls into a single Python script execution
