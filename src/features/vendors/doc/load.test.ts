import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { vendorOverallStatus } from '../axes'
import type { VendorAxisEvidence, VendorAxisStatuses } from '../axes'
import { lintVendorDoc } from './lint'
import { loadVendorDoc } from './load'

const fixture = readFileSync(
  new URL('./__fixtures__/samsung-tng.md', import.meta.url),
  'utf8',
)

describe('업체 리포트 문서 읽기', () => {
  const doc = loadVendorDoc(fixture)

  test('머리말과 제목·리드를 읽는다', () => {
    expect(doc.vendor).toBe('주식회사 삼성티엔지')
    expect(doc.bizno).toBe('109-86-28406')
    expect(doc.program).toBe('programs/3940000.autonomous-bus')
    expect(doc.title).toBe(
      '주식회사 삼성티엔지 · 스마트시티센터 정보시스템 유지보수',
    )
    expect(doc.asOf).toBe('2026. 10. 29.')
  })

  test('6개 축의 상태와 근거 수준을 읽고 종합 판정은 규칙으로 정한다', () => {
    const statuses = Object.fromEntries(
      Object.entries(doc.axes).map(([k, v]) => [k, v.status]),
    ) as VendorAxisStatuses
    const levels = Object.fromEntries(
      Object.entries(doc.axes).map(([k, v]) => [k, v.evidence]),
    ) as VendorAxisEvidence
    expect(statuses).toEqual({
      selection: 'watch',
      scope: 'unknown',
      delivery: 'on-track',
      output: 'on-track',
      cost: 'watch',
      record: 'on-track',
    })
    expect(levels.output).toBe('thin')
    expect(vendorOverallStatus(statuses, levels)).toBe('watch')
  })

  test('종합 판정 구역은 판정 문단 없이 다음 판단 시점만 갖는다', () => {
    expect(doc.nextDates.map((d) => d.when)).toEqual([
      '11. 12.~19.',
      '12. 31.',
      '2027년 1월',
    ])
    expect(doc.nextDates[0].date).toBe('2026-11-12')
  })

  test('점검표는 업체 축으로 나눈다', () => {
    expect(new Set(doc.checks.map((c) => c.axis))).toEqual(
      new Set(['selection', 'delivery', 'output', 'cost', 'record']),
    )
  })

  test('문장 규칙을 통과한다', () => {
    expect(lintVendorDoc(doc)).toEqual([])
  })

  test('사업 리포트의 구역을 쓰면 실패한다', () => {
    expect(() =>
      loadVendorDoc(fixture.replace('## 맡은 일', '## 사업 개요')),
    ).toThrow('알 수 없는 구역')
  })

  test('축이 하나 빠지면 실패한다', () => {
    const noRecord = fixture.replace(/### ⑥ 이력[\s\S]*?(?=\n## )/, '')
    expect(() => loadVendorDoc(noRecord)).toThrow('6개 축')
  })
})
