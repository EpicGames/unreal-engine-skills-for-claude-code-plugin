import { readdirSync, readFileSync, statSync, type Dirent } from "node:fs"
import { basename, dirname, join } from "node:path"

export interface OpenCodeSkill {
  id: string
  name: string
  description: string
  path: string
  content: string
}

export interface ParsedSkill {
  name?: string
  description?: string
  content: string
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'")
  }
  return trimmed
}

/** Parses the small YAML subset used by SKILL.md frontmatter. */
export function parseSkillMarkdown(markdown: string): ParsedSkill {
  const text = markdown.replace(/^\uFEFF/, "")
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return { content: text }
  }

  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!match) return { content: text }

  const parsed: ParsedSkill = {
    content: text.slice(match[0].length).replace(/^\r?\n/, ""),
  }
  for (const line of match[1].split(/\r?\n/)) {
    if (!line || /^\s/.test(line)) continue
    const separator = line.indexOf(":")
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = unquote(line.slice(separator + 1))
    if (key === "name") parsed.name = value
    if (key === "description") parsed.description = value
  }
  return parsed
}

/** Finds every `SKILL.md` below `root` and returns the skills it defines. */
export function discoverSkills(root: string): OpenCodeSkill[] {
  const skills: OpenCodeSkill[] = []

  const walk = (directory: string): void => {
    let entries: Dirent[]
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (entry.name !== "SKILL.md") continue

      const markdown = readFileSync(path, "utf8")
      const parsed = parseSkillMarkdown(markdown)
      const id = basename(dirname(path))
      skills.push({
        id,
        name: parsed.name ?? id,
        description: parsed.description ?? "",
        path,
        content: parsed.content,
      })
    }
  }

  if (isDirectory(root)) walk(root)
  return skills.sort((a, b) => a.id.localeCompare(b.id))
}
