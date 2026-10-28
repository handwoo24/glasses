---
name: write-report
description: 사업 카드 하나(programs/{기관코드}.{사업})의 리포트를 처음부터 초안까지 쓴다. 자료 수집 → 사실 원장 → 부재 기록 → 리포트 초안 → 검토 요청. "programs/3940000.xxx 리포트 써줘", "다음 사업 작업하자" 같은 요청에 쓴다. 한 세션에 사업 하나만 한다. 검증은 verify-report(다른 세션).
---

# 사업 리포트 작성

**한 세션 = 사업 하나.** 다른 사업의 자료·사실을 섞지 않는다. 다음 세션이 이어받을 수 있게 모든 산출물은 Firestore·Storage에 남기고, 세션 안에만 있는 메모에 기대지 않는다.

대상 고르기: 사이트 `/orgs/{기관코드}/programs`에서 단계가 `대기`인 사업 중 우선순위 높은 것. 행의 `programs/…` 경로를 그대로 받는다.

## 시작할 때

1. `npm run pipeline -- get programs/{id}` — 카드(이름, 부서, 세부사업 코드, 우선순위 이유).
2. 이미 한 일이 있는지 본다: `ls programs/{id}/facts`, `ls programs/{id}/absences`, `ls programs/{id}/reports`, 그리고 `materials`에서 `subjects`에 이 경로가 든 자료. 있으면 이어서 한다.
3. 상위 사업(`parent`)이나 같은 부서의 게시 리포트가 있으면 읽고, 이미 모은 자료(`materials/m-…`)를 다시 받지 않는다.

## 자료 모으기 (단계: 수집)

출처는 공식 공개 자료만: 기관 누리집(보도자료·고시공고·예산서), 지방의회 회의록(예산·행정사무감사), 지방재정365 세부사업 상세(사업개요·월별 배정·통계목별 지출), 나라장터 계약, 감사원·도 감사 결과, 법령.

- 자료 한 건 = `materials/m-{원본 sha256 앞 12자리}`. 원본은 로컬 사본 `.storage/materials/{id}/original.{확장자}`에 두고(Storage와 같은 경로), 글자가 아닌 원본이면 `text.txt`도 둔다. 양식은 `src/pipeline/schemas.ts`의 `MaterialSchema`.
- `subjects`에 이 사업 경로를, `about`에 기관코드를 적는다.
- Storage로 올리는 도구는 아직 없다. 로컬 사본을 Storage의 같은 경로로 올린다(운영 버킷은 `GLASSES_STORAGE_BUCKET`). 올리지 못했으면 세션 끝에 그렇다고 말한다.

## 사실 원장 (단계: 분석)

- 리포트의 숫자·판정은 모두 `programs/{id}/facts/f{n}`에서 출발한다. 원문 사실은 `material`·`locator`(쪽, 계약번호, 발언 순서)·`quote`(원문 그대로, 짧게), 계산된 사실은 `derivedFrom`·`formula`.
- `kind`: 수치·일정·발언·문서. 리포트의 근거 표시(`**발언**` `**문서**` `**계산**`)가 여기서 온다.
- 회의록 인용의 사람 이름은 `○○○`로 가린다(`○스마트시티과장 ○○○`, `○ ○○○ 위원`). 양식이 가리지 않은 이름을 거부한다.
- 찾았는데 없는 것은 `absences/a{n}`에 어디를 어떤 검색어로 찾았는지 남긴다. "자료 없음"의 근거가 된다.
- 다 쓰면 `npm run pipeline -- check-facts programs/{id}` — 인용이 원문에 있는지, 자료 파일이 바뀌지 않았는지.

## 리포트 초안 (단계: 작성)

- 양식: `src/features/reports/doc/FORMAT.md`. 예시: `src/features/reports/doc/__fixtures__/autonomous-bus.md`.
- 머리말 `slug`는 게시 주소가 된다. 카드 id의 사업 부분과 맞춘다.
- 7개 축 상태와 근거 수준은 사실 원장으로 정한다. 종합 판정은 쓰지 않는다(규칙으로 계산된다).
- 문장 규칙(`doc/lint.ts`): ‘에 대한’ 쓰지 않기, 곧은 따옴표 대신 “ ” ‘ ’, ‘1.5억’ 대신 ‘1억 5천만’, 의혹·특혜·부실·혈세 같은 판단 섞인 말 금지, 한 줄 요약은 한다체.
- 사업을 평가하지 사람을 평가하지 않는다. 직함으로 쓴다.
- `npm run pipeline -- put programs/{id}/reports/{기준일} report.md --status draft`. 양식·문장 규칙을 통과해야 쓰인다.
- 초안을 마치면 `--status in-review`로 다시 쓴다. 상황판 단계가 `검증`으로 바뀐다.

## 끝낼 때

사용자에게: 쓴 자료·사실·부재 기록 수, 리포트 기준일, 확인 못 한 것, 그리고 **다음은 새 세션에서 verify-report**라고 알린다. 게시는 검증이 통과한 뒤 사람이 한다.

## 걸려 넘어진 것

(회차마다 실제로 고친 것·실패한 것을 여기 보탠다. 미리 짐작해 쓰지 않는다.)
