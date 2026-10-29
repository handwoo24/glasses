#!/usr/bin/env bash
# 리포트 루프를 Opus 오케스트레이터 세션으로 띄운다. 오케스트레이터는 .claude/skills/run-loop, 일꾼은 .claude/agents/report-*.
# --vendors로 시작하면 업체 루프(.claude/skills/run-vendor-loop, 일꾼 vendor-* + report-*)를 띄운다.
# 운영 환경값(GLASSES_FIRESTORE_PROJECT, GOOGLE_CLOUD_QUOTA_PROJECT, GLASSES_STORAGE_BUCKET)과
# 업체 루프의 공공데이터포털 인증키(DATA_GO_KR_SERVICE_KEY)는 커밋하지 않는 loop.env.local에서 읽는다.
# 사용법: scripts/loop.sh {기관코드} [개수] [--programs 경로,경로]
#         scripts/loop.sh --vendors [기관코드] [개수] [--vendors 경로,경로]
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

skill=run-loop
if [[ "${1:-}" == "--vendors" ]]; then
  skill=run-vendor-loop
  shift
fi

run="$(date +%Y%m%d-%H%M)"
mkdir -p ".loop/runs/$run"
echo "run: .loop/runs/$run ($skill)" >&2

# 사용자 설정·플러그인·MCP를 싣지 않아 매 호출의 시작 컨텍스트를 줄인다(프로젝트 설정·스킬·에이전트만).
# loop.settings.json은 Firestore·Storage를 파이프라인 도구 밖에서 지우거나 쓰는 명령, 배포, 커밋을 막는다.
claude -p "/$skill $* --run $run" \
  --model opus --effort low \
  --setting-sources project --strict-mcp-config \
  --settings .claude/loop.settings.json \
  --permission-mode auto \
  --output-format stream-json --verbose \
  > ".loop/runs/$run/orchestrator.jsonl" 2> ".loop/runs/$run/orchestrator.err"
