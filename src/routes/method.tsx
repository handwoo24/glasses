import { createFileRoute } from '@tanstack/react-router'
import { GLOSSARY } from '#/content/glossary'
import { AXES_VERSION } from '#/features/reports/axes'
import {
  AxisDefinitions,
  EVIDENCE_RULE_NOTE,
  EvidenceLegend,
  OverallRules,
  StatusLegend,
  THRESHOLD_NOTE,
} from '#/features/reports/view/method-parts'
import { AnswerBadge, Panel } from '#/features/reports/view/parts'

export const Route = createFileRoute('/method')({
  head: () => ({ meta: [{ title: '평가 기준 | glasses' }] }),
  component: Method,
})

/** 리포트 섹션 순서 (문서 작성 체계 ‘보고서 구조’) */
const READING_ORDER: ReadonlyArray<readonly [string, string]> = [
  ['사업 정보 · 사업 개요', '무슨 사업이고, 무엇을 얼마로 누가 언제 하나'],
  ['종합 판정', '그래서 어떤가. 7개 축의 상태와 다음에 확인할 날짜'],
  ['현황 · 이용 안내', '지금 어디까지 왔고, 시민이 직접 쓰려면 어떻게 하나'],
  ['축별 근거', '축마다 결론 한 문장, 근거 사실과 출처, 시의 설명'],
  ['아직 확인하지 못한 것', '판정을 바꿀 수 있는데 아직 보지 못한 자료'],
  ['더 알아보는 방법', '정보공개청구 문구, 시의회 회의 일정, 질의 창구'],
  ['자세히 보기', '점검표, 판정 방법, 계약 상세, 감사 이력, 진행 경과'],
]

function Method() {
  return (
    <div className="page">
      <article className="doc">
        <header className="doc-head">
          <p className="proj">평가 체계 v{AXES_VERSION} (초안)</p>
          <h1>무엇을, 어떻게 평가하나</h1>
          <p className="lede">
            사업이 시가 약속한 대로 가고 있는지, 세금이 정해진 규칙대로 근거
            있게 쓰이는지를 공개 자료로 봅니다. 사업을 7개 축으로 나눠 축마다
            상태와 근거 수준을 매기고, 평균을 내지 않고 정해진 규칙으로 종합
            판정 하나를 정합니다.
          </p>
        </header>

        <Panel id="axes" title="7개 축">
          <p>
            ② 진척과 ③ 성과가 핵심 축입니다. 시민에게 약속한 것이 만들어지고
            쓰이는지가 가장 중요하기 때문입니다.
          </p>
          <AxisDefinitions />
        </Panel>

        <Panel id="levels" title="상태와 근거 수준">
          <h3>상태 4단계</h3>
          <StatusLegend />
          <h3>근거 수준 3단계</h3>
          <p>
            상태와 따로 매깁니다. 같은 ‘개선 필요’라도 원문 문서로 확인했는지,
            회의 발언으로 확인했는지에 따라 믿을 수 있는 정도가 다릅니다.
          </p>
          <EvidenceLegend />
        </Panel>

        <Panel id="rules" title="종합 판정 규칙">
          <p>위에서부터 차례로 보고, 처음 해당하는 규칙으로 정합니다.</p>
          <OverallRules />
          <p className="crit">
            {EVIDENCE_RULE_NOTE} {THRESHOLD_NOTE}
          </p>
        </Panel>

        <Panel id="checks" title="점검표">
          <p>
            축마다 ‘예·아니오’로 답할 수 있는 질문을 던지고 공개 자료로 답을
            확인합니다. 답이 ‘아니오’면 미충족이고, 왜 그런지는 따로 적습니다.
            점검표는 위법 여부의 판정이 아닙니다.
          </p>
          <p>
            <AnswerBadge answer="yes" /> <AnswerBadge answer="no" />{' '}
            <AnswerBadge answer="open" /> <AnswerBadge answer="none" />
          </p>
          <p>
            단독 응찰, 기준 금액에 붙은 낙찰, 같은 업체의 반복 수주, 큰 선급금,
            계약 뒤 증액, 계약 전 착수, 산출 근거 비공개 같은 위험 지표는 그
            자체로 위법은 아닙니다. 예산이 새거나 특정 업체에 유리하게 쓰일 때
            자주 함께 나타나므로, 감지되면 관련 축의 근거로 붙이고 시와 의회가
            설명해야 할 대상으로 표시합니다.
          </p>
        </Panel>

        <Panel id="reading" title="리포트는 이렇게 읽습니다">
          <ul className="list">
            {READING_ORDER.map(([k, v]) => (
              <li key={k}>
                <span className="k">{k}</span>
                {v}
              </li>
            ))}
          </ul>
          <p>
            아직 확인하지 못한 것은 이유를 함께 적습니다. ‘공개 자료에 없음’은
            우리가 아직 청구하거나 질의하지 않았다는 뜻이고, ‘의회 요청’으로
            시작하는 것은 의회가 요구했는데 나오지 않았다는 뜻입니다.
          </p>
        </Panel>

        <Panel id="principles" title="원칙">
          <ul className="f">
            <li>
              모든 수치와 판단에 원문 출처를 붙입니다. 출처가 없는 문장은
              게시하지 않습니다.
            </li>
            <li>
              평가 대상은 사업과 행정입니다. 공무원·의원은 직함으로만 적고,
              업체는 법인명만 적으며 대표자 등 개인 정보는 싣지 않습니다.
            </li>
            <li>
              판정은 시에 질의하기 전, 공개 자료만으로 매깁니다. 시의 설명은
              회의록과 보도자료에서 옮기고 직함과 시기를 붙입니다.
            </li>
            <li>
              원문은 고치지 않고 링크로 제공합니다(공공누리 이용조건 준수).
            </li>
            <li>
              분석 초안은 AI(Claude)가 작성하고, 숫자와 인용은 원문과
              대조합니다.
            </li>
          </ul>
        </Panel>

        <Panel id="terms" title="용어 풀이">
          <dl className="terms">
            {Object.entries(GLOSSARY).map(([term, meaning]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </article>
    </div>
  )
}
