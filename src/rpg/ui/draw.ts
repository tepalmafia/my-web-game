/**
 *  화면 그리기.
 *
 *  ★ 이 파일은 게임 규칙을 절대 판단하지 않습니다. 있는 그대로 그리기만 합니다.
 *
 *  그림 파일을 하나도 쓰지 않고 도형으로만 그립니다. 덕분에 받아야 할 자료가 없고,
 *  색과 크기를 숫자 몇 개로 바꿀 수 있습니다.
 */

import { PLAYER_RADIUS, TILE } from '../balance';
import { CLASSES } from '../content/classes';
import { GRADE_COLOR, itemDef } from '../content/items';
import { monsterDef } from '../content/monsters';
import { hash2 } from '../core/rng';
import { FLOOR, LIQUID, PROP, tileCenter, valueNoise } from '../core/world';
import type { MapTheme, MonsterShape, World } from '../types';

/** 지역마다의 색 */
interface Palette {
  floorA: string;
  floorB: string;
  wall: string;
  wallTop: string;
  prop: string;
  propDark: string;
  liquid: string;
  liquidGlow: string;
  /** 마을의 흙길 */
  road: string;
  fog: string;
}

const PALETTES: Record<MapTheme, Palette> = {
  town: {
    floorA: '#33472f', floorB: '#3b5136', wall: '#4a3a2c', wallTop: '#6b5540',
    prop: '#5c4633', propDark: '#3d2f22', liquid: '#1e3a5f', liquidGlow: '#3b82f6',
    road: '#5c4a33',
    fog: 'rgba(10,16,12,0.35)',
  },
  field: {
    floorA: '#2b4230', floorB: '#324c37', wall: '#3b3128', wallTop: '#584839',
    prop: '#1f3a26', propDark: '#16281b', liquid: '#1c3a56', liquidGlow: '#38bdf8',
    road: '#3f3a24',
    fog: 'rgba(8,14,10,0.4)',
  },
  canyon: {
    floorA: '#4a3a29', floorB: '#54432f', wall: '#3a2d20', wallTop: '#6b5540',
    prop: '#6b5a44', propDark: '#463a2b', liquid: '#38301f', liquidGlow: '#a3a3a3',
    road: '#5e4c36',
    fog: 'rgba(20,14,8,0.4)',
  },
  cave: {
    floorA: '#23222b', floorB: '#2a2933', wall: '#17161d', wallTop: '#3a3745',
    prop: '#3a3742', propDark: '#26242d', liquid: '#16283a', liquidGlow: '#22d3ee',
    road: '#302e3a',
    fog: 'rgba(4,6,10,0.55)',
  },
  fortress: {
    floorA: '#3a3129', floorB: '#433930', wall: '#2b241d', wallTop: '#5a4630',
    prop: '#5a4630', propDark: '#3b2e1f', liquid: '#2c2a1c', liquidGlow: '#84cc16',
    road: '#4c4034',
    fog: 'rgba(14,10,6,0.45)',
  },
  volcano: {
    floorA: '#33201d', floorB: '#3b2622', wall: '#241512', wallTop: '#4a2c26',
    prop: '#4a2c26', propDark: '#2c1a16', liquid: '#7f1d1d', liquidGlow: '#f97316',
    road: '#452b25',
    fog: 'rgba(20,6,4,0.45)',
  },
};

/** 화면과 월드 사이의 변환 — 클릭 판정과 그리기가 같은 값을 씁니다 */
export interface View {
  zoom: number;
  camX: number;
  camY: number;
  width: number;
  height: number;
}

export function computeView(world: World, width: number, height: number): View {
  const zoom = Math.max(0.85, Math.min(1.55, Math.min(width / 780, height / 560)));
  const mapW = world.map.def.width * TILE;
  const mapH = world.map.def.height * TILE;
  const halfW = width / (2 * zoom);
  const halfH = height / (2 * zoom);

  let camX = world.camera.x;
  let camY = world.camera.y;

  camX = mapW <= halfW * 2 ? mapW / 2 : Math.max(halfW, Math.min(mapW - halfW, camX));
  camY = mapH <= halfH * 2 ? mapH / 2 : Math.max(halfH, Math.min(mapH - halfH, camY));

  return { zoom, camX, camY, width, height };
}

/** 화면 좌표(캔버스 안 픽셀) → 월드 좌표 */
export function screenToWorld(view: View, sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - view.width / 2) / view.zoom + view.camX,
    y: (sy - view.height / 2) / view.zoom + view.camY,
  };
}

/* ===========================================================================
 *  본체
 * ======================================================================== */

export function draw(ctx: CanvasRenderingContext2D, world: World, width: number, height: number): void {
  const view = computeView(world, width, height);
  const palette = PALETTES[world.map.def.theme];

  ctx.save();
  ctx.fillStyle = palette.wall;
  ctx.fillRect(0, 0, width, height);

  ctx.translate(width / 2, height / 2);
  ctx.scale(view.zoom, view.zoom);
  ctx.translate(-view.camX, -view.camY);

  drawTiles(ctx, world, view, palette);
  drawPortals(ctx, world);
  drawNpcs(ctx, world);
  drawGround(ctx, world);
  drawWarnings(ctx, world);
  drawMonsters(ctx, world);
  drawPlayer(ctx, world);
  drawVfx(ctx, world);
  drawFloaters(ctx, world);

  ctx.restore();

  drawVignette(ctx, width, height, palette);
  drawMinimap(ctx, world, width, height);
}

/* --------------------------------------------------------------- 바닥 */

function drawTiles(ctx: CanvasRenderingContext2D, world: World, view: View, palette: Palette): void {
  const { def, tiles } = world.map;
  const halfW = view.width / (2 * view.zoom);
  const halfH = view.height / (2 * view.zoom);

  const x0 = Math.max(0, Math.floor((view.camX - halfW) / TILE) - 1);
  const x1 = Math.min(def.width - 1, Math.ceil((view.camX + halfW) / TILE) + 1);
  const y0 = Math.max(0, Math.floor((view.camY - halfH) / TILE) - 1);
  const y1 = Math.min(def.height - 1, Math.ceil((view.camY + halfH) / TILE) + 1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const tile = tiles[ty * def.width + tx]!;
      const x = tx * TILE;
      const y = ty * TILE;
      const noise = hash2(def.seed + 5, tx, ty);
      // 넓은 얼룩(patch)과 칸마다의 잔결(noise)을 섞습니다. 격자무늬가 보이지 않게 하려는 것입니다
      const patch = valueNoise(def.seed + 9, tx / 3.5, ty / 3.5);

      if (tile === FLOOR) {
        ctx.fillStyle = patch + noise * 0.12 > 0.55 ? palette.floorA : palette.floorB;
        ctx.fillRect(x, y, TILE, TILE);

        if (def.theme === 'town' && onRoad(def, tx, ty)) {
          ctx.fillStyle = palette.road;
          ctx.fillRect(x, y, TILE, TILE);
        }
        // 잔풀·자갈 몇 점
        if (noise > 0.86) {
          ctx.fillStyle = palette.propDark;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x + TILE * 0.28, y + TILE * 0.52, 4, 3);
          ctx.fillRect(x + TILE * 0.62, y + TILE * 0.34, 3, 2);
          ctx.globalAlpha = 1;
        } else if (noise < 0.08) {
          ctx.fillStyle = palette.floorA;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(x + TILE * 0.5, y + TILE * 0.5, TILE * 0.22, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else if (tile === LIQUID) {
        // 바닥을 먼저 깔고 그 위에 모서리를 둥글린 웅덩이를 얹습니다.
        // 타일 그대로 칠하면 네모 덩어리처럼 보여서 물이나 용암으로 읽히지 않습니다.
        ctx.fillStyle = patch > 0.5 ? palette.floorA : palette.floorB;
        ctx.fillRect(x, y, TILE, TILE);

        ctx.fillStyle = palette.liquid;
        roundRect(ctx, x - 1, y - 1, TILE + 2, TILE + 2, 9);
        ctx.fill();

        ctx.globalAlpha = 0.18 + 0.14 * Math.sin(world.time * 1.6 + tx * 0.7 + ty * 0.9);
        ctx.fillStyle = palette.liquidGlow;
        roundRect(ctx, x + 4, y + 4, TILE - 8, TILE - 8, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (tile === PROP) {
        ctx.fillStyle = noise > 0.5 ? palette.floorA : palette.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        drawProp(ctx, def.theme, x, y, palette, noise);
      } else {
        // 벽
        ctx.fillStyle = palette.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = palette.wallTop;
        ctx.fillRect(x, y, TILE, 6);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
      }
    }
  }
}

/** 마을 한복판을 가로지르는 흙길 */
function onRoad(def: { entryTx: number; entryTy: number }, tx: number, ty: number): boolean {
  return Math.abs(tx - def.entryTx) <= 1 || Math.abs(ty - def.entryTy) <= 1;
}

function drawProp(
  ctx: CanvasRenderingContext2D,
  theme: MapTheme,
  x: number,
  y: number,
  palette: Palette,
  noise: number,
): void {
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  // 전부 같은 크기면 붙여넣은 것처럼 보여서, 칸마다 조금씩 다르게 그립니다
  const scale = 0.82 + noise * 0.34;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + TILE * 0.32, TILE * 0.34, TILE * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  if (theme === 'field' || theme === 'town') {
    // 나무
    ctx.fillStyle = palette.propDark;
    ctx.fillRect(cx - 3, cy - 2, 6, TILE * 0.36);
    ctx.fillStyle = palette.prop;
    ctx.beginPath();
    ctx.moveTo(cx, cy - TILE * 0.48);
    ctx.lineTo(cx + TILE * 0.38, cy + TILE * 0.08);
    ctx.lineTo(cx - TILE * 0.38, cy + TILE * 0.08);
    ctx.closePath();
    ctx.fill();
  } else if (theme === 'canyon' || theme === 'cave') {
    // 바위
    ctx.fillStyle = palette.prop;
    ctx.beginPath();
    ctx.moveTo(cx - TILE * 0.38, cy + TILE * 0.3);
    ctx.lineTo(cx - TILE * 0.22, cy - TILE * 0.32);
    ctx.lineTo(cx + TILE * 0.18, cy - TILE * 0.4);
    ctx.lineTo(cx + TILE * 0.4, cy + TILE * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.propDark;
    ctx.fillRect(cx - TILE * 0.08, cy - TILE * 0.2, 4, TILE * 0.4);
  } else if (theme === 'fortress') {
    // 나무 말뚝
    ctx.fillStyle = palette.prop;
    ctx.fillRect(cx - TILE * 0.16, cy - TILE * 0.42, TILE * 0.32, TILE * 0.74);
    ctx.fillStyle = palette.propDark;
    ctx.beginPath();
    ctx.moveTo(cx - TILE * 0.16, cy - TILE * 0.42);
    ctx.lineTo(cx, cy - TILE * 0.56);
    ctx.lineTo(cx + TILE * 0.16, cy - TILE * 0.42);
    ctx.closePath();
    ctx.fill();
  } else {
    // 화산 — 굳은 용암 덩어리
    ctx.fillStyle = palette.prop;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = noise > 0.6 ? '#f97316' : palette.propDark;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(cx + 3, cy - 2, TILE * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** 모서리가 둥근 네모 (물웅덩이에 씁니다) */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* --------------------------------------------------------------- 문과 사람 */

function drawPortals(ctx: CanvasRenderingContext2D, world: World): void {
  for (const portal of world.map.def.portals) {
    const x = tileCenter(portal.tx);
    const y = tileCenter(portal.ty);
    const pulse = 0.5 + 0.5 * Math.sin(world.time * 3);

    ctx.save();
    ctx.globalAlpha = 0.35 + pulse * 0.3;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(x, y, TILE * 0.6, TILE * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, TILE * 0.6, TILE * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();

    label(ctx, `${portal.label} (Lv.${portal.recommendLevel}+)`, x, y - TILE * 0.75, '#e0f2fe');
    ctx.restore();
  }
}

function drawNpcs(ctx: CanvasRenderingContext2D, world: World): void {
  for (const npc of world.map.def.npcs) {
    const x = tileCenter(npc.tx);
    const y = tileCenter(npc.ty);
    const bob = Math.sin(world.time * 2 + npc.tx) * 1.5;

    shadow(ctx, x, y + 10, 10);
    ctx.fillStyle = npc.color;
    ctx.fillRect(x - 6, y - 12 + bob, 12, 16);
    ctx.beginPath();
    ctx.arc(x, y - 16 + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 6, y - 2 + bob, 12, 3);

    label(ctx, npc.name, x, y - 30, '#fde68a');
  }
}

function drawGround(ctx: CanvasRenderingContext2D, world: World): void {
  for (const item of world.ground) {
    const def = itemDef(item.defId);
    const color = GRADE_COLOR[def.grade] ?? '#cbd5e1';
    const bob = Math.sin(world.time * 4 + item.id) * 2;
    const fading = item.life < 6 ? 0.35 + 0.4 * Math.sin(world.time * 8) : 1;

    ctx.save();
    ctx.globalAlpha = fading;
    shadow(ctx, item.pos.x, item.pos.y + 5, 7);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(item.pos.x, item.pos.y - 8 + bob);
    ctx.lineTo(item.pos.x + 6, item.pos.y - 1 + bob);
    ctx.lineTo(item.pos.x, item.pos.y + 6 + bob);
    ctx.lineTo(item.pos.x - 6, item.pos.y - 1 + bob);
    ctx.closePath();
    ctx.fill();

    if (def.grade === 'epic' || def.grade === 'legend') {
      ctx.globalAlpha = 0.3 + 0.25 * Math.sin(world.time * 5);
      ctx.beginPath();
      ctx.arc(item.pos.x, item.pos.y, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* --------------------------------------------------------------- 몬스터 */

function drawWarnings(ctx: CanvasRenderingContext2D, world: World): void {
  for (const effect of world.vfx) {
    if (effect.kind !== 'warn') continue;
    const progress = 1 - effect.life / effect.maxLife;
    const radius = effect.radius ?? 100;

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(effect.pos.x, effect.pos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(effect.pos.x, effect.pos.y, radius * progress, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMonsters(ctx: CanvasRenderingContext2D, world: World): void {
  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    const def = monsterDef(monster.defId);
    const targeted = world.player.targetId === monster.id;
    const hurt = monster.hp < monster.maxHp;

    shadow(ctx, monster.pos.x, monster.pos.y + def.size * 0.75, def.size * 0.8);

    if (targeted) {
      ctx.save();
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(monster.pos.x, monster.pos.y, def.size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const color = monster.hitFlash > 0 ? '#ffffff' : def.color;
    drawShape(ctx, def.shape, monster.pos.x, monster.pos.y, def.size, color, world.time + monster.id);

    if (monster.castTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(world.time * 20);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(monster.pos.x, monster.pos.y - def.size - 14, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (hurt || targeted || def.boss) {
      hpBar(ctx, monster.pos.x, monster.pos.y - def.size - 8, def.boss ? 60 : 34, monster.hp / monster.maxHp, def.boss ? '#f43f5e' : '#ef4444');
    }
    if (def.boss || targeted) {
      label(ctx, `${def.name} Lv.${def.level}`, monster.pos.x, monster.pos.y - def.size - (def.boss ? 24 : 20), def.boss ? '#fbbf24' : '#fecaca');
    }
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: MonsterShape,
  x: number,
  y: number,
  size: number,
  color: string,
  t: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  const bob = Math.sin(t * 3) * size * 0.06;

  switch (shape) {
    case 'blob': {
      const squash = 1 + Math.sin(t * 4) * 0.08;
      ctx.beginPath();
      ctx.ellipse(x, y + bob, size * squash, size / squash, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'beast': {
      ctx.beginPath();
      ctx.ellipse(x, y + bob, size * 1.15, size * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + size * 0.9, y - size * 0.25 + bob, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath(); // 귀
      ctx.moveTo(x + size * 0.7, y - size * 0.6 + bob);
      ctx.lineTo(x + size * 0.95, y - size * 1.15 + bob);
      ctx.lineTo(x + size * 1.15, y - size * 0.55 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(x + size * 1.05, y - size * 0.3 + bob, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'humanoid': {
      ctx.fillRect(x - size * 0.55, y - size * 0.45 + bob, size * 1.1, size * 1.15);
      ctx.beginPath();
      ctx.arc(x, y - size * 0.75 + bob, size * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - size * 0.55, y + size * 0.35 + bob, size * 1.1, size * 0.2);
      ctx.fillStyle = color;
      ctx.fillRect(x + size * 0.5, y - size * 0.3 + bob, size * 0.28, size * 0.9); // 팔
      break;
    }
    case 'undead': {
      ctx.fillRect(x - size * 0.45, y - size * 0.35 + bob, size * 0.9, size);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(x, y - size * 0.75 + bob, size * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(x - size * 0.16, y - size * 0.8 + bob, size * 0.09, 0, Math.PI * 2);
      ctx.arc(x + size * 0.16, y - size * 0.8 + bob, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'golem': {
      ctx.fillRect(x - size * 0.8, y - size * 0.8 + bob, size * 1.6, size * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x - size * 0.5, y - size * 0.2 + bob, size * 0.18, size * 0.9);
      ctx.fillRect(x + size * 0.2, y - size * 0.6 + bob, size * 0.15, size * 0.7);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(x - size * 0.25, y - size * 0.35 + bob, size * 0.12, 0, Math.PI * 2);
      ctx.arc(x + size * 0.25, y - size * 0.35 + bob, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bat': {
      const flap = Math.sin(t * 12) * size * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y + bob);
      ctx.quadraticCurveTo(x - size * 1.4, y - flap + bob, x - size * 1.7, y + size * 0.4 + bob);
      ctx.quadraticCurveTo(x - size * 0.8, y + size * 0.3 + bob, x, y + size * 0.4 + bob);
      ctx.quadraticCurveTo(x + size * 0.8, y + size * 0.3 + bob, x + size * 1.7, y + size * 0.4 + bob);
      ctx.quadraticCurveTo(x + size * 1.4, y - flap + bob, x, y + bob);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y + bob, size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'elemental': {
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) {
        const wobble = Math.sin(t * 6 + i * 2) * size * 0.18;
        ctx.beginPath();
        ctx.moveTo(x + wobble, y - size * (1.3 - i * 0.25));
        ctx.quadraticCurveTo(x + size * (0.8 - i * 0.2), y, x + wobble, y + size * 0.8);
        ctx.quadraticCurveTo(x - size * (0.8 - i * 0.2), y, x + wobble, y - size * (1.3 - i * 0.25));
        ctx.fill();
        ctx.fillStyle = i === 0 ? '#fde68a' : color;
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'dragon': {
      const wing = Math.sin(t * 4) * size * 0.35;
      ctx.beginPath(); // 날개
      ctx.moveTo(x, y - size * 0.2 + bob);
      ctx.lineTo(x - size * 1.7, y - size * 0.9 - wing + bob);
      ctx.lineTo(x - size * 0.5, y + size * 0.4 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.2 + bob);
      ctx.lineTo(x + size * 1.7, y - size * 0.9 - wing + bob);
      ctx.lineTo(x + size * 0.5, y + size * 0.4 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath(); // 몸통
      ctx.ellipse(x, y + bob, size * 0.85, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath(); // 목과 머리
      ctx.ellipse(x + size * 0.9, y - size * 0.5 + bob, size * 0.45, size * 0.3, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(x + size * 1.05, y - size * 0.6 + bob, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/* --------------------------------------------------------------- 플레이어 */

function drawPlayer(ctx: CanvasRenderingContext2D, world: World): void {
  const player = world.player;
  const cls = CLASSES[player.classId];
  const { x, y } = player.pos;

  if (player.dead) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(x, y + 6, PLAYER_RADIUS * 1.3, PLAYER_RADIUS * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    label(ctx, `${player.name} — 쓰러짐`, x, y - 24, '#fca5a5');
    return;
  }

  shadow(ctx, x, y + PLAYER_RADIUS * 0.8, PLAYER_RADIUS);

  // 버프가 걸려 있으면 발밑에 고리
  if (player.buffs.length > 0) {
    ctx.save();
    for (const buff of player.buffs) {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(world.time * 4);
      ctx.strokeStyle = buff.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + PLAYER_RADIUS * 0.8, PLAYER_RADIUS * 1.5, PLAYER_RADIUS * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 몸
  ctx.save();
  ctx.fillStyle = cls.color;
  ctx.fillRect(x - 7, y - 6, 14, 15);
  ctx.beginPath();
  ctx.arc(x, y - 12, 7, 0, Math.PI * 2);
  ctx.fill();

  // 무기 — 바라보는 방향으로 뻗습니다
  ctx.translate(x, y - 2);
  ctx.rotate(player.facing);
  ctx.fillStyle = '#f8fafc';
  if (cls.weaponFamily === 'sword') ctx.fillRect(8, -2, 16, 4);
  else if (cls.weaponFamily === 'bow') {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(10, 0, 8, -1.2, 1.2);
    ctx.stroke();
  } else {
    ctx.fillRect(8, -1.5, 14, 3);
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath();
    ctx.arc(23, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  label(ctx, `${player.name} Lv.${player.level}`, x, y - 32, '#e2e8f0');
}

/* --------------------------------------------------------------- 효과 */

function drawVfx(ctx: CanvasRenderingContext2D, world: World): void {
  for (const effect of world.vfx) {
    const progress = 1 - effect.life / effect.maxLife;
    ctx.save();

    switch (effect.kind) {
      case 'slash': {
        if (!effect.to) break;
        const angle = Math.atan2(effect.to.y - effect.pos.y, effect.to.x - effect.pos.x);
        ctx.translate(effect.pos.x, effect.pos.y);
        ctx.rotate(angle);
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(18, 0, 22, -0.9 + progress * 1.6, 0.5 + progress * 1.6);
        ctx.stroke();
        break;
      }
      case 'projectile': {
        if (!effect.to) break;
        const px = effect.pos.x + (effect.to.x - effect.pos.x) * progress;
        const py = effect.pos.y + (effect.to.y - effect.pos.y) * progress;
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(effect.pos.x + (effect.to.x - effect.pos.x) * Math.max(0, progress - 0.18),
          effect.pos.y + (effect.to.y - effect.pos.y) * Math.max(0, progress - 0.18), 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'impact': {
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(effect.pos.x, effect.pos.y, (effect.radius ?? 12) * (0.5 + progress), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'aoe': {
        ctx.globalAlpha = (1 - progress) * 0.65;
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(effect.pos.x, effect.pos.y, (effect.radius ?? 100) * (0.6 + progress * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'ring':
      case 'levelup': {
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = effect.kind === 'levelup' ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(effect.pos.x, effect.pos.y, (effect.radius ?? 40) * (0.3 + progress * 1.2), 0, Math.PI * 2);
        ctx.stroke();
        if (effect.kind === 'levelup') {
          ctx.globalAlpha = (1 - progress) * 0.7;
          ctx.beginPath();
          ctx.arc(effect.pos.x, effect.pos.y, (effect.radius ?? 40) * (0.1 + progress * 0.7), 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'warn':
        break; // 이미 바닥에 그렸습니다
    }
    ctx.restore();
  }
}

function drawFloaters(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(2,6,23,0.85)';

  for (const floater of world.floaters) {
    const progress = 1 - floater.life / floater.maxLife;
    ctx.globalAlpha = Math.min(1, (1 - progress) * 2);

    let color = '#f8fafc';
    let size = 13;
    if (floater.kind === 'crit') {
      color = '#fde047';
      size = 19;
    } else if (floater.kind === 'taken') color = '#fca5a5';
    else if (floater.kind === 'heal') color = '#86efac';
    else if (floater.kind === 'exp') color = '#a5b4fc';
    else if (floater.kind === 'miss') color = '#94a3b8';
    else if (floater.kind === 'info') color = '#fcd34d';

    ctx.font = `bold ${size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.strokeText(floater.text, floater.pos.x, floater.pos.y);
    ctx.fillStyle = color;
    ctx.fillText(floater.text, floater.pos.x, floater.pos.y);
  }
  ctx.restore();
}

/* --------------------------------------------------------------- 도우미 */

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, ratio: number, color: string): void {
  const height = 4;
  ctx.save();
  ctx.fillStyle = 'rgba(2,6,23,0.75)';
  ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), height);
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.save();
  ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(2,6,23,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** 화면 가장자리를 어둡게 — 가운데(내 캐릭터)에 눈이 가게 합니다 */
function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number, palette: Palette): void {
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.35,
    width / 2, height / 2, Math.max(width, height) * 0.75,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, palette.fog);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** 오른쪽 위 작은 지도 */
function drawMinimap(ctx: CanvasRenderingContext2D, world: World, width: number, _height: number): void {
  const { def, tiles } = world.map;
  const size = 108;
  const scale = size / Math.max(def.width, def.height);
  const originX = width - size - 12;
  const originY = 12;

  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = '#020617';
  ctx.fillRect(originX - 3, originY - 3, size + 6, size + 6);
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(originX - 3, originY - 3, size + 6, size + 6);

  for (let ty = 0; ty < def.height; ty++) {
    for (let tx = 0; tx < def.width; tx++) {
      const tile = tiles[ty * def.width + tx]!;
      ctx.fillStyle = tile === FLOOR ? '#334155' : tile === LIQUID ? '#1d4ed8' : '#0f172a';
      ctx.fillRect(originX + tx * scale, originY + ty * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }

  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    const def2 = monsterDef(monster.defId);
    ctx.fillStyle = def2.boss ? '#fbbf24' : '#ef4444';
    const s = def2.boss ? 4 : 2;
    ctx.fillRect(originX + (monster.pos.x / TILE) * scale - s / 2, originY + (monster.pos.y / TILE) * scale - s / 2, s, s);
  }

  for (const portal of def.portals) {
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(originX + portal.tx * scale - 1.5, originY + portal.ty * scale - 1.5, 3, 3);
  }

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(originX + (world.player.pos.x / TILE) * scale, originY + (world.player.pos.y / TILE) * scale, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
