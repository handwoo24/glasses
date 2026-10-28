// 평가 대상 경로로 리포트 화면에 링크한다. 사업은 /programs/…, 재정 문서는 /orgs/…/budgets/…
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

const PROGRAM = /^programs\/([^/]+)$/
const BUDGET = /^orgs\/([^/]+)\/budgets\/([^/]+)$/

interface ReportLinkProps {
  subject?: string
  /** 대상 경로가 없는 옛 게시 문서는 옛 주소로 (그 주소가 새 주소로 넘긴다) */
  slug: string
  className?: string
  children: ReactNode
}

export function ReportLink({
  subject,
  slug,
  className,
  children,
}: ReportLinkProps) {
  const program = subject?.match(PROGRAM)
  if (program)
    return (
      <Link
        to="/programs/$programId"
        params={{ programId: program[1] }}
        className={className}
      >
        {children}
      </Link>
    )
  const budget = subject?.match(BUDGET)
  if (budget)
    return (
      <Link
        to="/orgs/$orgId/budgets/$budgetId"
        params={{ orgId: budget[1], budgetId: budget[2] }}
        className={className}
      >
        {children}
      </Link>
    )
  return (
    <Link to="/reports/$slug" params={{ slug }} className={className}>
      {children}
    </Link>
  )
}
