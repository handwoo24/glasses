# 자율 보고 파이프라인

에이전트가 예약 실행 한 번에 작업 하나를 맡아 처리한다. 실행마다 새 세션이므로 단계 사이에 넘기는 것은 모두 Firestore와 Storage에 남긴다. 데이터는 거기에만 두고, 이 폴더에는 양식([`schemas.ts`](schemas.ts))과 양식을 지키며 읽고 쓰는 도구만 둔다.

에이전트는 Firestore에 직접 쓰지 않고 `npm run pipeline` 도구로 쓴다. 도구는 양식과 참조(가리키는 문서가 있는지)를 검사하고, 틀리면 쓰지 않는다.

## 단계

| 단계                        | 누가                     | 읽는 것                   | 남기는 것                                                                                      |
| --------------------------- | ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------- |
| 감시                        | 코드                     | 보도자료·계약·회의록 목록 | `tasks` (triage)                                                                               |
| `triage` 분류               | 에이전트                 | 새로 나온 자료 목록       | 사업 카드·재정 문서, `tasks` (collect-analyze)                                                 |
| `collect-analyze` 수집·분석 | 에이전트                 | 평가 대상                 | `materials/*` 자료 + Storage 파일, `{대상}/facts/*` 사실, `{대상}/absences/*` 부재 기록        |
| `assess-write` 평가·작성    | 에이전트                 | 사실·부재 기록, 평가 기준 | `{대상}/reports/{기준일}` 리포트 (양식: [리포트 문서 양식](../features/reports/doc/FORMAT.md)) |
| `verify` 검증               | 에이전트 (작성자와 별개) | 리포트, 사실, 원문        | `{대상}/reviews/{id}` 검증 기록                                                                |
| 게시                        | 사람                     | 리포트, 검증 기록         | 리포트 `status: published`, `published/{주소}`                                                 |

- 평가 대상은 사업(`programs/{기관코드}.{사업}`) 또는 재정 문서(`orgs/{기관코드}/budgets/{연도-구분}`)다.
- 평가와 작성을 한 단계로 묶었다. 평가 결과(축 상태, 점검 답)가 모두 리포트에 들어가므로 따로 떼도 남는 것이 없다.
- 수집과 분석도 처음에는 묶는다. 원문이 한 세션에 다 들어가지 않는 사례가 나오면 나눈다.
- 검증 기록이 `fail`이면 `assess-write` 작업을 다시 넣는다. 같은 작업이 3번 실패하면 `failed`로 멈추고 사람이 본다.

## Firestore

```text
orgs/{기관코드}                         기관 레지스트리. 행정표준 기관코드 7자리(고양시 3940000)
  notes/{id}                            기관 단위 배경 메모
  budgets/{연도-구분}                    재정 문서 (2026-supplementary-3) ─┐
programs/{기관코드}.{사업}               사업 카드 (연도 없는 고정 id) ──────┤ 평가 대상
  vendors/{사업자등록번호}               업체 카드: 사업 안에서 업체 하나가 맡은 일 ┤ (업체 리포트)
  {대상}/facts/f{n}                      사실 원장: 원문 사실(자료·위치·인용) 또는 계산된 사실(근거 사실·계산식)
  {대상}/absences/a{n}                   "공개 자료에서 찾지 못했다"의 근거: 어디를 찾아봤나
  {대상}/reports/{YYYY-MM-DD}            리포트 한 판 (마크다운)
  {대상}/reviews/{id}                    검증 기록
  {대상}/notes/{id}                      배경 메모 (평가 근거가 아니라 작업 맥락)
budgetLines/{세부사업 코드}-{연도}        예산 카탈로그 (지방재정365 세부사업, 사업 카드가 코드로 가리킨다)
materials/m-{원본 sha256 앞 12자리}       수집 자료 색인 (발행처, 다루는 기관, 쓰이는 평가 대상)
tasks/{id}                               작업 큐
published/{주소}                         사이트에 보이는 리포트 (사람이 승인해 쓴다)
vendors/{사업자등록번호}                  업체 레지스트리 (공식 등록 정보만, 대표자 이름 없음)
publishedVendors/{주소}                  사이트에 보이는 업체 리포트
```

- 기관 id는 행정표준 기관코드다. 지방재정365 세부사업 코드의 앞 7자리와 같다. 지방재정365 자치단체 코드는 `lafCd`로 따로 적는다. 공공기관은 `alio-{ALIO 코드}`.
- 레지스트리에는 공식 출처로 확인한 기관만 넣는다. 확인하지 못한 발행처는 자료의 `publisher`(이름)로만 남긴다.

쓰기 전에 검사하는 참조:

- 평가 대상·기관 아래 문서는 그 대상·기관이 먼저 있어야 한다.
- 사업 카드와 예산 카탈로그의 기관, 사업 카드의 상위 사업, 사실의 자료와 근거 사실, 검증 기록의 리포트, 자료가 다루는 기관과 평가 대상이 먼저 있어야 한다.
- 리포트는 리포트 문서 양식과 문장 규칙(`doc/lint.ts`)을 통과해야 한다.
- 게시는 `status: published`이고 머리말 `slug`가 게시 주소와 같은 리포트만 가리킬 수 있다. 게시할 때 도구가 리포트에서 홈·목록용 요약(`summary`: 판정, 7축, 한 줄 판정, 다음 판단 시점)을 계산해 함께 쓴다. 홈과 목록은 리포트 원문을 읽지 않고 이 요약만 읽는다.
- 사이트의 리포트 주소는 평가 대상 경로다: `/programs/{기관코드}.{사업}`, `/orgs/{기관코드}/budgets/{연도-구분}`. 옛 주소 `/reports/{slug}`는 새 주소로 넘긴다.
- 회의록 인용의 사람 이름은 `○○○`로 가린다(`○스마트시티과장 ○○○`, `○ ○○○ 위원`).

### 목록 스냅샷

기관 고르기·기관 페이지·사업 목록은 원본 컬렉션을 읽지 않고 목록 스냅샷을 읽는다([`snapshot.server.ts`](../features/directory/server/snapshot.server.ts)). 도구가 기관·사업 카드·재정 문서·게시 문서를 쓰면(`put`, `put-many`, `publish`) 스냅샷을 다시 만들어 `meta/directory/chunks/`에 조각으로 쓰고 `meta/directory`의 버전을 올린다. 사이트 서버는 60초마다 버전만 확인한다.

도구를 거치지 않고 Firebase 콘솔 등에서 그 문서들을 고쳤으면 `npm run pipeline -- index`로 스냅샷을 다시 만든다. 스냅샷 양식(`snapshot.ts`)이나 거기 쓰는 양식을 바꿔 배포할 때도 같다. `meta/directory`가 없으면 서버는 원본을 직접 읽는다.

## 작업 현황

사이트 `/orgs/{기관코드}/programs`가 기관의 사업 카드와 각 사업의 작업 단계를 보여 준다. 단계는 따로 적지 않고 남은 산출물로 정한다([`stage.ts`](../features/worklist/stage.ts)): 자료가 있으면 수집, 사실·부재 기록이 있으면 분석, 리포트 초안이면 작성, 검토 요청이면 검증, 마지막 검증이 fail이면 고침, pass면 게시 대기, `published/`에 있으면 게시.

작업은 프로젝트 스킬로 한다. 세션 하나에 사업 하나.

| 스킬                                                                       | 하는 일                                                   |
| -------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`list-programs`](../../.claude/skills/list-programs/SKILL.md)             | 기관 세부사업 전수 목록화, 평가 대상 사업 카드 올리기     |
| [`write-report`](../../.claude/skills/write-report/SKILL.md)               | 사업 하나의 자료·사실·부재 기록·리포트 초안               |
| [`verify-report`](../../.claude/skills/verify-report/SKILL.md)             | 다른 세션이 쓴 리포트를 원장·원문과 대조해 검증 기록      |
| [`write-vendor-report`](../../.claude/skills/write-vendor-report/SKILL.md) | 사업 안 업체 하나의 업체 리포트 (업체 루프 일꾼도 읽는다) |

## 업체 루프

사업 리포트가 게시되면 업체 루프(`scripts/loop.sh --vendors`, 러너 `scripts/loop.ts`)가 이어받는다. 큐는 따로 적지 않는다. `npm run pipeline -- vendor-worklist`가 업체 목록화가 남은 게시 사업(사업 카드에 `vendorsListedAt`이 없는 것)과 업체 카드별 단계(사업과 같은 계산)를 돌려준다.

| 칸        | 일꾼                                      | 남기는 것                                                                       |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| 목록화    | `vendor-lister`                           | `vendors/{번호}`, `programs/{사업}/vendors/{번호}`, 사업 카드 `vendorsListedAt` |
| 수집      | `vendor-collector`                        | 나라장터·시 계약정보·회의록 자료 (`subjects`에 업체 경로)                       |
| 발췌·원장 | `report-extractor`·`report-ledger` (공용) | `{업체 경로}/facts`·`absences`. 사업 쪽 사실은 경로로 가리킨다                  |
| 작성      | `vendor-writer`                           | `{업체 경로}/reports/{기준일}` (양식 `src/features/vendors/doc/FORMAT.md`)      |
| 검증      | `report-verifier` (공용)                  | `{업체 경로}/reviews/{id}`                                                      |
| 게시      | 오케스트레이터 (`publish`)                | `publishedVendors/{주소}`, 화면 `/programs/{사업}/vendors/{번호}`               |

나라장터 OpenAPI는 `npm run catalog -- g2b`로 부른다(인증키 `DATA_GO_KR_SERVICE_KEY`, 응답의 사람 이름을 지우고 저장). 한글 공고서는 `npm run catalog -- hwp-text`.

## Storage

```text
materials/{자료 id}/original.{pdf|hwp|html|json|md …}   원본 (한 번 쓰면 바꾸지 않는다)
materials/{자료 id}/text.txt                             추출 텍스트 (원본이 글자가 아닐 때)
```

경로가 내용 해시로만 정해진다. 기관·사업 정리가 바뀌어도 파일은 움직이지 않고, 같은 파일을 두 번 받아도 한 자리다. 기관별·사업별 목록은 Firestore `materials`를 조회해서 본다. `check-facts`는 추출 텍스트가 있으면 텍스트에서, 없으면 원본에서 인용을 찾는다.

## 도구

```sh
npm run emulators                       # 로컬 에뮬레이터 (Firestore :8180, 관리 화면 :4100)
npm run dev                             # 개발 서버 (에뮬레이터를 읽는다)
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8180

npm run pipeline -- put programs/3940000.autonomous-bus card.yaml
npm run pipeline -- put programs/3940000.autonomous-bus/reports/2026-10-27 report.md --status draft
npm run pipeline -- ls programs/3940000.autonomous-bus/facts
npm run pipeline -- check-facts programs/3940000.autonomous-bus   # 인용이 원문에 있는지, 자료 파일이 바뀌지 않았는지

npm run pipeline -- enqueue verify programs/3940000.autonomous-bus --input programs/3940000.autonomous-bus/reports/2026-10-27
npm run pipeline -- claim verify          # 가장 오래된 작업을 30분 lease로 가져간다 (--subject로 대상 지정)
npm run pipeline -- done <작업 id> programs/3940000.autonomous-bus/reviews/2026-10-28
npm run pipeline -- fail <작업 id> <사유>  # 시도가 남았으면 다시 큐로
```

목록화 도구(`scripts/catalog.ts`)는 예산서 PDF를 텍스트로 바꾸고, 지방재정365 세부사업에 예산서의 부서·정책사업·단위사업을 붙여 사업 후보로 묶는다.

```sh
npm run catalog -- pdf-text 본예산서.pdf main.txt
npm run catalog -- candidates --lines 세출현황.json --book main.txt --book 추경.txt --out candidates.json
```

자료 파일은 로컬 사본(`.storage/`, Storage와 같은 경로)이 있으면 그것을 읽는다. 운영 Firebase 프로젝트에 쓰려면 `FIRESTORE_EMULATOR_HOST` 대신 아래를 정한다. 둘 다 없으면 도구는 연결하지 않는다.

```sh
export GLASSES_FIRESTORE_PROJECT=<프로젝트 id>
export GOOGLE_CLOUD_QUOTA_PROJECT=<프로젝트 id>                   # 로컬 사용자 인증(ADC)의 할당량 프로젝트
export GLASSES_STORAGE_BUCKET=<Storage 버킷>                     # 로컬 사본이 없을 때 자료 파일을 읽는 곳
```
