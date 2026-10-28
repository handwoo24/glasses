import { Link } from '@tanstack/react-router'
import { formatKrwThousand } from '../format'
import { AREAS } from '../schema'
import type { Check, CheckResult, Report } from '../schema'
import {
  AREA_INFO,
  EXCLUSION_INFO,
  RESULT_INFO,
  exclusionOf,
  gradeOf,
} from '../rubric'
import { Cite } from './cite'
import { GradeBadge } from './grade-badge'

const MARK_TONE: Record<CheckResult, string> = {
  pass: 'text-grade-good border-grade-good',
  warn: 'text-grade-caution border-grade-caution',
  fail: 'text-grade-poor border-grade-poor',
  unknown: 'text-grade-insufficient border-grade-insufficient border-dashed',
}

interface ChecklistProps {
  checks: ReadonlyArray<Check>
  skipped: Report['skippedAreas']
  total?: number
}

export function Checklist({ checks, skipped, total }: ChecklistProps) {
  const areas = AREAS.filter((a) => checks.some((c) => c.area === a))
  return (
    <div className="space-y-10">
      {areas.map((a) => {
        const items = checks.filter((c) => c.area === a)
        return (
          <section key={a} id={`check-${a}`} className="scroll-mt-24">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-2">
              <h3 className="m-0 font-serif text-[1.1rem] font-bold">
                {AREA_INFO[a].label}
              </h3>
              <GradeBadge grade={gradeOf(items, { total })} size="sm" />
            </header>
            <p className="m-0 mt-2 text-[13px] text-muted">
              {AREA_INFO[a].question}
            </p>
            <ul className="m-0 mt-3 list-none divide-y divide-rule p-0">
              {items.map((c, i) => (
                <CheckItem
                  key={`${i}-${c.question}`}
                  check={c}
                  excluded={exclusionOf(c, checks, { total })}
                  total={total}
                />
              ))}
            </ul>
          </section>
        )
      })}
      {skipped.length > 0 && (
        <section
          id="skipped-areas"
          className="scroll-mt-24 border-t border-ink pt-3"
        >
          <h3 className="m-0 text-[14px] font-semibold">점검하지 않은 영역</h3>
          <dl className="m-0 mt-2 space-y-1.5 text-[14px]">
            {skipped.map((s) => (
              <div key={s.area} className="flex flex-wrap gap-x-3">
                <dt className="font-medium">{AREA_INFO[s.area].label}</dt>
                <dd className="m-0 text-ink-soft">{s.reason}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <p className="m-0 text-[13px] text-muted">
        등급은 점검 결과로 자동 계산합니다. 같은 원인에서 나온 지적은 한 번만,
        점검 대상 금액의 1%에 못 미치는 지적은 빼고 셉니다.{' '}
        <Link to="/method" className="text-accent underline underline-offset-2">
          계산 규칙 보기
        </Link>
      </p>
    </div>
  )
}

interface CheckItemProps {
  check: Check
  excluded?: keyof typeof EXCLUSION_INFO
  total?: number
}

function CheckItem({ check: c, excluded, total }: CheckItemProps) {
  return (
    <li className="grid grid-cols-[2.25rem_1fr] gap-x-3 py-4">
      <span
        className={`flex size-8 items-center justify-center rounded-full border-[1.5px] text-[15px] font-bold ${MARK_TONE[c.result]} ${excluded ? 'border-dashed' : ''}`}
      >
        <span aria-hidden>{RESULT_INFO[c.result].mark}</span>
        <span className="sr-only">{RESULT_INFO[c.result].label}</span>
      </span>
      <div>
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] font-semibold leading-snug">
          {c.question}
          {excluded && (
            <span className="rounded-[3px] border border-rule px-1.5 text-[11.5px] font-medium text-muted">
              {EXCLUSION_INFO[excluded]}
            </span>
          )}
        </p>
        <p className="m-0 mt-1.5 text-[15px] leading-[1.8] text-ink-soft">
          {c.finding}
          <Cite ids={c.cite} />
        </p>
        <dl className="m-0 mt-2 space-y-1 border-l-2 border-rule pl-3 text-[13px] leading-relaxed text-muted">
          <div>
            <dt className="inline font-semibold">판단 기준 · </dt>
            <dd className="m-0 inline">{c.criterion}</dd>
          </div>
          {c.amount !== undefined && (
            <div>
              <dt className="inline font-semibold">걸린 돈 · </dt>
              <dd className="m-0 inline">
                {formatKrwThousand(c.amount / 1000)}
                {total !== undefined &&
                  ` (점검 대상의 ${share(c.amount, total)})`}
              </dd>
            </div>
          )}
          {c.why && (
            <div>
              <dt className="inline font-semibold">왜 보나 · </dt>
              <dd className="m-0 inline">{c.why}</dd>
            </div>
          )}
        </dl>
      </div>
    </li>
  )
}

function share(amount: number, total: number): string {
  const pct = (amount / total) * 100
  return pct < 0.1 ? '0.1% 미만' : `${pct.toFixed(pct < 10 ? 1 : 0)}%`
}
