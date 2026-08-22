/**
 * ===========================================================================
 *  땅 — 바닥, 물, 벽, 나무와 바위, 빛, 떠다니는 것
 * ===========================================================================
 *
 *  타일 한 칸을 그냥 한 가지 색으로 칠하면 바둑판처럼 보입니다. 그래서
 *
 *    · 색은 넓은 얼룩(patch)으로 섞고, 그 위에 잔결을 뿌립니다
 *    · 장애물 옆 바닥에는 그늘을 깝니다 — 이것만으로 바닥이 평평해 보이지 않습니다
 *    · 나무·바위는 칸마다 종류와 크기가 다릅니다
 *    · 빛나는 것(수정·모닥불·용암)은 주변을 실제로 밝힙니다
 *
 *  나무와 바위는 여기서 바로 그리지 않고 목록으로 넘겨줍니다.
 *  캐릭터와 함께 위에서 아래 순서로 그려야 나무 뒤로 걸어 들어갈 수 있기 때문입니다.
 */

import { TILE } from '../../balance';
import { hash2 } from '../../core/rng';
import { FLOOR, LIQUID, PROP, valueNoise } from '../../core/world';
import type { MapTheme, World } from '../../types';
import type { View } from '../view';
import { alpha, darken, lighten, mix, type ZoneArt } from './palette';
import { drawSprite, spriteFor } from './sprites';

/** 화면에 보이는 타일 범위 */
export interface TileRange {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function visibleTiles(world: World, view: View): TileRange {
  const { def } = world.map;
  const halfW = view.width / (2 * view.zoom);
  const halfH = view.height / (2 * view.zoom);

  return {
    x0: Math.max(0, Math.floor((view.camX - halfW) / TILE) - 1),
    x1: Math.min(def.width - 1, Math.ceil((view.camX + halfW) / TILE) + 1),
    y0: Math.max(0, Math.floor((view.camY - halfH) / TILE) - 1),
    y1: Math.min(def.height - 1, Math.ceil((view.camY + halfH) / TILE) + 2),
  };
}

/* ===========================================================================
 *  장애물의 종류 — 씨앗으로 정해지므로 같은 칸은 언제나 같은 모양입니다
 * ======================================================================== */

export type PropKind =
  | 'tree' | 'pine' | 'bush' | 'rock'
  | 'boulder' | 'spire' | 'deadbush'
  | 'beam' | 'crystal'
  | 'stake' | 'totem' | 'bones' | 'campfire'
  | 'shard' | 'vent';

const PROP_SETS: Record<MapTheme, PropKind[]> = {
  town: ['tree', 'bush', 'rock', 'tree'],
  forest: ['tree', 'pine', 'bush', 'tree', 'rock'],
  cave: ['spire', 'beam', 'spire', 'rock'],
  // 갈대와 마른 덤불 — 숲의 나무와 실루엣이 갈립니다
  river: ['bush', 'deadbush', 'bush', 'rock'],
};

/** 이 칸에 무엇이 서 있는가 */
export function propKind(theme: MapTheme, art: ZoneArt, seed: number, tx: number, ty: number): PropKind {
  const roll = hash2(seed + 991, tx, ty);
  if (art.beacon && roll < art.beacon.share) {
    return art.beacon.kind === 'crystal' ? 'crystal' : art.beacon.kind === 'campfire' ? 'campfire' : 'vent';
  }
  const set = PROP_SETS[theme];
  return set[Math.floor(hash2(seed + 55, tx, ty) * set.length)]!;
}

/**
 *  그림으로 그릴 때 화면에서 차지할 가로 크기 (scale 1 기준).
 *  ★ 지금 도형이 실제로 그리는 폭에서 가져왔습니다 — 그림으로 바꿔도 크기가 안 튀게.
 *  ★ 세로는 그림 비율대로 따라옵니다 (drawSprite).
 */
const PROP_WIDTH: Record<PropKind, number> = {
  tree: 37, pine: 30, bush: 29, rock: 20,
  boulder: 28, spire: 18, deadbush: 20,
  beam: 30, crystal: 25,
  stake: 10, totem: 14, bones: 28, campfire: 23,
  shard: 18, vent: 26,
};

/** 빛을 내는 장애물인가 */
export function isBeacon(kind: PropKind): boolean {
  return kind === 'crystal' || kind === 'campfire' || kind === 'vent';
}

/* ===========================================================================
 *  바닥
 * ======================================================================== */

/**
 *  마을 한복판을 가로지르는 흙길.
 *  가장자리를 잡음으로 흔들어 자로 그은 듯한 직선을 피합니다.
 */
function onRoad(seed: number, entryTx: number, entryTy: number, tx: number, ty: number): boolean {
  const wobbleX = (valueNoise(seed + 601, ty / 4, 0) - 0.5) * 2.2;
  const wobbleY = (valueNoise(seed + 733, tx / 4, 0) - 0.5) * 2.2;
  return Math.abs(tx - entryTx + wobbleX) <= 1.4 || Math.abs(ty - entryTy + wobbleY) <= 1.4;
}

/**
 *  바닥색 계단.
 *  세 가지 색을 그대로 쓰면 칸마다 색이 툭툭 끊겨 바둑판처럼 보입니다.
 *  미리 열두 단계로 섞어두고 잡음 값으로 골라 쓰면 경계가 사라집니다.
 */
const RAMPS = new Map<string, string[]>();

function groundRamp(art: ZoneArt): string[] {
  const key = art.ground.join('');
  const cached = RAMPS.get(key);
  if (cached) return cached;

  const steps: string[] = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    steps.push(t < 0.5 ? mix(art.ground[2]!, art.ground[0]!, t * 2) : mix(art.ground[0]!, art.ground[1]!, (t - 0.5) * 2));
  }
  RAMPS.set(key, steps);
  return steps;
}

export function drawGround(ctx: CanvasRenderingContext2D, world: World, range: TileRange, art: ZoneArt): void {
  const { def, tiles } = world.map;
  const ramp = groundRamp(art);

  /* 1) 바닥 — 부드럽게 이어지는 색 계단 */
  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      if (tiles[ty * def.width + tx]! === 1) continue; // 벽은 따로

      const x = tx * TILE;
      const y = ty * TILE;
      const patch =
        valueNoise(def.seed + 9, tx / 4.5, ty / 4.5) * 0.7 +
        valueNoise(def.seed + 41, tx / 1.7, ty / 1.7) * 0.3;

      ctx.fillStyle = ramp[Math.min(11, Math.max(0, Math.floor(patch * 12)))]!;
      // 1픽셀 겹쳐 칠합니다 — 화면 배율이 정수가 아닐 때 칸 사이에 실금이 보이기 때문입니다
      ctx.fillRect(x, y, TILE + 1, TILE + 1);

      if (def.theme === 'town' && onRoad(def.seed, def.entryTx, def.entryTy, tx, ty)) {
        // 네모로 칠하면 포장도로처럼 각이 집니다. 칸보다 큰 타원을 겹쳐 흙길로 만듭니다
        ctx.fillStyle = art.road;
        ctx.beginPath();
        ctx.ellipse(
          x + TILE / 2,
          y + TILE / 2,
          TILE * (0.66 + hash2(def.seed + 151, tx, ty) * 0.22),
          TILE * (0.62 + hash2(def.seed + 152, tx, ty) * 0.24),
          hash2(def.seed + 153, tx, ty) * 3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  /* 2) 큰 얼룩 — 칸 경계를 가로지르는 그늘과 볕. 격자를 지우는 것이 목적입니다 */
  ctx.save();
  for (let ty = range.y0 - 2; ty <= range.y1 + 2; ty += 2) {
    for (let tx = range.x0 - 2; tx <= range.x1 + 2; tx += 2) {
      const roll = hash2(def.seed + 313, tx, ty);
      if (roll > 0.42) continue;

      const jitterX = hash2(def.seed + 77, tx, ty) * TILE * 2;
      const jitterY = hash2(def.seed + 91, tx, ty) * TILE * 2;
      const radius = TILE * (0.9 + roll * 2.2);

      ctx.globalAlpha = roll < 0.2 ? 0.055 : 0.045;
      ctx.fillStyle = roll < 0.2 ? '#000000' : art.ground[1]!;
      ctx.beginPath();
      ctx.ellipse(tx * TILE + jitterX, ty * TILE + jitterY, radius, radius * 0.72, roll * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  /* 3) 잔결 — 풀포기와 자갈. 네모난 점을 찍으면 격자가 다시 보이므로 기울인 타원과 선으로 */
  const grassy = def.theme === 'town' || def.theme === 'forest';
  ctx.save();
  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      if (tiles[ty * def.width + tx]! !== FLOOR) continue;
      const grain = hash2(def.seed + 5, tx, ty);
      if (grain < 0.72) continue;

      const x = tx * TILE + hash2(def.seed + 21, tx, ty) * TILE;
      const y = ty * TILE + hash2(def.seed + 22, tx, ty) * TILE;

      if (grassy) {
        ctx.strokeStyle = alpha(art.detail, 0.5);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(x + i * 3, y + 3);
          ctx.quadraticCurveTo(x + i * 3.6, y - 1, x + i * 5.2, y - 5);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = alpha(art.detail, 0.55);
        ctx.beginPath();
        ctx.ellipse(x, y, 3.4, 2.1, grain * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = alpha(lighten(art.ground[1]!, 0.25), 0.35);
        ctx.beginPath();
        ctx.ellipse(x - 0.8, y - 0.8, 1.8, 1.1, grain * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  drawContactShade(ctx, world, range);
}

/**
 *  물과 용암.
 *  칸마다 네모로 칠하면 얼음 조각을 늘어놓은 것처럼 보입니다.
 *  칸보다 큰 원을 겹쳐 그리면 이웃끼리 녹아 붙어 웅덩이가 됩니다.
 */
export function drawPools(ctx: CanvasRenderingContext2D, world: World, range: TileRange, art: ZoneArt): void {
  const { def, tiles } = world.map;
  const isLiquid = (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < def.width && ty < def.height && tiles[ty * def.width + tx]! === LIQUID;

  ctx.save();
  // 물웅덩이 본체
  ctx.fillStyle = art.liquid;
  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      if (!isLiquid(tx, ty)) continue;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      const wobble = hash2(def.seed + 131, tx, ty) * 0.16;
      ctx.beginPath();
      ctx.ellipse(cx, cy, TILE * (0.74 + wobble), TILE * (0.7 + wobble), wobble * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 안쪽의 깊은 색과 흔들리는 빛
  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      if (!isLiquid(tx, ty)) continue;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      const surrounded = isLiquid(tx - 1, ty) && isLiquid(tx + 1, ty) && isLiquid(tx, ty - 1) && isLiquid(tx, ty + 1);
      const wave = Math.sin(world.time * 1.4 + tx * 0.9 + ty * 1.3);

      if (surrounded) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = darken(art.liquid, 0.35);
        ctx.beginPath();
        ctx.ellipse(cx, cy, TILE * 0.5, TILE * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 수면에서 반짝이는 선 — 위쪽이 트인 칸에만
      if (!isLiquid(tx, ty - 1)) {
        ctx.globalAlpha = 0.4 + 0.25 * wave;
        ctx.strokeStyle = art.liquidLight;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx - TILE * 0.3, cy - TILE * 0.22 + wave * 1.5);
        ctx.quadraticCurveTo(cx, cy - TILE * 0.3 - wave, cx + TILE * 0.3, cy - TILE * 0.2 + wave);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.18 + 0.1 * wave;
      ctx.fillStyle = art.liquidGlow;
      ctx.beginPath();
      ctx.ellipse(cx - 3, cy - 2, TILE * 0.2, TILE * 0.1, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

/** 장애물과 벽 옆 바닥에 깔리는 그늘 — 바닥이 평평해 보이지 않게 하는 핵심입니다 */
function drawContactShade(ctx: CanvasRenderingContext2D, world: World, range: TileRange): void {
  const { def, tiles } = world.map;
  const blocked = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= def.width || ty >= def.height) return true;
    return tiles[ty * def.width + tx]! === PROP || tiles[ty * def.width + tx]! === 1;
  };

  ctx.save();
  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      if (tiles[ty * def.width + tx]! !== FLOOR) continue;
      const x = tx * TILE;
      const y = ty * TILE;

      // 빛이 왼쪽 위에서 오므로 위·왼쪽 장애물이 더 짙은 그늘을 남깁니다
      if (blocked(tx, ty - 1)) {
        ctx.fillStyle = 'rgba(0,0,0,0.26)';
        ctx.fillRect(x, y, TILE, 7);
      }
      if (blocked(tx - 1, ty)) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x, y, 6, TILE);
      }
      if (blocked(tx + 1, ty)) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x + TILE - 4, y, 4, TILE);
      }
      if (blocked(tx, ty + 1)) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
      }
    }
  }
  ctx.restore();
}

/* ===========================================================================
 *  벽 — 테두리 절벽과 마을 건물
 * ======================================================================== */

export function drawWalls(ctx: CanvasRenderingContext2D, world: World, range: TileRange, art: ZoneArt): void {
  const { def, tiles } = world.map;
  const isWall = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= def.width || ty >= def.height) return true;
    return tiles[ty * def.width + tx]! === 1;
  };

  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      if (!isWall(tx, ty)) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const grain = hash2(def.seed + 17, tx, ty);
      const town = def.theme === 'town';

      // 윗면 (지붕 또는 절벽 위)
      ctx.fillStyle = town ? mix(art.wallTop, '#000000', grain * 0.18) : mix(art.wallTop, '#000000', grain * 0.25);
      ctx.fillRect(x, y, TILE, TILE);

      if (town) {
        // 기와 결
        ctx.fillStyle = alpha(darken(art.wallTop, 0.45), 0.5);
        for (let i = 0; i < 3; i++) ctx.fillRect(x, y + 6 + i * 9, TILE, 2);
      } else {
        ctx.fillStyle = alpha(lighten(art.wallTop, 0.25), 0.35);
        ctx.fillRect(x + 3, y + 3, TILE - 10, 3);
      }

      // 아래쪽이 뚫려 있으면 앞면이 보입니다
      if (!isWall(tx, ty + 1)) {
        ctx.fillStyle = art.wall;
        ctx.fillRect(x, y + TILE - 10, TILE, 10);
        ctx.fillStyle = alpha(lighten(art.wall, 0.3), 0.5);
        ctx.fillRect(x, y + TILE - 10, TILE, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
      }
      // 왼쪽 모서리에 빛, 오른쪽에 그림자
      if (!isWall(tx - 1, ty)) {
        ctx.fillStyle = alpha(lighten(art.wallTop, 0.35), 0.35);
        ctx.fillRect(x, y, 3, TILE);
      }
      if (!isWall(tx + 1, ty)) {
        ctx.fillStyle = alpha(art.wallEdge, 0.6);
        ctx.fillRect(x + TILE - 3, y, 3, TILE);
      }
    }
  }
}

/* ===========================================================================
 *  나무와 바위
 * ======================================================================== */

/** 장애물 하나 그리기 — (x, y) 는 칸의 왼쪽 위 */
export function drawProp(
  ctx: CanvasRenderingContext2D,
  world: World,
  art: ZoneArt,
  tx: number,
  ty: number,
): void {
  const { def } = world.map;
  const kind = propKind(def.theme, art, def.seed, tx, ty);
  const grain = hash2(def.seed + 33, tx, ty);
  const cx = tx * TILE + TILE / 2;
  const cy = ty * TILE + TILE / 2;
  const scale = 0.84 + grain * 0.34;

  ctx.save();
  // 바닥에 드리우는 그림자 (빛이 왼쪽 위 → 그림자는 오른쪽 아래)
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + TILE * 0.34, TILE * 0.36 * scale, TILE * 0.15 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  //  ★ 그림이 있으면 그림으로, 없으면 아래 도형으로 떨어집니다.
  //    지역별 그림이 있으면 그것을, 없으면 종류별 한 장을 씁니다.
  const img = spriteFor(`${def.theme}/${kind}`, kind);
  if (img) {
    //  접지선은 타일 위에서 0.72 지점 — draw.ts 의 깊이 정렬과 같은 값입니다.
    //  그 자리에 그림의 아래 끝을 놓아야 앞뒤가 안 뒤집힙니다.
    drawSprite(ctx, img, cx, ty * TILE + TILE * 0.72, PROP_WIDTH[kind] * scale);
    ctx.restore();
    return;
  }

  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  switch (kind) {
    case 'tree': {
      trunk(ctx, art, 5, 16);
      // 잎을 세 덩이로 겹쳐 부피를 냅니다
      leaf(ctx, art, 0, -14, 15, 0);
      leaf(ctx, art, -8, -6, 11, 0.12);
      leaf(ctx, art, 8, -4, 10, -0.1);
      break;
    }
    case 'pine': {
      trunk(ctx, art, 4, 14);
      for (let i = 0; i < 3; i++) {
        const w = 15 - i * 3.6;
        const yy = -4 - i * 8;
        ctx.fillStyle = i === 0 ? art.prop : mix(art.prop, art.propLight, 0.25 * i);
        ctx.beginPath();
        ctx.moveTo(0, yy - 11);
        ctx.lineTo(w, yy + 3);
        ctx.lineTo(-w, yy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = alpha(art.propLight, 0.5);
        ctx.beginPath();
        ctx.moveTo(0, yy - 11);
        ctx.lineTo(-w, yy + 3);
        ctx.lineTo(-w * 0.35, yy + 3);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'bush': {
      leaf(ctx, art, -5, 2, 9, 0.1);
      leaf(ctx, art, 5, 0, 10, -0.05);
      leaf(ctx, art, 0, -5, 8, 0);
      break;
    }
    case 'rock':
    case 'boulder': {
      const r = kind === 'rock' ? 10 : 14;
      ctx.fillStyle = art.prop;
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.6);
      ctx.lineTo(-r * 0.75, -r * 0.5);
      ctx.lineTo(-r * 0.1, -r);
      ctx.lineTo(r * 0.8, -r * 0.35);
      ctx.lineTo(r, r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = art.propLight; // 왼쪽 위 밝은 면
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, -r * 0.5);
      ctx.lineTo(-r * 0.1, -r);
      ctx.lineTo(r * 0.1, -r * 0.35);
      ctx.lineTo(-r * 0.5, -r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = alpha(art.propDark, 0.75); // 오른쪽 아래 그늘
      ctx.beginPath();
      ctx.moveTo(r * 0.8, -r * 0.35);
      ctx.lineTo(r, r * 0.6);
      ctx.lineTo(0, r * 0.6);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'spire':
    case 'shard': {
      const h = kind === 'shard' ? 22 : 18;
      ctx.fillStyle = art.prop;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(9, 9);
      ctx.lineTo(-9, 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = art.propLight;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(-9, 9);
      ctx.lineTo(-2, 9);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'deadbush': {
      ctx.strokeStyle = art.propDark;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.42;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.quadraticCurveTo(Math.cos(a) * 6, 0, Math.cos(a) * 12, 8 + Math.sin(a) * 14);
        ctx.stroke();
      }
      break;
    }
    case 'beam': {
      // 갱도 지지대
      ctx.fillStyle = art.prop;
      ctx.fillRect(-13, -18, 5, 30);
      ctx.fillRect(8, -18, 5, 30);
      ctx.fillRect(-15, -22, 30, 6);
      ctx.fillStyle = alpha(art.propLight, 0.6);
      ctx.fillRect(-13, -18, 2, 30);
      ctx.fillRect(-15, -22, 30, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-15, -17, 30, 2);
      break;
    }
    case 'stake': {
      ctx.fillStyle = art.prop;
      ctx.fillRect(-5, -14, 10, 26);
      ctx.beginPath();
      ctx.moveTo(-5, -14);
      ctx.lineTo(0, -22);
      ctx.lineTo(5, -14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = alpha(art.propLight, 0.65);
      ctx.fillRect(-5, -14, 3, 26);
      ctx.fillStyle = alpha(art.propDark, 0.7);
      ctx.fillRect(2, -14, 3, 26);
      break;
    }
    case 'totem': {
      ctx.fillStyle = art.prop;
      ctx.fillRect(-7, -20, 14, 32);
      ctx.fillStyle = alpha(art.propLight, 0.55);
      ctx.fillRect(-7, -20, 4, 32);
      ctx.fillStyle = '#d9c27a'; // 새겨진 얼굴
      ctx.beginPath();
      ctx.arc(-2.5, -12, 2, 0, Math.PI * 2);
      ctx.arc(2.5, -12, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d9c27a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.lineTo(4, -5);
      ctx.stroke();
      break;
    }
    case 'bones': {
      ctx.fillStyle = '#cdc4b0';
      ctx.save();
      ctx.rotate(0.4);
      ctx.fillRect(-11, -1, 22, 3.5);
      ctx.beginPath();
      ctx.arc(-11, 0, 3, 0, Math.PI * 2);
      ctx.arc(11, 1, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#e2dccb';
      ctx.beginPath();
      ctx.arc(3, 4, 6, 0, Math.PI * 2); // 두개골
      ctx.fill();
      ctx.fillStyle = '#2b2620';
      ctx.beginPath();
      ctx.arc(1, 3, 1.6, 0, Math.PI * 2);
      ctx.arc(5.5, 3.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'crystal': {
      const pulse = 0.75 + 0.25 * Math.sin(world.time * 2 + tx + ty);
      for (const [dx, h, w] of [[-6, 14, 5], [4, 20, 6], [10, 11, 4]] as const) {
        ctx.fillStyle = alpha(art.liquidGlow, 0.85);
        ctx.beginPath();
        ctx.moveTo(dx, -h);
        ctx.lineTo(dx + w, 10);
        ctx.lineTo(dx - w, 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = alpha('#ffffff', 0.5 * pulse);
        ctx.beginPath();
        ctx.moveTo(dx, -h);
        ctx.lineTo(dx - w * 0.4, 10);
        ctx.lineTo(dx - w, 10);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'campfire': {
      ctx.fillStyle = art.propDark; // 장작
      ctx.save();
      ctx.rotate(0.5);
      ctx.fillRect(-12, -2, 24, 4);
      ctx.rotate(-1);
      ctx.fillRect(-12, -2, 24, 4);
      ctx.restore();
      flame(ctx, world.time * 8 + tx, 0, -4, 12, '#ff9a3c', '#ffe08a');
      break;
    }
    case 'vent': {
      ctx.fillStyle = art.propDark;
      ctx.beginPath();
      ctx.ellipse(0, 4, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5a1a';
      ctx.beginPath();
      ctx.ellipse(0, 3, 8, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha('#ffd08a', 0.8);
      ctx.beginPath();
      ctx.ellipse(-1, 2, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      flame(ctx, world.time * 6 + tx, 0, -2, 9, '#ff6a2a', '#ffd08a');
      break;
    }
  }
  ctx.restore();
}

function trunk(ctx: CanvasRenderingContext2D, art: ZoneArt, w: number, h: number): void {
  ctx.fillStyle = darken(art.propDark, 0.15);
  ctx.fillRect(-w / 2, -2, w, h);
  ctx.fillStyle = alpha(lighten(art.propDark, 0.35), 0.7);
  ctx.fillRect(-w / 2, -2, 1.6, h);
}

/** 잎 한 덩이 — 왼쪽 위가 밝고 오른쪽 아래가 어둡습니다 */
function leaf(ctx: CanvasRenderingContext2D, art: ZoneArt, x: number, y: number, r: number, tilt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = art.prop;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(art.propLight, 0.75);
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.32, r * 0.55, r * 0.42, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(art.propDark, 0.45);
  ctx.beginPath();
  ctx.ellipse(r * 0.35, r * 0.38, r * 0.45, r * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 흔들리는 불꽃 */
export function flame(
  ctx: CanvasRenderingContext2D,
  phase: number,
  x: number,
  y: number,
  size: number,
  outer: string,
  inner: string,
): void {
  for (let i = 0; i < 2; i++) {
    const wobble = Math.sin(phase + i * 1.7) * size * 0.16;
    const h = size * (1 - i * 0.42);
    ctx.fillStyle = i === 0 ? outer : inner;
    ctx.beginPath();
    ctx.moveTo(x + wobble, y - h);
    ctx.quadraticCurveTo(x + size * 0.5 * (1 - i * 0.4), y, x + wobble * 0.5, y + size * 0.3);
    ctx.quadraticCurveTo(x - size * 0.5 * (1 - i * 0.4), y, x + wobble, y - h);
    ctx.fill();
  }
}

/* ===========================================================================
 *  빛 — 수정·모닥불·용암이 주변을 밝힙니다
 * ======================================================================== */

export function drawLights(
  ctx: CanvasRenderingContext2D,
  world: World,
  range: TileRange,
  art: ZoneArt,
): void {
  if (!art.beacon) return;
  const { def, tiles } = world.map;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      const tile = tiles[ty * def.width + tx]!;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;

      let color: string | null = null;
      let radius = 0;

      if (tile === PROP && art.beacon) {
        const kind = propKind(def.theme, art, def.seed, tx, ty);
        if (isBeacon(kind)) {
          color = art.beacon.color;
          radius = art.beacon.radius;
        }
      }
      if (!color) continue;

      const flicker = 0.82 + 0.18 * Math.sin(world.time * 5 + tx * 2.1 + ty * 1.7);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * flicker);
      gradient.addColorStop(0, alpha(color, 0.36));
      gradient.addColorStop(0.45, alpha(color, 0.12));
      gradient.addColorStop(1, alpha(color, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
  }
  ctx.restore();
}

/* ===========================================================================
 *  떠다니는 것 — 꽃가루, 반딧불, 먼지, 재
 * ======================================================================== */

export function drawMotes(ctx: CanvasRenderingContext2D, world: World, view: View, art: ZoneArt): void {
  const { kind, color, count } = art.motes;
  const spanX = view.width / view.zoom;
  const spanY = view.height / view.zoom;
  const left = view.camX - spanX / 2;
  const top = view.camY - spanY / 2;

  ctx.save();
  for (let i = 0; i < count; i++) {
    const seedX = hash2(1234, i, 7);
    const seedY = hash2(4321, i, 13);
    const speed = 0.3 + seedX * 0.7;

    let x: number;
    let y: number;

    if (kind === 'ash') {
      x = left + ((seedX * spanX + Math.sin(world.time * 0.4 + i) * 24) % spanX);
      y = top + ((seedY * spanY + world.time * 22 * speed) % spanY);
    } else if (kind === 'ember') {
      x = left + ((seedX * spanX + Math.sin(world.time * 0.9 + i) * 18) % spanX);
      y = top + (((seedY * spanY - world.time * 30 * speed) % spanY) + spanY) % spanY;
    } else if (kind === 'dust') {
      x = left + ((seedX * spanX + world.time * 14 * speed) % spanX);
      y = top + seedY * spanY + Math.sin(world.time * 0.7 + i * 2) * 10;
    } else {
      x = left + seedX * spanX + Math.sin(world.time * 0.5 * speed + i) * 26;
      y = top + seedY * spanY + Math.cos(world.time * 0.4 * speed + i * 1.7) * 20;
    }

    const twinkle = kind === 'firefly' ? 0.35 + 0.65 * Math.max(0, Math.sin(world.time * 2 + i * 2.3)) : 0.5;
    const size = kind === 'ash' ? 1.6 : kind === 'ember' ? 1.8 : 1.5;

    ctx.globalAlpha = twinkle * (kind === 'dust' ? 0.35 : 0.7);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    if (kind === 'firefly' || kind === 'ember') {
      ctx.globalAlpha = twinkle * 0.22;
      ctx.beginPath();
      ctx.arc(x, y, size * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ 도우미 */

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
