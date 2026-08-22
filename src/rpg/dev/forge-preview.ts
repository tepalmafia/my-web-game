/**
 *  화로 미리보기 — **개발 중에만 붙습니다.**
 *
 *  ★ 왜 필요한가. 큰 화로는 마을 2단계에 서므로, 새 게임에서는 몇 시간을 놀아야
 *    화면에 나옵니다. 그림 두 장이 나란히 섰을 때 같은 손에서 나온 것으로 보이는지는
 *    **지금 봐야 하는 것**이라 볼 자리를 따로 만듭니다.
 *
 *  ★★ **제품 화면을 건드리지 않습니다.** 세계도 안 건드립니다 —
 *    `world` 를 얕게 복사해 `town.chosen` 의 길이만 바꾼 것을 넘깁니다.
 *    `drawForge` 가 보는 것이 `world.time` 과 `world.me.town` 둘뿐이라
 *    그것만 바꿔도 **진짜 그리는 길이 그대로 돕니다** — 미리보기가 따로
 *    그리면 미리보기가 거짓말을 하기 시작합니다.
 *
 *  ★ 빌드에 안 들어갑니다. `DevTools.attach` 가 `import.meta.env.DEV` 안에서만
 *    부르므로 vite 가 이 모듈째 떨궈냅니다 (dev/inspect.ts 와 같은 방식).
 *
 *  쓰는 법:  window.aden.forges()      한 번 더 부르면 닫힙니다
 */
import { TILE } from '../balance';
import { drawForge } from '../ui/art/effects';
import type { World } from '../types';

const ID = 'aden-forge-preview';

/** 단계만 바꿔 끼운 세계 — 원본은 안 건드립니다 */
function atStage(world: World, stage: number): World {
  return {
    ...world,
    me: { ...world.me, town: { ...world.me.town, chosen: Array.from({ length: stage }, () => '') } },
  } as World;
}

export function showForges(world: World): string {
  if (document.getElementById(ID)) {
    document.getElementById(ID)!.remove();
    return '화로 미리보기를 닫았습니다';
  }

  //  ★ 화면에 실제로 나오는 배율로 봅니다. 3배로 뽑은 그림이 여기서 축소되는데,
  //    그 축소된 모습이 판단해야 할 모습입니다 (확대해 놓고 보면 안 보입니다).
  const scale = 1.375 * (window.devicePixelRatio || 1);
  const cellW = 150, cellH = 130;

  const canvas = document.createElement('canvas');
  canvas.id = ID;
  canvas.width = Math.round(cellW * 2 * scale);
  canvas.height = Math.round(cellH * scale);
  canvas.style.cssText =
    `position:fixed;left:8px;top:8px;z-index:60;image-rendering:pixelated;` +
    `width:${cellW * 2}px;height:${cellH}px;border:1px solid #1b1613;box-shadow:0 2px 12px #000a`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  //  마을 바닥색 — public/props/README.md 의 마을 중간 톤. 대비를 여기서 봅니다
  ctx.fillStyle = '#2f5233';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(scale, scale);
  //  ★ drawForge 는 타일 번호를 받아 tileCenter 로 월드 좌표를 냅니다.
  //    그래서 타일 한 칸을 골라놓고 그 중심이 칸 가운데로 오도록 화면을 옮깁니다.
  const tx = 1, ty = 1;
  for (const [i, stage] of [0, 2].entries()) {
    ctx.save();
    ctx.translate(i * cellW + cellW / 2 - (tx + 0.5) * TILE, cellH - 26 - (ty + 0.5) * TILE);
    drawForge(ctx, atStage(world, stage), tx, ty);
    ctx.restore();
  }
  ctx.restore();

  ctx.fillStyle = '#e8dcc0';
  ctx.font = `${11 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('작은 화로 (0단계)', cellW * 0.5 * scale, (cellH - 8) * scale);
  ctx.fillText('큰 화로 (2단계)', cellW * 1.5 * scale, (cellH - 8) * scale);

  return '화로 미리보기 — 한 번 더 부르면 닫힙니다';
}
