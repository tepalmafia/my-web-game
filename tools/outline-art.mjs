#!/usr/bin/env node
/**
 *  실루엣 가장자리 한 칸을 윤곽선 색으로 칠합니다.
 *
 *  ★ 왜 필요한가: 규약은 「어두운 1px 외곽선」인데(문서 3장·이번 판 STYLE),
 *    모델이 팔레트에 윤곽선 색을 줘도 가장자리에 꼭 쓰지는 않습니다.
 *    실측으로 나무·바위가 37% 뿐이었고, 그 둘이 32px 에서 먼저 뭉갰습니다.
 *
 *  ★ 새로 뽑지 않습니다. 있는 그림의 픽셀만 바꿉니다.
 *
 *  ★ 두께가 안 자라는 이유 — **알파를 안 건드립니다.**
 *    바깥으로 한 겹 두르는(팽창) 것이 아니라 이미 있는 가장자리 칸의 **색만** 바꿉니다.
 *    실루엣이 그대로니 가장자리 집합도 그대로고, 두 번 돌리면 같은 칸을 같은 색으로
 *    다시 칠할 뿐입니다. trim-art 와 같은 성질입니다.
 *
 *  ★ 90% 넘는 것도 지나가게 합니다. 지금 안 맞는 것이 두께라서,
 *    다 같은 규칙을 지나야 두께가 한 겹으로 통일됩니다.
 *
 *  쓰는 법:  node tools/outline-art.mjs [이름조각 ...]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { decodePNG, encodePNG } from './png.mjs';

/*  gen-art.mjs 의 OUTLINE 과 같은 값 — effects.ts 의 돌 이음매 색입니다  */
const OUTLINE = [0x1b, 0x16, 0x13];
const CUT = 16; // 이 값보다 알파가 크면 「있는 칸」

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = readdirSync('public/props')
  .filter((f) => f.endsWith('.png'))
  .filter((f) => !only.length || only.some((o) => f.includes(o)))
  .sort();

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**  가장자리 비율(%) — measure-art.mjs 와 같은 셈법입니다 */
function edgeDarkRatio({ width: w, height: h, data }) {
  let edge = 0, dark = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (data[i * 4 + 3] <= CUT) continue;
    const onEdge = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx < 0 || ny < 0 || nx >= w || ny >= h || data[(ny * w + nx) * 4 + 3] <= CUT;
    });
    if (!onEdge) continue;
    edge++;
    if (lum(data[i*4], data[i*4+1], data[i*4+2]) < 60) dark++;
  }
  return edge ? (dark / edge) * 100 : 0;
}

const rows = [];
for (const f of files) {
  const path = `public/props/${f}`;
  const im = decodePNG(readFileSync(path));
  const { width: w, height: h, data } = im;
  const before = edgeDarkRatio(im);

  //  ★ 먼저 어디가 가장자리인지 **전부 모은 다음** 칠합니다.
  //    칠하면서 판단하면 방금 칠한 칸을 보고 또 판단하게 되어 안쪽으로 번집니다.
  const edge = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (data[i * 4 + 3] <= CUT) continue;
    const onEdge = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx < 0 || ny < 0 || nx >= w || ny >= h || data[(ny * w + nx) * 4 + 3] <= CUT;
    });
    if (onEdge) edge.push(i);
  }

  let painted = 0;
  for (const i of edge) {
    if (data[i*4] === OUTLINE[0] && data[i*4+1] === OUTLINE[1] && data[i*4+2] === OUTLINE[2]) continue;
    data[i*4] = OUTLINE[0]; data[i*4+1] = OUTLINE[1]; data[i*4+2] = OUTLINE[2];
    data[i*4+3] = 255;  // 반투명 가장자리는 안티에일리어싱의 흔적이라 굳힙니다
    painted++;
  }
  writeFileSync(path, encodePNG(im));
  rows.push({ f: f.replace('.png',''), before, after: edgeDarkRatio(im), edge: edge.length, painted });
}

console.log('이름'.padEnd(20) + '가장자리 칸'.padEnd(13) + '칠함'.padEnd(9) + '윤곽 전 → 후');
console.log('─'.repeat(66));
for (const r of rows)
  console.log(
    r.f.padEnd(20) + String(r.edge).padEnd(13) + String(r.painted).padEnd(9) +
    `${r.before.toFixed(0)}%`.padStart(4) + ' → ' + `${r.after.toFixed(0)}%`,
  );
