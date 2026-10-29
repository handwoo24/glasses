// 쪽 번호 줄. 쪽마다 진짜 링크(주소 ?page=)라 새 탭·공유·뒤로 가기가 그대로 된다
import { Link } from '@tanstack/react-router'
import { pageItems } from '../paging'
import type { Paged } from '../paging'

interface PagerProps {
  paged: Paged<unknown>
  /** 화면 낭독용: ‘사업 목록 쪽’ */
  label: string
}

export function Pager({ paged, label }: PagerProps) {
  const { page, pages, total, from, to } = paged
  return (
    <nav aria-label={label} className="pager">
      <p className="count">
        {total.toLocaleString('ko-KR')}건 중 {from}–{to}
      </p>
      {pages > 1 && (
        <ol>
          <li>
            <PageLink page={page - 1} disabled={page === 1} rel="prev">
              이전
            </PageLink>
          </li>
          {pageItems(page, pages).map((n, i) =>
            n === null ? (
              <li key={`gap-${i}`} aria-hidden="true" className="gap">
                …
              </li>
            ) : (
              <li key={n}>
                <PageLink page={n} current={n === page}>
                  {n}
                </PageLink>
              </li>
            ),
          )}
          <li>
            <PageLink page={page + 1} disabled={page === pages} rel="next">
              다음
            </PageLink>
          </li>
        </ol>
      )}
    </nav>
  )
}

interface PageLinkProps {
  page: number
  current?: boolean
  disabled?: boolean
  rel?: 'prev' | 'next'
  children: React.ReactNode
}

function PageLink({ page, current, disabled, rel, children }: PageLinkProps) {
  // 지금 쪽은 링크가 아니다. 주소의 쪽 번호가 범위를 넘어 마지막 쪽을 보일 때도 맞게 표시된다
  if (current)
    return (
      <span className="pg" aria-current="page" aria-label={`${page}쪽`}>
        {children}
      </span>
    )
  if (disabled)
    return (
      <span className="pg off" aria-disabled="true">
        {children}
      </span>
    )
  return (
    <Link
      to="."
      search={(prev: Record<string, unknown>) => ({
        ...prev,
        page: page === 1 ? undefined : page,
      })}
      className="pg"
      rel={rel}
      // 같은 경로의 링크라 TanStack이 모든 쪽을 ‘지금 쪽’(aria-current)으로 표시하지 않게, 검색 조건까지 완전히 같아야 active
      activeOptions={{ includeSearch: true, explicitUndefined: true }}
      aria-label={rel ? undefined : `${page}쪽`}
      resetScroll
    >
      {children}
    </Link>
  )
}
