#!/usr/bin/env node
/**
 *  그림 아래의 빈 여백을 잘라냅니다.
 *
 *  ★ 왜 필요한가: 규약은 **그림의 아래 끝이 발밑**입니다
 *    (public/props/README.md 3번, sprites.ts 의 drawSprite 가 그렇게 그립니다).
 *    그런데 PixelLab 은 물건을 화면 **가운데**로 맞춰 줍니다. 그대로 쓰면
 *    아래 여백만큼 물건이 공중에 뜹니다.
 *
 *  ★ 아래만 자릅니다. 위·좌·우는 안 건드립니다 —
 *    좌우를 자르면 가운데가 틀어지고(drawSprite 가 cx 기준으로 가운데를 맞춥니다),
 *    위를 자르면 그려지는 높이가 바뀝니다. 규약이 말하는 것은 아래 끝 하나입니다.
 *
 *  ★ 두 번 돌려도 안전합니다. 이미 붙어 있으면 0 을 자릅니다.
 *
 *  쓰는 법:  node tools/trim-art.mjs [이름조각 ...]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { decodePNG, encodePNG, crop, opaqueBounds } from './png.mjs';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = readdirSync('public/props')
  .filter((f) => f.endsWith('.png'))
  .filter((f) => !only.length || only.some((o) => f.includes(o)))
  .sort();

let cutTotal = 0;
for (const f of files) {
  const path = `public/props/${f}`;
  const im = decodePNG(readFileSync(path));
  const b = opaqueBounds(im);
  if (!b) { console.log(`  ! ${f} — 전부 투명입니다`); continue; }

  const cut = im.height - 1 - b.maxY;
  if (cut === 0) { console.log(`  · ${f.padEnd(22)} 이미 붙어 있습니다`); continue; }

  writeFileSync(path, encodePNG(crop(im, 0, 0, im.width, im.height - cut)));
  cutTotal += cut;
  console.log(
    `  ✓ ${f.padEnd(22)} 아래 ${String(cut).padStart(2)}px 잘랐습니다  ` +
    `${im.width}×${im.height} → ${im.width}×${im.height - cut}` +
    `   (남은 여백 위 ${b.minY} · 좌 ${b.minX} · 우 ${im.width - 1 - b.maxX})`,
  );
}
console.log(`\n모두 ${cutTotal}px 잘랐습니다.`);
