import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"
import plugin from "../index.ts"
import type { OpenCodeSkill } from "../skills.ts"

const roots: string[] = []

async function unrealProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "unreal-plugin-"))
  roots.push(root)
  await writeFile(join(root, "MyGame.uproject"), "{}")
  await mkdir(join(root, "Source", "MyGame"), { recursive: true })
  return join(root, "Source", "MyGame")
}

after(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
})

interface Harness {
  ctx: Parameters<typeof plugin.setup>[0]
  mcp: Map<string, unknown>
  skills: Map<string, OpenCodeSkill>
  context?: (event: { system: Array<{ type: "text"; text: string }> }) => void
}

function harness(directory: string, options: Record<string, unknown> = {}, existing = false): Harness {
  const mcp = new Map<string, unknown>()
  const skills = new Map<string, OpenCodeSkill>()
  const state: Harness = { mcp, skills, ctx: undefined as never }

  if (existing) {
    mcp.set("unreal-mcp-proxy", { type: "local", command: ["proxy"] })
    skills.set("unreal-mcp", {
      id: "unreal-mcp",
      name: "Custom",
      description: "User override",
      path: "/tmp/custom/SKILL.md",
      content: "custom",
    })
  }

  state.ctx = {
    options,
    location: { directory },
    mcp: {
      async transform(callback: (editor: {
        get(name: string): unknown
        set(name: string, config: { type: "remote"; url: string; oauth: false }): void
      }) => void) {
        callback({
          get: (name) => mcp.get(name),
          set: (name, config) => {
            mcp.set(name, config)
          },
        })
      },
    },
    skill: {
      async transform(callback: (editor: {
        get(id: string): unknown
        add(skill: OpenCodeSkill): void
      }) => void) {
        callback({
          get: (id) => skills.get(id),
          add: (skill) => {
            skills.set(skill.id, skill)
          },
        })
      },
    },
    session: {
      async hook(_name: "context", callback: (event: {
        system: Array<{ type: "text"; text: string }>
      }) => void) {
        state.context = callback
      },
    },
  }

  return state
}

describe("unreal-engine plugin", () => {
  it("registers the MCP server, the three skills, and the context hook", async () => {
    const directory = await unrealProject()
    const state = harness(directory)

    await plugin.setup(state.ctx)

    assert.deepEqual(state.mcp.get("unreal-mcp"), {
      type: "remote",
      url: "http://127.0.0.1:8000/mcp",
      oauth: false,
    })
    assert.deepEqual(
      [...state.skills.keys()].sort(),
      ["create-toolset", "unreal-mcp", "unreal-skill"],
    )
    assert.equal(state.skills.get("unreal-mcp")?.name, "unreal-mcp")

    const event = { system: [] as Array<{ type: "text"; text: string }> }
    state.context?.(event)
    assert.match(event.system[0]?.text ?? "", /The project is `MyGame\.uproject`/)
  })

  it("does not add a direct connection when a proxy is configured", async () => {
    const directory = await unrealProject()
    const state = harness(directory, {}, true)

    await plugin.setup(state.ctx)

    assert.equal(state.mcp.has("unreal-mcp"), false)
    assert.equal(state.mcp.has("unreal-mcp-proxy"), true)
  })

  it("keeps a user-defined skill with the same ID", async () => {
    const directory = await unrealProject()
    const state = harness(directory, {}, true)

    await plugin.setup(state.ctx)

    assert.equal(state.skills.get("unreal-mcp")?.name, "Custom")
    assert.equal(state.skills.get("create-toolset")?.name, "create-toolset")
  })

  it("honours the URL option and lets the user disable MCP registration", async () => {
    const directory = await unrealProject()
    const custom = harness(directory, { url: "http://127.0.0.1:9000/mcp" })
    await plugin.setup(custom.ctx)
    assert.equal((custom.mcp.get("unreal-mcp") as { url: string }).url, "http://127.0.0.1:9000/mcp")

    const disabled = harness(directory, { mcp: false })
    await plugin.setup(disabled.ctx)
    assert.equal(disabled.mcp.size, 0)
  })

  it("does not inject context outside an Unreal project", async () => {
    const root = await mkdtemp(join(tmpdir(), "unreal-plugin-"))
    roots.push(root)
    const state = harness(root)

    await plugin.setup(state.ctx)

    const event = { system: [] as Array<{ type: "text"; text: string }> }
    state.context?.(event)
    assert.deepEqual(event.system, [])
  })
})
