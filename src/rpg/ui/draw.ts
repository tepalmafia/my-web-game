/**
 * ===========================================================================
 *  한 장면 그리기
 * ===========================================================================
 *
 *  ★ 이 파일은 게임 규칙을 절대 판단하지 않습니다. 있는 그대로 그리기만 합니다.
 *
 *  그리는 순서가 곧 화면의 깊이입니다.
 *
 *      바닥 → 벽 → 빛 → 광역기 예고 → [나무·사람·전리품·몬스터·나] → 효과 → 숫자 → 공기
 *
 *  가운데 대괄호 안은 ★ y좌표 순으로 섞어서 그립니다.
 *  그래야 나무 뒤로 걸어 들어가면 나무에 가려지고, 앞으로 나오면 내가 앞에 섭니다.
 *  이 한 가지만으로 평평하던 화면에 깊이가 생깁니다.
 */

import { TILE } from '../balance';
import { monsterDef } from '../content/monsters';
import { FLOOR, LIQUID, PROP, tileCenter } from '../core/world';
import type { World } from '../types';
import { computeView } from './view';
import { drawMonster, drawPlayer } from './art/actors';
import {
  drawCastMark,
  drawFloaters,
  drawGroundItem,
  drawNameplates,
  drawNpc,
  drawPortal,
  drawTargetMark,
  drawVfx,
  drawWarnings,
} from './art/effects';
import { ZONE_ART, alpha } from './art/palette';
import {
  drawGround,
  drawLights,
  drawMotes,
  drawPools,
  drawProp,
  drawWalls,
  visibleTiles,
  type TileRange,
} from './art/terrain';

export { computeView, screenToWorld } from './view';
export type { View } from './view';

/** y 순으로 섞어 그릴 것들 */
type Layer =
  | { y: number; kind: 'prop'; tx: number; ty: number }
  | { y: number; kind: 'npc'; index: number }
  | { y: number; kind: 'item'; index: number }
  | { y: number; kind: 'monster'; index: number }
  | { y: number; kind: 'player' };

/** 매 프레임 새로 만들지 않도록 목록을 재사용합니다 */
const layers: Layer[] = [];

/**
 *  바닥과 벽은 한 번 그리면 변하지 않습니다.
 *  매 프레임 수백 칸을 다시 칠하는 대신, 지역에 들어갈 때 통째로 한 장 그려두고
 *  그 그림을 한 번 붙여넣습니다. (물과 불빛은 움직이므로 따로 그립니다.)
 */
const terrainCache: { mapId: string; canvas: HTMLCanvasElement | null } = { mapId: '', canvas: null };

function terrainLayer(world: World): HTMLCanvasElement | null {
  if (terrainCache.mapId === world.mapId && terrainCache.canvas) return terrainCache.canvas;

  const { def } = world.map;
  const canvas = document.createElement('canvas');
  canvas.width = def.width * TILE;
  canvas.height = def.height * TILE;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const whole: TileRange = { x0: 0, y0: 0, x1: def.width - 1, y1: def.height - 1 };
  const art = ZONE_ART[def.theme];
  drawGround(ctx, world, whole, art);
  drawWalls(ctx, world, whole, art);

  terrainCache.mapId = world.mapId;
  terrainCache.canvas = canvas;
  return canvas;
}

export function draw(ctx: CanvasRenderingContext2D, world: World, width: number, height: number): void {
  const view = computeView(world, width, height);
  const art = ZONE_ART[world.map.def.theme];

  ctx.save();
  ctx.fillStyle = art.wallEdge;
  ctx.fillRect(0, 0, width, height);

  ctx.translate(width / 2, height / 2);
  ctx.scale(view.zoom, view.zoom);
  ctx.translate(-view.camX, -view.camY);

  const range = visibleTiles(world, view);

  const terrain = terrainLayer(world);
  if (terrain) ctx.drawImage(terrain, 0, 0);
  else {
    drawGround(ctx, world, range, art);
    drawWalls(ctx, world, range, art);
  }
  drawPools(ctx, world, range, art);
  drawLights(ctx, world, range, art);

  for (const portal of world.map.def.portals) {
    drawPortal(ctx, world, portal.tx, portal.ty, `${portal.label} · Lv.${portal.recommendLevel}+`);
  }

  drawWarnings(ctx, world);

  // 노리는 대상 표시는 발밑이므로 몸통보다 먼저
  const target = world.monsters.find((m) => m.id === world.player.targetId && m.state !== 'dead');
  if (target) drawTargetMark(ctx, world, target);

  drawDepthSorted(ctx, world, range);

  drawVfx(ctx, world);
  drawNameplates(ctx, world);
  drawFloaters(ctx, world);
  drawMotes(ctx, world, view, art);

  ctx.restore();

  // 지역의 공기색을 옅게 덮어 한 화면으로 묶습니다
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = art.ambientAlpha;
  ctx.fillStyle = art.ambient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  drawVignette(ctx, width, height, art.fog);
  drawMinimap(ctx, world, width);
}

/* ===========================================================================
 *  깊이 정렬
 * ======================================================================== */

function drawDepthSorted(ctx: CanvasRenderingContext2D, world: World, range: TileRange): void {
  const { def, tiles } = world.map;
  layers.length = 0;

  for (let ty = range.y0; ty <= range.y1; ty++) {
    for (let tx = range.x0; tx <= range.x1; tx++) {
      const tile = tiles[ty * def.width + tx]!;
      if (tile !== PROP) continue;
      // 나무 밑동이 기준입니다 — 밑동보다 아래에 서면 내가 앞으로 나옵니다
      layers.push({ y: ty * TILE + TILE * 0.72, kind: 'prop', tx, ty });
    }
  }
  for (let i = 0; i < def.npcs.length; i++) {
    layers.push({ y: tileCenter(def.npcs[i]!.ty), kind: 'npc', index: i });
  }
  for (let i = 0; i < world.ground.length; i++) {
    layers.push({ y: world.ground[i]!.pos.y, kind: 'item', index: i });
  }
  for (let i = 0; i < world.monsters.length; i++) {
    const monster = world.monsters[i]!;
    if (monster.state === 'dead') continue;
    layers.push({ y: monster.pos.y, kind: 'monster', index: i });
  }
  layers.push({ y: world.player.pos.y, kind: 'player' });

  layers.sort((a, b) => a.y - b.y);

  for (const layer of layers) {
    switch (layer.kind) {
      case 'prop':
        drawProp(ctx, world, ZONE_ART[def.theme], layer.tx, layer.ty);
        break;
      case 'npc':
        drawNpc(ctx, world, def.npcs[layer.index]!);
        break;
      case 'item':
        drawGroundItem(ctx, world, world.ground[layer.index]!);
        break;
      case 'monster': {
        const monster = world.monsters[layer.index]!;
        drawMonster(ctx, world, monster);
        if (monster.castTimer > 0) drawCastMark(ctx, world, monster);
        break;
      }
      case 'player':
        drawPlayer(ctx, world);
        break;
    }
  }
}

/* ===========================================================================
 *  화면 가장자리와 작은 지도
 * ======================================================================== */

/** 가장자리를 어둡게 — 가운데(내 캐릭터)로 눈이 가게 합니다 */
function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number, fog: string): void {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.3,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, fog);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawMinimap(ctx: CanvasRenderingContext2D, world: World, width: number): void {
  const { def, tiles } = world.map;
  const size = 104;
  const scale = size / Math.max(def.width, def.height);
  const originX = width - size - 14;
  const originY = 14;
  const art = ZONE_ART[def.theme];

  ctx.save();
  // 놋쇠 테두리
  ctx.fillStyle = 'rgba(10,8,6,0.88)';
  ctx.fillRect(originX - 5, originY - 5, size + 10, size + 10);
  ctx.strokeStyle = 'rgba(201,162,39,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(originX - 4.5, originY - 4.5, size + 9, size + 9);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeRect(originX - 2.5, originY - 2.5, size + 5, size + 5);

  for (let ty = 0; ty < def.height; ty++) {
    for (let tx = 0; tx < def.width; tx++) {
      const tile = tiles[ty * def.width + tx]!;
      ctx.fillStyle =
        tile === FLOOR ? alpha(art.ground[1]!, 0.85)
        : tile === LIQUID ? alpha(art.liquidLight, 0.8)
        : alpha(art.wallEdge, 0.95);
      ctx.fillRect(originX + tx * scale, originY + ty * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }

  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    const def2 = monsterDef(monster.defId);
    ctx.fillStyle = def2.boss ? '#f2c14e' : '#e0453f';
    const s = def2.boss ? 5 : 2.5;
    ctx.fillRect(
      originX + (monster.pos.x / TILE) * scale - s / 2,
      originY + (monster.pos.y / TILE) * scale - s / 2,
      s,
      s,
    );
  }

  for (const portal of def.portals) {
    ctx.fillStyle = '#5eb8ff';
    ctx.fillRect(originX + portal.tx * scale - 2, originY + portal.ty * scale - 2, 4, 4);
  }
  for (const npc of def.npcs) {
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(originX + npc.tx * scale - 1.5, originY + npc.ty * scale - 1.5, 3, 3);
  }

  // 나
  const px = originX + (world.player.pos.x / TILE) * scale;
  const py = originY + (world.player.pos.y / TILE) * scale;
  ctx.fillStyle = '#f5efe0';
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
