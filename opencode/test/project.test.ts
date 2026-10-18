import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"
import {
  buildContext,
  detectProject,
  findProjectRoot,
} from "../project.ts"

const roots: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "unreal-opencode-"))
  roots.push(directory)
  return directory
}

after(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
})

describe("findProjectRoot", () => {
  it("walks up from a nested source directory to the .uproject", async () => {
    const root = await temporaryDirectory()
    await writeFile(join(root, "MyGame.uproject"), "{}")
    const nested = join(root, "Source", "MyGame")
    await mkdir(nested, { recursive: true })

    assert.equal(findProjectRoot(nested), root)
  })

  it("recognises GenerateProjectFiles markers", async () => {
    const root = await temporaryDirectory()
    await writeFile(join(root, "GenerateProjectFiles.sh"), "")
    const nested = join(root, "Engine", "Source", "Runtime", "Engine")
    await mkdir(nested, { recursive: true })

    assert.equal(findProjectRoot(nested), root)
  })

  it("does not mistake a bare Engine module for the engine root", async () => {
    const root = await temporaryDirectory()
    const nested = join(root, "Engine", "Source", "Runtime", "Engine")
    await mkdir(nested, { recursive: true })

    assert.equal(findProjectRoot(nested), undefined)
  })

  it("returns undefined outside an Unreal project", async () => {
    const root = await temporaryDirectory()
    assert.equal(findProjectRoot(join(root, "src")), undefined)
  })
})

describe("detectProject", () => {
  it("reports a game project and its uproject name", async () => {
    const root = await temporaryDirectory()
    await writeFile(join(root, "MyGame.uproject"), "{}")
    await mkdir(join(root, "Content"))

    assert.deepEqual(detectProject(join(root, "Content")), {
      root,
      kind: "game",
      uproject: "MyGame.uproject",
    })
  })

  it("reports an engine source tree", async () => {
    const root = await temporaryDirectory()
    await writeFile(join(root, "GenerateProjectFiles.command"), "")
    await mkdir(join(root, "Engine"))

    assert.deepEqual(detectProject(root), {
      root,
      kind: "engine",
      uproject: undefined,
    })
  })

  it("ignores directories named like a uproject", async () => {
    const root = await temporaryDirectory()
    await mkdir(join(root, "NotAProject.uproject"), { recursive: true })

    assert.equal(detectProject(root), undefined)
  })
})

describe("buildContext", () => {
  it("names a game project and points at the skill and console command", () => {
    const context = buildContext({
      root: "/projects/MyGame",
      kind: "game",
      uproject: "MyGame.uproject",
    })

    assert.match(context, /The project is `MyGame\.uproject`/)
    assert.match(context, /`unreal-mcp` skill/)
    assert.match(context, /ModelContextProtocol\.StartServer/)
  })

  it("labels an engine source tree", () => {
    const context = buildContext({ root: "/engine", kind: "engine" })
    assert.match(context, /Engine source tree/)
  })
})
