#!/usr/bin/env node
/**
 *  PixelLab 으로 그림을 뽑습니다 — docs/그림-작업.md 4장 「스타일 기준 한 벌」.
 *
 *  ★ 두 걸음으로 나뉩니다. 일관성 때문입니다.
 *
 *      node tools/gen-art.mjs base          기준이 될 몸통을 변주 4장 (pixflux)
 *      node tools/gen-art.mjs rest <기준png> 고른 한 장에 맞춰 나머지 여섯 (bitforge)
 *
 *    한 장씩 따로 부르면(pixflux) 서로를 안 보고 나와서 같은 손에서 나온 것이
 *    되지 않습니다. bitforge 에 style_image 를 물리면 나머지가 그것을 따라옵니다.
 *
 *  ★ 규약(문서 3장)은 STYLE 한 곳에만 적습니다. 매번 사람이 다시 쓰면 반드시
 *    하나가 빠지고, 하나라도 빠지면 그 장은 못 씁니다.
 *
 *  ★ 색은 상상하지 않습니다. 전부 게임 코드에서 가져온 값이고 어디서 왔는지
 *    주석에 적혀 있습니다. shades() 와 같은 식으로 밝은 면·어두운 면을 만듭니다.
 *
 *  ★ 크기도 상상하지 않습니다. 코드에서 잰 월드 크기 × 3 입니다
 *    (최대 확대가 2.75배라 3배면 언제나 축소만 되어 안 뭉갭니다).
 *
 *  ★ 이미 있는 파일은 건너뜁니다 — 다시 뽑으면 생성이 나갑니다. --force 로 덮습니다.
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { palettePNG, decodePNG, encodePNG, fitInto, resizeNearest } from './png.mjs';

const BASE = 'https://api.pixellab.ai/v1';
const SECRET = process.env.PIXELLAB_SECRET;
const OUT = 'public/props';

/* ===========================================================================
 *  색 — 전부 게임 코드에서 가져온 값입니다
 * ======================================================================== */

/*  actors.ts 의 lighten/darken 과 같은 식입니다  */
const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16));
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const lighten = (h, a) => { const [r, g, b] = rgb(h); return hex(r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a); };
const darken  = (h, a) => { const [r, g, b] = rgb(h); return hex(r * (1 - a), g * (1 - a), b * (1 - a)); };

/**
 *  밝은 면 · 중간 · 어두운 면.
 *  ★ actors.ts 의 shades() 와 같은 값입니다 — lighten 0.3 / darken 0.42.
 *    화면이 그 셋으로 그리므로 그림도 그 셋이어야 나란히 놨을 때 안 튑니다.
 */
const shades = (c) => [lighten(c, 0.3), c, darken(c, 0.42)];

/*  윤곽선 색 — effects.ts 의 돌 이음매에 쓰는 값입니다  */
const OUTLINE = '#1b1613';

const C = {
  ironMail:  '#8892a0',  // palette.ts MATERIAL['iron-mail']
  ironHelm:  '#7c848f',  // palette.ts MATERIAL['iron-helm']
  blade:     '#c3cbd6',  // actors.ts IRON
  brass:     '#c9a227',  // actors.ts BRASS
  grip:      '#3a2c20',  // actors.ts drawArmedHand 자루
  skin:      '#e8b98c',  // actors.ts SKIN
  skinShade: '#c2916a',  // actors.ts SKIN_SHADE
  boot:      '#2a2320',  // actors.ts 신발
  wolf:      '#7d8590',  // content/monsters.ts 늑대 color
  stone:     '#584f47',  // effects.ts drawForge 의 stone — 이 저장소에 있는 유일한 돌색
  ember:     '#ff7a2a',  // effects.ts 숯불
  firebox:   '#140d09',  // effects.ts 아궁이 안쪽
  wood:      '#6b4f32',  // gen-art 자체값 없음 → actors.ts grip(#3a2c20)을 밝힌 값. 갱목
  crystal:   '#5ee0ff',  // palette.ts cave.liquidGlow — 빛나는 수정
  veinRock:  '#463f38',  // effects.ts drawVein 의 바탕 바위
};

/**
 *  광맥 색 — **content/veins.ts 의 def.color 그대로입니다.**
 *  ★ 지금 화면이 이 색으로 광석 알갱이를 찍습니다. 그림도 같은 색이어야
 *    그림을 껐다 켰을 때 광맥 종류가 안 바뀝니다.
 */
const VEIN = {
  'iron-shallow': '#8a7d6b',
  'iron-deep':    '#a08a6a',
  'copper-shallow': '#c47a4a',
  'copper-deep':  '#e08a4a',
  'dark-iron':    '#5a5560',
  'frost-iron':   '#9fb3bd',
  'ember-iron':   '#c96a3a',
};

/**
 *  지역 팔레트 — public/props/README.md 의 표 그대로입니다.
 *
 *  ★ 네 지역을 한 팔레트 그림에 같이 넣지 않습니다. color_image 는 팔레트를
 *    **강제**하므로, 넷을 다 넣으면 광산 바위에 숲 초록이 들어갑니다.
 *    지역색은 그 지역에 나오는 물건에만 겁니다.
 */
const ZONE = {
  town:   ['#4e7440', '#2f5233', '#1d3722'],
  forest: ['#456e39', '#2b4a2c', '#19311e'],
  cave:   ['#544c60', '#3a3442', '#221d2a'],
  river:  ['#8a9463', '#5e6a43', '#39422a'],
};

/* ===========================================================================
 *  규약 — 문서 3장. 모든 프롬프트 뒤에 그대로 붙습니다
 * ======================================================================== */

const STYLE =
  //  색 수 — 지금 화면이 물체마다 세 색입니다 (actors.ts shades)
  ', flat pixel art using exactly three tones per material: one light face, one mid base, ' +
  'one dark face, hard edges between tones, ' +
  'no gradients, no dithering, no soft shading, no anti-aliasing, no blurred pixels, ' +
  //  윤곽선 — 32px 로 줄여도 형체가 남아야 합니다
  'a clean dark one pixel outline around the whole silhouette so the shape still reads ' +
  'when shrunk to 32 pixels, ' +
  //  빛 — palette.ts LIGHT = {x:-0.55,y:-0.84}, 약 123도
  'light source from the upper left, ' +
  //  그림자 — 코드가 그립니다 (terrain.ts drawProp, actors.ts drawShadow)
  'no cast shadow and no ground shadow baked into the sprite, ' +
  'transparent background, no ground plane, no grass, no dirt, no scenery behind it, ' +
  //  ★ 넓은 화면(검 108×32)에서 모델이 빈 곳을 채우려고 같은 물건을 여러 개
  //    그려버립니다. 실측으로 세 자루가 나왔습니다. 그래서 하나라고 못박습니다.
  'exactly one single object centered in the frame, not a set, not a row, not a collection';

/**  좌우 거울에 걸리는 것 — 코드가 scale(-1,1) 로 통째 뒤집습니다 */
const MIRROR = ', keep the silhouette roughly symmetric so it still reads when mirrored horizontally';

/* ===========================================================================
 *  기준 한 장 — 몸통을 변주 넷으로
 *
 *  ★ 왜 몸통인가: 화면에 늘 있고, 부위가 여섯으로 쪼개져 일관성이 제일 깨지기
 *    쉽고, 크기가 제일 큽니다. 여기가 흔들리면 나머지가 다 흔들립니다.
 *  ★ seed 를 박아둡니다 — 마음에 든 장을 나중에 다시 뽑을 수 있어야 합니다.
 * ======================================================================== */

//  actors.ts drawPlayer — 몸통 x -7.5..7.5 · y -10..6, 뒤쪽 팔까지 x -9.5 → 월드 20 × 16
const TORSO_SIZE = [60, 48];
const TORSO_PALETTE = [
  ...shades(C.ironMail), C.grip, C.brass, C.skin, C.skinShade, OUTLINE,
];

const TORSO_VARIANTS = [
  { key: 'base-torso-1', seed: 11, prompt:
    'the torso and arms of a standing human warrior in a plain iron plate chestplate ' +
    'with rounded shoulder pauldrons and a brown leather belt with a small brass buckle, ' +
    'no head, no legs, front view' },
  { key: 'base-torso-2', seed: 22, prompt:
    'the torso and arms of a standing human warrior in a riveted iron mail shirt ' +
    'over a leather belt, bare forearms, no head, no legs, front view' },
  { key: 'base-torso-3', seed: 33, prompt:
    'the torso and arms of a standing human warrior in a segmented iron cuirass with ' +
    'broad angular shoulder plates and a brown leather belt, no head, no legs, front view' },
  { key: 'base-torso-4', seed: 44, prompt:
    'the torso and arms of a standing human warrior in a simple undecorated iron ' +
    'breastplate over a dark tunic with a brown leather belt, no head, no legs, front view' },
];

/* ===========================================================================
 *  나머지 여섯 — 고른 기준에 맞춰 bitforge 로
 * ======================================================================== */

const REST = [
  /* ------------------------------------------------------------ 프롭 여섯
   *  ★ 크기는 상상하지 않습니다. `terrain.ts` 의 `PROP_WIDTH` × 3 이 가로이고,
   *    세로는 그 도형이 실제로 덮는 높이 × 3 입니다 (접지선 = 타일 위 0.72,
   *    TILE 32 이므로 타일 가운데에서 7.04 아래).
   *  ★ 화면에 실제로 나오는 여덟 중 나무·바위는 이미 있어서 여섯만 뽑습니다.
   */
  { key: 'prop-pine', size: [90, 114], view: 'low top-down',
    // PROP_WIDTH.pine 30 · 도형 y -31..+7 → 월드 30 × 38
    palette: [...ZONE.forest, C.grip, darken(C.grip, 0.3), OUTLINE],
    prompt: 'a tall narrow evergreen pine tree with three stacked triangular tiers of ' +
      'dark green needles and a short brown trunk, the trunk bottom touching the very ' +
      'bottom edge of the image' + MIRROR },

  { key: 'prop-bush', size: [86, 60], view: 'low top-down',
    // PROP_WIDTH.bush 29 · 도형 y -13..+7 → 월드 29 × 20
    palette: [...ZONE.forest, OUTLINE],
    prompt: 'a low round green leafy shrub, three overlapping clumps of foliage, ' +
      'no trunk visible, sitting flat on the bottom edge of the image' + MIRROR },

  { key: 'prop-deadbush', size: [60, 42], view: 'low top-down',
    //  ★ 강가에만 납니다 (PROP_SETS.river). 그래서 강가 팔레트입니다
    palette: [...ZONE.river, OUTLINE],
    prompt: 'a small dry leafless shrub of thin bare twigs fanning upward and outward, ' +
      'dry olive brown, sitting on the bottom edge of the image' + MIRROR },

  { key: 'prop-spire', size: [54, 80], view: 'low top-down',
    //  ★ 광산 보라. 초록 이끼 금지 (.claude/rules/sprites.md 3절)
    palette: [...ZONE.cave, OUTLINE],
    prompt: 'a single narrow pointed rock spire rising from the ground, a sharp stone ' +
      'cone of cold purple-grey cave rock, nothing around it' + MIRROR },

  { key: 'prop-beam', size: [90, 102], view: 'low top-down',
    //  ★ 갱목. 나무지만 광산 팔레트에 나무색 둘을 더합니다 — 보라 바닥에서
    //    혼자 초록빛이 되지 않게 하면서도 「나무」로 읽혀야 합니다
    palette: [...ZONE.cave, C.wood, darken(C.wood, 0.35), OUTLINE],
    prompt: 'a wooden mine shaft support frame: two upright timber posts with one ' +
      'horizontal beam across the top, rough dark timber, nothing between the posts' + MIRROR },

  { key: 'prop-crystal', size: [74, 90], view: 'low top-down',
    //  ★ 빛나는 것 — 코드가 위에 빛을 더 얹습니다 (terrain.ts drawLights).
    //    그림에는 몸만 있고 번짐은 굽지 않습니다
    palette: [...ZONE.cave, C.crystal, lighten(C.crystal, 0.5), OUTLINE],
    prompt: 'a cluster of three glowing cyan crystal shards of different heights growing ' +
      'straight up from a small dark rock base, the crystals bright and translucent, ' +
      'no light halo or glow bloom around them' + MIRROR },

  { key: 'char-helm', size: [40, 28], view: 'low top-down',
    // actors.ts — 투구 arc r6.4, 챙 12.8 wide → 월드 13.3 × 9.3
    palette: [...shades(C.ironHelm), OUTLINE],
    prompt: 'a simple iron helmet with a flat brim seen from the front, no face visible' + MIRROR },

  { key: 'sword-iron', size: [108, 32], view: 'side',
    // actors.ts drawArmedHand — 자루 10 + 코등이 + 날 span ~19 → 월드 36 × 10.7
    palette: [...shades(C.blade), C.brass, C.grip, OUTLINE],
    prompt: 'an iron straight sword lying horizontally with the blade pointing right, ' +
      'brown leather grip on the left, small brass pommel and straight brass crossguard, ' +
      'the blade lighter along its top edge and darker along its bottom edge' },

  /* ------------------------------------------------------------ 몬스터 둘
   *  ★ 크기: `actors.ts` 가 `drawSprite(..., size*3.4)` 로 그린다. 그 모양을 쓰는
   *    가장 큰 몬스터를 기준으로 3배를 잡는다 —
   *    박쥐 size 11 → 3.4×11=37.4 월드 → 112px · 거미 size 19 → 64.6 → 194px.
   *  ★ 세로는 그 도형의 비율을 따른다 (bat 1.65/3.80 · spider 1.36/3.85).
   *  ★★ **색을 굽지 않는다.** 거미 모양 하나를 큰게·동굴거미·굴밑의것 셋이
   *    나눠 쓴다. 그래서 한 색으로 구워 넣고 `SPRITE_TONES` 에 그 셋을 적어두면
   *    `tintedSprite` 가 `def.color` 로 갈아끼운다 (.claude/rules/sprites.md 3절).
   *    여기 넣는 팔레트와 그 표가 **같은 값이어야** 한다.
   */
  { key: 'monster-bat', size: [112, 48], view: 'low top-down',
    // content/monsters.ts 광산 박쥐 color '#8a7aa8'
    palette: [...shades('#8a7aa8'), OUTLINE],
    prompt: 'a small bat seen from above with both leathery wings spread wide and flat, ' +
      'a small furry body in the middle, two pointed ears, symmetric' + MIRROR },

  { key: 'monster-spider', size: [194, 68], view: 'low top-down',
    // content/monsters.ts 동굴 거미 color '#4a5a3a'
    palette: [...shades('#4a5a3a'), OUTLINE],
    prompt: 'a spider seen from directly above with eight legs spread evenly to both ' +
      'sides, a small round head end and a larger round abdomen, the body much narrower ' +
      'than the leg span, symmetric' + MIRROR },

  { key: 'monster-beast', size: [200, 200], view: 'low top-down',
    // actors.ts drawMonster — 월드 66.8 × 46.2. 쓰러질 때 84.8도 도므로 정사각 여백
    palette: [...shades(C.wolf), C.boot, OUTLINE],
    prompt: 'a lean grey four-legged wolf standing in profile facing right, ' +
      'shaggy fur, bared teeth, one small pale eye' },

  { key: 'forest-tree', size: [132, 148], view: 'low top-down',
    // terrain.ts drawProp — scale 1.18 에서 월드 43.7 × 48.3
    palette: [...ZONE.forest, C.grip, darken(C.grip, 0.3), OUTLINE],
    prompt: 'a broadleaf forest tree with a rounded green leafy canopy and a short brown ' +
      'trunk, the trunk bottom touching the very bottom edge of the image' + MIRROR },

  { key: 'forest-rock', size: [72, 60], view: 'low top-down',
    // terrain.ts drawProp — 월드 23.6 × 18.9. 네 지역 전부에 나오므로 지역색을 안 겁니다
    palette: [...shades(C.stone), OUTLINE],
    prompt: 'a single small grey stone boulder, bare rock only, ' +
      'nothing under it and nothing around it' + MIRROR },

  { key: 'cave-rock', size: [72, 60], view: 'low top-down',
    //  ★ 광산 전용 바위. 숲 바위(forest-rock)를 그대로 쓰면 회색이 보라 바닥에서
    //    따로 놉니다 — 실제로 띄워 보고 그랬습니다. sprites.ts 주석대로
    //    'cave/rock' 이 'rock' 을 덮으므로 이 한 장만 더하면 갈립니다.
    //    지역색은 README 의 광산 세 톤 그대로입니다.
    palette: [...ZONE.cave, OUTLINE],
    prompt: 'a single small stone boulder made of cold purple-grey cave rock, ' +
      'bare rock only, nothing under it and nothing around it' + MIRROR },

  //  ★ 큰 화로 — 마을이 자라면 화로가 **커지는 것이 아니라 좋아집니다.**
  //    지금은 같은 도형을 FORGE_GROWN 으로 늘리기만 해서, 자란 것이
  //    「더 크게 그린 같은 것」입니다 (effects.ts drawForge).
  //  ★ 작은 것과 같은 배율입니다 — 월드 1px = 그림 3px. 월드 44 × 54.
  //    그래서 캔버스가 132 × 162 입니다. 이 비가 곧 화면 크기가 됩니다
  //    (effects.ts 가 naturalWidth / 3 을 폭으로 씁니다).
  /* ------------------------------------------------------------ 광맥 여덟
   *  ★★ **광맥은 바위와 반대다.** 바위는 배경에 섞여야 하는 장애물이고,
   *    광맥은 **찾아서 캐는 것**이라 눈에 걸려야 한다. 그래서 지역 팔레트를
   *    걸지 않고 **광석 색을 밝게 세워** 바닥에서 튀게 뽑는다 —
   *    특히 광산 보라 바닥(#3a3442)에서.
   *  ★ 광석 색은 상상하지 않는다. `content/veins.ts` 의 `def.color` 그대로다.
   *    지금 화면이 그 색으로 알갱이를 찍으므로 그림도 같아야 종류가 안 바뀐다.
   *  ★ 크기: `effects.ts drawVein` 이 `drawSprite(..., y+12, 32)` 로 그린다.
   *    월드 32 × 24 → 96 × 72.
   */
  ...Object.entries(VEIN).map(([id, ore]) => ({
    key: `vein-${id}`, size: [96, 72], view: 'low top-down',
    //  ★ 바탕 바위는 어둡게, 광석은 밝게. 바탕이 밝으면 알갱이가 안 걸린다
    palette: [darken(C.veinRock, 0.3), C.veinRock, ...shades(ore), lighten(ore, 0.55), OUTLINE],
    prompt: 'a low dark grey rock outcrop with bright metallic ore chunks embedded in it, ' +
      'the ore lumps clearly brighter than the rock and catching the light, ' +
      'the rock sitting flat on the bottom edge of the image' + MIRROR,
  })),

  { key: 'vein-empty', size: [96, 72], view: 'low top-down',
    //  ★ 바닥난 광맥 — 돌만 남는다. 종류를 안 가리고 한 장을 같이 쓴다
    //    (effects.ts drawVein 이 spriteFor('vein/empty') 하나만 본다)
    palette: [darken(C.veinRock, 0.3), C.veinRock, lighten(C.veinRock, 0.25), OUTLINE],
    prompt: 'a low plain dark grey rock outcrop with empty hollow pits where ore was ' +
      'chipped out, no metal left in it, sitting flat on the bottom edge of the image' + MIRROR },

  { key: 'forge-large', size: [132, 162], view: 'low top-down',
    // ★ 문서 3장 2절의 유일한 예외 — 빛이 왼쪽 위가 아니라 아궁이에서 옵니다
    palette: [...shades(C.stone), C.ember, C.firebox, OUTLINE],
    prompt: 'a large stone blacksmith forge: a wide grey stone block furnace with a ' +
      'heavy stone hood and a tall chimney above it, a broad dark arched firebox opening ' +
      'at the front glowing orange from the coals inside, the glow lighting the stone ' +
      'around the opening, thicker stonework than a small forge' },

  { key: 'forge', size: [96, 136], view: 'low top-down',
    // effects.ts drawForge — 굴뚝 y-36 부터 바닥 y+9, x -16..14 → 월드 32 × 45
    // ★ 문서 3장 2절의 유일한 예외 — 빛이 왼쪽 위가 아니라 아궁이에서 옵니다
    palette: [...shades(C.stone), C.ember, C.firebox, OUTLINE],
    prompt: 'a stone blacksmith forge: a grey stone block furnace with a tall chimney rising from ' +
      'the right hand side of the block, clearly on the right, and a dark arched ' +
      'firebox opening at the front glowing orange from the coals inside, ' +
      'the glow lighting the stone around the opening' },
];

/* ======================================================================== */

if (!SECRET) {
  console.error('PIXELLAB_SECRET 이 없습니다.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const words = argv.filter((a) => !a.startsWith('--'));
const mode = words[0];

mkdirSync(OUT, { recursive: true });

let made = 0, skipped = 0, spent = 0;

async function call(endpoint, body, key) {
  const path = `${OUT}/${key}.png`;
  if (existsSync(path) && !force) { console.log(`  · ${key} — 이미 있습니다`); skipped++; return; }

  process.stdout.write(`  … ${key} `);
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    //  ★ 조용히 넘어가지 않습니다 (CLAUDE.md 6장)
    console.log('✗');
    console.error(`     HTTP ${res.status} — ${(await res.text()).slice(0, 500)}`);
    return;
  }
  const json = await res.json();
  writeFileSync(path, Buffer.from(json.image.base64, 'base64'));
  spent += json.usage?.generations ?? 0;
  made++;
  console.log(`✓`);
}

const asImage = (buf) => ({ type: 'base64', base64: buf.toString('base64') });

/**  두 걸음이 공유하는 값. 여기 있는 것이 「스타일」입니다 */
const COMMON = {
  no_background: true,
  outline: 'single color black outline',  // 어두운 1px 외곽선
  shading: 'flat shading',                // 그러데이션 없음
  detail: 'low detail',                   // 색 수를 줄이는 쪽
  text_guidance_scale: 9,
};

if (mode === 'base') {
  console.log('기준 후보 — 캐릭터 몸통 변주 4장 (pixflux · color_image 로 팔레트 강제)\n');
  for (const v of TORSO_VARIANTS) {
    if (words.length > 1 && !words.slice(1).some((w) => v.key.includes(w))) continue;
    await call('generate-image-pixflux', {
      ...COMMON,
      description: v.prompt + STYLE,
      image_size: { width: TORSO_SIZE[0], height: TORSO_SIZE[1] },
      view: 'low top-down',
      color_image: asImage(palettePNG(TORSO_PALETTE)),
      seed: v.seed,
    }, v.key);
  }
} else if (mode === 'rest') {
  //  ★ --pixflux 는 기준 그림 없이 뽑습니다. 일관성은 STYLE 과 color_image 만으로
  //    걸리고, 대신 bitforge 가 형태를 흔드는 문제가 없습니다. 어느 쪽이 나은지
  //    같은 물건으로 나눠 재려고 둡니다.
  const viaPixflux = argv.includes('--pixflux');
  const stylePath = words[1];
  if (!stylePath || !existsSync(stylePath)) {
    console.error('기준 그림을 주십시오.  예: node tools/gen-art.mjs rest public/props/base-torso-2.png');
    process.exit(1);
  }
  //  ★ 50 = balanced (openapi 의 설명). 기준을 따라가되 물건마다 형태가 달라야 해서
  //    형태를 못 바꿀 만큼 높이지 않습니다. 어느 값을 썼는지 화면에 찍습니다.
  //  ★ 20 입니다. openapi 는 「50 = balanced」라고 하지만 실측으로 55 에서는
  //    기준 그림의 **형태까지** 따라와서 투구가 몸통이 되고 나무가 짐승이 됐습니다.
  //    20 에서 물건이 제 모양을 찾습니다. 넣는 방법(가운데 두기/늘리기)은
  //    같은 검으로 나눠 재봤고 차이가 강도만큼 크지 않았습니다.
  const STYLE_STRENGTH = Number(argv.find((a) => a.startsWith('--strength='))?.split('=')[1] ?? 20);
  //  ★ 기준 그림을 넣는 방법 둘. 비율을 지켜 가운데 두면(fit) 남는 곳이 투명이라
  //    모델이 그 실루엣을 「그릴 물건」으로 읽을 수 있습니다. 늘려 채우면(stretch)
  //    그 신호가 없어지는 대신 획 두께가 물건마다 달라집니다. 어느 쪽이 나은지 잽니다.
  const stretch = argv.includes('--stretch');
  //  ★ bitforge 는 style_image 가 image_size 와 **정확히 같은 크기**여야 합니다.
  //    openapi 에 없는 규칙이고, 어기면 HTTP 500 으로
  //    "style_image must be size (H, W)" 가 옵니다. 그래서 물건마다 맞춰 넣습니다 —
  //    찌그러뜨리지 않고 비율을 지킨 채 가운데 두고 나머지는 투명입니다.
  const styleSrc = decodePNG(readFileSync(stylePath));
  //  ★ 무엇으로 돌았는지 그대로 찍습니다. 예전에 --pixflux 로 돌리고도 화면은
  //    bitforge 라고 적어서, 나중에 어느 방법으로 뽑은 그림인지 알 수 없었습니다.
  if (viaPixflux) {
    console.log('나머지 여섯 — pixflux · color_image 로 팔레트 강제 (기준 그림은 안 씁니다)');
    console.log(`실측: bitforge 는 style_image 를 어떻게 넣든(가운데/늘리기) 형태를 흔들었습니다.
       강도 55 는 투구를 몸통으로, 20 은 나무를 세 그루로 만들었습니다.
       일관성은 STYLE 과 color_image 로만 겁니다.\n`);
  } else {
    console.log(`나머지 여섯 — 기준 ${stylePath} · style_strength ${STYLE_STRENGTH} · ${stretch ? '늘려서' : '가운데 두고'} (bitforge)`);
    console.log(`기준 그림은 ${styleSrc.width}×${styleSrc.height} 이라 물건 크기에 맞춰 다시 넣습니다\n`);
  }
  for (const p of REST) {
    if (words.length > 2 && !words.slice(2).some((w) => p.key.includes(w))) continue;
    const common = {
      ...COMMON,
      description: p.prompt + STYLE,
      image_size: { width: p.size[0], height: p.size[1] },
      view: p.view,
      color_image: asImage(palettePNG(p.palette)),
    };
    await call(
      viaPixflux ? 'generate-image-pixflux' : 'generate-image-bitforge',
      viaPixflux ? common : {
        ...common,
        style_image: asImage(encodePNG((stretch ? resizeNearest : fitInto)(styleSrc, p.size[0], p.size[1]))),
        style_strength: STYLE_STRENGTH,
      },
      p.key,
    );
  }
} else {
  console.error('쓰는 법:\n  node tools/gen-art.mjs base\n  node tools/gen-art.mjs rest public/props/base-torso-N.png');
  process.exit(1);
}

console.log(`\n뽑음 ${made} · 건너뜀 ${skipped} · 쓴 생성 ${spent}`);
