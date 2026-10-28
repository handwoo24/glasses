// 7개 축 요약: 상태별 축 수를 막대로, 어느 축인지는 문장으로. 나쁜 상태부터 센다.
// 막대 칸 길이는 축 수에 비례하고, 색은 상태다. 근거 수준은 리포트 페이지에서 본다.
import { AXIS_INFO, STATUS_INFO } from '../axes'
import type { AxisId, AxisStatus } from '../axes'
import { STATUS_TONE, groupByStatus } from '../assessment'
import type { StatusGroup } from '../assessment'

type SummaryAxes = Record<AxisId, { status: AxisStatus }>

/** ‘개선 필요 1, 지켜볼 점 5, …’ 화면 낭독용 */
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
  /** bar: 막대만, text: 문장만, 없으면 둘 다 */
  only?: 'bar' | 'text'
}

export function AxisSummary({ axes, only }: AxisSummaryProps) {
  const groups = groupByStatus(axes)
  return (
    <span className="axis-sum">
      {only !== 'text' && (
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
      {only !== 'bar' && (
        <span className="txt" aria-hidden={only === undefined || undefined}>
          {groups.map((g) => (
            <span key={g.status} className={STATUS_TONE[g.status]}>
              <b>
                {STATUS_INFO[g.status].label} {g.axes.length}
              </b>{' '}
              {g.axes.map((a) => AXIS_INFO[a].label).join(', ')}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
