// 한글(HWP 5) 문서의 본문 글자를 꺼낸다. 외부 도구 없이 OLE 복합 파일과 압축을 직접 읽는다.
// 문단 글자(PARA_TEXT) 레코드만 모으고, 표 칸·그림 같은 컨트롤은 건너뛴다.
import { inflateRawSync } from 'node:zlib'

const FREE = 0xffffffff
const END = 0xfffffffe
/** HWPTAG_BEGIN(0x10) + 51 */
const PARA_TEXT = 67
/** 16바이트(8글자)를 차지하는 컨트롤 문자: 확장(1-3, 11, 12, 14-18, 21-23)과 인라인(4-9, 19, 20). 탭(9)도 인라인이다 */
const WIDE_CONTROLS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
])
/** 압축을 푼 본문 한 구역의 상한. 압축 폭탄으로 메모리를 다 쓰지 않게 한다 */
const MAX_SECTION_BYTES = 256 * 1024 * 1024

function broken(why: string): Error {
  return new Error(`OLE 복합 파일이 깨졌다: ${why}`)
}

interface Entry {
  name: string
  type: number
  left: number
  right: number
  child: number
  start: number
  size: number
}

/** OLE 복합 파일 → 스트림 경로(BodyText/Section0 …)별 내용 */
export function readCfb(data: Buffer): Map<string, Buffer> {
  const secSize = 1 << data.readUInt16LE(30)
  const miniSize = 1 << data.readUInt16LE(32)
  const nFat = data.readUInt32LE(44)
  const dirStart = data.readUInt32LE(48)
  const miniCutoff = data.readUInt32LE(56)
  const miniFatStart = data.readUInt32LE(60)
  const difatStart = data.readUInt32LE(68)
  const sectorCount = Math.floor(data.length / secSize) - 1
  const sector = (i: number) => {
    if (!Number.isInteger(i) || i < 0 || i >= sectorCount)
      throw broken(`섹터 ${i}이 파일 밖`)
    return data.subarray((i + 1) * secSize, (i + 2) * secSize)
  }
  const words = (b: Buffer) =>
    Array.from({ length: b.length / 4 }, (_, k) => b.readUInt32LE(k * 4))

  const difat = words(data.subarray(76, 76 + 109 * 4))
  const seenDifat = new Set<number>()
  for (let next = difatStart; next !== FREE && next !== END;) {
    if (seenDifat.has(next)) throw broken('DIFAT 사슬이 돈다')
    seenDifat.add(next)
    const w = words(sector(next))
    difat.push(...w.slice(0, -1))
    next = w[w.length - 1]
  }
  if (nFat > sectorCount) throw broken(`FAT 섹터 수 ${nFat}`)
  const fat = difat.slice(0, nFat).flatMap((i) => words(sector(i)))
  const chain = (start: number, table: ReadonlyArray<number>) => {
    const out: Array<number> = []
    const seen = new Set<number>()
    for (let i = start; i !== FREE && i !== END && i < table.length;) {
      if (seen.has(i)) break
      seen.add(i)
      out.push(i)
      i = table[i]
    }
    return out
  }
  const readChain = (start: number) =>
    Buffer.concat(chain(start, fat).map(sector))

  const dir = readChain(dirStart)
  const entries: Array<Entry> = []
  for (let off = 0; off + 128 <= dir.length; off += 128) {
    const e = dir.subarray(off, off + 128)
    const nameLen = e.readUInt16LE(64)
    entries.push({
      name: e.subarray(0, Math.max(nameLen - 2, 0)).toString('utf16le'),
      type: e[66],
      left: e.readUInt32LE(68),
      right: e.readUInt32LE(72),
      child: e.readUInt32LE(76),
      start: e.readUInt32LE(116),
      size: e.readUInt32LE(120),
    })
  }
  const root = entries[0]
  const mini = readChain(root.start)
  const miniFat = chain(miniFatStart, fat).flatMap((i) => words(sector(i)))
  const read = (e: Entry) =>
    e.size < miniCutoff
      ? Buffer.concat(
          chain(e.start, miniFat).map((i) =>
            mini.subarray(i * miniSize, (i + 1) * miniSize),
          ),
        ).subarray(0, e.size)
      : readChain(e.start).subarray(0, e.size)

  const streams = new Map<string, Buffer>()
  const visited = new Set<number>()
  const walk = (idx: number, prefix: string) => {
    if (idx === FREE || idx >= entries.length) return
    if (visited.has(idx)) throw broken('디렉터리 트리가 돈다')
    visited.add(idx)
    const e = entries[idx]
    walk(e.left, prefix)
    walk(e.right, prefix)
    if (e.type === 2) streams.set(prefix + e.name, read(e))
    else if (e.type === 1) walk(e.child, `${prefix}${e.name}/`)
  }
  walk(root.child, '')
  return streams
}

/** 본문 레코드 → 문단 글자들 */
export function paraTexts(buf: Buffer): Array<string> {
  const out: Array<string> = []
  let pos = 0
  while (pos + 4 <= buf.length) {
    const header = buf.readUInt32LE(pos)
    pos += 4
    const tag = header & 0x3ff
    let size = (header >>> 20) & 0xfff
    if (size === 0xfff) {
      if (pos + 4 > buf.length) throw new Error('한글 본문 레코드가 잘렸다')
      size = buf.readUInt32LE(pos)
      pos += 4
    }
    const body = buf.subarray(pos, pos + size)
    pos += size
    if (tag !== PARA_TEXT) continue
    let text = ''
    for (let i = 0; i + 2 <= body.length;) {
      const c = body.readUInt16LE(i)
      if (c < 32) {
        if (c === 9) text += '\t'
        if (WIDE_CONTROLS.has(c)) {
          i += 16
          continue
        }
        if (c === 10 || c === 13) text += '\n'
        i += 2
        continue
      }
      text += String.fromCharCode(c)
      i += 2
    }
    out.push(text.replace(/\n+$/, ''))
  }
  return out
}

/** 한글 파일 → 문단마다 한 줄인 글자 */
export function hwpText(file: Buffer): string {
  const streams = readCfb(file)
  const header = streams.get('FileHeader')
  if (!header) throw new Error('한글(HWP 5) 파일이 아니다: FileHeader 없음')
  const compressed = (header.readUInt32LE(36) & 1) === 1
  const sections = [...streams.keys()]
    .filter((p) => p.startsWith('BodyText/Section'))
    .sort(
      (a, b) => Number(a.split('Section')[1]) - Number(b.split('Section')[1]),
    )
  const lines = sections.flatMap((p) => {
    const raw = streams.get(p) as Buffer
    return paraTexts(
      compressed
        ? inflateRawSync(raw, { maxOutputLength: MAX_SECTION_BYTES })
        : raw,
    )
  })
  return `${lines.join('\n')}\n`
}
