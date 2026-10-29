#!/usr/bin/env bash
# 리포트 루프를 띄운다. 기본은 코드 러너(scripts/loop.ts)가 단계표대로 일꾼(.claude/agents/report-*)을 하나씩 부른다.
# --vendors로 시작하면 업체 루프(일꾼 vendor-* + report-*)를 띄운다.
# --legacy를 맨 앞에 주면 예전 Opus 오케스트레이터(.claude/skills/run-loop, run-vendor-loop)로 돌린다(되돌리기용).
# 운영 환경값(GLASSES_FIRESTORE_PROJECT, GOOGLE_CLOUD_QUOTA_PROJECT, GLASSES_STORAGE_BUCKET)과
# 업체 루프의 공공데이터포털 인증키(DATA_GO_KR_SERVICE_KEY)는 커밋하지 않는 loop.env.local에서 읽는다.
# 사용법: scripts/loop.sh [--legacy] {기관코드} [개수] [--programs 경로,경로]
#         scripts/loop.sh [--legacy] --vendors [기관코드] [개수] [--vendors 경로,경로]
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f loop.env.local ]]; then
  echo "loop.env.local이 없다. 운영 환경값 세 개를 KEY=값 줄로 적어 둔다." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
. ./loop.env.local
set +a

legacy=0
if [[ "${1:-}" == "--legacy" ]]; then
  legacy=1
  shift
fi

run="$(date +%Y%m%d-%H%M)"
mkdir -p ".loop/runs/$run"

if [[ $legacy == 0 ]]; then
  echo "run: .loop/runs/$run (runner)" >&2
  # 일꾼마다 `claude -p --agent`를 띄운다. 일꾼 플래그(프로젝트 설정만, MCP 없음, loop.settings.json)는 loop.ts에 있다.
  node_modules/.bin/tsx scripts/loop.ts "$@" --run "$run" 2> >(tee ".loop/runs/$run/runner.err" >&2)
  exit
fi

skill=run-loop
if [[ "${1:-}" == "--vendors" ]]; then
  skill=run-vendor-loop
  shift
fi
echo "run: .loop/runs/$run ($skill, legacy)" >&2

# 사용자 설정·플러그인·MCP를 싣지 않아 매 호출의 시작 컨텍스트를 줄인다(프로젝트 설정·스킬·에이전트만).
# loop.settings.json은 Firestore·Storage를 파이프라인 도구 밖에서 지우거나 쓰는 명령, 배포, 커밋을 막는다.
claude -p "/$skill $* --run $run" \
  --model opus --effort low \
  --setting-sources project --strict-mcp-config \
  --settings .claude/loop.settings.json \
  --permission-mode auto \
  --output-format stream-json --verbose \
  > ".loop/runs/$run/orchestrator.jsonl" 2> ".loop/runs/$run/orchestrator.err"
