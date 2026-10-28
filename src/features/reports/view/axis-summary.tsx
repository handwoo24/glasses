// 7개 축 요약: 상태별 축 수를 막대로, 어느 축인지는 문장으로. 나쁜 상태부터 센다.
// 막대 칸 길이는 축 수에 비례하고, 색은 상태다. 근거 수준은 리포트 페이지에서 본다.
// 비례 막대는 좁은 칸에서 읽히지 않으므로 좁은 줄에서는 개수만 쓴다(count).
import { AXIS_INFO, STATUS_INFO } from '../axes'
import type { AxisId, AxisStatus } from '../axes'
import { STATUS_TONE, groupByStatus } from '../assessment'
import type { StatusGroup } from '../assessment'

type SummaryAxes = Record<AxisId, { status: AxisStatus }>

/** ‘개선 필요 1(지속성), 지켜볼 점 5(…)’ 화면 낭독용 */
function summaryLabel(groups: ReadonlyArray<StatusGroup>): string {
  return groups
    .map(
      (g) =>
        `${STATUS_INFO[g.status].label} ${g.axes.length}(${g.axes.map((a) => AXIS_INFO[a].label).join(', ')})`,
    )
    .join(', ')
}

interface AxisSummaryProps {
  axes: SummaryAxes
  /** detail: 막대 + 축 이름 문장(카드), list: 막대 + 개수(목록 줄), count: 색 점 + 개수(좁은 줄) */
  mode?: 'detail' | 'list' | 'count'
}

export function AxisSummary({ axes, mode = 'detail' }: AxisSummaryProps) {
  const groups = groupByStatus(axes)
  const hasBar = mode !== 'count'
  return (
    <span className={`axis-sum ${mode}`}>
      {hasBar && (
        <span
          className="bar"
          role="img"
          aria-label={`7개 축: ${summaryLabel(groups)}`}
        >
          {groups.map((g) => (
            <span
              key={g.status}
              className={STATUS_TONE[g.status]}
              style={{ flexGrow: g.axes.length }}
            />
          ))}
        </span>
      )}
      <span className="txt" aria-hidden={hasBar || undefined}>
        {groups.map((g) => (
          <span key={g.status} className={STATUS_TONE[g.status]}>
            {mode === 'count' && <i aria-hidden="true" />}
            <b>
              {STATUS_INFO[g.status].label} {g.axes.length}
            </b>
            {mode === 'detail' &&
              ` ${g.axes.map((a) => AXIS_INFO[a].label).join(', ')}`}
          </span>
        ))}
      </span>
    </span>
  )
}
