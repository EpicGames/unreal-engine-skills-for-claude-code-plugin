---
name: unreal-mcp
description: "Control Unreal Editor via MCP: create actors, edit Blueprints, manipulate widgets, materials, Niagara, Control Rigs, Sequencer, run automation tests, and more. Use this skill whenever the user mentions Unreal Engine, UE5/UE4, `.uproject`, the Unreal Editor, Blueprints, UMG, Niagara, Sequencer, Control Rigs, State Trees, or asks to spawn, place, or edit actors, assets, or widgets in an Unreal project, even if they don't explicitly name the skill."
---

# Unreal MCP

Unreal MCP exposes hundreds of tools from the Unreal Editor through an MCP server. Tools are registered via **EDA's ToolsetRegistry** and bridged to MCP automatically. When the editor is running, all registered toolsets are available via the `unreal-mcp` MCP server.

All tools are auto-discovered via MCP. You do not need to memorize tool names. They appear in Claude Code's tool list when the editor is connected.

When **deferred tool loading** is enabled (the default), `tools/list` returns three lightweight tools (`list_toolsets`, `describe_toolset`, and `load_toolset`) instead of the full set of tool schemas. This keeps the initial context window small. Use `list_toolsets` to discover available toolsets, `describe_toolset` to inspect a toolset's tools and schemas, and `load_toolset` to register a toolset's tools as native MCP tools. Loaded tools become available on the **next** client turn, not in the same response as the `load_toolset` call. Deferred loading can be toggled with the `ModelContextProtocol.DeferredToolLoading` console variable.

## Prerequisites

- Unreal Editor running with the **ModelContextProtocol** plugin enabled
- MCP server active (check Output Log for startup messages)
- Default endpoint: `http://localhost:8000/mcp`

## First-Time Setup

If the MCP server is not yet connected, Claude Code can help the user get set up. The steps below can be performed directly by Claude Code when the user asks for help connecting.

### 1. Enable plugins in the `.uproject` file

The project's `.uproject` file must list the `ModelContextProtocol` plugin as enabled. Search the `Plugins` array for an existing entry; if missing, add it:

```json
{
  "Name": "ModelContextProtocol",
  "Enabled": true
}
```

### 2. Enable auto-start via `.ini`

To start the MCP server automatically on editor launch (without requiring the user to open Tools > Claude Code), add the following to the project's `Config/DefaultEditorPerProjectUserSettings.ini`:

```ini
[/Script/ModelContextProtocolEngine.ModelContextProtocolSettings]
bAutoStartServer=True
```

The port and URL path can also be set here if the defaults need to change:

```ini
ServerPortNumber=8000
ServerUrlPath=/mcp
```

Alternatively, auto-start can be triggered via the command line flag `-StartModelContextProtocolServer`, and the port can be overridden with `-ModelContextProtocolPort=<port>`.

### 3. Generate the `.mcp.json` file

The `.mcp.json` file tells Claude Code where the MCP server is. The editor is the canonical source: on startup it regenerates `.mcp.json` from the live port and URL settings, overwriting any hand-written copy. Only write `.mcp.json` directly when the file is absent and the editor is not about to launch (for example, when scripting a fresh-project bootstrap before the user opens the editor). Otherwise, prefer launching the editor and letting it generate the file. Write this to `.mcp.json` in the project root (the directory containing the `.uproject` file):

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

Adjust the port and path if non-default values are configured. Once the editor is running, `ModelContextProtocol.GenerateClientConfig All` regenerates config files from the current settings. The command accepts a specific client argument: `ClaudeCode`, `Cursor`, `VSCode`, `Gemini`, `Codex`, or `All`.

## Safety

- **Save before bulk operations.** MCP tools modify editor state directly. Save before and after large changes.
- **Wait for compilation.** Don't issue tool calls while C++ or shader compilation is in progress.
- **PIE context.** Some editor-only tools (e.g., asset creation) may behave differently during Play-in-Editor.
- **Sequential execution.** Tool calls execute on the game thread. Don't issue them in parallel.
- **Check results.** Operations like Blueprint compilation can fail. Always check the result before proceeding.

## Workflows

### Automation Testing

1. `AutomationTestToolset.DiscoverTests` to initialize test discovery (call once before other test tools)
2. `AutomationTestToolset.ListTests` to find tests by name or tag substring
3. `AutomationTestToolset.RunTests` to execute specific tests by full path
4. `AutomationTestToolset.GetTestStatus` for a lightweight progress snapshot
5. `AutomationTestToolset.GetTestResults` for detailed per-test results, errors, and warnings
6. `AutomationTestToolset.StopTests` to cancel running tests

### Sequencer (Level Sequences)

1. `SequencerTools.create_level_sequence` to create a new sequence asset
2. `SequencerTools.open_sequence` to open it in the Sequencer editor
3. `SequencerTools.add_actors_by_name` to bind level actors into the sequence
4. `SequencerTools.add_track_to_binding` to add tracks (transform, animation, etc.)
5. `SequencerTools.add_section` to add sections to tracks
6. `SequencerTools.add_key_float` / `add_key_bool` / `add_key_integer` to keyframe values
7. `SequencerTools.set_playback_range` to set the sequence duration
8. `SequencerTools.create_camera` to add a cine camera
9. `SequencerTools.set_playhead_frame` to scrub to a frame
10. `SequencerTools.play` / `pause` for playback control

### Inspect a Level

1. `SceneTools.find_actors` to list actors in the level
2. `ObjectTools.list_properties` then `ObjectTools.get_properties` to inspect a specific actor
3. `EditorAppToolset.CaptureAssetImage` to screenshot the viewport (pass the current level path as `assetPath`)

### Create and Place Objects

1. `SceneTools.add_to_scene_from_asset` or `add_to_scene_from_class` to spawn an actor
2. `ActorTools.set_actor_transform` to position it
3. `ObjectTools.set_properties` to configure properties
4. `EditorAppToolset.FocusOnActors` to center the viewport on it

### Blueprint Creation

1. `BlueprintTools.create` with a parent class
2. `ActorTools.add_component` to add components
3. `ObjectTools.set_properties` to configure component properties
4. `BlueprintTools.add_variable` to add member variables
5. `BlueprintTools.get_graph` to get the EventGraph
6. `BlueprintTools.create_node` to add nodes
7. `BlueprintTools.connect_pins` to wire pins together
8. `BlueprintTools.compile_blueprint` to compile and check for errors

### Material Instances

1. `MaterialInstanceTools.create` with an existing parent material
2. `MaterialInstanceTools.list_parameters` to see what parameters are exposed
3. `MaterialInstanceTools.set_scalar_parameter` / `set_vector_parameter` / `set_texture_parameter` to configure values
4. Assign the instance to meshes via `ObjectTools.set_properties`

### Widget/UI Creation

1. `UMGToolSet.CreateWidgetBlueprint` to create a Widget Blueprint
2. `UMGToolSet.AddWidget` to add UI elements (text, buttons, images)
3. `ObjectTools.set_properties` to configure widget and slot properties
4. `UMGToolSet.CompileWidgetBlueprint` to compile

### Niagara Particle Effects

1. `AssetTools.find_assets` to find template Niagara systems (e.g., under `/Niagara`)
2. `NiagaraTools.System_CreateNiagaraSystem` from a template
3. `NiagaraTools.System_GetSystemTopology` to understand the structure
4. `NiagaraTools.System_GetModuleSchema` to see available inputs
5. `NiagaraTools.System_SetStackInputData` to modify parameters

### Slate UI Automation

1. `SlateInspectorToolset.Snapshot` to get the widget tree
2. `SlateInspectorToolset.Observe` to start tracking a subtree
3. `SlateInspectorToolset.Click` / `Type` / `PressKey` to interact with widgets
4. `SlateInspectorToolset.Screenshot` for visual verification
5. `SlateInspectorToolset.Unobserve` to clean up when done

### Batch Operations

1. `ProgrammaticToolset.get_execution_environment` to learn the API (call once per session)
2. `ProgrammaticToolset.execute_tool_script` to run a Python script that calls multiple tools in one round-trip

## Toolset Reference

For the full per-toolset reference (every registered toolset with a short description, grouped by domain), read `references/toolsets.md`. It is kept out of this file so the skill's hot-path context stays small; load it only when you need to look up a specific toolset's capabilities.

## Configuration

### Editor Preferences > Plugins > Model Context Protocol

| Setting     | Default | Description                   |
|-------------|---------|-------------------------------|
| Server Port | 8000    | HTTP port for MCP server      |
| URL Path    | /mcp    | MCP endpoint path             |
| Auto Start  | false   | Start server on editor launch |

### Console Commands

| Command                                              | Description                                                                             |
|------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `ModelContextProtocol.StartServer [port]`            | Start the MCP server (optional port override)                                           |
| `ModelContextProtocol.StopServer`                    | Stop the MCP server                                                                     |
| `ModelContextProtocol.RefreshTools`                  | Re-register all tools                                                                   |
| `ModelContextProtocol.GenerateClientConfig <client>` | Generate MCP client config (`ClaudeCode`, `Cursor`, `VSCode`, `Gemini`, `Codex`, `All`) |

### Console Variables

| CVar                                       | Default | Description                                                                                                                                                                                                     |
|--------------------------------------------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `ModelContextProtocol.DeferredToolLoading` | true    | When enabled, `tools/list` returns `list_toolsets`, `describe_toolset`, and `load_toolset` instead of all tool schemas. The LLM discovers and loads specific toolsets on demand, reducing context window usage. |

## Troubleshooting

| Issue                | Solution                                                                                                                 |
|----------------------|--------------------------------------------------------------------------------------------------------------------------|
| MCP not connecting   | Ensure editor is running. Open Tools > Claude Code to trigger MCP server start. Check Output Log for errors.             |
| Failed to listen     | Run `ModelContextProtocol.StartServer <port>` with a different port number.                                              |
| Tools not appearing  | Run `ModelContextProtocol.RefreshTools` console command. Check that ToolsetRegistry plugins are enabled.                 |
| Tool calls failing   | Check Output Log for error details. Ensure editor is idle (not compiling, loading).                                      |
| Docked context empty | Claude Code tab must be docked inside an asset editor (Blueprint, Material, etc.) for `GetDockedContext` to return data. |
