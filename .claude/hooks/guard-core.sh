#!/usr/bin/env bash
#
#  PreToolUse 훅 — 지시 없이 못 건드리는 자리를 막는다.
#
#  ★ 무엇을 막나. 세계의 규칙과 표다.
#      src/rpg/core/**      규칙. 여기가 바뀌면 봇 실측과 저장이 다 흔들린다
#      src/rpg/content/**   표. 몬스터·물건·지도
#      src/rpg/balance.ts   수치
#    그리는 것(ui/·dev/)과 문서·도구는 안 막는다.
#
#  ★ 조용히 막지 않는다. 왜 막혔는지, 무엇을 하면 되는지 사람이 읽을 수 있게 낸다.
#    막힌 이유를 안 보여주면 「왜 안 되지」로 시간이 간다 (CLAUDE.md 6장).
#
#  ★ 읽기는 안 막는다. 이 훅은 Edit/Write 에만 걸린다 — 읽고 재는 것은 언제나 해야 한다.
set -uo pipefail

payload=$(cat)

path=$(printf '%s' "$payload" | python3 -c '
import json,sys
try: d=json.load(sys.stdin)
except Exception: print(""); raise SystemExit
i=d.get("tool_input") or {}
print(i.get("file_path") or i.get("notebook_path") or "")
')
[ -z "$path" ] && exit 0

#  저장소 뿌리를 기준으로 한 상대 경로로 맞춘다
root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
rel="${path#"$root"/}"

why=""
case "$rel" in
  src/rpg/core/*)    why="core — 세계의 규칙입니다. 여기가 바뀌면 저장·봇 실측·시험이 한꺼번에 흔들립니다." ;;
  src/rpg/content/*) why="content — 몬스터·물건·지도 표입니다. 값 하나가 밸런스 전체를 옮깁니다." ;;
  src/rpg/balance.ts) why="balance — 수치입니다. 고치면 지금까지 잰 값이 전부 무효가 됩니다." ;;
  *) exit 0 ;;
esac

reason="이 파일은 지시 없이 못 고칩니다.

  파일   ${rel}
  이유   ${why}

지금 할 수 있는 것:
  · 읽는 것은 막지 않습니다. 먼저 읽고 무엇이 문제인지 재십시오.
  · 정말 고쳐야 하면 **사람에게 무엇을 왜 고칠지 말하고 허락을 받으십시오.**
    허락받은 판에서는 이 훅을 .claude/settings.json 에서 잠깐 끄거나,
    사람이 직접 고치는 쪽이 안전합니다.
  · 그리는 것(src/rpg/ui/ · src/rpg/dev/)과 문서·도구는 안 막혀 있습니다."

python3 -c '
import json,sys
print(json.dumps({
 "hookSpecificOutput":{
   "hookEventName":"PreToolUse",
   "permissionDecision":"deny",
   "permissionDecisionReason":sys.argv[1],
 },
 "systemMessage":sys.argv[2],
}, ensure_ascii=False))
' "$reason" "막았습니다: ${rel} — ${why}"
exit 0
