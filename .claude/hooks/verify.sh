#!/usr/bin/env bash
#
#  Stop 훅 — 끝내기 전에 세 가지가 성한지 본다.
#
#  ★ 왜 훅인가. CLAUDE.md 8장에 「완료 조건」으로 적어두면 사람이 읽고 지켜야 한다.
#    읽는 것을 잊으면 아무 일도 안 일어난다. 기계가 지킬 수 있는 것은 기계가 지킨다.
#
#  ★ 하나라도 실패하면 종료를 막고 **무엇이 어떻게 실패했는지** 돌려준다.
#    조용히 막으면 왜 안 끝나는지 알 수가 없다 (CLAUDE.md 6장).
#
#  ★ 무한 되풀이를 막는다. 세 번 연속 막으면 그다음은 통과시키되 크게 알린다 —
#    고칠 수 없는 실패에 갇히는 것이 검사를 건너뛰는 것보다 나쁘다.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT" || exit 0

COUNT_FILE="${TMPDIR:-/tmp}/aden-stop-hook-$(echo "$ROOT" | tr '/' '_').count"
MAX_BLOCKS=3

#  jq 로 JSON 문자열을 안전하게 만든다. 없으면 파이썬으로.
json_escape() {
  if command -v jq >/dev/null 2>&1; then jq -Rs .
  else python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
  fi
}

fails=""
add_fail() { fails="${fails}$1"$'\n'; }

#  1) 시험
if ! out=$(npm test 2>&1); then
  add_fail "■ npm test 실패
$(echo "$out" | grep -E 'FAIL|✗|×|Tests |Test Files |Error' | head -20)"
fi

#  2) 타입 검사
if ! out=$(npx tsc --noEmit -p tsconfig.json 2>&1); then
  add_fail "■ 타입 검사 실패
$(echo "$out" | head -20)"
fi

#  3) 프로덕션 빌드
if ! out=$(npm run build 2>&1); then
  add_fail "■ 프로덕션 빌드 실패
$(echo "$out" | tail -20)"
fi

if [ -z "$fails" ]; then
  rm -f "$COUNT_FILE"
  exit 0
fi

n=$(( $( [ -f "$COUNT_FILE" ] && cat "$COUNT_FILE" || echo 0 ) + 1 ))
echo "$n" > "$COUNT_FILE"

if [ "$n" -gt "$MAX_BLOCKS" ]; then
  rm -f "$COUNT_FILE"
  msg="완료 검사가 ${MAX_BLOCKS}번 연속 실패했습니다. 되풀이를 끊고 종료를 허용합니다.
아래가 아직 깨져 있습니다 — 사람이 봐야 합니다.

${fails}"
  printf '{"systemMessage":%s}\n' "$(printf '%s' "$msg" | json_escape)"
  exit 0
fi

reason="끝내기 전 완료 검사가 실패했습니다 (${n}/${MAX_BLOCKS}번째).

${fails}
CLAUDE.md 8장의 완료 조건입니다. 고치고 다시 끝내십시오.
정말 이대로 두어야 하면 사람에게 말하고 이유를 적으십시오."
printf '{"decision":"block","reason":%s}\n' "$(printf '%s' "$reason" | json_escape)"
exit 0
