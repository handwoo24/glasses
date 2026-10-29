import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { hwpText, paraTexts, readCfb } from './hwp'

/** 레코드 머리(태그 10비트, 크기 12비트) + 본문 */
function record(tag: number, body: Buffer): Buffer {
  const header = Buffer.alloc(4)
  header.writeUInt32LE(tag | (body.length << 20))
  return Buffer.concat([header, body])
}

const utf16 = (s: string) => Buffer.from(s, 'utf16le')

describe('한글 본문 레코드', () => {
  test('문단 글자 레코드만 모은다', () => {
    const buf = Buffer.concat([
      record(66, Buffer.alloc(8)),
      record(67, utf16('납 품  기 한 : 2026/12/31\r')),
      record(68, Buffer.alloc(4)),
      record(67, utf16('사 업  금 액 : 1,327,094,000원')),
    ])
    expect(paraTexts(buf)).toEqual([
      '납 품  기 한 : 2026/12/31',
      '사 업  금 액 : 1,327,094,000원',
    ])
  })

  test('탭과 인라인 컨트롤도 16바이트를 차지한다', () => {
    const tab = Buffer.alloc(16)
    tab.writeUInt16LE(9, 0)
    const inline = Buffer.alloc(16)
    inline.writeUInt16LE(19, 0)
    const buf = record(
      67,
      Buffer.concat([utf16('가'), tab, utf16('나'), inline, utf16('다')]),
    )
    expect(paraTexts(buf)).toEqual(['가\t나다'])
  })

  test('잘린 확장 크기 레코드는 이유를 붙여 실패한다', () => {
    const header = Buffer.alloc(4)
    header.writeUInt32LE((67 | (0xfff << 20)) >>> 0)
    expect(() => paraTexts(header)).toThrow('한글 본문 레코드가 잘렸다')
  })

  test('16바이트 컨트롤 문자(표·그림 자리)는 건너뛴다', () => {
    const control = Buffer.alloc(16)
    control.writeUInt16LE(11, 0)
    const buf = record(67, Buffer.concat([utf16('앞'), control, utf16('뒤')]))
    expect(paraTexts(buf)).toEqual(['앞뒤'])
  })
})

describe('깨진 OLE 파일', () => {
  /** 512바이트 머리 + 빈 섹터 두 개. 필요한 칸만 채운다 */
  function header(fields: Record<number, number>): Buffer {
    const b = Buffer.alloc(512 * 3, 0)
    b.writeUInt16LE(9, 30) // 섹터 512
    b.writeUInt16LE(6, 32) // 미니 섹터 64
    b.fill(0xff, 76, 76 + 109 * 4)
    for (const [off, v] of Object.entries(fields))
      b.writeUInt32LE(v, Number(off))
    return b
  }

  test('DIFAT 사슬이 파일 밖을 가리키면 멈추지 않고 실패한다', () => {
    expect(() => readCfb(header({ 68: 1000, 44: 0 }))).toThrow('OLE')
  })

  test('DIFAT 섹터가 자기 자신을 가리켜도 멈춘다', () => {
    const b = header({ 68: 0, 44: 0 })
    b.writeUInt32LE(0, 512 + 508) // 섹터 0의 마지막 칸 = 다음 DIFAT 섹터 0
    expect(() => readCfb(b)).toThrow('OLE')
  })
})

// 나라장터에서 받은 실제 공고서가 로컬에 있을 때만 돈다 (저장소에 원문을 담지 않는다)
const SAMPLE = process.env.HWP_SAMPLE ?? ''
describe.skipIf(!SAMPLE || !existsSync(SAMPLE))('실제 한글 파일', () => {
  test('공고서 본문에서 사업금액과 납품기한을 읽는다', () => {
    const text = hwpText(readFileSync(SAMPLE))
    expect(text).toContain('사 업  금 액 : 1,327,094,000원')
    expect(text).toContain('납 품  기 한 : 2026/12/31')
  })
})
