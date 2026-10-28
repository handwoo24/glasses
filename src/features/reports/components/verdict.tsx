import { ReportChart } from '../charts/report-chart'
import { AREAS } from '../schema'
import type { Chart, Check, CheckResult, Point, Report } from '../schema'
import {
  AREA_INFO,
  RESULT_INFO,
  countResults,
  countedChecks,
  gradeOf,
} from '../rubric'
import { Cite } from './cite'
import { GradeBadge } from './grade-badge'

const RESULT_TONE: Record<CheckResult, string> = {
  pass: 'bg-grade-good',
  warn: 'bg-grade-caution',
  fail: 'bg-grade-poor',
  unknown: 'bg-transparent border border-dashed border-grade-insufficient',
}

interface VerdictProps {
  verdict: string
  points: ReadonlyArray<Point>
  charts: ReadonlyArray<Chart>
  checks: ReadonlyArray<Check>
  total?: number
  responseNote: string
}

/** 판정과 시민이 알아야 할 것: 종합 등급 + 판정 한 문장 + 결론마다 근거·해명·단서 */
export function Verdict({
  verdict,
  points,
  charts,
  checks,
  total,
  responseNote,
}: VerdictProps) {
  return (
    <section aria-labelledby="verdict-heading">
      <div className="border-2 border-ink bg-sheet p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id="verdict-heading"
            className="m-0 font-serif text-[1.15rem] font-bold"
          >
            판정
          </h2>
          <GradeBadge grade={gradeOf(checks, { total })} />
          <a
            href="#details"
            className="text-[13px] text-accent underline underline-offset-2"
          >
            등급은 이렇게 냈습니다
          </a>
        </div>
        <p className="m-0 mt-3 font-serif text-[1.2rem] font-bold leading-snug sm:text-[1.35rem]">
          {verdict}
        </p>
        <p className="m-0 mt-3 text-[13.5px] leading-relaxed text-muted">
          {responseNote}
        </p>
      </div>

      <h2 className="m-0 mt-12 font-serif text-[1.4rem] font-bold tracking-tight">
        시민이 알아야 할 {points.length}가지
      </h2>
      <ol className="m-0 mt-6 list-none space-y-12 p-0">
        {points.map((p, i) => (
          <PointItem
            key={`${i}-${p.claim}`}
            n={i + 1}
            point={p}
            charts={p.charts.flatMap((id) => charts.filter((c) => c.id === id))}
          />
        ))}
      </ol>
    </section>
  )
}

interface PointItemProps {
  n: number
  point: Point
  charts: ReadonlyArray<Chart>
}

function PointItem({ n, point: p, charts }: PointItemProps) {
  return (
    <li className="grid grid-cols-[2rem_1fr] sm:grid-cols-[2.5rem_1fr]">
      <span className="font-serif text-[1.4rem] font-black leading-[1.3] text-accent">
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="m-0 font-serif text-[1.15rem] font-bold leading-[1.55] sm:text-[1.25rem]">
          {p.claim}
        </h3>
        <ul className="m-0 mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-[1.8] text-ink-soft marker:text-rule">
          {p.evidence.map((e, i) => (
            <li key={`${i}-${e.text}`}>
              {e.text}
              <Cite ids={e.cite} />
            </li>
          ))}
        </ul>
        {p.plain && (
          <p className="m-0 mt-3 bg-accent/10 px-3 py-2 text-[15px] leading-relaxed">
            <span className="font-semibold text-accent">시민 말로 하면 · </span>
            {p.plain}
          </p>
        )}
        {(p.cause || p.said || p.caveat) && (
          <dl className="m-0 mt-3 space-y-1.5 border-l-2 border-rule pl-3 text-[14px] leading-relaxed text-ink-soft">
            {p.said && (
              <div>
                <dt className="inline font-semibold text-ink">시의 해명 · </dt>
                <dd className="m-0 inline">
                  {p.said.text}
                  <Cite ids={p.said.cite} />
                </dd>
              </div>
            )}
            {p.cause && (
              <div>
                <dt className="inline font-semibold text-ink">원인 · </dt>
                <dd className="m-0 inline">{p.cause}</dd>
              </div>
            )}
            {p.caveat && (
              <div>
                <dt className="inline font-semibold text-grade-caution">
                  단서 ·{' '}
                </dt>
                <dd className="m-0 inline">{p.caveat}</dd>
              </div>
            )}
          </dl>
        )}
        {charts.length > 0 && (
          <div className="mt-8 space-y-10">
            {charts.map((c) => (
              <ReportChart key={c.id} chart={c} />
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

interface GradeBreakdownProps {
  checks: ReadonlyArray<Check>
  skipped: Report['skippedAreas']
  total?: number
}

/** 감사용 상세 맨 위: 점검 결과 막대와 7개 영역 등급 */
export function GradeBreakdown({
  checks,
  skipped,
  total,
}: GradeBreakdownProps) {
  const counted = countedChecks(checks, { total })
  const counts = countResults(counted)
  const left = checks.length - counted.length

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-[3px] bg-rule"
        role="img"
        aria-label={`등급에 넣은 점검 ${counted.length}건 중 확인됨 ${counts.pass}, 주의 ${counts.warn}, 문제 ${counts.fail}, 확인 불가 ${counts.unknown}`}
      >
        {(['pass', 'warn', 'fail', 'unknown'] as const).map((r) =>
          counts[r] ? (
            <span
              key={r}
              className={`${RESULT_TONE[r]} h-full border-r-2 border-sheet last:border-r-0`}
              style={{ width: `${(counts[r] / counted.length) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <p className="m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
        <span>
          점검 {counted.length}건{left > 0 && ` (묶음·경미 ${left}건 제외)`}
        </span>
        {(['pass', 'warn', 'fail', 'unknown'] as const).map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`inline-block size-2.5 rounded-full ${RESULT_TONE[r]}`}
            />
            {RESULT_INFO[r].label} {counts[r]}
          </span>
        ))}
      </p>

      <dl className="m-0 mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {AREAS.map((a) => {
          const items = checks.filter((c) => c.area === a)
          const skip = skipped.find((s) => s.area === a)
          return (
            <div
              key={a}
              className="flex items-center justify-between gap-2 border-b border-rule pb-2"
            >
              <dt className="text-[14px]">
                <a
                  href={items.length > 0 ? `#check-${a}` : '#skipped-areas'}
                  className="text-ink no-underline hover:underline"
                >
                  {AREA_INFO[a].label}
                </a>
              </dt>
              <dd className="m-0">
                {items.length > 0 ? (
                  <GradeBadge grade={gradeOf(items, { total })} size="sm" />
                ) : (
                  <span className="text-[12px] text-muted">
                    점검 안 함
                    {skip && <span className="sr-only">: {skip.reason}</span>}
                  </span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
