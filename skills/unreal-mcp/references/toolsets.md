# Toolset Reference

All toolsets listed below are registered via EDA's ToolsetRegistry and grouped by domain.

Tool names mix `camelCase`, `PascalCase`, and `snake_case` across toolsets because each toolset preserves the native naming conventions of the API it wraps (e.g. `BlueprintTools.create`, `UMGToolSet.CreateWidgetBlueprint`, `SequencerTools.create_level_sequence`). Use tool names exactly as registered; do not normalize casing.

## Actors and Scene

**ActorTools** manages actors and components: get/set transforms, labels, bounds, add/remove components, query component hierarchy, and reparent scene components.

**SceneTools** handles level and scene management: spawn actors from assets or classes, find actors by type/name, delete actors, load levels, manage outliner folders, and get the current level path.

**PrimitiveTools** adds procedural DynamicMesh shapes to actors: cubes, spheres, and cylinders/cones with configurable dimensions and local transforms.

## Blueprints

**BlueprintTools** provides full Blueprint editing: create blueprints, add/remove function graphs and variables (primitive, struct, object types), create/delete/connect nodes, set pin values, manage function parameters, compile, reparent, query node types/categories, and bind component events.

## Assets and Content

**AssetTools** covers asset and file management: find, load, save, move, duplicate, delete assets and folders. Read/write text files. Check dirty state and discover plugin content paths.

**DataAssetTools** creates DataAsset instances from a specified class.

**DataTableTools** creates and edits DataTable assets: add/remove/rename rows, get/set row values as JSON, query column schemas, and search for compatible row structs.

**CurveTableTools** creates and edits CurveTable assets: add/remove/rename rows, add/set/get keys (time/value pairs).

**StringTableTools** creates and edits StringTable assets: add/remove/get entries by key, list keys, and query namespace/table ID.

## Materials

**MaterialTools** authors Materials: add expression nodes (constants, parameters, texture samples, math ops), connect expressions to each other and to material outputs, delete expressions, auto-layout, and recompile shaders.

**MaterialInstanceTools** creates and edits Material Instances: set/get scalar, vector, texture, and static switch parameters. List exposed parameters, change parent, and clear overrides.

## Meshes and Textures

**StaticMeshTools** inspects and edits Static Meshes: query bounds, LODs, triangle/vertex counts, material slots, Nanite state. Generate convex collisions and LODs, remove collisions/LODs, and toggle Nanite.

**SkeletalMeshTools** inspects and edits Skeletal Meshes: query bones (hierarchy, parents, children), material slots, sockets (add/remove/rename/transform), morph targets, LODs, bounds, vertex counts, and assign physics assets.

**TextureTools** queries Texture2D dimensions (width/height in pixels).

## Objects and Properties

**ObjectTools** provides generic UObject inspection: get class, list properties, get/set property values (as JSON), and search for subclasses of any class. Works on any UObject.

## Animation

**AnimationToolset (ControlRig)** builds and edits Control Rigs: create rigs, add bones/nulls/controls, manage graphs (forward/backward/interaction solve), create RigUnit nodes, connect pins, set transforms, and manage variables.

**StateTreeToolset** inspects StateTree assets: get root states, child states, tasks, transitions, enter conditions, evaluators, global tasks, and node descriptions.

**AIModuleToolset** inspects and navigates Behavior Trees: list nodes, get children, depths, decorators, blackboards, and subtree references.

## Sequencer

**SequencerTools** provides comprehensive Level Sequence editing: create and open sequences, manage bindings (possessables, spawnables, custom bindings), add tracks and sections, keyframe float/bool/integer/string channels, control playback (play, pause, scrub, loop, speed). Supports camera management (create cameras, camera cuts, lock to viewport), Control Rig integration (get/set control transforms, space switching, baking, tweening, layered mode, animation layers), FBX import/export, animation sequence export, marked frames/bookmarks, outliner node management (mute, solo, lock, pin, expand, deactivate), Curve Editor controls, section properties (blend type, completion mode, easing, conditions), track conditions, folder organization, selection management, and sub-sequence hierarchy navigation.

## VFX

**NiagaraAIAssistantTools** provides full Niagara system authoring: create systems/emitters, add/remove modules and renderers, get/set stack inputs, manage user variables, query schemas, create Blueprint wrappers, and set component variables.

**DataflowAgent** creates and edits Dataflow graphs: add/remove/connect nodes, manage variables, inspect node type schemas, reposition nodes, and add comment boxes.

## UI

**UMGToolSet** builds UMG widget blueprints: create blueprints, add/remove/move/rename widgets, manage named slots, set widget-as-variable, compile, and reparent.

**SlateInspectorToolset** provides UI automation and inspection: snapshot widget trees, click/type/hover/drag widgets, fill forms, select combobox options, press keys, take screenshots, observe subtrees, and manage windows.

## Gameplay

**GameplayTagsToolset** manages gameplay tags: add, remove, rename tags and inspect tag details across tag sources.

**GASToolsets** covers three sub-toolsets for the Gameplay Ability System: **AbilitySystemInspector** (query active effects, tags, attributes, granted abilities on actors), **AttributeSet** (find attribute set classes and list their attributes), **GameplayCue** (manage cue tags, create notify assets, execute cues, find orphaned tags).

**GameFeaturesToolset** creates and inspects Game Feature Plugins: list plugins, find GameFeatureData assets, and query their actions.

**ConversationToolset** inspects Common Conversation assets: list entry points, speakers, navigate node graphs by GUID, get connections and sub-nodes.

**PhysicsToolsets** edits Physics Assets: add/remove bodies and constraints, set collision shapes (sphere/capsule/box), configure constraint limits, mass scale, and simulation modes. Create physics assets from skeletal meshes.

**WorldConditionsToolset** describes world conditions and world condition query definitions in human-readable form.

## Editor Utilities

**EditorAppToolset** handles editor interaction: capture asset images/viewport screenshots, capture full editor screenshots, get/set camera transform, select actors/assets, focus on actors, manage content browser path, screen-to-world and world-to-screen coordinate conversion, search console variables, get visible actors in the viewport frustum, get open assets and selected assets, and open asset editors.

**PrintToLog** prints messages to the Unreal Output Log with configurable verbosity (Log, Warning, Error).

**LogsToolset** provides log inspection: list log categories, get/filter log entries by category or regex pattern, and get/set verbosity levels.

**AutomationTestToolset** runs C++ automation tests from the editor: discover available tests, list tests by name or tag filter, run specific tests by path, check status, get detailed per-test results (duration, errors, warnings), and stop running tests. Requires calling `DiscoverTests` once before using other test tools.

**LiveCodingToolset** triggers an in-editor Live Coding compile and waits for completion, returning the compile result (`Success`, `NoChanges`, `Failure`, etc.) together with captured `LogLiveCoding` output and any MSVC diagnostics extracted from the UBT log. Live Coding must be enabled in Editor Preferences and for the session. Use this instead of asking the user to rebuild from the IDE when iterating on C++ changes.

**AgentSkillToolset** manages Agent Skills: list, get details, create, and update skill assets.

**AIAssistantToolset** returns docked editor context and project context for AI assistant widgets docked in asset editors.

## Scripting

**ProgrammaticToolset** executes Python scripts against all toolset APIs in a single call. Call `get_execution_environment` first to discover available modules and usage instructions.
