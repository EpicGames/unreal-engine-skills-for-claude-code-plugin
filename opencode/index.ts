import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { projectContext } from "./project.ts"
import { discoverSkills, type OpenCodeSkill } from "./skills.ts"

const DEFAULT_URL = "http://127.0.0.1:8000/mcp"
const DEFAULT_SERVER_NAME = "unreal-mcp"
const PROXY_SERVER_NAME = "unreal-mcp-proxy"

interface PluginOptions {
  /** Remote MCP endpoint. Defaults to `UNREAL_MCP_URL` or localhost:8000/mcp. */
  url?: string
  /** MCP server name. Defaults to `unreal-mcp`. */
  serverName?: string
  /** Set to false to leave MCP configuration to the user. */
  mcp?: boolean
  /** Set to false to skip registering the bundled skills. */
  skills?: boolean
  /** Set to false to skip the Unreal project context note. */
  context?: boolean
}

interface McpEditor {
  get(name: string): unknown
  set(name: string, config: { type: "remote"; url: string; oauth: false }): void
}

interface SkillEditor {
  get(id: string): unknown
  add(skill: OpenCodeSkill): void
}

interface SessionContextEvent {
  system: Array<{ type: "text"; text: string }>
}

interface PluginContext {
  options?: Record<string, unknown>
  location: { directory: string }
  mcp: { transform(callback: (editor: McpEditor) => void): Promise<unknown> }
  skill: { transform(callback: (editor: SkillEditor) => void): Promise<unknown> }
  session: {
    hook(
      name: "context",
      callback: (event: SessionContextEvent) => void,
    ): Promise<unknown>
  }
}

/** Prefer the shared checkout skills; fall back to the packaged copy. */
function resolveSkillsRoot(packageRoot: string): string | undefined {
  const repositoryRoot = join(packageRoot, "..")
  const repositorySkills = join(repositoryRoot, "skills")
  if (
    existsSync(join(repositoryRoot, ".claude-plugin", "plugin.json")) &&
    existsSync(repositorySkills)
  ) {
    return repositorySkills
  }

  const packagedSkills = join(packageRoot, "skills")
  return existsSync(packagedSkills) ? packagedSkills : undefined
}

export default {
  id: "unreal-engine",

  async setup(ctx: PluginContext) {
    const options = (ctx.options ?? {}) as PluginOptions
    const serverName = options.serverName ?? DEFAULT_SERVER_NAME
    const url = options.url ?? process.env.UNREAL_MCP_URL ?? DEFAULT_URL
    const packageRoot = dirname(fileURLToPath(import.meta.url))
    const skillsRoot = resolveSkillsRoot(packageRoot)

    if (options.mcp !== false) {
      await ctx.mcp.transform((editor) => {
        // A proxy is a deliberate replacement for the direct connection, and
        // an explicit user entry wins over the default. Do not create both.
        if (editor.get(serverName) || editor.get(PROXY_SERVER_NAME)) return
        editor.set(serverName, { type: "remote", url, oauth: false })
      })
    }

    if (options.skills !== false && skillsRoot) {
      const skills = discoverSkills(skillsRoot)
      if (skills.length > 0) {
        await ctx.skill.transform((editor) => {
          for (const skill of skills) {
            // Respect a skill the user already configured under the same ID.
            if (editor.get(skill.id)) continue
            editor.add(skill)
          }
        })
      }
    }

    if (options.context !== false) {
      const cache = new Map<string, string | undefined>()
      await ctx.session.hook("context", (event) => {
        const directory = ctx.location.directory
        if (!cache.has(directory)) cache.set(directory, projectContext(directory))
        const context = cache.get(directory)
        if (context) event.system.push({ type: "text", text: context })
      })
    }
  },
}
