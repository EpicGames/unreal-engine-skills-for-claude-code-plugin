---
name: unreal-mcp
description: "Use this skill to perform actions inside an Unreal Engine project via a live-editor MCP connection. Trigger when the user wants to change, query, or run something in their Unreal Engine project, not for conceptual or docs questions. Concrete triggers: spawn/move/duplicate/transform actors in a level, open a `.uproject`, add things around a PlayerStart, create or edit a Blueprint/Widget/Material/Niagara/Control Rig/Sequencer/Behavior Tree/GAS ability, read or write properties on actors (e.g. `bIsLocked` on `BP_DoorActor`), Live Coding recompile after editing C++ (`AActor`, `UMyComponent::Method`, `UPROPERTY`), or modify Static/Skeletal Mesh assets. Treat as Unreal context even without the word \"Unreal\": asset prefixes `BP_`, `WBP_`, `M_`, `MI_`, `NS_`, `CR_`, `SK_`, `SM_`, `ABP_`; UE C++ types/macros; `.uproject`; Content Browser; Outliner; PlayerStart; \"in my game\" plus UE signals. Skip for: pure conceptual/docs questions, Unity, Godot, or unrelated uses of \"blueprint\"/\"sequencer\"/\"widget\"."
---

# Unreal MCP

You are wired into a live Unreal Editor through the `unreal-mcp` MCP server. The server exposes hundreds of tools across 30+ toolsets (actors, blueprints, materials, Niagara, Sequencer, Control Rigs, GAS, automation tests, Live Coding, and more) registered through EDA's `ToolsetRegistry`. Use it to inspect and mutate live editor state instead of telling the user to do it manually.

You don't need to memorize tool names. The flow below has you discover them on demand.

## First step every time: load the toolsets you need

Deferred tool loading is on by default, so the MCP server initially advertises only three discovery tools: `list_toolsets`, `describe_toolset`, and `load_toolset`. Tool names like `BlueprintTools.create` or `SequencerTools.create_level_sequence` are **not visible** until you load their owning toolset. This is deliberate. It keeps your context window small.

When you start work:

1. If you already know which toolset you need (the user said "make a Blueprint" → `BlueprintTools`), call `load_toolset` directly and skip ahead.
2. Otherwise call `list_toolsets` to see what's registered, then `describe_toolset` on the candidates to read their tool schemas.
3. Once `load_toolset` succeeds, the toolset's tools become native MCP tools you can invoke directly.

If the discovery tools themselves aren't available (`list_toolsets` errors, or you don't see `unreal-mcp` in your MCP server list at all), the editor or its MCP server is not running. Don't bluff. Ask the user to launch the editor (and run `ModelContextProtocol.StartServer` in the console if auto-start isn't on), or follow `references/setup.md` to wire up a project that has never been configured.

## Safety rules

These exist because every MCP call mutates live editor state and runs on the game thread. Treat them as hard constraints, not suggestions.

- **Save first, then save again.** Tell the user to save the project (or call `AssetTools` save APIs) before any bulk change, and again after. MCP edits are not always undoable, especially across compilation boundaries. Treat anything that touches multiple assets as a destructive operation that needs a recovery point.
- **Wait for compilation.** If C++ or shader compilation is in flight, your tool calls will hang or fail in confusing ways. To rebuild C++ from the running editor, drive `LiveCodingToolset.CompileLiveCoding` and wait on its result instead of asking the user to switch to the IDE. That tool blocks until the compile actually finishes and surfaces MSVC diagnostics.
- **Sequential, never parallel.** Tool calls execute on the game thread, so issuing them in parallel deadlocks or fails. Even when calls look independent, serialize them.
- **Always check the result.** Blueprint compilation, widget creation, material edits: many tools return a status that flips between success and failure with no exception thrown on the wire. Read the response before moving on. Treat anything that isn't an explicit success as a stop.
- **Mind PIE.** Editor-only tools (asset creation in particular) behave differently while Play-in-Editor is active. If a result looks wrong, check whether PIE is running and stop it if so.

## Workflows

These are the canonical step sequences for common tasks. Tool names are listed by `Toolset.tool` so you can `load_toolset` the right thing first. Order matters. Many later steps assume earlier ones have run.

### Inspect a level

1. `SceneTools.find_actors` to enumerate actors by name or class.
2. `ObjectTools.list_properties` then `ObjectTools.get_properties` to read a specific actor's state.
3. `EditorAppToolset.CaptureAssetImage` for a viewport screenshot. Pass the current level path as `assetPath`.

### Create and place an actor

1. `SceneTools.add_to_scene_from_asset` (when you have an asset path) or `add_to_scene_from_class` (for a class).
2. `ActorTools.set_actor_transform` to position, rotate, and scale.
3. `ObjectTools.set_properties` to configure exposed properties.
4. `EditorAppToolset.FocusOnActors` to bring the viewport to the new actor.

### Blueprint authoring

1. `BlueprintTools.create` with the parent class.
2. `ActorTools.add_component` for any components the Blueprint needs.
3. `ObjectTools.set_properties` to configure the components.
4. `BlueprintTools.add_variable` for member variables.
5. `BlueprintTools.get_graph` to fetch the EventGraph.
6. `BlueprintTools.create_node` to add nodes, then `BlueprintTools.connect_pins` to wire them.
7. `BlueprintTools.compile_blueprint` to compile. If it fails, read the diagnostic and fix before doing anything else.

### Widget / UMG authoring

1. `UMGToolSet.CreateWidgetBlueprint` for a new Widget Blueprint.
2. `UMGToolSet.AddWidget` to add text, buttons, images, and other UI elements.
3. `ObjectTools.set_properties` for widget and slot properties.
4. `UMGToolSet.CompileWidgetBlueprint`. As with Blueprints, do not proceed past a failed compile.

### Material Instances

1. `MaterialInstanceTools.create` against an existing parent material.
2. `MaterialInstanceTools.list_parameters` to see what is exposed.
3. `MaterialInstanceTools.set_scalar_parameter` / `set_vector_parameter` / `set_texture_parameter` for the values you want.
4. Assign the instance to meshes via `ObjectTools.set_properties`.

### Niagara particle systems

1. `AssetTools.find_assets` under a known template root (e.g. `/Niagara`) to find a starting system.
2. `NiagaraTools.System_CreateNiagaraSystem` from that template.
3. `NiagaraTools.System_GetSystemTopology` to understand emitters and stages.
4. `NiagaraTools.System_GetModuleSchema` to see the inputs available on a module.
5. `NiagaraTools.System_SetStackInputData` to set values.

### Sequencer (Level Sequences)

1. `SequencerTools.create_level_sequence` for a new sequence asset.
2. `SequencerTools.open_sequence` to open it in the Sequencer editor.
3. `SequencerTools.add_actors_by_name` to bind level actors as possessables.
4. `SequencerTools.add_track_to_binding` for transform / animation / etc. tracks.
5. `SequencerTools.add_section` for sections on those tracks.
6. `SequencerTools.add_key_float` / `add_key_bool` / `add_key_integer` to keyframe values.
7. `SequencerTools.set_playback_range` to bound the duration.
8. `SequencerTools.create_camera` for a cine camera.
9. `SequencerTools.set_playhead_frame` to scrub.
10. `SequencerTools.play` / `pause` to control playback.

### Slate UI automation

1. `SlateInspectorToolset.Snapshot` to capture the widget tree.
2. `SlateInspectorToolset.Observe` to start tracking a subtree before you interact with it.
3. `SlateInspectorToolset.Click` / `Type` / `PressKey` to drive the UI.
4. `SlateInspectorToolset.Screenshot` to verify visually.
5. `SlateInspectorToolset.Unobserve` when done. Leaving observers attached is wasteful.

### Automation tests

1. `AutomationTestToolset.DiscoverTests` once before any other test tool. Skipping this is the single most common cause of empty results.
2. `AutomationTestToolset.ListTests` to find tests by name or tag substring.
3. `AutomationTestToolset.RunTests` to execute by full path.
4. `AutomationTestToolset.GetTestStatus` for a lightweight progress poll.
5. `AutomationTestToolset.GetTestResults` for detailed errors and warnings once the run finishes.
6. `AutomationTestToolset.StopTests` to cancel.

### Live Coding (C++ iteration)

1. Edit the relevant C++ source files in the project.
2. `LiveCodingToolset.CompileLiveCoding` to trigger a Live Coding compile from inside the editor. The tool blocks until the compile finishes.
3. Read the returned status (`Success`, `NoChanges`, `Failure`, …) and any captured `LogLiveCoding` / MSVC diagnostics. Fix and re-invoke if needed.

Live Coding must be enabled in Editor Preferences and active for the current session. Use this rather than asking the user to rebuild from the IDE. Round-trips through the IDE are slow and break flow.

### Batch operations

When you need to make many tool calls in one round-trip (e.g. populating a level with dozens of actors), prefer `ProgrammaticToolset` over a long sequence of individual MCP calls.

1. `ProgrammaticToolset.get_execution_environment` once per session to learn the available Python modules and the calling conventions.
2. `ProgrammaticToolset.execute_tool_script` to run a Python script that calls multiple toolset APIs inside a single editor round-trip.

This is also the right tool when a workflow doesn't fit a fixed schema. The Python environment exposes every toolset API.

## Reference files

- `references/setup.md`: first-time MCP server setup for a project that has never been configured (`.uproject` plugin entry, auto-start `.ini`, `.mcp.json` generation).
- `references/operations.md`: console commands, settings, and a troubleshooting matrix for when things go wrong (port collision, missing toolsets, hangs, empty docked context).

## Companion skills

- **`create-toolset`**: use when authoring a new toolset or adding tools to an existing one. Covers design principles, C++ and Python conventions, registration, error handling, and testing.
- **`unreal-skill`**: use when creating, updating, or reviewing an Agent Skill. Covers what makes a good skill and how to structure one.
