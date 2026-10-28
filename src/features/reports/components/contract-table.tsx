import { formatDate, formatKrwThousand } from '../format'
import type { Contract } from '../schema'
import { Cite } from './cite'

const won = (v?: number) =>
  v === undefined ? '—' : formatKrwThousand(v / 1000)

interface ContractTableProps {
  intro: string
  items: ReadonlyArray<Contract>
}

/** 계약 한 건을 카드 한 장으로: 짚어 볼 점을 맨 위에, 그다음 누가·어떤 방식으로·얼마에 */
export function ContractTable({ intro, items }: ContractTableProps) {
  return (
    <div>
      <p className="m-0 mb-5 text-[15px] leading-[1.8] text-ink-soft">
        {intro}
      </p>
      <ol className="m-0 list-none space-y-4 p-0">
        {items.map((c, i) => (
          <li
            key={`${i}-${c.date}-${c.name}`}
            className="border border-rule bg-sheet"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-3">
              <p className="m-0 text-[15px] font-semibold">
                {c.name}
                <Cite ids={c.cite} />
              </p>
              <p className="m-0 text-[13px] text-muted">
                {c.kind} · {formatDate(c.date)}{' '}
                {c.contractAmount === undefined ? '공고' : '계약'}
              </p>
            </div>
            {c.flag && (
              <p className="m-0 border-b border-rule bg-grade-caution/10 px-4 py-2.5 text-[14px] leading-relaxed text-ink">
                <span className="font-semibold text-grade-caution">
                  짚어 볼 점 ·{' '}
                </span>
                {c.flag}
              </p>
            )}
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 text-[13.5px] sm:grid-cols-4">
              <Field label="업체">{c.vendor}</Field>
              <Field label="방식">{c.method}</Field>
              <Field label="계약 금액">
                {c.contractAmount === undefined
                  ? '확인 안 됨'
                  : won(c.contractAmount)}
              </Field>
              {c.period && <Field label="기간">{c.period}</Field>}
              {c.baseAmount !== undefined && (
                <Field label="기초·예정 금액">{won(c.baseAmount)}</Field>
              )}
              {c.awardAmount !== undefined && (
                <Field label="낙찰 금액">{won(c.awardAmount)}</Field>
              )}
              <Field
                label={
                  c.awardAmount !== undefined
                    ? '낙찰률 (낙찰 금액 ÷ 기초 금액)'
                    : '낙찰률 (계약 금액 ÷ 기초 금액)'
                }
              >
                {c.rate !== undefined ? (
                  <RateBar rate={c.rate} />
                ) : (
                  '공개 안 됨'
                )}
              </Field>
              {c.paid !== undefined && (
                <Field label="지급액">{won(c.paid)}</Field>
              )}
            </dl>
            {c.bid && <BidBlock bid={c.bid} />}
            {c.performance && c.contractAmount !== undefined && (
              <PerformanceBlock
                performance={c.performance}
                contractAmount={c.contractAmount}
              />
            )}
            {c.reason && (
              <p className="m-0 border-t border-rule px-4 py-3 text-[13.5px] leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">수의계약 사유 · </span>
                {c.reason}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="m-0 mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

/** 기준가 대비 비율. 95% 이상은 경쟁이 약했을 수 있어 주의 색으로 표시 */
function RateBar({ rate }: { rate: number }) {
  const high = rate >= 95
  return (
    <span className="block">
      <span className={high ? 'text-grade-caution' : ''}>{rate}%</span>
      <span
        aria-hidden
        className="mt-1 block h-1.5 w-full rounded-full bg-rule"
      >
        <span
          className={`block h-full rounded-full ${high ? 'bg-grade-caution' : 'bg-total'}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </span>
    </span>
  )
}

const unknownText = '공개 자료로 확인 안 됨'

function BidBlock({ bid }: { bid: NonNullable<Contract['bid']> }) {
  return (
    <div className="border-t border-rule px-4 py-3">
      <p className="m-0 text-[12px] font-semibold tracking-wide text-muted">
        입찰 과정
      </p>
      <dl className="m-0 mt-2 grid gap-x-4 gap-y-2 text-[13.5px] sm:grid-cols-2">
        <Field label="공고">{bid.notice ?? unknownText}</Field>
        <Field label="응찰 업체 수">
          {bid.bidders !== undefined ? `${bid.bidders}곳` : unknownText}
        </Field>
        <Field label="참가 자격">{bid.eligibility ?? unknownText}</Field>
        <Field label="평가·낙찰 방식">{bid.evaluation ?? unknownText}</Field>
      </dl>
    </div>
  )
}

const PAY_TONE: Record<string, string> = {
  선급금: 'bg-grade-caution',
  기성금: 'bg-total',
  준공금: 'bg-grade-good',
  기타: 'bg-muted',
}

function PerformanceBlock({
  performance: p,
  contractAmount,
}: {
  performance: NonNullable<Contract['performance']>
  contractAmount: number
}) {
  const paid = p.payments.reduce((s, x) => s + x.amount, 0)
  return (
    <div className="border-t border-rule px-4 py-3">
      <p className="m-0 text-[12px] font-semibold tracking-wide text-muted">
        이행과 대금 지급
      </p>
      <dl className="m-0 mt-2 grid gap-x-4 gap-y-2 text-[13.5px] sm:grid-cols-3">
        <Field label="감독 공무원 지정">
          {p.supervisor === undefined
            ? unknownText
            : p.supervisor
              ? '지정됨'
              : '기록 없음'}
        </Field>
        <Field label="검사">{p.inspection ?? unknownText}</Field>
        <Field label="하도급">
          {p.subcontracts === undefined
            ? unknownText
            : p.subcontracts === 0
              ? '신고 없음'
              : `${p.subcontracts}건`}
        </Field>
      </dl>
      {p.payments.length > 0 && (
        <div className="mt-3">
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-rule"
            role="img"
            aria-label={`계약 금액 대비 지급 ${Math.round((paid / contractAmount) * 100)}%`}
          >
            {p.payments.map((x, i) => (
              <span
                key={i}
                className={`${PAY_TONE[x.kind]} h-full border-r border-sheet`}
                style={{ width: `${(x.amount / contractAmount) * 100}%` }}
              />
            ))}
          </div>
          <p className="m-0 mt-1 text-[12.5px] text-muted">
            계약 금액의 {Math.round((paid / contractAmount) * 100)}% 지급 ·{' '}
            <span className="text-grade-caution">■</span> 선급금{' '}
            <span className="text-total">■</span> 기성금{' '}
            <span className="text-grade-good">■</span> 준공금
          </p>
          <details className="mt-1 text-[13px]">
            <summary className="cursor-pointer text-muted hover:text-ink">
              지급 내역 {p.payments.length}건 보기
            </summary>
            <table className="mt-2 w-full border-collapse">
              <caption className="sr-only">대금 지급 내역</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">지급일</th>
                  <th scope="col">구분</th>
                  <th scope="col">금액</th>
                </tr>
              </thead>
              <tbody>
                {p.payments.map((x, i) => (
                  <tr key={i} className="border-b border-rule">
                    <td className="py-1">{formatDate(x.date)}</td>
                    <td className="py-1">{x.kind}</td>
                    <td className="py-1 text-right tabular-nums">
                      {won(x.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
      {p.changes.length > 0 && (
        <ul className="m-0 mt-3 list-none space-y-1 p-0 text-[13px] text-ink-soft">
          {p.changes.map((x, i) => (
            <li key={i}>
              <span className="font-semibold text-ink">
                계약 변경 {formatDate(x.date)}
              </span>{' '}
              {formatKrwThousand(x.delta / 1000, { signed: true })} · {x.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
