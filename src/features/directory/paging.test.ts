import { describe, expect, it } from 'vitest'
import { PageSchema, pageItems, paginate } from './paging'

const rows = Array.from({ length: 45 }, (_, i) => i + 1)

describe('페이지 나누기', () => {
  it('첫 쪽은 1~20', () => {
    const p = paginate(rows, undefined)
    expect(p).toMatchObject({ page: 1, pages: 3, total: 45, from: 1, to: 20 })
    expect(p.rows[0]).toBe(1)
  })

  it('마지막 쪽은 남은 줄만', () => {
    const p = paginate(rows, 3)
    expect(p.rows).toEqual([41, 42, 43, 44, 45])
    expect(p).toMatchObject({ from: 41, to: 45 })
  })

  it('범위를 넘는 쪽은 마지막 쪽으로 (필터로 줄이 줄었을 때)', () => {
    expect(paginate(rows, 9).page).toBe(3)
  })

  it('빈 목록도 한 쪽', () => {
    expect(paginate([], 2)).toMatchObject({
      page: 1,
      pages: 1,
      total: 0,
      from: 0,
      to: 0,
    })
  })

  it('쪽 번호 단추는 처음·끝·앞뒤만, 사이는 줄임', () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(1, 3)).toEqual([1, 2, 3])
    expect(pageItems(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageItems(10, 10)).toEqual([1, null, 9, 10])
  })

  it('주소의 쪽 번호', () => {
    expect(PageSchema.parse('3')).toBe(3)
    expect(PageSchema.parse(2)).toBe(2)
    expect(PageSchema.parse('0')).toBeUndefined()
    expect(PageSchema.parse('abc')).toBeUndefined()
  })
})
