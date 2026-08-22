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
import { stageOf } from '../content/town';
import { FLOOR, LIQUID, PROP, tileCenter } from '../core/world';
import type { World } from '../types';
import { computeView } from './view';
import { deathProgress, drawMonster, drawPlayer } from './art/actors';
import {
  drawCorpse,
  drawFloaters,
  drawForge,
  drawForgeLabel,
  drawForgeRing,
  drawGroundItem,
  drawNameplates,
  drawNpc,
  drawPortal,
  drawSealedPortal,
  drawTargetMark,
  drawThreatMarks,
  drawThreatRings,
  drawVein,
  drawVeinLabels,
  drawVeinRings,
  drawVfx,
  setLabelBlockout,
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
  | { y: number; kind: 'vein'; index: number }
  | { y: number; kind: 'forge' }
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
/**
 *  ★ 열쇠에 마을 단계가 함께 들어갑니다. mapId 만으로 잡으면, 마을 안에 서 있는 채로
 *    대장간이 자랐을 때 옛 그림이 그대로 붙어 있어 아무 일도 안 일어난 것처럼 보입니다.
 */
const terrainCache: { key: string; canvas: HTMLCanvasElement | null } = { key: '', canvas: null };

function terrainLayer(world: World): HTMLCanvasElement | null {
  const key = `${world.mapId}:${stageOf(world.me.town)}`;
  if (terrainCache.key === key && terrainCache.canvas) return terrainCache.canvas;

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

  terrainCache.key = key;
  terrainCache.canvas = canvas;
  return canvas;
}

/** 작은 지도가 차지하는 자리 (화면 좌표) — 그리는 쪽과 이름표를 접는 쪽이 같은 값을 씁니다 */
const MINIMAP = { size: 104, margin: 14, pad: 5 };

/**
 *  작은 지도의 **바닥**을 한 번만 굽습니다.
 *
 *  ★ 왜: 예전에는 매 프레임 지도 전체를 다시 칠했습니다. 숲이 46×36 이니
 *    한 프레임에 fillRect 1,656 번 + 타일마다 alpha() 로 문자열 하나.
 *    초당 60프레임이면 **초당 십만 번**입니다. 재보니 데스크톱이 15fps 였고,
 *    한 프레임 4,240 개 명령 중 이것 하나가 40% 였습니다.
 *
 *  ★ 안전한 이유: map.tiles 는 buildMap 이 지은 뒤 아무도 안 고칩니다
 *    (world.ts 의 set() 이 유일한 쓰기이고 전부 buildMap 안입니다).
 *    바뀌는 것은 마을 단계뿐인데 그건 열쇠에 들어 있습니다 — terrainCache 와 같은 모양입니다.
 *
 *  ★ 몬스터·문·시체·나는 안 굽습니다. 그건 매 프레임 움직입니다.
 */
const minimapCache: { key: string; canvas: HTMLCanvasElement | null } = { key: '', canvas: null };

function minimapLayer(world: World): HTMLCanvasElement | null {
  const { def, tiles } = world.map;
  const key = `${world.mapId}:${stageOf(world.me.town)}`;
  if (minimapCache.key === key && minimapCache.canvas) return minimapCache.canvas;

  const size = MINIMAP.size;
  const scale = size / Math.max(def.width, def.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const art = ZONE_ART[def.theme];
  //  ★ 색 문자열도 여기서 세 번만 만듭니다. 예전에는 타일마다 만들었습니다
  const floor = alpha(art.ground[1]!, 0.85);
  const liquid = alpha(art.liquidLight, 0.8);
  const wall = alpha(art.wallEdge, 0.95);

  for (let ty = 0; ty < def.height; ty++) {
    for (let tx = 0; tx < def.width; tx++) {
      const tile = tiles[ty * def.width + tx]!;
      ctx.fillStyle = tile === FLOOR ? floor : tile === LIQUID ? liquid : wall;
      ctx.fillRect(tx * scale, ty * scale, Math.ceil(scale), Math.ceil(scale));
    }
  }

  minimapCache.key = key;
  minimapCache.canvas = canvas;
  return canvas;
}

function minimapScreenBox(width: number) {
  const x0 = width - MINIMAP.size - MINIMAP.margin - MINIMAP.pad;
  const y0 = MINIMAP.margin - MINIMAP.pad;
  return { x0, y0, x1: x0 + MINIMAP.size + MINIMAP.pad * 2, y1: y0 + MINIMAP.size + MINIMAP.pad * 2 };
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

  // 작은 지도 밑에 깔릴 이름표는 접습니다 (화면 좌표 → 월드 좌표)
  const screenBox = minimapScreenBox(width);
  setLabelBlockout({
    x0: (screenBox.x0 - width / 2) / view.zoom + view.camX,
    y0: (screenBox.y0 - height / 2) / view.zoom + view.camY,
    x1: (screenBox.x1 - width / 2) / view.zoom + view.camX,
    y1: (screenBox.y1 - height / 2) / view.zoom + view.camY,
  });

  const range = visibleTiles(world, view);

  const terrain = terrainLayer(world);
  if (terrain) ctx.drawImage(terrain, 0, 0);
  else {
    drawGround(ctx, world, range, art);
    drawWalls(ctx, world, range, art);
  }
  drawPools(ctx, world, range, art);
  drawLights(ctx, world, range, art);

  //  ★ 두고 온 짐. 어디서 죽었는지 모르면 되찾을 수 없습니다
  const corpse = world.me.corpse;
  if (corpse && corpse.mapId === world.mapId) {
    drawCorpse(ctx, world, corpse.pos.x, corpse.pos.y, corpse.until - world.time);
  }

  for (const portal of world.map.def.portals) {
    // 조건이 걸린 문은 빛나지 않습니다 — 보이되 열려 보이지는 않게
    if (portal.needs) drawSealedPortal(ctx, world, portal.tx, portal.ty, portal.label);
    else drawPortal(ctx, world, portal.tx, portal.ty, portal.label);
  }

  // 만들 수 있는 자리를 바닥에 그립니다 — 발밑이므로 몸통보다 먼저
  const forge = world.map.def.forge;
  if (forge) drawForgeRing(ctx, world, forge.tx, forge.ty);

  // 발밑에 깔리는 것들은 몸통보다 먼저
  drawVeinRings(ctx, world);
  drawThreatRings(ctx, world);
  const target = world.monsters.find((m) => m.id === world.me.targetId && m.state !== 'dead');
  if (target) drawTargetMark(ctx, world, target);

  drawDepthSorted(ctx, world, range);

  drawVfx(ctx, world);
  drawThreatMarks(ctx, world);
  drawVeinLabels(ctx, world);
  drawForgeLabel(ctx, world);
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

  setLabelBlockout(null);

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
  const forge = def.forge;
  // 화로도 뒤로 걸어 들어가면 가려집니다 — 화덕 아랫부분이 기준입니다
  if (forge) layers.push({ y: tileCenter(forge.ty) + 9, kind: 'forge' });
  for (let i = 0; i < world.veins.length; i++) {
    layers.push({ y: world.veins[i]!.pos.y, kind: 'vein', index: i });
  }
  for (let i = 0; i < def.npcs.length; i++) {
    layers.push({ y: tileCenter(def.npcs[i]!.ty), kind: 'npc', index: i });
  }
  for (let i = 0; i < world.ground.length; i++) {
    layers.push({ y: world.ground[i]!.pos.y, kind: 'item', index: i });
  }
  for (let i = 0; i < world.monsters.length; i++) {
    const monster = world.monsters[i]!;
    // ★ 죽은 뒤 0.4초는 계속 그립니다 — 쓰러지는 것까지가 죽인 것입니다
    if (monster.state === 'dead' && deathProgress(monster) === null) continue;
    layers.push({ y: monster.pos.y, kind: 'monster', index: i });
  }
  layers.push({ y: world.me.pos.y, kind: 'player' });

  layers.sort((a, b) => a.y - b.y);

  for (const layer of layers) {
    switch (layer.kind) {
      case 'prop':
        drawProp(ctx, world, ZONE_ART[def.theme], layer.tx, layer.ty);
        break;
      case 'forge':
        if (forge) drawForge(ctx, world, forge.tx, forge.ty);
        break;
      case 'vein':
        drawVein(ctx, world, world.veins[layer.index]!);
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
  const { def } = world.map;
  const size = MINIMAP.size;
  const scale = size / Math.max(def.width, def.height);
  const originX = width - size - MINIMAP.margin;
  const originY = MINIMAP.margin;

  ctx.save();
  // 놋쇠 테두리
  ctx.fillStyle = 'rgba(10,8,6,0.88)';
  ctx.fillRect(originX - 5, originY - 5, size + 10, size + 10);
  ctx.strokeStyle = 'rgba(201,162,39,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(originX - 4.5, originY - 4.5, size + 9, size + 9);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeRect(originX - 2.5, originY - 2.5, size + 5, size + 5);

  //  바닥은 구워둔 것을 붙입니다 (minimapLayer). 위에 얹는 것들만 매 프레임 그립니다
  const baked = minimapLayer(world);
  if (baked) ctx.drawImage(baked, originX, originY);

  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    ctx.fillStyle = '#e0453f';
    const s = 2.5;
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
  //  ★ 두고 온 짐은 작은 지도에도 찍습니다. 넓은 광산에서 그림만으로는 못 찾습니다
  const myPack = world.me.corpse;
  if (myPack && myPack.mapId === world.mapId) {
    ctx.fillStyle = '#f0c674';
    ctx.fillRect(
      originX + (myPack.pos.x / TILE) * scale - 2.5,
      originY + (myPack.pos.y / TILE) * scale - 2.5,
      5,
      5,
    );
  }
  for (const npc of def.npcs) {
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(originX + npc.tx * scale - 1.5, originY + npc.ty * scale - 1.5, 3, 3);
  }

  // 나
  const px = originX + (world.me.pos.x / TILE) * scale;
  const py = originY + (world.me.pos.y / TILE) * scale;
  ctx.fillStyle = '#f5efe0';
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
