import { GRADE_INFO } from '../rubric'
import type { Grade } from '../schema'

const TONE: Record<Grade, string> = {
  good: 'text-grade-good',
  caution: 'text-grade-caution',
  poor: 'text-grade-poor',
  insufficient: 'text-grade-insufficient',
}

interface GradeBadgeProps {
  grade: Grade
  size?: 'sm' | 'md'
}

/** 도장처럼 보이는 등급 표시. 색과 글자를 함께 써서 색만으로 구분하지 않는다. */
export function GradeBadge({ grade, size = 'md' }: GradeBadgeProps) {
  const dashed = grade === 'insufficient' ? 'border-dashed' : 'border-solid'
  const pad =
    size === 'sm' ? 'px-1.5 py-px text-[11px]' : 'px-2.5 py-0.5 text-[13px]'
  return (
    <span
      className={`inline-flex items-center rounded-[3px] border-[1.5px] ${dashed} ${pad} font-semibold tracking-wide ${TONE[grade]}`}
    >
      {GRADE_INFO[grade].label}
    </span>
  )
}

export function GradeDot({ grade }: { grade: Grade }) {
  const fill = {
    good: 'bg-grade-good',
    caution: 'bg-grade-caution',
    poor: 'bg-grade-poor',
    insufficient:
      'bg-transparent border border-dashed border-grade-insufficient',
  }[grade]
  return (
    <span
      aria-hidden
      className={`inline-block size-2.5 rounded-full ${fill}`}
    />
  )
}
