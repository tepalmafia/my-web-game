#!/usr/bin/env node
/**
 *  한 몬스터의 **모든 프레임을 하나의 규격**으로 맞춥니다.
 *
 *  ★★ 왜 생겼나. `align-frames.mjs` 는 **걷는 세 장끼리만** 맞춥니다.
 *    그래서 정지 한 장이 따로 잘려 있었고, 걸음을 떼는 순간 짐승이
 *    **폭 1.31배 · 높이 1.33배**로 튀었습니다 (docs/크기-체계.md 2.3).
 *    맞추는 단위가 「한 묶음」이지 「그 몬스터 전부」가 아니었던 것입니다.
 *
 *  ★★ **고정하는 것은 배율이지 실루엣이 아닙니다.**
 *    걷는 동안 다리가 벌어지고 꼬리·머리가 움직이면 불투명 경계는 변합니다.
 *    그것이 정상입니다. 프레임마다 따로 확대·축소해서 경계를 맞추면
 *    몸이 숨 쉬듯 커졌다 작아졌다 합니다 — 지금보다 나쁩니다.
 *
 *  ★★ 그래서 배율을 **넓이**로 잽니다.
 *    자세가 바뀌어도 다리의 넓이는 그대로고 꼬리를 흔들어도 그대로입니다.
 *    바깥 경계(폭·높이)는 자세에 흔들리지만 넓이는 안 흔들립니다 —
 *    걷는 세 장의 넓이가 2% 안에 모이는 것을 재서 확인했습니다(선형 1%).
 *    그 값을 첫 짐작으로 삼고 **마스크 겹침(IoU)** 으로 다듬습니다.
 *    두 방법이 따로 1.2775 와 1.280 을 냈고, 그래서 이 값을 믿습니다.
 *
 *  ★ **묶음(batch) 단위로 맞춥니다.** 한 번에 생성된 프레임들은 생성기가
 *    이미 같은 좌표계에 놓았으므로 **묶음 안의 상대 위치를 건드리지 않습니다.**
 *    프레임끼리 겹침을 맞추려 들면 자세가 다른 것을 억지로 포개어
 *    root 가 흔들립니다. 정합은 **묶음과 묶음 사이에서만** 합니다.
 *
 *  ★ 원본은 git 이 갖고 있습니다. 이 도구는 제자리에서 고쳐 씁니다
 *    (outline-art · trim-art · align-frames 와 같은 방식).
 *
 *  쓰는 법:
 *    node tools/fit-sprite-set.mjs --canvas 256x200 \
 *      --batch beast-walk0.png,beast-walk1.png,beast-walk2.png \
 *      --batch monster-beast.png
 *
 *    첫 --batch 가 기준입니다 (배율 1). 나머지 묶음이 거기 맞춰집니다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePNG, encodePNG, resizeNearest, opaqueBounds } from './png.mjs';

const CUT = 16;
const DIR = 'public/props';

/* ---------------------------------------------------------------- 인자 */
const argv = process.argv.slice(2);
const batches = [];
let canvas = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--batch') batches.push(argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
  else if (argv[i] === '--canvas') canvas = argv[++i];
  else { console.error(`모르는 인자: ${argv[i]}`); process.exit(1); }
}
if (!canvas || batches.length === 0) {
  console.error('쓰는 법: node tools/fit-sprite-set.mjs --canvas 256x200 --batch a.png,b.png --batch c.png');
  process.exit(1);
}
const m = /^(\d+)x(\d+)$/.exec(canvas);
if (!m) { console.error('--canvas 는 256x200 꼴이어야 합니다'); process.exit(1); }
const CW = +m[1], CH = +m[2];

/* ------------------------------------------------------------ 읽고 재기 */
function maskOf(img) {
  const { width: w, height: h, data } = img;
  const mask = new Uint8Array(w * h);
  let area = 0, sx = 0, sy = 0;
  for (let i = 0; i < mask.length; i++) {
    if (data[i * 4 + 3] > CUT) { mask[i] = 1; area++; sx += i % w; sy += (i / w) | 0; }
  }
  if (!area) throw new Error('전부 투명한 그림입니다');
  return { w, h, mask, area, cx: sx / area, cy: sy / area };
}

const load = (f) => {
  const img = decodePNG(readFileSync(`${DIR}/${f}`));
  return { f, img, ...maskOf(img), bounds: opaqueBounds(img) };
};
const sets = batches.map((files) => files.map(load));

/* --------------------------------------------------- 묶음 사이의 배율·위치
 *  기준 묶음의 첫 장에 대고 (배율, dx) 를 찾습니다.
 *  ★ 첫 짐작은 넓이비, 다듬기는 마스크 겹침입니다. 두 방법이 어긋나면 출력에 보입니다.
 */
function overlap(a, b, s, dx, dy) {
  let inter = 0, onlyA = 0;
  const aw = Math.round(a.w * s), ah = Math.round(a.h * s);
  for (let y = 0; y < ah; y++) {
    const sy = Math.min(a.h - 1, Math.floor(y / s));
    for (let x = 0; x < aw; x++) {
      if (!a.mask[sy * a.w + Math.min(a.w - 1, Math.floor(x / s))]) continue;
      const bx = x + dx, by = y + dy;
      if (bx >= 0 && bx < b.w && by >= 0 && by < b.h && b.mask[by * b.w + bx]) inter++; else onlyA++;
    }
  }
  return inter / (b.area + onlyA);
}

function fitTo(ref, other) {
  const guess = Math.sqrt(ref.area / other.area);
  let best = { v: -1 };
  //  무게중심을 겹치는 자리에서 시작합니다 — 자세가 비슷하면 거기가 답 근처입니다
  for (let s = guess - 0.03; s <= guess + 0.0301; s += 0.005) {
    const cx0 = Math.round(ref.cx - other.cx * s), cy0 = Math.round(ref.cy - other.cy * s);
    for (let dx = cx0 - 12; dx <= cx0 + 12; dx++)
      for (let dy = cy0 - 12; dy <= cy0 + 12; dy++) {
        const v = overlap(other, ref, s, dx, dy);
        if (v > best.v) best = { v, s, dx, dy };
      }
  }
  //  배율만 한 번 더 촘촘히
  const coarse = best.s;
  for (let s = coarse - 0.005; s <= coarse + 0.0051; s += 0.001)
    for (let dx = best.dx - 2; dx <= best.dx + 2; dx++)
      for (let dy = best.dy - 2; dy <= best.dy + 2; dy++) {
        const v = overlap(other, ref, s, dx, dy);
        if (v > best.v) best = { v, s, dx, dy };
      }
  return { ...best, guess };
}

const ref = sets[0][0];
const plan = sets.map((set, i) => {
  if (i === 0) return { set, scale: 1, dx: 0, note: '기준' };
  const fit = fitTo(ref, set[0]);
  console.log(`${set[0].f}  넓이비 짐작 ${fit.guess.toFixed(4)} → 겹침 최적 ${fit.s.toFixed(4)}`
    + `  (두 방법 차이 ${(Math.abs(fit.s - fit.guess) / fit.guess * 100).toFixed(2)}%)`
    + `  겹침 ${(fit.v * 100).toFixed(1)}%  dx ${fit.dx}`);
  if (Math.abs(fit.s - fit.guess) / fit.guess > 0.05) {
    console.error(`  ✗ 넓이와 겹침이 5% 넘게 어긋납니다 — 같은 짐승이 맞는지 보십시오`);
    process.exit(1);
  }
  return { set, scale: fit.s, dx: fit.dx, note: `기준의 ${fit.s.toFixed(4)}배` };
});

/* ------------------------------------------------------- 캔버스에 앉히기
 *  가로: 묶음 오프셋 + 전체를 캔버스 가운데로
 *  세로: **불투명 아래끝을 캔버스 마지막 줄**로 — 발밑은 언제나 그림의 아래 끝입니다
 */
const placed = [];
for (const { set, scale, dx } of plan) {
  for (const it of set) {
    const w = Math.round(it.w * scale), h = Math.round(it.h * scale);
    const img = scale === 1 ? it.img : resizeNearest(it.img, w, h);
    const b = opaqueBounds(img);
    placed.push({ f: it.f, img, b, x: dx, scale });
  }
}
const left = Math.min(...placed.map((p) => p.b.minX + p.x));
const right = Math.max(...placed.map((p) => p.b.maxX + p.x));
const pad = Math.round((CW - (right - left + 1)) / 2);
if (pad < 0) { console.error(`✗ 캔버스 가로 ${CW} 가 내용 ${right - left + 1} 보다 좁습니다`); process.exit(1); }

console.log(`\n캔버스 ${CW}x${CH} · 내용 가로 ${right - left + 1} · 좌우 여백 ${pad}/${CW - pad - (right - left + 1)}`);

for (const p of placed) {
  const out = { width: CW, height: CH, data: Buffer.alloc(CW * CH * 4) };
  const ox = pad - left + p.x;          // 가로: 묶음 오프셋 + 가운데 맞춤
  const oy = CH - 1 - p.b.maxY;         // 세로: 불투명 아래끝 → 마지막 줄
  const contentH = p.b.maxY - p.b.minY + 1;
  if (p.b.minY + oy < 0) { console.error(`✗ ${p.f} 내용 높이 ${contentH} 가 캔버스 ${CH} 를 넘습니다`); process.exit(1); }
  for (let y = 0; y < p.img.height; y++) {
    const ty = y + oy; if (ty < 0 || ty >= CH) continue;
    for (let x = 0; x < p.img.width; x++) {
      const tx = x + ox; if (tx < 0 || tx >= CW) continue;
      const s = (y * p.img.width + x) * 4, d = (ty * CW + tx) * 4;
      out.data[d] = p.img.data[s]; out.data[d+1] = p.img.data[s+1];
      out.data[d+2] = p.img.data[s+2]; out.data[d+3] = p.img.data[s+3];
    }
  }
  writeFileSync(`${DIR}/${p.f}`, encodePNG(out));
  const nb = opaqueBounds(out);
  console.log(`  ${p.f.padEnd(20)} 배율 ${p.scale.toFixed(4)} · 불투명 ${nb.maxX-nb.minX+1}x${nb.maxY-nb.minY+1}`
    + ` · 아래끝 y ${nb.maxY} · 가로중심 ${((nb.minX+nb.maxX)/2).toFixed(1)}`);
}
console.log('\n★ 윤곽선 도구를 지나가십시오:  node tools/outline-art.mjs beast');
