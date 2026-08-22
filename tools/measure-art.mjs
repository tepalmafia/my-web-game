#!/usr/bin/env node
/**
 *  public/props 의 그림을 잽니다 — 눈이 아니라 픽셀입니다.
 *
 *  ★ 무엇을 왜 재는가:
 *    - 색 수 · 상위 색 점유율 — 문서 3장 7절이 「색 수를 못박아라」 (지금 화면은 3톤)
 *    - 테두리 어두운 칸 비율 — 윤곽선이 실제로 들어갔는가
 *    - 32px 로 줄였을 때 남는 칸 — 「32px 로 줄여도 읽히는가」
 *    - 여백 — 규약은 「그림 아래 끝이 발밑」인데 PixelLab 은 가운데로 맞춥니다
 *
 *  쓰는 법:  node tools/measure-art.mjs [이름조각 ...]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { decodePNG, opaqueBounds } from './png.mjs';

const only = process.argv.slice(2);
const files = readdirSync('public/props')
  .filter((f) => f.endsWith('.png'))
  .filter((f) => !only.length || only.some((o) => f.includes(o)))
  .sort();

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

console.log(
  '이름'.padEnd(20) + '크기'.padEnd(11) + '색'.padEnd(7) + '3색이'.padEnd(8) +
  '윤곽'.padEnd(8) + '32px'.padEnd(8) + '여백 위/아래/좌/우',
);
console.log('─'.repeat(96));

for (const f of files) {
  const im = decodePNG(readFileSync(`public/props/${f}`));
  const { width: w, height: h, data } = im;
  const b = opaqueBounds(im);
  if (!b) { console.log(f.padEnd(20) + '— 전부 투명'); continue; }

  // 색 세기 (알파 있는 칸만)
  const count = new Map();
  let opaque = 0;
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] <= 16) continue;
    opaque++;
    const k = (data[i*4] << 16) | (data[i*4+1] << 8) | data[i*4+2];
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const sorted = [...count.values()].sort((x, y) => y - x);
  const top3 = ((sorted[0] + (sorted[1] ?? 0) + (sorted[2] ?? 0)) / opaque * 100);

  //  윤곽선 — 실루엣 가장자리 칸 중 어두운(휘도 60 미만) 것의 비율
  let edge = 0, edgeDark = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (data[i*4+3] <= 16) continue;
    const out = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => {
      const nx = x+dx, ny = y+dy;
      return nx<0||ny<0||nx>=w||ny>=h || data[(ny*w+nx)*4+3] <= 16;
    });
    if (!out) continue;
    edge++;
    if (lum(data[i*4], data[i*4+1], data[i*4+2]) < 60) edgeDark++;
  }

  //  32px 로 줄였을 때 — 최근접으로 뽑아 남는 불투명 칸 수
  const k = 32 / h;
  let small = 0;
  const sw = Math.max(1, Math.round(w * k));
  for (let y = 0; y < 32; y++) for (let x = 0; x < sw; x++) {
    const sx = Math.min(w-1, Math.round(x/k)), sy = Math.min(h-1, Math.round(y/k));
    if (data[(sy*w+sx)*4+3] > 16) small++;
  }

  console.log(
    f.replace('.png','').padEnd(20) +
    `${w}×${h}`.padEnd(11) +
    String(count.size).padEnd(7) +
    (top3.toFixed(0)+'%').padEnd(8) +
    (edge ? (edgeDark/edge*100).toFixed(0)+'%' : '—').padEnd(8) +
    `${small}/${32*sw}`.padEnd(8) +
    `${b.minY} / ${h-1-b.maxY} / ${b.minX} / ${w-1-b.maxX}`,
  );
}
