// 목록 페이지 나누기. 쪽 번호는 주소(?page=)에 남아 그대로 공유된다.
import { z } from 'zod'

/** 한 쪽에 보이는 줄 수 */
export const PAGE_SIZE = 20

/** ?page=: 1부터. 숫자로 읽힌 값도 받고 틀린 값은 버린다 */
export const PageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .optional()
  .catch(undefined)

export interface Paged<T> {
  rows: Array<T>
  /** 1부터, 범위를 넘으면 마지막 쪽으로 */
  page: number
  pages: number
  total: number
  /** 이 쪽 첫 줄의 순번 (1부터, 비었으면 0) */
  from: number
  to: number
}

export function paginate<T>(
  all: ReadonlyArray<T>,
  page: number | undefined,
  size = PAGE_SIZE,
): Paged<T> {
  const pages = Math.max(1, Math.ceil(all.length / size))
  const current = Math.min(Math.max(1, page ?? 1), pages)
  const start = (current - 1) * size
  const rows = all.slice(start, start + size)
  return {
    rows,
    page: current,
    pages,
    total: all.length,
    from: rows.length ? start + 1 : 0,
    to: start + rows.length,
  }
}

/** 쪽 번호 단추: 처음·끝과 지금 쪽 앞뒤 하나. 사이가 비면 null(…) */
export function pageItems(page: number, pages: number): Array<number | null> {
  const keep = new Set([1, pages, page - 1, page, page + 1])
  const nums = [...keep]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b)
  return nums.flatMap((n, i) =>
    i > 0 && n - nums[i - 1] > 1 ? [null, n] : [n],
  )
}
