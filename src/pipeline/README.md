# 자율 보고 파이프라인

에이전트가 예약 실행 한 번에 작업 하나를 맡아 처리한다. 실행마다 새 세션이므로 단계 사이에 넘기는 것은 모두 Firestore에 남긴다. 데이터는 Firestore에만 두고, 이 폴더에는 양식([`schemas.ts`](schemas.ts))과 양식을 지키며 읽고 쓰는 도구만 둔다.

에이전트는 Firestore에 직접 쓰지 않고 `npm run pipeline` 도구로 쓴다. 도구는 양식과 참조(가리키는 문서가 있는지)를 검사하고, 틀리면 쓰지 않는다.

## 단계

| 단계                        | 누가                     | 읽는 것                   | 남기는 것                                                                                          |
| --------------------------- | ------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------- |
| 감시                        | 코드                     | 보도자료·계약·회의록 목록 | `tasks` (triage)                                                                                   |
| `triage` 분류               | 에이전트                 | 새로 나온 자료 목록       | `programs/{사업}` 사업 카드, `tasks` (collect-analyze)                                             |
| `collect-analyze` 수집·분석 | 에이전트                 | 사업 카드                 | `materials/*` 자료, `programs/{사업}/facts/*` 사실, `programs/{사업}/absences/*` 부재 기록         |
| `assess-write` 평가·작성    | 에이전트                 | 사실·부재 기록, 평가 기준 | `programs/{사업}/reports/{기준일}` 리포트 (양식: [리포트 문서 양식](../content/reports/README.md)) |
| `verify` 검증               | 에이전트 (작성자와 별개) | 리포트, 사실, 원문        | `programs/{사업}/reviews/{id}` 검증 기록                                                           |
| 게시                        | 사람                     | 리포트, 검증 기록         | 리포트 `status: published`                                                                         |

- 평가와 작성을 한 단계로 묶었다. 평가 결과(축 상태, 점검 답)가 모두 리포트에 들어가므로 따로 떼도 남는 것이 없다.
- 수집과 분석도 처음에는 묶는다. 원문이 한 세션에 다 들어가지 않는 사례가 나오면 나눈다.
- 검증 기록이 `fail`이면 `assess-write` 작업을 다시 넣는다. 같은 작업이 3번 실패하면 `failed`로 멈추고 사람이 본다.

## 데이터

```text
programs/{기관.사업}                  사업 카드 (연도와 무관한 id)
  facts/f{n}                          사실 원장: 원문 사실(자료·위치·인용) 또는 계산된 사실(근거 사실·계산식)
  absences/a{n}                       "공개 자료에서 찾지 못했다"의 근거: 어디를 찾아봤나
  reports/{YYYY-MM-DD}                리포트 한 판 (마크다운)
  reviews/{id}                        검증 기록
materials/m-{sha256 앞 12자리}         수집한 원자료 (원본은 Cloud Storage, 로컬은 resources/)
tasks/{단계-사업-시각}                 작업 큐
```

쓰기 전에 검사하는 참조:

- 사업 아래 문서는 사업 카드가 먼저 있어야 한다.
- 사업 카드의 상위 사업, 사실의 자료와 근거 사실, 검증 기록의 리포트가 먼저 있어야 한다.
- 리포트는 리포트 문서 양식 검사(`loadReportDoc`)를 통과해야 한다.

## 도구

```sh
npm run emulators                       # 로컬 에뮬레이터 (Firestore :8180, 관리 화면 :4100)
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8180

npm run pipeline -- put programs/goyang.autonomous-bus card.yaml
npm run pipeline -- put programs/goyang.autonomous-bus/reports/2026-10-27 report.md --status draft
npm run pipeline -- ls programs/goyang.autonomous-bus/facts
npm run pipeline -- check-facts goyang.autonomous-bus   # 인용이 원문에 있는지, 자료 파일이 바뀌지 않았는지

npm run pipeline -- enqueue verify goyang.autonomous-bus --input programs/goyang.autonomous-bus/reports/2026-10-27
npm run pipeline -- claim verify          # 가장 오래된 작업을 30분 lease로 가져간다
npm run pipeline -- done <작업 id> programs/goyang.autonomous-bus/reviews/2026-10-28
npm run pipeline -- fail <작업 id> <사유>  # 시도가 남았으면 다시 큐로
```

운영(`glasses-8bd7a`)에 쓰려면 `FIRESTORE_EMULATOR_HOST` 대신 아래를 정한다. 둘 다 없으면 도구는 연결하지 않는다.

```sh
export GLASSES_FIRESTORE_PROJECT=glasses-8bd7a
export GOOGLE_CLOUD_QUOTA_PROJECT=glasses-8bd7a              # 로컬 사용자 인증(ADC)의 할당량 프로젝트
export GLASSES_STORAGE_BUCKET=glasses-8bd7a.firebasestorage.app  # 로컬에 resources/가 없을 때 자료 파일을 읽는 곳
```

수집 원자료는 Storage의 `resources/` 아래에 로컬과 같은 경로로 둔다. `materials.file`이 곧 Storage 객체 이름이다. 로컬 사본을 올릴 때는 `gcloud storage rsync resources gs://glasses-8bd7a.firebasestorage.app/resources --recursive`.
