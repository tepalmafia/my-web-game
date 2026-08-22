#!/usr/bin/env node
/**
 *  걷기 프레임에서 **발이 실제로 얼마나 가는지** 잽니다.
 *
 *  ★ 덮는 비율의 정의 (이 파일이 유일한 근거입니다):
 *
 *      덮는 비율 = 컨택트에서 반대쪽 컨택트까지 **발의 가로 변위**
 *                  ÷ 한 걸음 이동거리
 *
 *    분자는 **왕복 총량이 아닙니다.** 한쪽 컨택트에서 반대쪽 컨택트까지
 *    한 방향으로 간 거리입니다. 왕복은 그 두 배라 반으로 세면 두 배 부풀려집니다.
 *
 *  ★ 그림에서 잽니다. 관절에 넣은 값이 아니라 **나온 그림의 픽셀**입니다 —
 *    모델이 시킨 만큼 안 벌릴 수 있고, 그것을 알아야 합니다.
 *
 *  ★ 발을 어떻게 찾나. 내용의 아래쪽 띠(기본 12%)에서 불투명 칸의
 *    가로 무게중심을 냅니다. 네 다리가 대각선으로 함께 나가는 트롯이라
 *    무게중심이 앞뒤로 흔들리고, 그 흔들림이 곧 발의 변위입니다.
 *    개별 발을 프레임 사이에 짝지으려면 어느 발이 어느 발인지 정해야 하는데
 *    그림에는 그 정보가 없습니다 — 무게중심은 그 모호함이 없습니다.
 *
 *  쓰는 법:  node tools/measure-stride.mjs <이름> [--band=0.12]
 *      예:  node tools/measure-stride.mjs beast
 */
import { readdirSync, readFileSync } from 'node:fs';
import { decodePNG, opaqueBounds } from './png.mjs';

const argv = process.argv.slice(2);
const name = argv.find((a) => !a.startsWith('--')) ?? 'beast';
const BAND = Number(argv.find((a) => a.startsWith('--band='))?.split('=')[1] ?? 0.12);

/*  게임이 그리는 크기 — actors.ts 의 drawSprite(…, size * 3.4)  */
const DRAW_MUL = 3.4;
const BEASTS = [['들개', 12], ['늑대', 14], ['얼어붙은 것', 21]];
/*  engine.ts 의 anim rate 를 여기 적어두고 한 걸음을 냅니다.
    ★ 값을 박지 않고 파일에서 읽습니다 — 두 곳이 갈라지면 잰 값이 거짓이 됩니다.  */
const RATE = Number(
  readFileSync('src/rpg/core/engine.ts', 'utf8').match(/monster\.anim \+= walked \* ([0-9.]+)/)?.[1],
);
if (!RATE) { console.error('engine.ts 에서 monster anim rate 를 못 읽었습니다'); process.exit(1); }
const STEP = Math.PI / RATE;

const files = readdirSync('public/props')
  .filter((f) => new RegExp(`^${name}-walk\\d+\\.png$`).test(f))
  .sort();
if (!files.length) { console.error(`public/props 에 ${name}-walk*.png 가 없습니다`); process.exit(1); }

console.log(`engine.ts 의 rate = ${RATE} → 한 걸음 ${STEP.toFixed(2)} 월드px`);
console.log(`아래쪽 ${(BAND * 100).toFixed(0)}% 띠에서 발을 찾습니다\n`);

const rows = files.map((f) => {
  const im = decodePNG(readFileSync(`public/props/${f}`));
  const b = opaqueBounds(im);
  const h = b.maxY - b.minY + 1;
  const from = b.maxY - Math.round(h * BAND) + 1;
  let sum = 0, n = 0, lo = 1e9, hi = -1;
  for (let y = from; y <= b.maxY; y++)
    for (let x = 0; x < im.width; x++)
      if (im.data[(y * im.width + x) * 4 + 3] > 16) {
        sum += x; n++;
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
  return { f, im, b, cx: n ? sum / n : NaN, n, lo, hi, w: im.width, h: im.height };
});

console.log('프레임'.padEnd(20) + '크기'.padEnd(11) + '아래여백'.padEnd(10) + '발 띠 칸'.padEnd(10) + '발 무게중심'.padEnd(13) + '발 범위');
for (const r of rows) {
  console.log(
    r.f.replace('.png', '').padEnd(20) + `${r.w}×${r.h}`.padEnd(11) +
    String(r.im.height - 1 - r.b.maxY).padEnd(10) + String(r.n).padEnd(10) +
    r.cx.toFixed(2).padEnd(13) + `${r.lo}~${r.hi}`,
  );
}

/*  컨택트 둘 = 무게중심이 가장 앞선 프레임과 가장 뒤진 프레임  */
const sorted = [...rows].sort((a, b) => a.cx - b.cx);
const back = sorted[0], front = sorted[sorted.length - 1];
const srcShift = front.cx - back.cx;

console.log(`\n컨택트 두 프레임: ${back.f.replace('.png','')} (뒤 ${back.cx.toFixed(2)}) ↔ ${front.f.replace('.png','')} (앞 ${front.cx.toFixed(2)})`);
console.log(`원본에서의 가로 변위: ${srcShift.toFixed(2)} px\n`);

console.log('종'.padEnd(14) + '그리는 폭'.padEnd(12) + '월드/원본px'.padEnd(14) + '발 변위(월드)'.padEnd(16) + '덮는 비율');
for (const [ko, size] of BEASTS) {
  const drawW = size * DRAW_MUL;
  const perSrc = drawW / rows[0].w;
  const world = srcShift * perSrc;
  console.log(
    ko.padEnd(14) + drawW.toFixed(1).padEnd(12) + perSrc.toFixed(4).padEnd(14) +
    world.toFixed(2).padEnd(16) + (world / STEP * 100).toFixed(1) + '%',
  );
}

/*  목표를 채우려면 관절에 얼마를 줘야 하나  */
console.log('\n한 걸음을 100% 덮으려면 원본에서 필요한 가로 변위:');
for (const [ko, size] of BEASTS) {
  const perSrc = (size * DRAW_MUL) / rows[0].w;
  console.log(`  ${ko.padEnd(14)}${(STEP / perSrc).toFixed(1)} px  (지금 ${srcShift.toFixed(1)} → ×${(STEP / perSrc / srcShift).toFixed(2)})`);
}
