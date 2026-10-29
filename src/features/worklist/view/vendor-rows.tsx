// 작업 현황의 사업 줄 아래 업체 줄 (캔버스 시안 ‘업체 작업 현황’ C안). 게시된 사업에 참여한 업체와 업체 리포트 단계
import { Link } from '@tanstack/react-router'
import { STATUS_INFO } from '#/features/reports/axes'
import type { AxisStatus } from '#/features/reports/axes'
import { STATUS_TONE } from '#/features/reports/assessment'
import { StatusBadge } from '#/features/reports/view/parts'
import {
  VENDOR_AXIS_IDS,
  VENDOR_AXIS_INFO,
  vendorOverallStatus,
} from '#/features/vendors/axes'
import type { VendorSummary } from '#/features/vendors/summary'
import { eok, stageTone } from '../list'
import type { VendorWork, WorkItem } from '../server/worklist.server'
import type { WorkStage } from '../stage'

/** 업체 리포트 단계마다 다음 할 일 */
const VENDOR_NEXT: Record<WorkStage, string> = {
  대기: '업체 리포트 작성 시작',
  수집: '자료를 사실 원장으로 옮기기',
  분석: '업체 리포트 초안 쓰기',
  작성: '초안을 마치고 검증',
  검증: '검증 세션에서 대조',
  고침: '검증 지적을 고쳐 다시 검증',
  '게시 대기': '게시',
  게시: '다음 판단 시점에 갱신',
}

const COUNT_ORDER: ReadonlyArray<AxisStatus> = [
  'fix',
  'watch',
  'on-track',
  'unknown',
]

/** 6개 축을 상태별로 센다. 문제가 있는 상태는 축 이름까지 */
function AxisCounts({ axes }: { axes: VendorSummary['axes'] }) {
  const groups = COUNT_ORDER.map((status) => ({
    status,
    ids: VENDOR_AXIS_IDS.filter((a) => axes[a].status === status),
  })).filter((g) => g.ids.length > 0)
  return (
    <span
      className="wl-vaxes"
      role="img"
      aria-label={`6개 축: ${groups.map((g) => `${STATUS_INFO[g.status].label} ${g.ids.length}`).join(', ')}`}
    >
      {groups.map((g) => (
        <span key={g.status} className={STATUS_TONE[g.status]}>
          <i aria-hidden="true" />
          {g.ids.length}
          {(g.status === 'fix' ||
            g.status === 'watch' ||
            g.status === 'unknown') &&
            ` ${g.ids.map((a) => VENDOR_AXIS_INFO[a].label).join('·')}`}
        </span>
      ))}
    </span>
  )
}

function verdictOf(summary: VendorSummary): AxisStatus {
  const statuses = Object.fromEntries(
    VENDOR_AXIS_IDS.map((a) => [a, summary.axes[a].status]),
  ) as Parameters<typeof vendorOverallStatus>[0]
  const levels = Object.fromEntries(
    VENDOR_AXIS_IDS.map((a) => [a, summary.axes[a].evidence]),
  )
  return vendorOverallStatus(statuses, levels)
}

function VendorRow({ programId, v }: { programId: string; v: VendorWork }) {
  return (
    <li className="wl-vrow">
      <span className="name">
        {v.summary ? (
          <Link
            to="/programs/$programId/vendors/$bizno"
            params={{ programId, bizno: v.bizno }}
          >
            {v.name}
          </Link>
        ) : (
          <Link to="/vendors/$bizno" params={{ bizno: v.bizno }}>
            {v.name}
          </Link>
        )}
        <span className="role"> · {v.role}</span>
        {v.programs > 1 && (
          <Link
            className="wl-multi"
            to="/vendors/$bizno"
            params={{ bizno: v.bizno }}
          >
            사업 {v.programs}곳
          </Link>
        )}
      </span>
      <span className="money">{eok(v.amount)}</span>
      <span className="wl-stage" data-tone={stageTone(v.stage)}>
        {v.stage}
      </span>
      <span className="next">
        {v.summary ? (
          <>
            <StatusBadge status={verdictOf(v.summary)} overall />
            <AxisCounts axes={v.summary.axes} />
          </>
        ) : (
          VENDOR_NEXT[v.stage]
        )}
      </span>
    </li>
  )
}

/** 사업 하나의 업체 줄. 게시 전 사업에는 붙이지 않는다 */
export function VendorRows({ item: i }: { item: WorkItem }) {
  if (i.stage !== '게시' && i.vendors.length === 0) return null
  if (!i.vendorsListedAt && i.vendors.length === 0)
    return (
      <p className="wl-vbox wl-vlist-todo">
        <b>업체 목록화 남음</b> 업체 루프가 다음 회차에 계약 기록에서 참여
        업체를 찾습니다.
      </p>
    )
  const total = i.vendors.reduce((s, v) => s + v.amount, 0)
  return (
    <div className="wl-vbox">
      <p className="wl-vhead">
        참여 업체 {i.vendors.length}
        {i.vendors.length > 0 && ` · ${eok(total)}`}
        {i.vendorsListedAt &&
          ` · 업체 목록화 ${i.vendorsListedAt.slice(5).replace('-', '. ')}.`}
      </p>
      {i.vendors.length > 0 ? (
        <ul>
          {i.vendors.map((v) => (
            <VendorRow key={v.bizno} programId={i.id} v={v} />
          ))}
        </ul>
      ) : (
        <p className="wl-vnone">
          평가 기준(용역, 1억 원 이상)에 맞는 업체가 없습니다.
        </p>
      )}
    </div>
  )
}
