// 자율주행버스 ‘달릴고양’ 평가 (평가 체계 v0.1, 시설·시스템 구축과 운영 위탁 유형).
// 공개 자료만으로 매긴 것이며 시에 질의하기 전이다. 출처 id는 리포트 데이터와 같다.
import type { Assessment } from '#/features/reports/assessment'
import { Cite } from '#/features/reports/components/cite'
import { DownArrow, FactList } from '#/features/reports/view/parts'
import {
  CHECK_MAP,
  NEW_CHECKS,
  SIGNAL_AXIS,
} from './autonomous-bus-dallil-goyang.checks'

export const autonomousBusDallilGoyangAssessment: Assessment = {
  reportSlug: 'autonomous-bus-dallil-goyang',
  project: '거점형 스마트시티 조성사업',
  title: '자율주행버스 ‘달릴고양’',
  description:
    '고양특례시 거점형 스마트시티 조성사업 가운데 자율주행버스 ‘달릴고양’의 사업 내용, 예산과 집행, 계약을 공개 자료로 정리하고 7개 축으로 평가했습니다.',
  asOf: '2026. 10. 27.',
  facts: [
    ['주관', '고양특례시 스마트시티과'],
    ['사업', '국토교통부 거점형 스마트시티 공모'],
    ['기간', '2023~2026. 12.'],
    ['총사업비', '402억 원'],
    ['상태', '운행 중'],
  ],
  lede: [
    '국비와 시비 402억 원으로 스마트시티 서비스 11개를 만드는 거점형 스마트시티 사업의 하나입니다. 버스 2대가 10월 20일 정식 운행을 시작했고, 사업은 12월에 끝납니다.',
    's3',
    's1',
  ],
  typeNote: '이 사업은 시설·시스템 구축과 운영 위탁이 섞인 유형입니다.',
  axisIndicators: {
    goal: '공모 때 약속한 성과지표, 계획 변경과 승인',
    progress: '11개 서비스·버스 대수 완료 현황, 일정, 교부액 중 지출액',
    outcome: '탑승 인원, 목표 대비 이용 실적',
    cost: '버스 1대 단가, 용역 월 단가, 경쟁과 연속 수주',
    execution: '감독 공무원, 검수, 선금, 계약 전 운행, 보조금 하위 집행',
    sustainability: '사업 종료 뒤 운영·유지비와 재원',
    accountability:
      '의회 요구 자료, 시정 요구 처리, 감사 이력, 공개 정보의 정확성',
  },
  overview: {
    cells: [
      {
        label: '무엇',
        value: '자율주행버스 2대 · 3개 노선',
        text: '거점형 스마트시티 11개 서비스 가운데 하나',
        cite: ['s1', 's3'],
      },
      {
        label: '얼마',
        value: '402억 원',
        text: '국비·시비 절반씩. 시민 1명당 약 3만 7천 원',
        cite: ['s3', 's22'],
      },
      {
        label: '누가',
        value: '8개 회사 컨소시엄',
        text: '보조금을 받아 사업 수행. 버스 운행은 오토노머스에이투지',
        cite: ['s7', 's5'],
      },
      {
        label: '언제',
        value: '2026. 10. 20. 정식 운행',
        text: '6. 15. 시범운행 시작, 12월 사업 종료',
        cite: ['s1', 's3'],
      },
    ],
    chips: {
      label: '11개 서비스',
      cite: ['s3'],
      items: [
        { label: '교통 최적화' },
        { label: '자율주행버스', on: true },
        { label: '수요응답형 버스' },
        { label: '드론 순찰·관제' },
        { label: '실시간 인파 관리' },
        { label: '재난 대응' },
        { label: '디지털 트윈' },
        { label: '지반 침하·침수 예측' },
        { label: '스마트폴·미디어월' },
        { label: 'AI 민원 상담' },
        { label: '데이터 허브' },
      ],
    },
  },
  side: {
    title: '이용 안내',
    body: (
      <>
        <ul className="routes">
          <li>
            <span className="rt">주간 1</span>
            <span>대화역 → 킨텍스 → 종합운동장 → 대화역 순환, 약 4km</span>
          </li>
          <li>
            <span className="rt">주간 2</span>
            <span>대화역 → 킨텍스역 → 킨텍스캠핑장 → 대화역 순환, 약 6km</span>
          </li>
          <li>
            <span className="rt night">야간</span>
            <span>
              대화역 ↔ 백석역 ↔ 대곡역 ↔ 화정역 왕복, 편도 약 11km
              <Cite ids={['s1']} />
            </span>
          </li>
        </ul>
        <dl className="kv">
          <div>
            <dt>운행</dt>
            <dd>
              화~토요일. 주간 10:00~17:00, 야간 01:00~05:00 (바뀔 수 있음)
              <Cite ids={['s13']} />
            </dd>
          </div>
          <div>
            <dt>요금</dt>
            <dd>
              무료
              <Cite ids={['s13']} />
            </dd>
          </div>
          <div>
            <dt>타는 곳</dt>
            <dd>
              지정 정류장에서만 타고 내립니다. 시범운행 때 정류장: 대화역,
              일산백병원입구, 현대백화점, 현대모터스튜디오 고양, 킨텍스역,
              킨텍스, 한국건설기술연구원, 종합운동장
              <Cite ids={['s13', 's36']} />
            </dd>
          </div>
        </dl>
      </>
    ),
  },
  verdict:
    '버스 2대가 10월 20일 정식 운행을 시작했습니다. 다만 1대에 18억 9,720만 원이 든 산출 근거는 의회 요구에도 공개되지 않았고, 시도 비싸다고 인정했습니다. 사업이 끝난 뒤 해마다 25억 원 안팎이 드는데, 그 재원 계획은 공개 자료에서 찾지 못했습니다. 탑승 인원은 11월 10일 첫 실적 보고 뒤에 확인할 수 있습니다.',
  nextDates: [
    ['11. 10.', '첫 실적 보고'],
    ['11. 12.~19.', '의회 행정사무감사'],
    ['12월', '사업 종료'],
  ],
  status: {
    title: '운영 현황',
    body: (
      <>
        <ul className="list">
          <li>
            <span className="k">운행</span>6. 15. 시범운행, 10. 20. 정식 운행
            시작
            <Cite ids={['s1']} />
          </li>
          <li>
            <span className="k">탑승 인원</span>공개되지 않았습니다. 운영 업체는
            매달 탑승 인원·운행 횟수·사고 기록을 보고해야 합니다.
            <Cite ids={['s13']} />
          </li>
          <li>
            <span className="k">11개 서비스</span>8월 중간보고회가 열렸고,
            서비스별 완료 여부는 공개 자료로 확인하지 못했습니다.
            <Cite ids={['s3']} />
          </li>
        </ul>
        <p className="label">다음 날짜</p>
        <p className="big-date">2026. 11. 10.</p>
        <p className="small-soft">
          첫 월간실적보고서 제출 기한
          <Cite ids={['s13']} />
        </p>
      </>
    ),
  },
  axes: {
    goal: {
      status: 'unknown',
      evidence: 'thin',
      line: '공모 때 약속한 수치 목표를 공개 자료에서 찾지 못했다.',
      title: '공모 때 약속한 수치 목표를 공개 자료에서 찾지 못했습니다',
      facts: [
        [
          '시 보도자료와 의회 회의록에는 수치로 된 성과 목표가 나오지 않습니다.',
          's3',
          's1',
        ],
        [
          '운영 용역의 목적은 “대중교통수단이 제공되지 않는 새벽 시간대나 대중교통 사각지역에 자율주행버스 공급을 통해” 시민의 이동성을 보장하는 것입니다.',
          's13',
        ],
        [
          '차량 계획은 자율주행버스 1대와 수요응답형 버스 7대에서 자율주행버스 3대로 바뀌었고, 실제 운행은 2대입니다.',
          's6',
          's23',
        ],
      ],
      said: [
        [
          '스마트시티과장(2024. 12.): 수요응답형 버스는 교통 부서 협의에서 필요 없다는 의견을 받아 자율주행버스로 바꿨다.',
          's6',
        ],
      ],
      missing:
        '2023년 공모 제안서의 성과 목표(글자 정보가 없는 이미지 파일이라 대조하지 못함), 국토교통부의 계획 변경 승인 기록',
    },
    progress: {
      status: 'watch',
      evidence: 'partial',
      line: '버스 2대가 운행 중이지만, 차량 계획이 바뀌었고 11개 서비스의 완료 여부는 공개되지 않았다.',
      title:
        '버스 2대가 운행을 시작했고, 11개 서비스의 완료 여부는 공개되지 않았습니다',
      facts: [
        [
          '6월 15일 시범운행, 10월 20일 정식 운행을 시작했습니다. 사업은 12월에 끝납니다.',
          's1',
          's3',
        ],
        [
          '운영 용역은 9월 1일 착수를 기준으로 공고했고, 10월 23일에 계약했습니다.',
          's13',
          's5',
        ],
        [
          '교부한 340억 원 가운데 실제 지출액은 2024년 12월의 설명(98억 원 중 약 20억 원) 뒤로 공개되지 않았습니다.',
          's6',
          's33',
        ],
        [
          '2026년 예산 61억 6,120만 원은 10월 26일까지 교부되지 않았습니다. 이 사업은 해마다 한두 차례 몰아서 교부해 왔습니다.',
          's9',
          's33',
        ],
      ],
      missing: '11개 서비스별 완료 현황, 종료 일정이 바뀌는지 여부',
    },
    outcome: {
      status: 'unknown',
      evidence: 'thin',
      line: '탑승 인원이 공개되지 않았고, 첫 실적 보고 기한은 11월 10일이다.',
      title: '탑승 인원은 아직 공개되지 않았고, 첫 보고 기한은 11월 10일입니다',
      facts: [
        [
          '운영 업체는 운행 횟수, 운영 시간, 운행 거리, 탑승 인원, 장애·안전사고 기록을 월간실적보고서로 다음 달 10일까지 내야 합니다.',
          's13',
        ],
        ['6월 시범운행부터 지금까지 이용 실적은 공개되지 않았습니다.', 's1'],
        ['수치 목표가 공개되지 않아 목표 달성률은 계산할 수 없습니다.', 's3'],
      ],
      missing: '탑승 인원(11. 10. 이후 정보공개청구 예정)',
    },
    cost: {
      status: 'fix',
      evidence: 'partial',
      line: '버스 1대 18억 9,720만 원 중 차량은 4억 5천만 원이고, 산출 근거는 세 차례 요구에도 공개되지 않았다.',
      title:
        '버스와 센터 유지보수 금액의 산출 근거가 요구에도 공개되지 않았습니다',
      figure: (
        <>
          <h4 className="sub-h">버스 1대 사업비</h4>
          <div
            className="split"
            role="img"
            aria-label="1대 18억 9,720만 원 중 차량 4억 5천만 원, 나머지 약 14억 5천만 원"
          >
            <span className="a">
              차량
              <br />
              4.5억
            </span>
            <span className="b">소프트웨어·정밀지도·관제 등 약 14.5억</span>
          </div>
          <FactList
            facts={[
              [
                '2024년 12월 시의회에서 1대 18억 9,720만 원 가운데 차량 구입비가 4억 5천만 원이라는 산출 내역이 언급됐습니다. 의회가 버스별·시스템별로 나눈 자료를 요청했고, 제출 기록은 찾지 못했습니다.',
                's6',
                's23',
              ],
              [
                '같은 해 행정사무감사에서 담당 과장은 버스 단가가 시민 눈높이에 맞느냐는 질문에 “비쌉니다”라고 답했습니다.',
                's21',
              ],
            ]}
          />
          <p className="cap">2대 기준 약 37억 9천만 원</p>
          <h4 className="sub-h">스마트시티센터 정보시스템 유지보수</h4>
          <div>
            <div
              className="bars"
              role="img"
              aria-label="한 달 금액: 2023년 6,928만, 2024년 7,864만, 2025년 7,230만, 2026년 1억 1,796만 원"
            >
              <div>
                6,928만<i style={{ height: '69px' }}></i>
              </div>
              <div>
                7,864만<i style={{ height: '78px' }}></i>
              </div>
              <div>
                7,230만<i style={{ height: '72px' }}></i>
              </div>
              <div className="hot">
                1억 1,796만<i style={{ height: '118px' }}></i>
              </div>
            </div>
            <p className="years">
              <span>2023</span>
              <span>2024</span>
              <span>2025</span>
              <span>2026</span>
            </p>
          </div>
          <FactList
            facts={[
              [
                '2023~2026년 같은 업체(삼성티엔지)가 맡았고, 한 달 금액은 2025년보다 63% 많습니다. 2026년 계약 금액은 공고한 사업금액의 80%입니다.',
                's10',
                's15',
              ],
              [
                '위원이 상주 인력 2명에 13억 원 예산의 근거를 물었고, 시가 맡긴 원가계산 용역(451만 원)의 결과는 공개되지 않았습니다.',
                's4',
                's10',
              ],
            ]}
          />
          <p className="per">
            상주 인력 2명 기준으로 나누면 1명에 한 달 약 5,900만 원
          </p>
          <FactList
            facts={[
              [
                '거점형 사업 공모에는 컨소시엄 한 곳만 응모했습니다. 버스 1대 한 달 운영비는 고양 1,980만 원으로 안양과 같고 성남(1,417만 원)보다 높습니다. 운행 요일·시간이 달라 단순 비교는 어렵습니다.',
                's7',
                's5',
                's19',
                's20',
              ],
            ]}
          />
        </>
      ),
      said: [
        [
          '스마트시티과장(2024. 12.): 버스 단가는 서울·안양에 납품한 업체의 견적을 근거로 했다.',
          's6',
        ],
        [
          '스마트시티과장(2026. 8.): 유지보수 금액은 인원만이 아니라 하드웨어 283대, 소프트웨어 17종 29식을 맡는 비용이다.',
          's4',
        ],
      ],
      missing: '버스 항목별 산출 내역, 유지보수 원가계산 결과',
    },
    execution: {
      status: 'watch',
      evidence: 'partial',
      line: '시가 직접 맺은 계약에서 증액·하도급 문제는 찾지 못했고, 보조금 340억 원의 하위 집행은 공개 자료로 볼 수 없다.',
      title:
        '시 계약에서 증액·하도급 문제는 찾지 못했고, 보조금 340억 원의 쓰임은 볼 수 없습니다',
      figure: (
        <>
          <div className="flow">
            <div className="node">
              <b>국비 + 시비 402억 원</b>
              <span>
                2023년 국토교통부 공모 선정
                <Cite ids={['s3']} />
              </span>
            </div>
            <div className="down">
              <DownArrow />
            </div>
            <div className="node">
              <b>고양시</b>
              <span>
                민간자본사업보조로 편성해 회사별로 교부
                <Cite ids={['s32']} />
              </span>
            </div>
            <div className="down">
              <DownArrow />
            </div>
            <div className="zone">
              <span className="label">
                이 단계부터는 시 계약정보공개시스템에 나오지 않음
              </span>
              <div className="node">
                <b>컨소시엄 340억 원</b>
                <span>
                  2024년 98억 · 2025년 242억
                  <Cite ids={['s33']} />
                </span>
              </div>
              <div className="down">
                <DownArrow />
              </div>
              <div className="node">
                <b>회사가 발주한 하위 용역</b>
                <span>
                  예: 버스 구축 (공고상 50억 9,319만 원)
                  <Cite ids={['s18']} />
                </span>
              </div>
            </div>
          </div>
          <p className="per">340억 원은 시민 1명당 약 3만 2천 원</p>
          <ul className="state">
            <li>
              <span>
                시가 직접 맺은 계약의 증액 변경·미신고 하도급
                <Cite ids={['s10']} />
              </span>
              <span className="st ok">없음</span>
            </li>
            <li>
              <span>
                정보시스템 유지보수 선급금 5억 6천만 원
                <Cite ids={['s10', 's34']} />
              </span>
              <span className="st ok">비율·시기 규정 안</span>
            </li>
            <li>
              <span>
                센터 유지보수 용역의 감독 공무원
                <Cite ids={['s10']} />
              </span>
              <span className="st ok">지정됨</span>
            </li>
            <li>
              <span>
                버스 운영 용역의 감독 공무원
                <Cite ids={['s5']} />
              </span>
              <span className="st none">지정 기록 없음</span>
            </li>
            <li>
              <span>
                버스 구축 용역의 검수 주체
                <Cite ids={['s18']} />
              </span>
              <span className="st warn">사업주관 회사</span>
            </li>
            <li>
              <span>
                정식 운행(10. 20.)과 운영 계약(10. 23.)
                <Cite ids={['s1', 's5']} />
              </span>
              <span className="st warn">운행이 사흘 먼저</span>
            </li>
          </ul>
        </>
      ),
      said: [
        [
          '스마트시티과장(2024. 12.): 보조금은 업체에 바로 가지 않고 e나라도움 시스템 안에 있다가 쓰이며, 98억 원 중 약 20억 원이 지출됐다.',
          's6',
        ],
      ],
      note: (
        <>
          버스 구축 용역의 제안요청서는 준공 전 시범서비스를 과업에 넣고 있어,
          계약 전 운행이 구축 용역 안에서 이뤄졌을 수 있습니다.
          <Cite ids={['s18']} />
        </>
      ),
      missing:
        '회사별 보조금 집행 내역, 하위 용역의 낙찰자·계약 금액·검수 결과',
    },
    sustainability: {
      status: 'fix',
      evidence: 'full',
      line: '종료 뒤 연 24억~32억 원이 들 것으로 추산되는데, 확인된 재원은 광고 수익 2억 5천만 원이다.',
      title:
        '사업이 끝난 뒤 해마다 25억 원 안팎이 드는데, 재원 계획은 찾지 못했습니다',
      facts: [
        [
          '2024년 담당 과장은 조성 뒤 유지보수비를 “연간 한 10% 정도 계산하면 25억 정도”로 추산했습니다.',
          's21',
        ],
        [
          '2026년 3월 담당 실장은 사업비의 “6% 상당인가, 8% 상당”이라고 했습니다(약 24억~32억 원).',
          's23',
        ],
        [
          '광고 등으로 연 2억 5천만 원의 수익을 예상했습니다. 그 밖의 재원 계획은 공개 자료에서 찾지 못했습니다.',
          's21',
        ],
        [
          '중앙투자심사는 “지방비 부담을 최소화”하라는 조건을 달았습니다.',
          's6',
        ],
      ],
      per: '연 25억 원이면 10년에 250억 원, 시민 1명당 해마다 약 2,300원',
    },
    accountability: {
      status: 'fix',
      evidence: 'full',
      line: '의회 요구 자료의 제출 기록, 시정 요구의 처리 결과, 시 감사부서의 감사 이력을 공개 자료에서 찾지 못했다.',
      title:
        '의회가 요구한 자료의 제출 기록과 시정 요구의 처리 결과가 공개되지 않았습니다',
      facts: [
        [
          '의회는 2024년 12월 버스 단가를 나눈 자료, 2026년 3월 사업 자료, 2026년 8월 유지보수 산출 근거를 요구했습니다. 제출 기록은 공개 자료에서 찾지 못했습니다.',
          's6',
          's23',
          's4',
        ],
        [
          '2025년 행정사무감사의 시정 요구 “거점형 스마트시티 사업의 예산 효율성 재검토”의 처리 결과가 공개되지 않았습니다. 의회의 조치결과 게시판은 0건입니다.',
          's22',
          's25',
        ],
        [
          '시 감사부서가 2022~2026년 공개한 감사 자료 가운데 이 사업이나 스마트시티과 계약을 다룬 것은 없습니다. 시 자체 종합감사는 본청 부서를 순환 대상에 넣지 않습니다.',
          's26',
        ],
        [
          '계약대장에는 자격을 제한한 입찰이 “일반경쟁”으로, 사업금액의 80%에 맺은 계약이 낙찰률 “100”으로 적혀 있어 공고와 다릅니다.',
          's10',
          's17',
          's15',
        ],
        [
          '시가 직접 맺은 계약의 업체·금액·지급 내역과 입찰공고는 공개돼 있습니다.',
          's10',
          's13',
        ],
      ],
    },
  },
  checkMap: CHECK_MAP,
  newChecks: NEW_CHECKS,
  signalAxis: SIGNAL_AXIS,
  vendors: {
    title: '참여 기관과 계약',
    body: (
      <>
        <div className="tbl">
          <table>
            <caption className="label">
              공개 자료에 나온 법인명 그대로이며, 대표자 등 개인 정보는 싣지
              않습니다.
            </caption>
            <thead>
              <tr>
                <th scope="col">맡은 곳</th>
                <th scope="col">맡은 일</th>
                <th scope="col">금액</th>
                <th scope="col">기간</th>
                <th scope="col">참고</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  컨소시엄 8개사
                  <Cite ids={['s33', 's7']} />
                </th>
                <td>
                  <span className="grp">거점형 사업</span>사업 전체 (버스 포함)
                </td>
                <td className="n">보조금 340억 원</td>
                <td>2024~</td>
                <td>공모에 단독 응모. 회사별 집행 내역은 공개 자료에 없음</td>
              </tr>
              <tr>
                <th scope="row">
                  글로벌이엔씨
                  <Cite ids={['s18']} />
                </th>
                <td>
                  <span className="grp">거점형 사업</span>버스 구축 용역
                  발주·검수 (컨소시엄 참여사)
                </td>
                <td className="n">확인 안 됨</td>
                <td>2025</td>
                <td>
                  공고상 용역금액 50억 9,319만 원. 낙찰자·계약 금액은 시 공개
                  자료에 없음
                </td>
              </tr>
              <tr>
                <th scope="row">
                  오토노머스에이투지
                  <Cite ids={['s5']} />
                </th>
                <td>
                  <span className="grp">거점형 사업</span>버스 운행 (시와 직접
                  계약)
                </td>
                <td className="n">9,500만 원</td>
                <td>2026. 10.~12.</td>
                <td>낙찰 금액은 기초금액의 99%. 지급 전</td>
              </tr>
              <tr>
                <th scope="row">
                  삼성티엔지
                  <Cite ids={['s10']} />
                </th>
                <td>
                  <span className="grp">센터 용역</span>정보시스템 유지보수
                </td>
                <td className="n">10억 6,168만 원</td>
                <td>2023~ (4년째)</td>
                <td>10월까지 7억 1,255만 원 지급</td>
              </tr>
              <tr>
                <th scope="row">
                  더존시스템
                  <Cite ids={['s10', 's16']} />
                </th>
                <td>
                  <span className="grp">센터 용역</span>스마트시티 서비스
                  유지보수
                </td>
                <td className="n">2억 8,405만 원</td>
                <td>2023~ (4년째)</td>
                <td>2026년은 유찰 뒤 수의계약</td>
              </tr>
              <tr>
                <th scope="row">
                  와이드큐브
                  <Cite ids={['s10']} />
                </th>
                <td>
                  <span className="grp">센터 용역</span>통합플랫폼 유지보수
                </td>
                <td className="n">1억 9,030만 원 (2025)</td>
                <td>2021~2025</td>
                <td>2024·2025년 같은 금액</td>
              </tr>
              <tr>
                <th scope="row">
                  씨엔에스종합건설
                  <Cite ids={['s10', 's17']} />
                </th>
                <td>
                  <span className="grp">센터 용역</span>CCTV 모니터링
                </td>
                <td className="n">17억 6,890만 원</td>
                <td>2026</td>
                <td>2023~2026년 해마다 다른 업체가 낙찰</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  unknowns: [
    {
      label: '공개 자료에 없음 · 청구 예정',
      text: '공모 때 약속한 수치 목표, 11개 서비스별 완료 현황',
    },
    {
      label: '공개 자료에 없음 · 청구 예정',
      text: '회사별 보조금 집행 내역, 버스 구축 용역의 낙찰자·검수 결과',
    },
    {
      label: '공개 자료에 없음 · 11. 10. 이후 청구',
      text: '운행 실적(탑승 인원)',
    },
    {
      label: '의회 요청 · 제출 기록 없음',
      text: '버스 1대 산출 내역 (2024. 12. 요청)',
      requested: true,
      cite: ['s6'],
    },
    {
      label: '의회 요청 · 처리 결과 공개 안 됨',
      text: '2025년 행정사무감사 시정 요구 “예산 효율성 재검토”',
      requested: true,
      cite: ['s22', 's25'],
    },
  ],
  nextReview: '2026. 12.',
  request:
    '고양시 스마트시티과 소관 자료의 공개를 청구합니다.\n1. 2026년 자율주행버스 운영 용역의 월간실적보고서(2026년 10월분부터)\n2. 거점형 스마트시티 조성사업 보조사업자별 교부액과 집행 내역(2024~2026년)\n3. 보조사업자가 발주한 “자율주행 버스 구축” 용역의 계약서와 검수 결과\n4. 2026년 스마트시티센터 정보시스템 유지보수 원가계산 결과보고서\n5. 2023년 거점형 스마트시티 공모 제안서의 성과지표와 사업 변경 승인 문서',
  moreActions: (
    <>
      <li>
        <span className="k">시의회 회의</span>11월 12일부터 19일까지
        행정사무감사가 열립니다. 회의 생중계와 회의록은{' '}
        <a
          href="https://www.goyangcouncil.go.kr/"
          target="_blank"
          rel="noopener noreferrer"
        >
          고양특례시의회 누리집
        </a>
        에 있습니다.
        <Cite ids={['s24', 's12']} />
      </li>
    </>
  ),
  footNote:
    '1명당 금액은 고양시 인구 1,071,202명(등록외국인 포함, 2026. 9. 30.)으로 나눈 단순 계산입니다.',
  extraSources: [
    {
      id: 's36',
      title: '고양시, 자율주행버스 시범운행 시작…미래형 대중교통 서비스 시동',
      org: '고양특례시',
      kind: '보도자료',
      date: '2026-06-22',
      url: 'https://www.goyang.go.kr/news/user/bbs/BD_selectBbs.do?q_bbsCode=1090&q_bbscttSn=20260622180154559&q_estnColumn1=All',
      license: '공공누리',
      locator: '시범운행 정류장, 운행 시간',
    },
  ],
}
