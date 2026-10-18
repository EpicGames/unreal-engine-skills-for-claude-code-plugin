import { readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"

/**
 * Top-level markers that identify an Unreal Engine checkout or project root.
 * A bare `Engine` directory is deliberately not a marker: the Unreal source
 * tree contains `Engine/Source/Runtime/Engine`, so walking up from a Runtime
 * module would otherwise stop at `Source/Runtime`.
 */
const ROOT_MARKERS = [
  "GenerateProjectFiles.bat",
  "GenerateProjectFiles.sh",
  "GenerateProjectFiles.command",
]

export interface UnrealProject {
  /** Absolute path to the project or engine root. */
  root: string
  /** An Engine source tree, as opposed to a game project. */
  kind: "engine" | "game"
  /** Basename of the first `.uproject` at the root, when present. */
  uproject?: string
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function findUproject(directory: string): string | undefined {
  try {
    const names = readdirSync(directory)
      .filter((name) => name.toLowerCase().endsWith(".uproject"))
      .filter((name) => isFile(join(directory, name)))
      .sort()
    return names[0]
  } catch {
    return undefined
  }
}

function isProjectRoot(directory: string): boolean {
  if (ROOT_MARKERS.some((marker) => isFile(join(directory, marker)))) return true
  return findUproject(directory) !== undefined
}

/** Walks upward from `start` until it finds an Unreal Engine root marker. */
export function findProjectRoot(start: string): string | undefined {
  let directory = isDirectory(start) ? start : dirname(start)
  while (directory) {
    if (isProjectRoot(directory)) return directory
    const parent = dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
  return undefined
}

/** Detects the Unreal Engine project containing `start`, if any. */
export function detectProject(start: string): UnrealProject | undefined {
  const root = findProjectRoot(start)
  if (!root) return undefined

  return {
    root,
    kind: isDirectory(join(root, "Engine")) ? "engine" : "game",
    uproject: findUproject(root),
  }
}

/** Short note injected into the model request when a UE project is detected. */
export function buildContext(project: UnrealProject): string {
  let context = "This working directory is an Unreal Engine project."
  if (project.kind === "engine") {
    context += " It is an Engine source tree."
  } else if (project.uproject) {
    context += ` The project is \`${project.uproject}\`.`
  }
  context +=
    " Prefer Unreal Engine conventions (C++/UObject patterns, Slate, UHT reflection) when suggesting code."
  context +=
    " Use the `unreal-mcp` skill for tasks that involve driving the Unreal Editor via MCP."
  context +=
    " Start the editor MCP server with `ModelContextProtocol.StartServer` if the `unreal-mcp` tools are unavailable."
  return context
}

/** Convenience helper used by the plugin to detect and describe in one call. */
export function projectContext(start: string): string | undefined {
  const project = detectProject(start)
  return project ? buildContext(project) : undefined
}
