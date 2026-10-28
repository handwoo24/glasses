// 화면과 리포트 문서가 같이 쓰는 한국어 라벨. 문서는 이 라벨로 값을 적고 파서가 되돌린다.
import type { DisclosureItem, Oversight, RiskSignal } from './schema'

export const SIGNAL_LABEL: Record<RiskSignal['status'], string> = {
  detected: '해당',
  clear: '해당 없음',
  unknown: '확인 못 함',
}

export const SEVERITY_LABEL: Record<RiskSignal['severity'], string> = {
  high: '중요도 높음',
  medium: '중요도 보통',
  low: '중요도 낮음',
}

export const OVERSIGHT_LABEL: Record<Oversight['status'], string> = {
  done: '점검함',
  partial: '일부',
  none: '기록 없음',
  unknown: '확인 못 함',
}

export const DISCLOSURE_LABEL: Record<DisclosureItem['status'], string> = {
  public: '공개',
  partial: '일부 공개',
  missing: '공개 자료에서 찾지 못함',
  unknown: '확인 못 함',
}

export const DUTY_LABEL: Record<DisclosureItem['duty'], string> = {
  mandatory: '게시 의무',
  request: '청구 대상',
  unknown: '의무 확인 못 함',
}

export const REQUEST_LABEL: Record<DisclosureItem['request'], string> = {
  'not-filed': '청구 전',
  pending: '청구 중',
  granted: '공개 결정',
  denied: '비공개 결정',
  'no-answer': '무응답',
}

/** 라벨 → 값. 없는 라벨이면 undefined */
export function fromLabel<TKey extends string>(
  labels: Record<TKey, string>,
  label: string,
): TKey | undefined {
  return (Object.keys(labels) as Array<TKey>).find((k) => labels[k] === label)
}
