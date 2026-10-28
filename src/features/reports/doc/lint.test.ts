import { describe, expect, test } from 'vitest'
import { lintReportDoc } from './lint'
import { loadReportDoc } from './load'
import md from './__fixtures__/autonomous-bus.md?raw'
import budgetMd from './__fixtures__/budget-supplementary.md?raw'

describe('문장 규칙', () => {
  test.each([md, budgetMd])('검수한 리포트는 규칙을 지킨다', (src) => {
    expect(lintReportDoc(loadReportDoc(src))).toEqual([])
  })

  test.each([
    [
      '판단이 섞인 말',
      ['공개되지 않았다.', '공개되지 않아 의혹이 있다.'],
      '의혹',
    ],
    [
      '1.5억 표기',
      ['약 20억 원이 지출됐다.', '약 1.5억 원이 지출됐다.'],
      '1억 5천만',
    ],
    [
      '한다체가 아닌 한 줄 요약',
      [
        '> 공모 때 약속한 수치 목표를 공개 자료에서 찾지 못했다.',
        '> 공모 때 약속한 수치 목표를 공개 자료에서 찾지 못했습니다.',
      ],
      '한다체',
    ],
    [
      '직함·시기 없는 시의 설명',
      ['- 스마트시티과장(2024. 12.): 수요응답형', '- 과장: 수요응답형'],
      '직함',
    ],
  ] as const)('%s', (_name, [from, to], why) => {
    if (!md.includes(from)) throw new Error(`문서에 없는 글자: ${from}`)
    const problems = lintReportDoc(loadReportDoc(md.replace(from, to)))
    expect(problems.join('\n')).toContain(why)
  })
})
