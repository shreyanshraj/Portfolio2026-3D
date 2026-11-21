// Writes base64 copies of public/models/*.glb and public/media/*.mp4 into
// src/scene/sources/, for hosts that can't serve those file types
// (used by `npm run build:inline`).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

function inline(folder, ext, out) {
  const dir = new URL(`../public/${folder}/`, import.meta.url)
  const entries = readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => `  ${JSON.stringify(f.replace(ext, ''))}: ${JSON.stringify(readFileSync(new URL(f, dir)).toString('base64'))},`)
  writeFileSync(new URL(`../src/scene/sources/${out}`, import.meta.url), `export default {\n${entries.join('\n')}\n}\n`)
  console.log(`inlined ${entries.length} ${folder}`)
}
inline('models', '.glb', 'inline.generated.js')
inline('media', '.mp4', 'inline-media.generated.js')
