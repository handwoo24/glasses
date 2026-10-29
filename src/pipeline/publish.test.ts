import { describe, expect, it } from 'vitest'
import { publishBlocker, vendorSlugBlocker } from './publish'

const written = '2026-10-28T12:00:00Z'
const before = '2026-10-28T11:00:00Z'
const after = '2026-10-28T13:00:00Z'

describe('publishBlocker', () => {
  it('고친 뒤의 마지막 검증이 pass면 게시한다', () => {
    const reports = [
      { asOf: '2026-10-28', status: 'in-review' as const, updatedAt: written },
    ]
    const reviews = [
      { report: '2026-10-28', verdict: 'fail' as const, reviewedAt: before },
      { report: '2026-10-28', verdict: 'pass' as const, reviewedAt: after },
    ]
    expect(publishBlocker('2026-10-28', reports, reviews)).toBeUndefined()
  })

  it('pass 뒤에 리포트를 고쳤으면 게시하지 않는다', () => {
    const reports = [
      { asOf: '2026-10-28', status: 'in-review' as const, updatedAt: after },
    ]
    const reviews = [
      { report: '2026-10-28', verdict: 'pass' as const, reviewedAt: written },
    ]
    expect(publishBlocker('2026-10-28', reports, reviews)).toMatch(/검증/)
  })

  it('마지막 검증이 fail이면 게시하지 않는다', () => {
    const reports = [
      { asOf: '2026-10-28', status: 'in-review' as const, updatedAt: before },
    ]
    const reviews = [
      { report: '2026-10-28', verdict: 'pass' as const, reviewedAt: written },
      { report: '2026-10-28', verdict: 'fail' as const, reviewedAt: after },
    ]
    expect(publishBlocker('2026-10-28', reports, reviews)).toMatch(/고침/)
  })

  it('검증이 없으면 게시하지 않는다', () => {
    const reports = [
      { asOf: '2026-10-28', status: 'in-review' as const, updatedAt: written },
    ]
    expect(publishBlocker('2026-10-28', reports, [])).toMatch(/검증/)
  })

  it('가장 늦은 판이 아니면 게시하지 않는다', () => {
    const reports = [
      { asOf: '2026-10-27', status: 'in-review' as const, updatedAt: before },
      { asOf: '2026-10-28', status: 'draft' as const, updatedAt: written },
    ]
    const reviews = [
      { report: '2026-10-27', verdict: 'pass' as const, reviewedAt: after },
    ]
    expect(publishBlocker('2026-10-27', reports, reviews)).toMatch(/가장 늦은/)
  })

  it('초안이면 게시하지 않는다', () => {
    const reports = [
      { asOf: '2026-10-28', status: 'draft' as const, updatedAt: written },
    ]
    const reviews = [
      { report: '2026-10-28', verdict: 'pass' as const, reviewedAt: after },
    ]
    expect(publishBlocker('2026-10-28', reports, reviews)).toMatch(/in-review/)
  })
})

describe('업체 게시 주소', () => {
  const A = 'programs/3940000.bus/vendors/1111111111'
  const B = 'programs/3940000.bus/vendors/2222222222'
  it('처음 게시는 통과', () => {
    expect(vendorSlugBlocker('a', A, [])).toBeUndefined()
  })
  it('다른 업체가 쓰는 주소는 막는다', () => {
    expect(vendorSlugBlocker('a', B, [{ slug: 'a', subject: A }])).toContain(
      '다른 업체',
    )
  })
  it('이미 게시된 업체의 주소를 바꾸지 않는다', () => {
    expect(vendorSlugBlocker('b', A, [{ slug: 'a', subject: A }])).toContain(
      '이미 a로 게시',
    )
    expect(
      vendorSlugBlocker('a', A, [{ slug: 'a', subject: A }]),
    ).toBeUndefined()
  })
})
