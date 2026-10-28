import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { AXIS_IDS } from '../axes'
import { ReportPage } from '../view/report-page'
import { loadReportDoc } from './load'
import md from '#/content/reports/autonomous-bus-dallil-goyang.md?raw'

/** 문서의 한 곳을 바꾼다. 바꿀 글자가 없으면 테스트가 헛돌지 않게 실패 */
function edit(from: string, to: string): string {
  if (!md.includes(from)) throw new Error(`문서에 없는 글자: ${from}`)
  return md.replace(from, to)
}

describe('리포트 문서 읽기', () => {
  const doc = loadReportDoc(md)

  test('머리말·제목·리드를 읽는다', () => {
    expect(doc.slug).toBe('autonomous-bus-dallil-goyang')
    expect(doc.title).toBe('자율주행버스 ‘달릴고양’')
    expect(doc.asOf).toBe('2026. 10. 27.')
    expect(doc.nextReview).toBe('2026. 12.')
    expect(doc.facts[0]).toEqual(['주관', '고양특례시 스마트시티과'])
    expect(doc.lede.slice(1)).toEqual(['s3', 's1'])
  })

  test('축 제목의 라벨을 상태와 근거 수준으로 되돌린다', () => {
    expect(AXIS_IDS.map((a) => doc.axes[a].status)).toEqual([
      'unknown',
      'watch',
      'unknown',
      'fix',
      'watch',
      'fix',
      'fix',
    ])
    expect(doc.axes.cost.evidence).toBe('partial')
    expect(doc.axes.goal.said?.[0].slice(1)).toEqual(['s6'])
  })

  test('점검표·지표·계약·출처를 읽는다', () => {
    expect(doc.checks.filter((k) => k.axis === 'goal')).toHaveLength(2)
    expect(doc.checks.every((k) => k.criterion.length > 0)).toBe(true)
    expect(Object.values(doc.signals).flat().length).toBeGreaterThan(0)
    expect(doc.contracts?.items[0].cite.length).toBeGreaterThan(0)
    expect(doc.sources.map((s) => s.id)).toContain('s36')
  })

  test('코드 블록(청구 문구) 안의 [s9]는 출처로 보지 않는다', () => {
    expect(() =>
      loadReportDoc(
        edit(
          '소관 자료의 공개를 청구합니다.',
          '소관 자료[s98]의 공개를 청구합니다.',
        ),
      ),
    ).not.toThrow()
  })

  test('10:00 같은 글자는 지시자가 아니라 글자로 남는다', () => {
    const html = renderToStaticMarkup(createElement(ReportPage, { doc }))
    expect(html).toContain('주간 10:00~17:00, 야간 01:00~05:00')
  })
})

describe('양식이 틀린 문서는 읽지 않는다', () => {
  test.each([
    [
      '출처 표에 없는 id',
      edit('- **요금** 무료 [s13]', '- **요금** 무료 [s99]'),
      '출처 표에 없는 id: s99',
    ],
    [
      '문장 중간의 출처',
      edit('하나입니다. 버스 2대가', '하나입니다. [s3] 버스 2대가'),
      '출처는 문장 끝에만',
    ],
    [
      '허용 도메인 밖 링크',
      edit('(https://www.goyangcouncil.go.kr/)', '(https://evil.example.com/)'),
      '허용되지 않은 링크',
    ],
    [
      'javascript: 링크',
      edit('(https://www.goyangcouncil.go.kr/)', '(javascript:alert(1))'),
      '허용되지 않은 링크',
    ],
    [
      'HTML',
      edit(':::routes', '<script>alert(1)</script>\n\n:::routes'),
      '쓸 수 없는 블록: html',
    ],
    [
      '정하지 않은 블록',
      edit(':::routes', ':::chart'),
      '쓸 수 없는 블록 :::chart',
    ],
    [
      '정하지 않은 글자 지시자',
      edit(':grp[센터 용역]CCTV', ':foo[센터 용역]CCTV'),
      '쓸 수 없는 지시자 :foo',
    ],
    [
      '축 상태 라벨 오타',
      edit('④ 비용 · 개선 필요 · 근거 일부', '④ 비용 · 매우 나쁨 · 근거 일부'),
      '축 제목은',
    ],
    [
      '점검 답 라벨 오타',
      edit('- **자료 없음** 수치 목표가', '- **아마도** 수치 목표가'),
      '"아마도"는 쓸 수 없는 라벨',
    ],
    [
      '판단 기준 문단 빠짐',
      edit(
        '\n\n  **판단 기준** 사업계획서·공모 제안서·예산서에',
        ' 사업계획서·공모 제안서·예산서에',
      ),
      '**판단 기준** 문단이 필요함',
    ],
    ['필수 구역 빠짐', edit('## 진행 경과', '## 경과'), '알 수 없는 구역'],
    ['머리말에 모르는 키', edit('slug:', 'author: 누군가\nslug:'), '[머리말]'],
    [
      '출처 주소가 허용 도메인 밖',
      edit('](https://www.goyang.go.kr/', '](https://www.goyang.example.com/'),
      '허용되지 않은 주소',
    ],
    [
      '축 제목 뒤 군더더기',
      edit(
        '④ 비용 · 개선 필요 · 근거 일부',
        '④ 비용 · 개선 필요 · 근거 일부 · 아무거나',
      ),
      '축 제목은',
    ],
    [
      '개요 구분 중복',
      edit('| 언제 | 2026. 10. 20.', '| 무엇 | 2026. 10. 20.'),
      '구분은 무엇·얼마·누가·언제',
    ],
    [
      '같은 라벨 두 번',
      edit(
        '**시민 단위** 연 25억 원이면',
        '**시민 단위** 한 번 더\n\n**시민 단위** 연 25억 원이면',
      ),
      '**시민 단위**가 두 번',
    ],
    [
      '시의 설명 뒤 목록 없음',
      edit('해마다 약 2,300원\n', '해마다 약 2,300원\n\n**시의 설명**\n'),
      '**시의 설명** 다음에는 목록',
    ],
    [
      '제목에 꾸밈',
      edit('## 종합 판정', '## 종합 **판정**'),
      '글자만 쓸 수 있는 자리에 strong',
    ],
    [
      '표 칸 부족',
      edit(
        '| 2026. 10. 20. 정식 운행 | 6. 15. 시범운행 시작, 12월 사업 종료 [s1][s3] |',
        '| 2026. 10. 20. 정식 운행 |',
      ),
      '칸이 3개여야 함',
    ],
    [
      '빈 목록 항목',
      edit('- 중앙투자심사는', '-\n- 중앙투자심사는'),
      '빈 항목',
    ],
    ['날짜 형식 오류', edit('{date=2026-11-10}', '{date=foo}'), 'date'],
    [
      '정하지 않은 속성',
      edit('{date=2026-11-10}', '{date=2026-11-10 onclick=x}'),
      '쓸 수 없는 속성 onclick',
    ],
    [
      '출처를 못 다는 칸의 출처',
      edit('확인할 수 있습니다.', '확인할 수 있습니다. [s13]'),
      '출처를 붙일 수 없는 자리',
    ],
    [
      '라벨 자리의 지시자',
      edit('- **자료 없음** 수치 목표가', '- :req[자료 없음] 수치 목표가'),
      '**라벨**이 있어야 함',
    ],
    [
      '정해진 제목에 {#id}',
      edit('## 종합 판정', '## 종합 판정 {#side}'),
      '{#side}',
    ],
    [
      '낭독용 요약 없는 split',
      edit(
        ':::split{label="1대 18억 9,720만 원 중 차량 4억 5천만 원, 나머지 약 14억 5천만 원"}',
        ':::split',
      ),
      'label',
    ],
    ['출처 id 중복', edit('| s36 |', '| s1 |'), 's1이 두 번'],
  ] as const)('%s', (_name, src, message) => {
    expect(() => loadReportDoc(src)).toThrow(message)
  })
})
