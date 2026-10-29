// 평가 대상을 고른 기준 (작업 현황 화면). 기관 종류마다 사용자와 정한 기준이다.
// 기초 2026-10-28, 광역·중앙 2026-10-29. 기준을 바꾸면 .claude/skills/list-programs/SKILL.md도 함께 고친다.
import { CENTRAL_TYPES } from '#/pipeline/schemas'
import type { Org } from '#/pipeline/schemas'

export interface Criteria {
  lead: string
  notes: ReadonlyArray<string>
}

const LOCAL: Criteria = {
  lead: '시가 정하고 시 예산으로 하는 10억 원 이상 사업',
  notes: [
    '국비·도비가 절반 넘는 국가 제도(기초연금·보육료 등)는 중앙 사업으로 따로 봅니다',
    '국비 공모로 시가 짓는 시설은 넣었습니다',
    '공원 유지관리·청사 관리 같은 일상 운영비는 뺐습니다',
  ],
}

const REGIONAL: Criteria = {
  lead: '국비가 절반 미만인 100억 원 이상 사업',
  notes: [
    '보육료·급여·장기요양 같은 법정 지출과 전출금·교부금·기금 예탁·채무 상환은 뺐습니다',
    '도로·공원 유지관리, 청사·위탁 관리 같은 일상 운영비와 융자는 뺐습니다',
    '출연기관 지원, 시군 지원 사업, 광역철도 분담금은 넣었습니다',
  ],
}

const CENTRAL: Criteria = {
  lead: '2026 확정 예산 1,000억 원 이상 재량 사업',
  notes: [
    '교부금·교부세, 연금·보험 급여, 국채 이자·상환, 융자·출자, 예비비 같은 의무지출은 뺐습니다',
    '기본경비·인건비, 군 연료·피복·급식, 시설 유지보수, 보증 같은 일상·금융 지출도 뺐습니다',
    '국고보조 사업은 지자체 사업 카드와 이어 지역별 시행을 함께 봅니다',
  ],
}

const OTHER: Criteria = {
  lead: '이 기관의 평가 대상 기준은 아직 정하지 않았습니다',
  notes: ['사업 카드는 사람이 한 건씩 골라 올렸습니다'],
}

export function criteriaOf(type: Org['type']): Criteria {
  if (type === '광역자치단체') return REGIONAL
  if (type === '기초자치단체') return LOCAL
  if (CENTRAL_TYPES.has(type)) return CENTRAL
  return OTHER
}
