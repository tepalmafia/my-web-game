#!/usr/bin/env bash
#
#  힉스필드에 뽑아둔 그림 24장을 public/props/ 로 받아옵니다.
#
#  ★ 왜 스크립트로 두는가: 결과가 CloudFront 에 올라가는데 세션에 따라
#    그 도메인이 egress 허용 목록 밖일 수 있습니다. 그러면 여기서 전부
#    ✗ 로 떨어지고, 허용된 뒤에 다시 돌리면 그대로 받아집니다.
#    URL 스물넷을 사람이 다시 모으지 않게 하려고 저장소에 둡니다.
#
#  ★ 받은 뒤 할 일: src/rpg/ui/art/sprites.ts 의 SPRITES 표에 줄을 더합니다.
#    표에 없으면 지금 도형으로 그대로 그려집니다 — 한 장씩 켜고 끌 수 있습니다.
#
#  쓰는 법:  bash tools/fetch-props.sh
#
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
mkdir -p public/props

BASE=https://d8j0ntlcm91z4.cloudfront.net/user_3Hqms2GYc06S4obMvBRc3EeniNI
ok=0
miss=0

get() { # get <붙일 이름> <원본 파일명>
  if curl -fsSL --max-time 60 "$BASE/$2" -o "public/props/$1.png" 2>/dev/null; then
    printf '  ✓ %s\n' "$1"; ok=$((ok + 1))
  else
    rm -f "public/props/$1.png"
    printf '  ✗ %s\n' "$1"; miss=$((miss + 1))
  fi
}

echo '장애물 — 숲'
get forest-tree   hf_20260821_064616_1a44d02c-747d-47a7-8ec8-63c44022126f.png
get forest-pine   hf_20260821_064616_c808aff5-9405-4436-9d81-e30291f2e232.png
get forest-rock   hf_20260821_064616_44241252-62cb-4d70-a9e1-e05c97d987c7.png
get forest-stump  hf_20260821_064616_0036a090-eccc-404d-8fdb-eeb8db2698d7.png
#  ★ 원본은 「마른 덤불」입니다 (dry dead shrub, 숲용). 이름만 bush 입니다.
get forest-bush   hf_20260821_064616_f7546196-7cdf-49db-9b31-f8e00771e731.png

echo '장애물 — 광산'
get mine-tree     hf_20260821_064616_56fc12a8-7207-4490-a228-d838a0e5952d.png
get mine-rock     hf_20260821_064616_a311ffcd-1e61-4a98-86eb-97161e01ada9.png
get mine-beam     hf_20260821_064616_0a8189db-ffc0-429d-ac84-bda5bd703bf1.png

echo '광맥'
get vein-iron     hf_20260821_064616_d31a6eb9-5f7d-4fed-9a15-a4de41079f84.png
get vein-copper   hf_20260821_064616_8f198631-60e2-4a70-8589-f0190b5ac8c0.png
get vein-darkiron hf_20260821_064616_c98d9675-f1ee-4aca-bebe-b8e6bfcf4402.png
get vein-depleted hf_20260821_064616_4d85aff2-fd5f-4494-b593-889bcf892bc1.png

echo '몬스터'
get mob-stray     hf_20260821_065630_569c1a2a-d866-4486-8184-226fc387ab1d.png
get mob-wolf      hf_20260821_065630_5399ccad-eee5-4715-ae08-6e6452c8ddcd.png
get mob-bat       hf_20260821_065630_b9b21f60-af58-49ab-9a28-c45054ce9d84.png
get mob-spider    hf_20260821_065630_adeff894-fade-4c52-a8ed-3c142ae14921.png
get mob-burrow    hf_20260821_065630_b4086b5e-019f-42f3-a693-d3c266a37aaa.png
get mob-frozen    hf_20260821_065630_514b4766-c026-4127-8510-b0367fb09a13.png

echo '마을 — 아직 걸 자리가 없습니다 (건물·화로는 배관을 더 놓아야 합니다)'
get smithy-small  hf_20260821_065630_1eebf8ed-9da7-46e2-a71a-d41caa9b75d2.png
get smithy-large  hf_20260821_065630_2ba87546-7817-4d51-8843-0701a7d847a2.png
get shop          hf_20260821_065630_1400be45-9b90-470d-84b6-b35bfb92adb1.png
get plot-empty    hf_20260821_065631_1c590e59-1963-4990-907e-6bae827dd6e0.png
get forge-small   hf_20260821_065630_3363c56b-b36f-4027-b471-89cbd5f51019.png
get forge-large   hf_20260821_065630_a5f3f6c8-87bd-4ae0-aba5-6e96b65474d6.png

echo
echo "받음 ${ok} · 못 받음 ${miss}"
if [ "$miss" -gt 0 ]; then
  cat <<'MSG'

못 받은 것이 있습니다. 거의 언제나 이유는 하나입니다 —
d8j0ntlcm91z4.cloudfront.net 이 이 세션의 egress 허용 목록 밖입니다.
확인:  curl -sS "$HTTPS_PROXY/__agentproxy/status" | grep -o 'cloudfront[^"]*'
허용 목록에 넣은 뒤 새 세션에서 다시 돌리면 그대로 받아집니다.
MSG
  exit 1
fi

cat <<'MSG'

다음: src/rpg/ui/art/sprites.ts 의 SPRITES 에 아래를 넣으면 켜집니다.

  'forest/tree': 'forest-tree.png',
  'forest/pine': 'forest-pine.png',
  'forest/rock': 'forest-rock.png',
  'river/deadbush': 'forest-bush.png',
  'cave/rock': 'mine-rock.png',
  'cave/beam': 'mine-beam.png',
  'vein/iron-shallow': 'vein-iron.png',
  'vein/iron-deep': 'vein-iron.png',
  'vein/copper-shallow': 'vein-copper.png',
  'vein/copper-deep': 'vein-copper.png',
  'vein/dark-iron': 'vein-darkiron.png',
  'vein/empty': 'vein-depleted.png',
  'monster/stray-dog': 'mob-stray.png',
  'monster/wolf': 'mob-wolf.png',
  'monster/cave-bat': 'mob-bat.png',
  'monster/cave-spider': 'mob-spider.png',
  'monster/deep-lurker': 'mob-burrow.png',
  'monster/frozen-thing': 'mob-frozen.png',

forest-stump · mine-tree 는 지금 장애물 여덟 종에 대응하는 것이 없습니다.
쓰려면 PropKind 와 PROP_SETS 에 종류를 늘려야 합니다 — 콘텐츠 변경입니다.
큰게(river-crab)는 그림이 없습니다.
MSG
