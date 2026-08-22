#!/usr/bin/env node
/**
 *  PixelLab 으로 그림을 뽑습니다 — docs/그림-작업.md 4장 「스타일 기준 한 벌」.
 *
 *  ★ 왜 스크립트로 두는가: 프롬프트에 3장의 규약을 **전부** 박아야 하는데
 *    (하나라도 빠지면 전부 못 씁니다), 그것을 매번 사람이 다시 쓰면 반드시 빠집니다.
 *    규약을 STYLE 한 곳에 두고 표에는 무엇을 그릴지만 적습니다.
 *
 *  ★ 크기는 상상이 아니라 잰 것입니다. 게임 안 월드 크기 × 3 입니다
 *    (최대 확대가 2.75배라 3배면 언제나 축소만 되어 안 뭉갭니다).
 *    PixelLab 의 상한은 400 이고 제일 큰 beast 가 200 이라 전부 안에 듭니다.
 *
 *  쓰는 법:
 *    PIXELLAB_SECRET=... node tools/gen-art.mjs           # 없는 것만
 *    PIXELLAB_SECRET=... node tools/gen-art.mjs --force    # 다시 뽑기
 *    PIXELLAB_SECRET=... node tools/gen-art.mjs rock tree  # 고른 것만
 *
 *  ★ 이미 있는 파일은 건너뜁니다. 한 번 뽑은 것을 다시 뽑으면 돈이 나갑니다.
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';

const API = 'https://api.pixellab.ai/v1/generate-image-pixflux';
const SECRET = process.env.PIXELLAB_SECRET;
const OUT = 'public/props';

/**
 *  3장의 규약. **모든 프롬프트 뒤에 그대로 붙습니다.**
 *
 *  ★ 「그림자 없음」이 여기 있는 이유: 그림자는 코드가 그립니다
 *    (terrain.ts 의 drawProp, actors.ts 의 drawShadow). 구우면 둘이 됩니다.
 *  ★ 「빛은 왼쪽 위」는 palette.ts 의 LIGHT = {x:-0.55, y:-0.84}, 약 123도입니다.
 *  ★ 「세 색」은 지금 화면이 밝은면/중간/어두운면 셋인 것과 맞춥니다.
 */
const STYLE =
  ', flat pixel art with exactly three tones (a light face, a mid base, a dark face), ' +
  'light source from the upper left, ' +
  'no cast shadow and no ground shadow baked into the sprite, ' +
  'transparent background, centered, no ground plane, no scenery behind it';

/**  좌우 거울에 걸리는 것에만 붙입니다 — 코드가 scale(-1,1) 로 통째 뒤집습니다 */
const MIRROR = ', keep the shape roughly symmetric so it still reads when mirrored horizontally';

/**  지역 팔레트 — public/props/README.md 의 표와 같은 값입니다 */
const FOREST = 'greens #456e39 #2b4a2c #19311e';

/**
 *  무엇을 몇 픽셀로.
 *
 *  size 는 **월드 크기 × 3** 입니다. 월드 크기는 코드에서 잰 값이고 주석에 적었습니다.
 *  회전하는 것(몬스터는 쓰러질 때 최대 84.8도)은 정사각 여백을 둡니다.
 */
const PIECES = [
  {
    key: 'char-torso',
    // actors.ts drawPlayer — 몸통 x -7.5..7.5 · y -10..6, 뒤쪽 팔까지 x -9.5
    size: [60, 48],
    view: 'low top-down',
    prompt:
      'the torso and arms of a standing human warrior wearing a plain iron chestplate ' +
      'with rounded shoulder pauldrons and a brown leather belt, no head, no legs' +
      MIRROR,
  },
  {
    key: 'char-helm',
    // actors.ts — 투구 arc r6.4 at headY-0.5, 챙 12.8 wide
    size: [40, 28],
    view: 'low top-down',
    prompt:
      'a simple iron helmet with a flat brim, seen from the front, ' +
      'a single small highlight on the dome, no face visible' +
      MIRROR,
  },
  {
    key: 'sword-iron',
    // actors.ts drawArmedHand — 자루 10 + 코등이 + 날 span ~19 + 칼끝, 월드 약 36 × 10
    size: [108, 32],
    view: 'side',
    prompt:
      'an iron straight sword lying horizontally with the blade pointing right, ' +
      'brown leather grip, small round pommel on the left, straight crossguard, ' +
      'the blade is lighter along its top edge and darker along its bottom edge',
  },
  {
    key: 'monster-beast',
    // actors.ts drawMonster — 월드 66.8 × 46.2. 쓰러질 때 84.8도 도므로 정사각
    size: [200, 200],
    view: 'low top-down',
    prompt:
      'a lean four-legged wolf-like beast standing in profile facing right, ' +
      'shaggy fur, bared teeth, small pale eye',
  },
  {
    key: 'forest-tree',
    // terrain.ts drawProp — scale 1.18 에서 월드 43.7 × 48.3
    size: [132, 148],
    view: 'low top-down',
    prompt:
      `a broadleaf forest tree with a rounded leafy canopy in ${FOREST} ` +
      'and a short brown trunk, the trunk bottom at the very bottom edge of the image' +
      MIRROR,
  },
  {
    key: 'forest-rock',
    // terrain.ts drawProp — 월드 23.6 × 18.9. ★ 회색입니다. 지금 코드는 초록으로 그립니다
    size: [72, 60],
    view: 'low top-down',
    prompt:
      'a small grey granite boulder, cool neutral grey stone, no moss, no grass' +
      MIRROR,
  },
  {
    key: 'forge',
    // effects.ts drawForge — 굴뚝 y-36 부터 바닥 y+9, x -16..14. 월드 32 × 45
    size: [96, 136],
    view: 'low top-down',
    // ★ 화로는 3장 2절의 유일한 예외입니다 — 아궁이 쪽이 밝습니다
    prompt:
      'a stone blacksmith forge: a grey stone block furnace with a tall chimney on its ' +
      'right, and a dark arched firebox opening at the front glowing orange from the ' +
      'coals inside, the glow lights the stone around the opening',
  },
  {
    //  ★ 비교용 한 장. 나머지 일곱은 selective outline 인데 이것만 lineless 입니다.
    //    지금 게임 화면에는 윤곽선이 하나도 없어서, 윤곽선이 남의 것처럼 보이는지
    //    같은 바위 둘을 나란히 놓고 봐야 알 수 있습니다 (4장의 마지막 질문).
    key: 'forest-rock-lineless',
    size: [72, 60],
    view: 'low top-down',
    outline: 'lineless',
    prompt:
      'a small grey granite boulder, cool neutral grey stone, no moss, no grass' +
      MIRROR,
  },
];

if (!SECRET) {
  console.error('PIXELLAB_SECRET 이 없습니다. 환경변수를 설정하고 다시 도세요.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const only = argv.filter((a) => !a.startsWith('--'));

mkdirSync(OUT, { recursive: true });

let made = 0;
let skipped = 0;
let spent = 0;

for (const piece of PIECES) {
  if (only.length && !only.some((o) => piece.key.includes(o))) continue;

  const path = `${OUT}/${piece.key}.png`;
  if (existsSync(path) && !force) {
    console.log(`  · ${piece.key} — 이미 있습니다`);
    skipped++;
    continue;
  }

  const body = {
    description: piece.prompt + STYLE,
    image_size: { width: piece.size[0], height: piece.size[1] },
    no_background: true,
    view: piece.view,
    //  ★ 윤곽선은 한 곳에서만 정합니다. 지금 게임에는 선이 없지만 32px 로 줄여도
    //    읽히려면 픽셀아트에서는 보통 선이 필요합니다 — 그 둘 중 어느 쪽인지가
    //    4장이 묻는 것이라, 기본은 selective 로 두고 비교용 한 장만 lineless 입니다.
    outline: piece.outline ?? 'selective outline',
    shading: 'flat shading',
    detail: 'low detail',
    text_guidance_scale: 9,
  };

  process.stdout.write(`  … ${piece.key} (${piece.size[0]}×${piece.size[1]}) `);

  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    //  ★ 조용히 넘어가지 않습니다 (CLAUDE.md 6장). 무엇이 왜 안 됐는지 그대로 찍습니다.
    console.log('✗');
    console.error(`     HTTP ${res.status} — ${(await res.text()).slice(0, 400)}`);
    continue;
  }

  const json = await res.json();
  writeFileSync(path, Buffer.from(json.image.base64, 'base64'));
  spent += json.usage?.generations ?? 0;
  made++;
  console.log(`✓ ${json.usage?.generations ?? '?'}장`);
}

console.log(`\n뽑음 ${made} · 건너뜀 ${skipped} · 쓴 생성 ${spent}`);
if (made) console.log('다음: src/rpg/ui/art/sprites.ts 의 SPRITES 표에 줄을 더하면 그림으로 바뀝니다.');
