import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"
import { discoverSkills, parseSkillMarkdown } from "../skills.ts"

const roots: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "unreal-skills-"))
  roots.push(directory)
  return directory
}

after(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
})

describe("parseSkillMarkdown", () => {
  it("reads name and description and strips frontmatter", () => {
    const parsed = parseSkillMarkdown(
      [
        "---",
        "name: unreal-mcp",
        'description: "Drive the editor: actors, blueprints, and more."',
        "---",
        "",
        "# Body",
        "",
        "Instructions.",
      ].join("\n"),
    )

    assert.equal(parsed.name, "unreal-mcp")
    assert.equal(parsed.description, "Drive the editor: actors, blueprints, and more.")
    assert.equal(parsed.content, "# Body\n\nInstructions.")
  })

  it("handles CRLF frontmatter", () => {
    const parsed = parseSkillMarkdown("---\r\nname: test\r\n---\r\nBody\r\n")
    assert.equal(parsed.name, "test")
    assert.equal(parsed.content, "Body\r\n")
  })

  it("leaves markdown without frontmatter alone", () => {
    const parsed = parseSkillMarkdown("# Just content\n")
    assert.equal(parsed.name, undefined)
    assert.equal(parsed.content, "# Just content\n")
  })
})

describe("discoverSkills", () => {
  it("finds nested SKILL.md files and derives IDs from directories", async () => {
    const root = await temporaryDirectory()
    await mkdir(join(root, "unreal-mcp", "references"), { recursive: true })
    await writeFile(
      join(root, "unreal-mcp", "SKILL.md"),
      "---\nname: Unreal MCP\ndescription: Drive the editor.\n---\nBody\n",
    )
    await writeFile(join(root, "unreal-mcp", "references", "setup.md"), "setup")
    await mkdir(join(root, "create-toolset"))
    await writeFile(
      join(root, "create-toolset", "SKILL.md"),
      "---\ndescription: Author toolsets.\n---\nBody\n",
    )

    const skills = discoverSkills(root)

    assert.deepEqual(
      skills.map((skill) => skill.id),
      ["create-toolset", "unreal-mcp"],
    )
    assert.equal(skills[1].name, "Unreal MCP")
    assert.equal(skills[1].description, "Drive the editor.")
    assert.equal(skills[1].content, "Body\n")
    assert.equal(skills[0].name, "create-toolset")
  })

  it("skips node_modules and hidden directories", async () => {
    const root = await temporaryDirectory()
    for (const directory of ["node_modules/pkg", ".cache/pkg"]) {
      await mkdir(join(root, directory), { recursive: true })
      await writeFile(join(root, directory, "SKILL.md"), "---\nname: nope\n---\n")
    }

    assert.deepEqual(discoverSkills(root), [])
  })
})
