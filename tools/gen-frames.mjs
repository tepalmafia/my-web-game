#!/usr/bin/env node
/**
 *  걷기 프레임을 뽑습니다 — PixelLab 의 `animate-with-skeleton`.
 *
 *  ★ 왜 skeleton 이고 text 가 아닌가 (docs/그림-작업.md 5.1.1 의 실측):
 *    `animate_with_text` 는 **64×64 하나뿐**이라 beast 원본(200×176)이 안 듭니다.
 *    화면에서 늑대가 131px 인데 64 에서 올리면 2.3배 확대라, 맞춰놓은 격자와
 *    윤곽선을 그대로 버리게 됩니다. skeleton 은 256 까지 받아 원본이 그대로 듭니다.
 *
 *  ★ **한 창은 정확히 3프레임입니다.** 아니면 422 입니다.
 *    그리고 창을 이어붙일 수 없습니다 — 같은 관절을 두 창에 줘도 29.8% 다르게
 *    나오고 발밑이 4px 어긋납니다. 그래서 **걷기는 한 창에 넣고 0→1→2→1 로 되짚습니다.**
 *
 *  ★ **관절의 y 를 프레임마다 같게 줍니다.** 모델은 골격이 시키는 대로 합니다 —
 *    y 를 고정하면 발밑이 2px 안에 들어옵니다. 남은 2px 은 align-frames.mjs 가 없앱니다.
 *
 *  쓰는 법:
 *    node tools/gen-frames.mjs beast          # 관절 뽑고 걷기 3장
 *    node tools/gen-frames.mjs beast --force  # 다시
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { decodePNG, encodePNG, fitInto, palettePNG } from './png.mjs';

const BASE = 'https://api.pixellab.ai/v1';
const SECRET = process.env.PIXELLAB_SECRET;
const OUT = 'public/props';

/*  뽑을 것. 지금은 beast 하나입니다  */
const SUBJECTS = {
  beast: {
    from: 'public/props/monster-beast.png',
    //  그림이 쓰는 팔레트 그대로 — 프레임끼리 색이 안 갈리게 (sprites.ts 의 SPRITE_TONES)
    palette: ['#a4aab1', '#7d8590', '#494d54', '#1b1613'],
    //  ★ 네발짐승을 사람 관절에 얹습니다. 앞다리 = 어깨/팔꿈치/팔, 뒷다리 = 엉덩이/무릎/다리.
    //    이름은 편법이지만 좌표를 우리가 주므로 궤적은 정확합니다.
    limbs: [
      ['LEFT SHOULDER', 'LEFT ELBOW', 'LEFT ARM', +1],
      ['RIGHT SHOULDER', 'RIGHT ELBOW', 'RIGHT ARM', -1],
      ['LEFT HIP', 'LEFT KNEE', 'LEFT LEG', -1],
      ['RIGHT HIP', 'RIGHT KNEE', 'RIGHT LEG', +1],
    ],
    swing: 0.045,   // 정규화 좌표. 256 에서 약 11px
    size: 256,
  },
};

if (!SECRET) { console.error('PIXELLAB_SECRET 이 없습니다.'); process.exit(1); }

const argv = process.argv.slice(2);
const force = argv.includes('--force');
//  ★ 달성률을 재려고 둡니다 — 같은 조건에서 swing 만 바꿔 뽑고, 실제 프레임을
//    덮지 않게 다른 이름으로 씁니다. --swing 을 안 주면 표의 값을 씁니다.
const swingArg = Number(argv.find((a) => a.startsWith('--swing='))?.split('=')[1] ?? NaN);
const tag = argv.find((a) => a.startsWith('--tag='))?.split('=')[1] ?? '';
const name = argv.find((a) => !a.startsWith('--'));
const subject = SUBJECTS[name];
if (!subject) { console.error(`쓰는 법: node tools/gen-frames.mjs ${Object.keys(SUBJECTS).join('|')}`); process.exit(1); }

mkdirSync(OUT, { recursive: true });
const asImage = (buf) => ({ type: 'base64', base64: buf.toString('base64') });
let spent = 0;

async function post(path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    //  ★ 조용히 넘어가지 않습니다 (CLAUDE.md 6장)
    throw new Error(`${path} HTTP ${res.status} — ${(await res.text()).slice(0, 400)}`);
  }
  const json = await res.json();
  spent += json.usage?.generations ?? 0;
  return json;
}

//  참조 그림을 정사각으로. estimate 가 받는 크기가 16/32/64/128/256 뿐입니다
const src = decodePNG(readFileSync(subject.from));
const ref = encodePNG(fitInto(src, subject.size, subject.size));
console.log(`${name} — 원본 ${src.width}×${src.height} → 참조 ${subject.size}×${subject.size}`);

//  관절. 한 번 뽑으면 파일로 두고 다시 안 뽑습니다 (0.1장이지만 공짜는 아닙니다)
//  ★ public/ 이 아니라 tools/ 입니다 — 게임은 이 파일을 안 읽습니다.
//    public/ 에 두면 빌드가 그대로 복사해서 쓰지도 않는 110줄이 배포됩니다.
mkdirSync('tools/skeletons', { recursive: true });
const keyPath = `tools/skeletons/${name}.json`;
let keypoints;
if (existsSync(keyPath) && !force) {
  keypoints = JSON.parse(readFileSync(keyPath, 'utf8'));
  console.log(`  · 관절 ${keypoints.length}개 — 이미 있습니다`);
} else {
  process.stdout.write('  … 관절 뽑는 중 ');
  keypoints = (await post('estimate-skeleton', { image: asImage(ref) })).keypoints;
  writeFileSync(keyPath, JSON.stringify(keypoints, null, 1));
  console.log(`✓ ${keypoints.length}개`);
}

/**
 *  한 프레임의 관절.
 *
 *  ★ y 는 절대 안 건드립니다. 발밑이 흔들리면 못 씁니다.
 *  ★ z_index 를 반올림합니다 — estimate 는 소수(-3.5)를 주는데 animate 는 정수만 받습니다.
 *    같은 API 안에서 아귀가 안 맞습니다 (밟은-지뢰).
 */
const poseOf = (phase) =>
  keypoints.map((k) => {
    const z = Math.round(k.z_index);
    const limb = subject.limbs.find((L) => L[1] === k.label || L[2] === k.label);
    if (!limb) return { ...k, z_index: z };
    const foot = limb[2] === k.label;
    const swing = Number.isFinite(swingArg) ? swingArg : subject.swing;
    return { ...k, z_index: z, y: k.y, x: k.x + phase * limb[3] * swing * (foot ? 1 : 0.55) };
  });

const stem = `${name}${tag}`;
const done = [0, 1, 2].every((i) => existsSync(`${OUT}/${stem}-walk${i}.png`));
if (done && !force) {
  console.log('  · 걷기 3장 — 이미 있습니다');
} else {
  process.stdout.write('  … 걷기 3장 ');
  const j = await post('animate-with-skeleton', {
    image_size: { width: subject.size, height: subject.size },
    view: 'low top-down',
    direction: 'east',
    reference_image: asImage(ref),
    color_image: asImage(palettePNG(subject.palette)),
    //  가운데 → 앞 → 뒤. 되짚으면(0→1→2→1) 네 박자가 됩니다
    skeleton_keypoints: [0, 1, -1].map(poseOf),
    guidance_scale: 4.0,
  });
  j.images.forEach((im, i) => writeFileSync(`${OUT}/${stem}-walk${i}.png`, Buffer.from(im.base64, 'base64')));
  console.log(`✓ ${j.images.length}장`);
}

console.log(`\n쓴 생성 ${spent.toFixed(1)}장`);
console.log('다음: node tools/align-frames.mjs ' + name + '  (발밑을 맞추고 같은 사각형으로 자릅니다)');
