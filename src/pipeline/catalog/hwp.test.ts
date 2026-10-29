import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { hwpText, paraTexts } from './hwp'

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

  test('16바이트 컨트롤 문자(표·그림 자리)는 건너뛴다', () => {
    const control = Buffer.alloc(16)
    control.writeUInt16LE(11, 0)
    const buf = record(67, Buffer.concat([utf16('앞'), control, utf16('뒤')]))
    expect(paraTexts(buf)).toEqual(['앞뒤'])
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
