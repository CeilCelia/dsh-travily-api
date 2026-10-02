// Minimal asar reader/extractor (no deps).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const asarPath = process.argv[2]
const cmd = process.argv[3]
const arg = process.argv[4]

const fd = fs.openSync(asarPath, 'r')
const head = Buffer.alloc(16)
fs.readSync(fd, head, 0, 16, 0)
const jsonSize = head.readUInt32LE(12)
const headerBuf = Buffer.alloc(jsonSize)
fs.readSync(fd, headerBuf, 0, jsonSize, 16)
const header = JSON.parse(headerBuf.toString('utf8'))
// payload begins after the 8-byte pickle prefix, the 4-byte size + 4-byte payload
// size fields, and the JSON header, then padded to an 8-byte boundary.
const dataStart = Math.ceil((16 + jsonSize) / 8) * 8

function readFile(rel) {
  const parts = rel.split('/').filter(Boolean)
  let node = header
  for (const p of parts) node = node.files?.[p]
  if (!node || node.files) return null
  const buf = Buffer.alloc(node.size)
  fs.readSync(fd, buf, 0, node.size, dataStart + Number(node.offset))
  return buf
}

if (cmd === 'list') {
  const out = []
  const walk = (node, prefix) => {
    for (const [name, child] of Object.entries(node.files || {})) {
      const p = prefix + '/' + name
      if (child.files) walk(child, p)
      else out.push(p)
    }
  }
  walk(header, '')
  const re = arg ? new RegExp(arg) : null
  for (const p of out) if (!re || re.test(p)) console.log(p)
} else if (cmd === 'cat') {
  const buf = readFile(arg)
  if (!buf) { console.error('not found: ' + arg); process.exit(1) }
  process.stdout.write(buf)
} else if (cmd === 'extract') {
  const re = arg ? new RegExp(arg) : null
  const outRoot = process.argv[5]
  const unpackedRoot = path.join(path.dirname(asarPath), 'app.asar.unpacked')
  let n = 0
  let bad = 0
  let unpacked = 0
  let skipped = 0
  const walk = (node, prefix, dir) => {
    for (const [name, child] of Object.entries(node.files || {})) {
      const p = prefix + '/' + name
      const d = path.join(dir, name)
      if (child.files) { fs.mkdirSync(d, { recursive: true }); walk(child, p, d) }
      else if (!re || re.test(p)) {
        fs.mkdirSync(dir, { recursive: true })
        // Files marked `unpacked` (native addons) live outside the archive.
        if (child.unpacked === true || child.offset === undefined) {
          const bare = d.slice(outRoot.length).replace(/^[\\/]/u, '')
          const external = path.join(unpackedRoot, bare)
          if (fs.existsSync(external)) {
            fs.rmSync(d, { force: true })
            fs.symlinkSync(external, d, 'junction')
            unpacked++
          } else skipped++
          n++
          return
        }
        const buf = Buffer.alloc(child.size)
        fs.readSync(fd, buf, 0, child.size, dataStart + Number(child.offset))
        if (child.integrity?.hash) {
          const h = crypto.createHash('sha256').update(buf).digest('hex')
          if (h !== child.integrity.hash) {
            console.error('HASH MISMATCH ' + p + ' at ' + (dataStart + Number(child.offset)))
            bad++
          }
        }
        fs.writeFileSync(d, buf)
        n++
      }
    }
  }
  const outRootFinal = outRoot
  walk(header, '', outRootFinal)
  console.log(
    'extracted ' + n + ', mismatched ' + bad + ', unpacked ' + unpacked + ', skipped ' + skipped + ', dataStart ' + dataStart,
  )
}
fs.closeSync(fd)
