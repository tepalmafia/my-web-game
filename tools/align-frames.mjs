#!/usr/bin/env node
/**
 *  프레임들의 발밑을 맞추고 **같은 사각형**으로 자릅니다.
 *
 *  ★★ 왜 trim-art.mjs 를 못 쓰는가. 그것은 장마다 제 아래끝까지 자릅니다.
 *    그러면 **장마다 높이가 달라지고**, `drawSprite` 가 가로만 받고 세로를
 *    그림 비율로 내므로 **프레임이 바뀔 때마다 짐승 크기가 변합니다.**
 *    걷는 것이 아니라 커졌다 작아졌다 하게 됩니다.
 *
 *  ★ 그래서 두 걸음입니다.
 *    1. 프레임마다 내용 아래끝이 같아지도록 **세로로 민다** (모델이 남긴 2px 을 없앤다)
 *    2. 세 장을 **하나의 사각형**으로 자른다 (모든 내용을 담는 합집합)
 *
 *  ★ 가로는 안 맞춥니다. 걸을 때 몸이 좌우로 흔들리는 것은 걷기 그 자체입니다.
 *
 *  쓰는 법:  node tools/align-frames.mjs beast
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { decodePNG, encodePNG, crop, opaqueBounds } from './png.mjs';

const name = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!name) { console.error('쓰는 법: node tools/align-frames.mjs <이름>   예: beast'); process.exit(1); }

const files = readdirSync('public/props')
  .filter((f) => new RegExp(`^${name}-walk\\d+\\.png$`).test(f))
  .sort();
if (files.length < 2) { console.error(`public/props 에 ${name}-walk*.png 가 없습니다`); process.exit(1); }

const frames = files.map((f) => {
  const im = decodePNG(readFileSync(`public/props/${f}`));
  const b = opaqueBounds(im);
  if (!b) throw new Error(`${f} 가 전부 투명합니다`);
  return { f, im, b };
});

console.log('맞추기 전:');
for (const { f, b } of frames) console.log(`  ${f}  아래끝 ${b.maxY} · 위끝 ${b.minY} · 좌 ${b.minX} · 우 ${b.maxX}`);

//  1) 아래끝을 가장 아래인 것에 맞춥니다 — 위로 당기지 않고 아래로 미는 쪽이
//     잘려나갈 위험이 없습니다 (아래에 여백이 있는 장을 내립니다)
const foot = Math.max(...frames.map((x) => x.b.maxY));
console.log(`\n발밑을 ${foot} 로 맞춥니다`);

for (const fr of frames) {
  const dy = foot - fr.b.maxY;
  if (dy === 0) { console.log(`  ${fr.f}  그대로`); continue; }
  const { width: w, height: h, data } = fr.im;
  const moved = Buffer.alloc(w * h * 4);
  //  아래로 dy 만큼. 위에 생기는 빈 줄은 투명입니다
  for (let y = h - 1; y >= dy; y--) data.copy(moved, y * w * 4, (y - dy) * w * 4, (y - dy + 1) * w * 4);
  fr.im = { width: w, height: h, data: moved };
  fr.b = opaqueBounds(fr.im);
  console.log(`  ${fr.f}  아래로 ${dy}px`);
}

//  2) 모든 내용을 담는 하나의 사각형
const box = {
  minX: Math.min(...frames.map((x) => x.b.minX)),
  maxX: Math.max(...frames.map((x) => x.b.maxX)),
  minY: Math.min(...frames.map((x) => x.b.minY)),
  maxY: Math.max(...frames.map((x) => x.b.maxY)),
};
const w = box.maxX - box.minX + 1;
const h = box.maxY - box.minY + 1;
console.log(`\n공통 사각형 ${w}×${h} (x ${box.minX}~${box.maxX} · y ${box.minY}~${box.maxY})`);

for (const fr of frames) {
  writeFileSync(`public/props/${fr.f}`, encodePNG(crop(fr.im, box.minX, box.minY, w, h)));
}

//  3) 재서 확인합니다 — 크기가 같고 아래끝이 0 이어야 합니다
console.log('\n맞춘 뒤:');
let ok = true;
for (const { f } of frames) {
  const im = decodePNG(readFileSync(`public/props/${f}`));
  const b = opaqueBounds(im);
  const bottomGap = im.height - 1 - b.maxY;
  const sizeSame = im.width === w && im.height === h;
  if (!sizeSame || bottomGap !== 0) ok = false;
  console.log(`  ${f}  ${im.width}×${im.height}  아래여백 ${bottomGap}  ${sizeSame && bottomGap === 0 ? '✓' : '✗'}`);
}
console.log(ok ? '\n세 장의 크기가 같고 아래끝이 모두 붙었습니다.' : '\n✗ 안 맞습니다. 위를 보십시오.');
process.exit(ok ? 0 : 1);
