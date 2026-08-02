import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = readFileSync(new URL('../src/tools/telegram/telegramCore.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
const module = { exports: {} }
vm.runInNewContext(outputText, { module, exports: module.exports, require })

const {
  createManifest,
  maxTelegramPartBytes,
  parseManifest,
  partCount,
  planTelegramParts,
} = module.exports

assert.equal(partCount(0), 1)
assert.equal(partCount(maxTelegramPartBytes), 1)
assert.equal(partCount(maxTelegramPartBytes + 1), 2)

const ranges = planTelegramParts(maxTelegramPartBytes * 2 + 7)
assert.equal(JSON.stringify(ranges), JSON.stringify([
  { index: 0, start: 0, end: maxTelegramPartBytes },
  { index: 1, start: maxTelegramPartBytes, end: maxTelegramPartBytes * 2 },
  { index: 2, start: maxTelegramPartBytes * 2, end: maxTelegramPartBytes * 2 + 7 },
]))

const manifest = createManifest(
  { name: 'demo.bin', type: 'application/octet-stream', size: maxTelegramPartBytes + 1 },
  [
    { index: 0, fileId: 'a', fileName: 'demo.part-001', size: maxTelegramPartBytes },
    { index: 1, fileId: 'b', fileName: 'demo.part-002', size: 1 },
  ],
)
assert.equal(parseManifest(JSON.stringify(manifest)).parts.length, 2)
assert.equal(createManifest({ name: 'photo.PNG', size: 3 }, [{ index: 0, fileId: 'image', fileName: 'photo.PNG', size: 3 }]).mimeType, 'image/png')
assert.throws(() => parseManifest(JSON.stringify({ ...manifest, parts: [{ ...manifest.parts[0], size: maxTelegramPartBytes + 1 }] })))
assert.throws(() => parseManifest(JSON.stringify({ ...manifest, parts: [{ ...manifest.parts[0], index: 1 }] })))

console.log('telegram-core self-check ok')
