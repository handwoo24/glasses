/**
 * 업체 리포트 화면 한 장이 받는 데이터. 서버가 업체 리포트 문서(doc/load.ts, 양식 doc/FORMAT.md)를 읽어 만든다.
 * 사업 리포트(ReportDoc)와 문서 문법·부품은 같고, 축과 구역이 다르다.
 */
import type { ClassifiedCheck, Cited, UnknownItem } from '../reports/assessment'
import type { AxisDoc, NextDate, Panel } from '../reports/report-doc'
import type {
  DisclosureItem,
  RiskSignal,
  Source,
  TimelineItem,
} from '../reports/schema'
import type { VendorAxisId } from './axes'
import type { ListItem } from 'mdast'

export interface VendorReportDoc {
  slug: string
  /** 업체 평가 대상 경로(programs/…/vendors/{사업자등록번호}). 게시 문서에서 온다 */
  subject?: string
  /** 업체가 참여한 사업 (programs/{기관코드}.{사업}) */
  program: string
  /** 제목 위 사업명 */
  project: string
  /** 공식 기록의 법인명 */
  vendor: string
  /** 법인 사업자등록번호 (109-86-28406) */
  bizno: string
  /** 맡은 일 한 줄 */
  role: string
  title: string
  description: string
  /** 화면 표기(2026. 10. 29.) */
  asOf: string
  facts: ReadonlyArray<readonly [label: string, value: string]>
  lede: Cited
  axisIndicators: Partial<Record<VendorAxisId, string>>
  /** 맡은 일: 계약 표 */
  work: Panel
  nextDates: ReadonlyArray<NextDate>
  /** 계약의 일생: 공고 → 낙찰 → 계약 → 변경 → 검수 → 지급 */
  life?: Panel
  axes: Record<VendorAxisId, AxisDoc>
  /** 다른 공공 계약 (맥락, 평가 아님) */
  context?: Panel
  disclosure: ReadonlyArray<DisclosureItem>
  unknowns: ReadonlyArray<UnknownItem>
  /** 화면 표기(2027. 1.) */
  nextReview: string
  request: string
  moreActions: ReadonlyArray<ListItem>
  footNote: string
  checks: ReadonlyArray<ClassifiedCheck<VendorAxisId>>
  signals: Record<VendorAxisId, ReadonlyArray<RiskSignal>>
  sources: ReadonlyArray<Source>
  timeline: ReadonlyArray<TimelineItem>
}
