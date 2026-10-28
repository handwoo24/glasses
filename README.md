# glasses

정부와 지자체의 공공사업과 예산을 **공개 자료로 평가**하는 공익 오픈소스 프로젝트입니다. 부처와 지자체가 공개한 원문(보도자료, 예산서, 회의록, 계약 정보, 공고)으로 사업을 정리하고, 목표·진척·성과·비용·집행·지속성·투명성의 7개 축으로 평가합니다. 모든 숫자에 원문 출처가 붙고, 새 자료가 나오면 평가를 고칩니다.

- 평가 기준: 사이트의 ‘평가 기준’ 페이지(`src/routes/method.tsx`)

> 사업을 평가하고, 사람과 의도는 평가하지 않습니다. 원문 인용 속 공무원·의원 이름은 ○○○로 가립니다.

## 무엇을 보여 주나

리포트 한 건은 사업(`/programs/{기관코드}.{사업}`) 또는 재정 문서(`/orgs/{기관코드}/budgets/{연도-구분}`) 하나를 다룹니다. 화면은 뉴스처럼 위에서부터 읽습니다.

1. 사업명, 종합 판정(판정 이유 한 문장), 다음 판단 시점
2. 핵심 내용, 7개 축을 사업 흐름에 놓은 그림
3. 축별 근거(무거운 판정부터): 사실마다 근거 종류(발언·문서·계산)와 출처
4. 아직 확인하지 못한 것, 정보공개청구 문구, 출처 목록

평가 체계는 v0.1(초안)입니다. 종합 판정은 평균을 내지 않고 정해진 규칙(`src/features/reports/axes.ts`)으로 정합니다.

## 어떻게 만드나

에이전트가 감시 → 분류 → 수집·분석 → 평가·작성 → 검증 단계를 나눠 맡고, 사람이 게시를 승인합니다. 자료와 작업 큐는 Firestore·Cloud Storage에 둡니다. 리포트는 사람이 그대로 읽을 수 있는 마크다운 문서이고, 사이트가 이 문서를 읽어 그립니다.

- 파이프라인과 데이터 구조: [`src/pipeline/README.md`](src/pipeline/README.md)
- 리포트 문서 양식: [`src/features/reports/doc/FORMAT.md`](src/features/reports/doc/FORMAT.md)

초안은 AI(Claude)가 쓰고, 숫자와 인용은 별도 검증 단계에서 원문과 대조합니다. 틀린 내용은 이슈로 알려 주세요.

## 개발

Node 24가 필요합니다.

```sh
npm install
npm run emulators   # Firestore 에뮬레이터 (:8180, 관리 화면 :4100)
npm run dev         # 개발 서버 (:3000, 에뮬레이터를 읽는다)
```

에뮬레이터는 처음에 비어 있습니다. 테스트 자료로 리포트를 넣으려면 파이프라인 도구를 씁니다(사용법은 `npm run pipeline`).

```sh
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8180
npm run pipeline -- put orgs/3940000 org.yaml
npm run pipeline -- put programs/3940000.autonomous-bus card.yaml
npm run pipeline -- put programs/3940000.autonomous-bus/reports/2026-10-27 \
  src/features/reports/doc/__fixtures__/autonomous-bus.md --status published
npm run pipeline -- put published/autonomous-bus-dallil-goyang published.json
```

| 명령                             | 하는 일                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `npm test`                       | 테스트 (에뮬레이터 테스트는 `FIRESTORE_EMULATOR_HOST`가 있을 때만) |
| `npm run lint` · `npm run check` | ESLint · Prettier 검사                                             |
| `npm run build`                  | 프로덕션 빌드                                                      |
| `npm run pipeline -- …`          | Firestore 문서를 양식에 맞춰 읽고 쓰는 도구                        |

리포트 문서(`*.md`)는 Prettier로 고치지 않습니다. 지시자(`:::`)가 깨집니다.

## 구조

```text
src/
├── routes/                 화면 주소 (홈, 사업·재정 문서 리포트, 평가 기준)
├── features/reports/       평가 체계, 리포트 문서 읽기, 화면 부품
│   ├── doc/                마크다운 → 리포트 데이터 (양식 FORMAT.md)
│   ├── view/               리포트 페이지, 7개 축 흐름도·링
│   └── server/             게시 리포트 읽기 (서버 전용)
├── pipeline/               Firestore 양식(schemas.ts)과 읽기·쓰기 도구
└── styles/                 디자인 토큰과 페이지 스타일
scripts/pipeline.ts         파이프라인 명령줄 도구
```

## 라이선스

- 소스 코드: [GNU AGPL-3.0](LICENSE)
- 리포트(평가 문서와 그 안의 글·그림): [CC BY 4.0](LICENSE-REPORTS.md)
- 원문 자료의 저작권은 각 기관에 있습니다. 공공누리 이용조건에 따라 링크로 제공하며, 원문은 이 저장소에 담지 않습니다.
