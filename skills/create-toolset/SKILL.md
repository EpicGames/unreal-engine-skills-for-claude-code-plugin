---
name: create-toolset
description: "Use this skill when authoring or extending an Unreal Engine toolset, a class of static, AI-callable functions registered with `ToolsetRegistry` and exposed through the unreal-mcp server. Trigger when the user wants to add, expose, or register a new tool method, create a new toolset, or extend an existing one such as `BlueprintTools`, `StaticMeshTools`, `ObjectTools`, `LevelTools`, or `MaterialTools`. Concrete triggers: 'add a tool to X', 'expose this via MCP', 'register a function so Claude/the agent can call it', 'wire this into the toolset registry', 'create a new toolset for Y', 'add a Python toolset', 'make this AI-callable'; adding a `static` method to a `*Tools.cpp/.h/.py` file; editing files under a `Toolsets/` folder; designing tool parameters, return types, or struct schemas for a toolset. SKIP for: invoking existing tools at runtime (use unreal-mcp instead), authoring an Agent Skill (use unreal-skill), generic refactors that happen to touch a toolset file but don't add or redesign a tool, or unrelated uses of the word 'toolset'."
---

# Create Toolset

You are authoring or extending an Unreal Engine toolset: a collection of static, AI-callable functions registered with the `ToolsetRegistry` and exposed through the MCP server. The goal is to expand the surface of things Claude can do inside the editor.

## Principles

A good toolset is:

**Clean**: Design the simplest API that can do useful work in the domain. Don't mirror Unreal's existing APIs directly; they're often unnecessarily complex. A good heuristic: would a technical artist understand this without reading the implementation?

**Complete**: Support CRUD symmetry. If you can set a thing, you should be able to get it. If there's a create, there should be a delete. Getters without setters are fine when mutation isn't possible or useful.

**Composable**: Use consistent types for the same kinds of operation across the toolset. If `get_graph()` returns a `Graph`, then `get_graph_nodes()` should accept a `Graph`. Functions should combine naturally to produce more complex results.

**DRY**: No duplication within a toolset, and no duplication across toolsets. `ObjectTools` already provides generic UObject property get/set. Don't reimplement it. If functionality lives elsewhere, call it or point to it.

## Before You Write

Work through these questions in order before touching any code.

**1. Does the functionality already exist?** If the editor is running, call `list_toolsets` via MCP, then `describe_toolset` on anything relevant. If MCP isn't available, search the codebase for folders named `Toolsets` and read the C++ headers or Python toolset files there. If the capability is already exposed, there's nothing to do. Tell the user and point them to the right tool.

**2. Is the request more general than it sounds?** Users often ask for something domain-specific that is actually an instance of a broader pattern. Before looking for a domain toolset, ask whether the capability truly belongs to that domain or whether it applies more widely. For example, a request for "read blueprint asset metadata" sounds like it belongs in `BlueprintTools`, but metadata applies to all assets, so the right place is `AssetTools`. Solving it generically is almost always better than solving it narrowly.

**3. Does a toolset for this domain already exist?** If the functionality is missing but a toolset already covers the same domain (e.g. you're adding a mesh query to `StaticMeshTools`), add to that toolset rather than creating a new one.

**4. Does a new toolset need its own plugin?** If you're creating a new toolset and it's closely related to an existing plugin, add it there. If it's a distinct enough domain, it may warrant its own plugin. Ask the user if it isn't obvious.

**5. Choose the implementation language.** This is the user's call, but help them make an informed one. Python is generally preferred: it's faster to iterate and easier to change. Assess both options:

- **Python**: Check what's available in the Python stubs (`<project_root>/Intermediate/PythonStub/unreal.py`; search it, don't read it wholesale). If the file doesn't exist, the user needs to enable **Developer Mode** in **Edit → Project Settings → Plugins → Python** and restart the editor. This is worth doing for any toolset work, so recommend it proactively. If the necessary APIs are all there, Python is the right choice. If most of the functionality is available but something small is missing, flag the gap to the user; a minor engine tweak may still make Python the better option overall.
- **C++**: The right choice when Python coverage is thin or non-existent. Most of what you need simply isn't in the stubs.

Summarize what's available in each and let the user decide before writing any code. If the APIs needed aren't available in either language, don't work around it. Stop and tell the user so they can extend the engine. Workarounds create fragile tools that break silently.

## Shared Conventions

These apply in both C++ and Python:

- **Don't duplicate existing tools.** For example, `ObjectTools` already handles generic UObject property get/set.
- **Documentation is required.** Every toolset and every tool call must be documented. See the Documentation section below.
- **Use real types.** Parameters and return values should be the actual type (`int32`, `FVector`, `TArray<FString>`, a struct, etc.). The ToolsetRegistry handles serialization automatically. Converting to or from a JSON-formatted string inside a tool call is a code smell. A string type should mean it's genuinely a string, not structured data in disguise.
- **Return values carry data, not status.** Returning normally means success; raising means failure. Never return a boolean, error string, or result wrapper to communicate an error. Raise instead.
- **All tool methods are static.** No instance state.
- **Tests are mandatory.** Every tool must have test coverage. See the Testing section below.

## Documentation

Good documentation is required at every level. It's not optional polish. Don't go into too much detail; a short, precise description is better than a long one. If a sentence doesn't add meaning beyond what the code already says, cut it.

**Toolset class**: Write 1-3 sentences describing what the toolset does and the domain it covers. An LLM will often see only the toolset name and this description without ever loading its tools, so it needs to stand on its own. Describe the domain and the kinds of operations the toolset supports. Don't enumerate tool names; the tools speak for themselves.

**Each tool**: Write a clear description of what the tool does, document every parameter, and document the return value. Focus on meaning and units. Don't restate the type, default values, or anything else already captured in the signature or metadata.

**Structs**: Document the struct itself (what it represents and when it's used) and every field (meaning and units where applicable). UPROPERTY metadata such as `ClampMin` and `ClampMax` is extracted automatically and included in the schema. Use it rather than restating constraints in the doc comment.

## C++ Specifics

### Structure

- Derive from `UToolsetDefinition` (from `ToolsetRegistry/ToolsetDefinition.h`).
- One toolset class per `.h` / `.cpp` file.
- All AI-callable tools are **static methods** marked with `UFUNCTION(meta = (AICallable))`. The function's doc comment becomes the AI-visible tool description. Write it clearly.
- Private helpers are static methods without `UFUNCTION(meta = (AICallable))`. Simply omit the macro and they won't be exposed.
```cpp
/**
 * Snapshot of a MyThing's current state, returned by GetThingInfo.
 */
USTRUCT(BlueprintType)
struct FMyThingInfo
{
    GENERATED_BODY()

    /** How thing-like this thing is. */
    UPROPERTY(meta=(ClampMin="0.0", ClampMax="1.0")) float Thinginess;

    /** Things that belong to this thing. */
    UPROPERTY() TArray<UMyThing*> SubThings;
};

/**
 * Manages MyThings in the current level. Covers the full lifecycle of these objects:
 * querying by name, reading their state, and performing operations on them.
 */
UCLASS(BlueprintType, MinimalAPI)
class UMyToolset : public UToolsetDefinition
{
    GENERATED_BODY()

public:
    /**
     * Returns all things whose name matches the given pattern.
     * @param NamePattern Substring to match against thing names.
     * @return Matching things, or an empty array if none are found.
     */
    UFUNCTION(meta = (AICallable), Category = "MyToolset")
    static TArray<UMyThing*> FindThings(const FString& NamePattern);

    /**
     * Returns detailed info about the given thing.
     * @param Thing The thing to read state from.
     * @return The thing's current state.
     */
    UFUNCTION(meta = (AICallable), Category = "MyToolset")
    static FMyThingInfo GetThingInfo(UMyThing* Thing);

    /**
     * Performs the primary operation on the given thing.
     * @param Thing The thing to perform the operation on.
     */
    UFUNCTION(meta = (AICallable), Category = "MyToolset")
    static void DoTheThing(UMyThing* Thing);
};
```

### Async Tool Calls

Most tools are synchronous: they run on the game thread and return a value directly. Use async for long-running operations such as capturing a screenshot or waiting for an editor state change.

Async tools return a subclass of `UToolCallAsyncResult` instead of the value directly. Many result types already exist, and new ones can be created by subclassing `UToolCallAsyncResult` for any value type. Check the existing types before creating a new one.

The declaration looks like any other tool, just with an async result return type:

```cpp
/**
 * Renders an image of the given thing.
 * @param Thing The thing to capture.
 * @return An image of the thing.
 */
UFUNCTION(meta = (AICallable), Category = "MyToolset")
static UToolCallAsyncResultImage* CaptureThingImage(UMyThing* Thing);
```

Unlike synchronous tools, success and failure are both communicated through the result object. Call `SetValue()` on success and `SetError()` on failure.

```cpp
UToolCallAsyncResultImage* UMyToolset::CaptureThingImage(UMyThing* Thing)
{
    UToolCallAsyncResultImage* Result = NewObject<UToolCallAsyncResultImage>();

    if (!IsRenderingEnabled())
    {
        Result->SetError(TEXT("Rendering is not enabled."));
        return Result;
    }

    // Initiate the capture; call Result->SetValue(image) on completion.
    return Result;
}
```

The right implementation approach depends on the system being exercised. Look at existing toolsets for real examples before writing any code.

### Registration

Toolsets can be registered and unregistered dynamically at any time. A common pattern is to do it in module startup and shutdown:

```cpp
class FMyToolsetModule : public IModuleInterface
{
    void StartupModule()
    {
        UToolsetRegistry::RegisterToolsetClass(UMyToolset::StaticClass());
    }

    void ShutdownModule()
    {
        UToolsetRegistry::UnregisterToolsetClass(UMyToolset::StaticClass());
    }
};
```

Check nearby toolsets in the same plugin to see what pattern is used there.

### Custom Type-to-JSON Converters

The ToolsetRegistry automatically converts all Unreal types to and from JSON. You rarely need to think about serialization. JSON converters let you take extra control over how a specific type is represented, typically to produce a cleaner or more AI-friendly schema than the default.

This is an advanced feature and should only be used reactively, when there is a clear need for it, not just because it might be helpful.

Several types already have built-in custom converters. For example:

- **`FToolsetColorConverter`**: unifies `FColor` and `FLinearColor` into a single color representation so the AI doesn't need to know about the byte vs. float distinction.
- **`FToolsetReferenceConverter`**: converts all UObject\* and UClass\* properties to typed soft path objects rather than the raw strings you'd otherwise get.
- **`FToolsetTransformConverter`**: exposes `FTransform` location, rotation, and scale as optional fields, which is much more ergonomic than requiring all three components every time.

When you need custom serialization for a type not already covered, subclass `FToolsetJsonConverter` (from `ToolsetRegistry/ToolsetJsonConverter.h`) and register it alongside your toolset. Read one of the existing converters in the ToolsetRegistry plugin source before writing your own. The interface has several moving parts and the existing implementations are the best guide.

### Error Handling

When a tool cannot complete its work (invalid input, missing asset, precondition not met), raise a script error and return immediately with a null or default value:

```cpp
TArray<UMyThing*> UMyToolset::FindThings(const FString& NamePattern)
{
    if (NamePattern.IsEmpty())
    {
        UKismetSystemLibrary::RaiseScriptError(
            EScriptExceptionType::Error,
            TEXT("NamePattern must not be empty."));
        return {};
    }
}
```

### Tests

Before running tests, compile your changes with `LiveCodingToolset.CompileLiveCoding`. It blocks until done and surfaces MSVC diagnostics. Fix any compile errors before proceeding.

Every tool needs test coverage for both the success path and every error path. Write at least one test that confirms the tool does what it says, and a separate test for each condition that raises. Use the `BEGIN_DEFINE_SPEC` / `END_DEFINE_SPEC` pattern. Read existing tests in `Plugins/Experimental/Toolsets` for reference. Place tests near the toolset and follow the convention in the same plugin:

```cpp
BEGIN_DEFINE_SPEC(
    FMyToolsetSpec,
    "AI.MyToolset",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
END_DEFINE_SPEC(FMyToolsetSpec)

void FMyToolsetSpec::Define()
{
    Describe("FindThings", [this]()
    {
        It("returns matching things", [this]()
        {
            TArray<UMyThing*> Results = UMyToolset::FindThings(TEXT("expected_name"));
            TestFalse(TEXT("Result is not empty"), Results.IsEmpty());
        });

        It("returns an empty array when no things match", [this]()
        {
            TArray<UMyThing*> Results = UMyToolset::FindThings(TEXT("nonexistent"));
            TestTrue(TEXT("Result is empty"), Results.IsEmpty());
        });

        It("raises when the name pattern is empty", [this]()
        {
            AddExpectedError(TEXT("NamePattern must not be empty"));
            UMyToolset::FindThings(TEXT(""));
        });
    });
}
```

## Python Specifics

### Structure

- Decorate the class with `@unreal.uclass()` and inherit from `unreal.ToolsetDefinition`.
- One toolset class per `.py` file.
- All AI-callable tools use `@toolset_registry.tool_call` followed by `@staticmethod`. The docstring becomes the AI-visible tool description.
- Private helpers are `@staticmethod` with a `_`-prefixed name, placed at the end of the class.
- **Type annotations are mandatory on every parameter and return value.** Schema generation depends on them entirely.
- **Use standard Python type annotations** (`list[str]`, `dict[str, str]`, etc.) rather than Unreal equivalents like `unreal.Array[str]`. The `@toolset_registry.tool_call` decorator handles the conversion automatically.
```python
@unreal.uclass()
class MyToolset(unreal.ToolsetDefinition):
    """Manages MyThings in the current level. Covers the full lifecycle of these objects:
    querying by name, reading their state, and performing operations on them."""

    @toolset_registry.tool_call
    @staticmethod
    def find_things(name_pattern: str) -> list[MyThing]:
        """Returns all things whose name matches the given pattern.

        Args:
            name_pattern: Substring to match against thing names.

        Returns:
            Matching things, or an empty list if none are found.
        """
        ...

    @toolset_registry.tool_call
    @staticmethod
    def get_thing_info(thing: MyThing) -> MyThingInfo:
        """Returns detailed info about the given thing.

        Args:
            thing: The thing to read state from.

        Returns:
            The thing's current state.
        """
        ...

    @toolset_registry.tool_call
    @staticmethod
    def do_the_thing(thing: MyThing) -> None:
        """Performs the primary operation on the given thing.

        Args:
            thing: The thing to perform the operation on.
        """
        ...
```

### Registration

Registration is never automatic. Add the toolset class to the plugin's registration list and call `unreal.ToolsetRegistry.register_toolset_class` during initialization, typically in an `__init__.py` or `init_unreal.py` alongside other toolsets in the same plugin:

```python
def register_toolsets():
    unreal.ToolsetRegistry.register_toolset_class(MyToolset)

def unregister_toolsets():
    unreal.ToolsetRegistry.unregister_toolset_class(MyToolset)
```

Find the equivalent functions in the plugin you're working in and add your toolset there.

### Error Handling

When a tool cannot complete its work, raise an exception directly:

```python
@toolset_registry.tool_call
@staticmethod
def find_things(name_pattern: str) -> list[MyThing]:
    """Returns things whose name matches the given pattern."""
    if not name_pattern:
        raise ValueError("name_pattern must not be empty.")
```

### Tests

Every tool needs test coverage for both the success path and every error path. Write at least one test that confirms the tool does what it says, and a separate test for each condition that raises. Read existing tests in `Plugins/Experimental/Toolsets` for reference. Extend `ToolCallTestCase` and use `assertToolRaisesRuntimeError` to test error paths:

```python
class MyToolsetTestCase(ToolCallTestCase):
    """Test MyToolset toolset."""

    def test_find_things_returns_matches(self):
        """Returns matching things when they exist."""
        results = MyToolset.find_things("expected_name")
        self.assertGreater(len(results), 0)

    def test_find_things_returns_empty_for_no_match(self):
        """Returns an empty list when no things match the pattern."""
        results = MyToolset.find_things("nonexistent")
        self.assertEqual(results, [])

    def test_find_things_raises_on_empty_pattern(self):
        """Raises when name_pattern is empty."""
        with self.assertToolRaisesRuntimeError():
            MyToolset.find_things("")
```

Before re-running tests after editing, reload the plugin's package. The editor won't pick up changes otherwise. Enable Remote Execution in **Edit → Project Settings → Plugins → Python → Enable Remote Execution**, then run:

```bash
python Engine/Plugins/Experimental/ToolsetRegistry/Content/Python/toolset_registry/tests/reload_remote.py your_plugin
```

## Testing Your Work

Tests are how you verify the toolset actually works and catch regressions when things change. Work in a tight loop: write code, compile if needed, run the tests, read the failures, fix them, and repeat until everything passes.

### Live Editor (preferred)

Running tests against a live editor instance using `unreal-mcp` is the fastest way to iterate. Changes can be compiled or hot-reloaded without restarting, and results come back immediately. This flow works for both C++ and Python tests.

Run tests via MCP:

1. Load `AutomationTestToolset` and call `DiscoverTests`. This is required before any other test tool; skipping it causes empty results.
2. Call `ListTests` filtered to your toolset name to confirm the tests are discovered.
3. Call `RunTests` with the full test paths.
4. Poll `GetTestStatus`, then call `GetTestResults` for detailed per-test errors and warnings.

When iterating on Python tests, call `DiscoverTests` with `force_rediscover=true` after reloading so the automation system picks up any added or removed tests.

### Command Line (no running editor)

When no editor is running, the command line launches a headless editor instance, runs the specified tests, and exits. It's slower due to startup time (~30 seconds) but requires no running editor and is useful in CI or when the editor isn't available.

Use `UnrealEditor-Cmd` with `-ExecCmds` to invoke the automation test system directly:

``` bash
UnrealEditor-Cmd.exe <Project>.uproject -ExecCmds="Automation RunTests AI.MyToolset;quit" -Unattended -NullRHI
```

Replace `AI.MyToolset` with the test filter matching your toolset's spec name. Check how existing tests in the same plugin are run to confirm the right flags and filter prefix for the project.

## Reviewing Your Work

Once the code is written and tests pass, step back and read what you've built as a whole before declaring it done. First-pass code often has issues that aren't visible tool-by-tool:

- **Duplicated boilerplate.** Similar patterns repeated across tools that could share a helper.
- **Incomplete test coverage.** A raise path that was added late and never got a test. A success case that only checks one scenario.
- **Duplicate functionality.** A tool that does something another tool in this toolset or another toolset entirely already does.
- **API inconsistency.** Parameter names or types that don't match the conventions used elsewhere in the toolset.
- **Documentation gaps.** A parameter whose description was left vague, or a class docstring that doesn't say enough to be useful on its own.

Fix anything you find before handing off. A clean second pass is faster than a bug report later.
