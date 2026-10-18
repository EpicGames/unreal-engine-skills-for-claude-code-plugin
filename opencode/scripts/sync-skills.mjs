// Copies the repository's shared skills into the package before npm packs or
// installs it. The plugin also resolves ../skills for local checkouts, so this
// copy is only needed for published tarballs and Git installs.
import { cp, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(packageRoot, "..", "skills")
const target = join(packageRoot, "skills")

await rm(target, { recursive: true, force: true })
await cp(source, target, { recursive: true })
console.log(`Copied ${source} -> ${target}`)
