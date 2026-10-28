/**
 * 리포트 화면 한 장이 받는 데이터. 서버가 마크다운 문서(doc/load.ts)를 읽어 만들고,
 * 브라우저로는 JSON으로 넘어간다. 자유 본문(안내, 그림 등)은 검사를 마친 마크다운 트리(mdast)로 담고
 * 화면에서 doc/rich.tsx가 디자인 시스템 마크업으로 그린다.
 */
import type { AxisId, AxisStatus, EvidenceLevel } from './axes'
import type {
  ClassifiedCheck,
  Cited,
  OverviewCell,
  UnknownItem,
} from './assessment'
import type {
  BudgetBasis,
  Contract,
  DisclosureItem,
  Oversight,
  RiskSignal,
  Source,
  TimelineItem,
} from './schema'
import type { ListItem, PhrasingContent, RootContent } from 'mdast'

/** 패널·그림 본문 블록 */
export type Blocks = ReadonlyArray<RootContent>
/** 문단 안 글자 */
export type Inline = ReadonlyArray<PhrasingContent>

export interface Panel {
  title: string
  body: Blocks
}

export interface AxisDoc {
  status: AxisStatus
  evidence: EvidenceLevel
  /** 종합 판정 목록의 한 줄 (한다체) */
  line: string
  /** 축 카드의 결론 제목 (합니다체) */
  title: string
  facts?: ReadonlyArray<Cited>
  /** 그래프나 표 */
  figure?: Blocks
  /** 시민 단위 (축마다 최대 하나) */
  per?: string
  /** 시의 설명. “직함(시기): 요약.” 발언자마다 하나 */
  said?: ReadonlyArray<Cited>
  note?: Inline
  missing?: string
}

export interface ReportDoc {
  slug: string
  /** 평가 대상 경로(programs/… 또는 orgs/…/budgets/…). 게시 문서에서 온다 */
  subject?: string
  project: string
  title: string
  description: string
  /** 화면 표기(2026. 10. 27.) */
  asOf: string
  facts: ReadonlyArray<readonly [label: string, value: string]>
  lede: Cited
  typeNote?: string
  axisIndicators: Partial<Record<AxisId, string>>
  overview: {
    cells: ReadonlyArray<OverviewCell>
    chips?: {
      label: string
      cite?: ReadonlyArray<string>
      items: ReadonlyArray<{ label: string; on?: boolean }>
    }
  }
  side: Panel
  /** 종합 판정 문장: ① 잘되는 것 ② 가장 큰 문제와 금액 ③ 다음 확인 시점, 4문장 안쪽 */
  verdict: string
  nextDates: ReadonlyArray<readonly [when: string, what: string]>
  status: Panel
  axes: Record<AxisId, AxisDoc>
  vendors?: Panel
  unknowns: ReadonlyArray<UnknownItem>
  /** 화면 표기(2026. 12.) */
  nextReview: string
  /** 정보공개청구 문구 */
  request: string
  /** ‘더 알아보는 방법’에 덧붙이는 항목 (**라벨** 내용) */
  moreActions: ReadonlyArray<ListItem>
  footNote: string
  /** 축과 답이 정해진 점검 */
  checks: ReadonlyArray<ClassifiedCheck>
  /** 축별 위험 지표 */
  signals: Record<AxisId, ReadonlyArray<RiskSignal>>
  /** 화면 각주 번호는 이 순서다 */
  sources: ReadonlyArray<Source>
  budgetBasis?: BudgetBasis
  contracts?: { intro: string; items: ReadonlyArray<Contract> }
  oversight: ReadonlyArray<Oversight>
  disclosure: ReadonlyArray<DisclosureItem>
  timeline: ReadonlyArray<TimelineItem>
}

/** 홈 카드에 필요한 것만 */
export type ReportSummary = Pick<
  ReportDoc,
  'slug' | 'project' | 'title' | 'verdict' | 'asOf' | 'nextDates'
> & {
  axes: Record<AxisId, Pick<AxisDoc, 'status' | 'evidence'>>
}

export function toSummary(doc: ReportDoc): ReportSummary {
  const axes = Object.fromEntries(
    Object.entries(doc.axes).map(([id, a]) => [
      id,
      { status: a.status, evidence: a.evidence },
    ]),
  ) as ReportSummary['axes']
  return {
    slug: doc.slug,
    project: doc.project,
    title: doc.title,
    verdict: doc.verdict,
    asOf: doc.asOf,
    nextDates: doc.nextDates,
    axes,
  }
}
