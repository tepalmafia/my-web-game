/**
 *  지형과 이동.
 *
 *  ─ 지형은 파일로 저장하지 않습니다.
 *    맵마다 정해진 씨앗으로 그때그때 만들어내며, 같은 씨앗이면 항상 같은 모양이 나옵니다.
 *    덕분에 저장 파일에는 "지금 어느 맵에 있는가" 한 줄만 들어갑니다.
 *
 *  ─ 만든 뒤에는 반드시 입구에서 물이 흐르는지(모든 칸에 걸어서 닿는지) 확인합니다.
 *    닿지 않는 구덩이가 있으면 거기 태어난 몬스터를 영영 잡을 수 없기 때문입니다.
 */

import { AI, TILE } from '../balance';
import { MAPS, MAP_ORDER, mapDef } from '../content/maps';
import { stageOf } from '../content/town';
import { monsterDef } from '../content/monsters';
import { hash2, nextRandom, randInt } from './rng';
import { gearScore } from './stats';
import { veinDef } from '../content/veins';
import type { GroundItem, MapDef, MapId, MapRuntime, Monster, Portal, Vec2, World } from '../types';

/* 타일 값 */
export const FLOOR = 0;
export const WALL = 1;
export const PROP = 2; // 나무·바위·기둥
export const LIQUID = 3; // 물·용암

/** 타일 좌표 → 그 칸의 한가운데 픽셀 좌표 */
export function tileCenter(t: number): number {
  return t * TILE + TILE / 2;
}

export function tileAt(map: MapRuntime, x: number, y: number): number {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= map.def.width || ty >= map.def.height) return WALL;
  return map.tiles[ty * map.def.width + tx]!;
}

export function tileBlocked(map: MapRuntime, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.def.width || ty >= map.def.height) return true;
  return map.tiles[ty * map.def.width + tx]! !== FLOOR;
}

/** 반지름 r 짜리 몸통이 (x, y) 에 설 수 있는가 */
export function blockedAt(map: MapRuntime, x: number, y: number, r: number): boolean {
  return (
    tileAt(map, x - r, y - r) !== FLOOR ||
    tileAt(map, x + r, y - r) !== FLOOR ||
    tileAt(map, x - r, y + r) !== FLOOR ||
    tileAt(map, x + r, y + r) !== FLOOR
  );
}

/**
 * 벽에 부딪히면 미끄러지며 움직입니다.
 * x 와 y 를 따로 판정하기 때문에 모서리에 걸려도 벽을 따라 흘러갑니다.
 */
export function slideMove(map: MapRuntime, pos: Vec2, dx: number, dy: number, r: number): void {
  if (dx !== 0 && !blockedAt(map, pos.x + dx, pos.y, r)) pos.x += dx;
  if (dy !== 0 && !blockedAt(map, pos.x, pos.y + dy, r)) pos.y += dy;
}

/* ===========================================================================
 *  지형 만들기
 * ======================================================================== */

/** 부드러운 잡음 — 격자마다 뽑은 난수를 사이사이 이어 붙여 자연스러운 얼룩을 만듭니다 */
export function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = hash2(seed, x0, y0);
  const n10 = hash2(seed, x0 + 1, y0);
  const n01 = hash2(seed, x0, y0 + 1);
  const n11 = hash2(seed, x0 + 1, y0 + 1);

  const a = n00 + (n10 - n00) * sx;
  const b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sy;
}

/** 마을에 세울 건물들 (타일 단위 사각형) */
/**
 *  마을의 건물.
 *
 *  ★ 대장간(동쪽 위)만 단계에 따라 커집니다. 숫자로만 바뀌면 아무 일도 안 일어난 것과
 *    같습니다(기획안 5.3) — 자란 것이 실제로 화면에 커 보여야 합니다.
 *
 *  ★ 두린(21,9)과 화로(21,11)를 삼키지 않도록 아래로는 y=7 까지만 자랍니다.
 */
function townBuildings(stage: number) {
  //  ★ 단계마다 대장간이 커집니다. 자란 것이 눈에 안 보이면 아무 일도 안 일어난 것과
  //    같습니다 (기획안 5.3). 예전에는 2단계에서 멈춰서, 3·4단계를 올려도 마을이
  //    그대로였습니다 — 조용한 실패가 예약돼 있었습니다.
  //
  //  ★ 아래쪽으로는 y8 까지가 끝입니다. y9 에 대장장이 두린이 서 있고,
  //    y11 에 화로가 있습니다. 건물이 그 위를 덮으면 두린에게 말을 걸 수 없게 됩니다.
  //    옆으로는 x13~x26 이 한계입니다 (x7~12 가 상점 건물).
  const smithy =
    stage >= 4 ? { x: 14, y: 2, w: 12, h: 7 }
    : stage >= 3 ? { x: 15, y: 2, w: 10, h: 6 }
    : stage >= 2 ? { x: 16, y: 3, w: 8, h: 5 }
    : stage >= 1 ? { x: 17, y: 3, w: 7, h: 5 }
    : { x: 17, y: 4, w: 6, h: 4 };
  return [
    { x: 7, y: 4, w: 6, h: 4 },
    smithy,
    { x: 4, y: 12, w: 4, h: 5 },
    { x: 22, y: 12, w: 4, h: 5 },
  ];
}

/**
 *  다른 지도들이 이 지도의 어느 칸으로 내려놓는가.
 *
 *  ★ 문은 나가는 쪽 지도에만 적혀 있어서, 받는 쪽 지도는 자기 어디에 사람이
 *    떨어지는지 모릅니다. 그래서 여기서 한 번 훑습니다.
 */
function arrivalsInto(mapId: MapId): Array<{ tx: number; ty: number }> {
  const spots: Array<{ tx: number; ty: number }> = [];
  for (const other of Object.values(MAPS)) {
    for (const portal of other.portals) {
      if (portal.to === mapId) spots.push({ tx: portal.toTx, ty: portal.toTy });
    }
  }
  return spots;
}

/**
 *  물길을 놓습니다.
 *
 *  ★ 물은 못 지나갑니다. 그래서 물길은 지도를 두 쪽으로 가르고, 건너는 자리(여울)가
 *    곧 길목이 됩니다. 여울을 길찾기(carve)가 알아서 뚫어주기를 기다리지 않고
 *    ★ 데이터가 정한 자리에 손으로 놓습니다 — 저절로 되는 것에 기대면
 *    씨앗 하나 바뀔 때 여울이 엉뚱한 곳으로 갑니다.
 */
function carveRiver(map: MapRuntime, river: NonNullable<MapDef['river']>): void {
  const { def } = map;
  const half = river.width / 2;
  const centerAt = (ty: number) => river.x + Math.sin(ty / 5.5) * river.wobble;

  for (let ty = 1; ty < def.height - 1; ty++) {
    const cx = centerAt(ty);
    for (let tx = Math.round(cx - half); tx <= Math.round(cx + half); tx++) {
      if (tx <= 0 || tx >= def.width - 1) continue; // 바깥 테두리는 벽으로 둡니다
      set(map, tx, ty, LIQUID);
    }
  }

  // 여울 — 물길이 끊기고 바닥이 드러나는 세 줄
  for (let ty = river.fordY - 1; ty <= river.fordY + 1; ty++) {
    if (ty <= 0 || ty >= def.height - 1) continue;
    const cx = centerAt(ty);
    for (let tx = Math.round(cx - half) - 2; tx <= Math.round(cx + half) + 2; tx++) {
      if (tx <= 0 || tx >= def.width - 1) continue;
      set(map, tx, ty, FLOOR);
    }
  }
}

function set(map: MapRuntime, tx: number, ty: number, value: number): void {
  if (tx < 0 || ty < 0 || tx >= map.def.width || ty >= map.def.height) return;
  map.tiles[ty * map.def.width + tx] = value;
}

/** 어떤 칸 주변을 넓게 비웁니다 (문·NPC·입구 앞이 막히면 안 되므로) */
function clearAround(map: MapRuntime, tx: number, ty: number, radius: number): void {
  for (let y = ty - radius; y <= ty + radius; y++) {
    for (let x = tx - radius; x <= tx + radius; x++) {
      if (x <= 0 || y <= 0 || x >= map.def.width - 1 || y >= map.def.height - 1) continue;
      set(map, x, y, FLOOR);
    }
  }
}

/** 두 점 사이를 직선으로 뚫습니다 */
function carve(map: MapRuntime, ax: number, ay: number, bx: number, by: number): void {
  let x = ax;
  let y = ay;
  let guard = 0;
  while ((x !== bx || y !== by) && guard++ < 4000) {
    if (x !== bx) x += Math.sign(bx - x);
    else if (y !== by) y += Math.sign(by - y);
    clearAround(map, x, y, 1);
  }
}

/** 입구에서 걸어서 닿는 칸을 표시합니다 */
function reachableMask(map: MapRuntime, startTx: number, startTy: number): Uint8Array {
  const { width, height } = map.def;
  const seen = new Uint8Array(width * height);
  const queue: number[] = [startTy * width + startTx];
  seen[queue[0]!] = 1;

  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]!;
    const x = index % width;
    const y = (index - x) / width;
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (nx! < 0 || ny! < 0 || nx! >= width || ny! >= height) continue;
      const ni = ny! * width + nx!;
      if (seen[ni] || map.tiles[ni] !== FLOOR) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
}

/** 지역 하나의 지형을 만듭니다 */
export function buildMap(def: MapDef, stage = 0): MapRuntime {
  const map: MapRuntime = { def, tiles: new Uint8Array(def.width * def.height) };

  // 1) 바깥 테두리는 벽
  for (let x = 0; x < def.width; x++) {
    set(map, x, 0, WALL);
    set(map, x, def.height - 1, WALL);
  }
  for (let y = 0; y < def.height; y++) {
    set(map, 0, y, WALL);
    set(map, def.width - 1, y, WALL);
  }

  // 2) 안쪽 채우기
  if (def.theme === 'town') {
    for (const b of townBuildings(stage)) {
      for (let y = b.y; y < b.y + b.h; y++) {
        for (let x = b.x; x < b.x + b.w; x++) set(map, x, y, WALL);
      }
    }
  } else {
    // 잡음 값을 그냥 clutter 와 비교하면, 여러 겹을 더하는 순간 값이 가운데로 몰려서
    // 실제로는 나무가 거의 안 생깁니다. 그래서 값을 모아 정렬한 뒤
    // "아래에서 clutter 만큼"을 잘라 씁니다. clutter 0.15 면 정확히 15%가 막힙니다.
    const values: number[] = [];
    for (let y = 1; y < def.height - 1; y++) {
      for (let x = 1; x < def.width - 1; x++) {
        values.push(
          0.55 * valueNoise(def.seed, x / 5.5, y / 5.5) +
            0.3 * valueNoise(def.seed + 71, x / 2.5, y / 2.5) +
            0.15 * hash2(def.seed + 131, x, y),
        );
      }
    }
    const sorted = [...values].sort((a, b) => a - b);
    const propLimit = sorted[Math.floor(sorted.length * def.clutter)] ?? 0;
    const liquidLimit = sorted[Math.floor(sorted.length * def.clutter * 0.25)] ?? 0;

    let index = 0;
    for (let y = 1; y < def.height - 1; y++) {
      for (let x = 1; x < def.width - 1; x++) {
        const n = values[index++]!;
        if (n < liquidLimit) set(map, x, y, LIQUID);
        else if (n < propLimit) set(map, x, y, PROP);
      }
    }
  }

  // 3) 물길 — 지도를 세로로 가르고, ★ 건너는 자리는 손으로 놓습니다
  if (def.river) carveRiver(map, def.river);

  // 4) 문·사람·입구 앞은 반드시 비워둡니다
  clearAround(map, def.entryTx, def.entryTy, 2);
  for (const portal of def.portals) clearAround(map, portal.tx, portal.ty, 2);
  for (const npc of def.npcs) clearAround(map, npc.tx, npc.ty, 2);
  //  ★ 놓여 있던 것도 비웁니다. 안 그러면 바위 속에 떨어져서 못 줍습니다 —
  //    아무 말도 없이 그냥 못 줍는 것이라 알아채기가 어렵습니다.
  for (const relic of def.relics ?? []) clearAround(map, relic.tx, relic.ty, 1);
  // ★ 다른 지도에서 이리로 내려놓는 칸도 비웁니다.
  //   예전에는 도착 칸이 어쩌다 문 옆(clearAround 반경 안)이라 우연히 걸을 수 있었을 뿐이고,
  //   문을 하나만 옮겨도 나무 한가운데에 떨어질 수 있었습니다.
  for (const spot of arrivalsInto(def.id)) clearAround(map, spot.tx, spot.ty, 2);

  // 5) 입구에서 모든 문·도착 칸까지 실제로 걸어갈 수 있는지 확인하고, 막혔으면 길을 냅니다
  let mask = reachableMask(map, def.entryTx, def.entryTy);
  const mustReach = [
    ...def.portals.map((p) => ({ tx: p.tx, ty: p.ty })),
    ...(def.relics ?? []).map((r) => ({ tx: r.tx, ty: r.ty })),
    ...arrivalsInto(def.id),
  ];
  for (const spot of mustReach) {
    if (!mask[spot.ty * def.width + spot.tx]) {
      carve(map, def.entryTx, def.entryTy, spot.tx, spot.ty);
      mask = reachableMask(map, def.entryTx, def.entryTy);
    }
  }
  for (const npc of def.npcs) {
    if (!mask[npc.ty * def.width + npc.tx]) {
      carve(map, def.entryTx, def.entryTy, npc.tx, npc.ty);
      mask = reachableMask(map, def.entryTx, def.entryTy);
    }
  }

  // 5) 걸어서 닿지 않는 빈 칸은 아예 막아버립니다 — 거기 몬스터가 태어나면 영영 못 잡습니다
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] === FLOOR && !mask[i]) map.tiles[i] = PROP;
  }

  return map;
}

/* ===========================================================================
 *  자리 찾기와 몬스터 배치
 * ======================================================================== */

/** 걸어다닐 수 있는 빈 칸을 하나 찾습니다. 조건에 맞는 곳을 못 찾으면 입구를 돌려줍니다 */
export function findOpenTile(
  world: World,
  filter?: (tx: number, ty: number) => boolean,
): { tx: number; ty: number } {
  const { def } = world.map;
  for (let attempt = 0; attempt < 400; attempt++) {
    const tx = randInt(world, 1, def.width - 2);
    const ty = randInt(world, 1, def.height - 2);
    if (tileBlocked(world.map, tx, ty)) continue;
    if (filter && !filter(tx, ty)) continue;
    return { tx, ty };
  }
  return { tx: def.entryTx, ty: def.entryTy };
}

function makeMonster(world: World, defId: string, tx: number, ty: number): Monster {
  const def = monsterDef(defId);
  const pos = { x: tileCenter(tx), y: tileCenter(ty) };
  return {
    id: world.nextId++,
    defId,
    pos,
    home: { x: pos.x, y: pos.y },
    hp: def.hp,
    maxHp: def.hp,
    state: 'idle',
    attackCooldown: 0,
    hitFlash: 0,
    aggroUntil: 0,
    respawnIn: 0,
    wanderTarget: null,
    wanderTimer: nextRandom(world) * AI.wanderInterval,
    path: [],
    pathTimer: 0,
    anim: nextRandom(world) * 10,
    moving: false,
    swing: 0,
    facing: nextRandom(world) * Math.PI * 2,
  };
}

/**
 * 지금 지역에 몬스터와 광맥을 놓습니다.
 *
 * ★ 깊이가 곧 위험이자 보상입니다.
 *   입구에서 멀수록 사나운 것이 살고, 좋은 광맥이 있습니다.
 *   그래서 "어디까지 들어갈 것인가"가 이 게임의 판단이 됩니다.
 */
export function populate(world: World): void {
  const { def } = world.map;
  world.monsters = [];
  world.veins = [];

  const depthFrom = (tx: number, ty: number) => Math.hypot(tx - def.entryTx, ty - def.entryTy);

  for (const spawn of def.spawns) {
    for (let i = 0; i < spawn.count; i++) {
      const spot = findOpenTile(world, (tx, ty) => depthFrom(tx, ty) >= spawn.minDepth);
      world.monsters.push(makeMonster(world, spawn.monsterId, spot.tx, spot.ty));
    }
  }

  for (const patch of def.veins) {
    const vdef = veinDef(patch.veinId);
    for (let i = 0; i < patch.count; i++) {
      // 광맥은 바위 옆에 붙어 있어야 광맥처럼 보입니다
      const spot = findOpenTile(world, (tx, ty) => {
        if (depthFrom(tx, ty) < patch.minDepth) return false;
        return (
          tileBlocked(world.map, tx + 1, ty) ||
          tileBlocked(world.map, tx - 1, ty) ||
          tileBlocked(world.map, tx, ty + 1) ||
          tileBlocked(world.map, tx, ty - 1)
        );
      });
      world.veins.push({
        id: world.nextId++,
        defId: patch.veinId,
        pos: { x: tileCenter(spot.tx), y: tileCenter(spot.ty) },
        remaining: vdef.capacity,
        respawnIn: 0,
      });
    }
  }
}

/** 지금 지역의 바닥을 보관함에 넣습니다 (빈 지역은 자리를 차지하지 않습니다) */
function stashGround(world: World): void {
  const alive = world.ground.filter((item) => item.until === null || world.time < item.until);
  if (alive.length > 0) world.stash[world.mapId] = alive;
  else delete world.stash[world.mapId];
}

/** 그 지역에 놓여 있던 것을 꺼냅니다. 그사이 수명이 다한 것은 버립니다 */
function takeStashed(world: World, mapId: MapId): GroundItem[] {
  const kept = (world.stash[mapId] ?? []).filter(
    (item) => item.until === null || world.time < item.until,
  );
  delete world.stash[mapId];
  return kept;
}

/**
 *  이 문을 지금 지날 수 있는가.
 *
 *  ★ 판정을 여기 한 곳에만 둡니다. 문마다 흩어놓으면 어떤 문은 검사하고
 *    어떤 문은 안 하는 상태가 됩니다 — 그리고 그건 아무도 모릅니다.
 *
 *  돌려주는 값: 못 지나가는 이유 한 줄, 지날 수 있으면 null.
 *  ★ 이유에는 무엇이 부족한지 적지 않습니다. 궁금한 채로 두는 것이 목적입니다.
 */
/**
 *  이 문에 이름을 붙입니다 — 한 번 연 문을 기억하려고.
 *  ★ 문에 id 를 새로 달지 않습니다. 자리가 곧 이름입니다.
 */
export function portalId(mapId: MapId, portal: Portal): string {
  return `${mapId}:${portal.tx},${portal.ty}`;
}

/**
 *  이 문이 왜 안 열리는가. null 이면 열린다.
 *
 *  ★ 한 번 연 문은 다시 안 닫힙니다 (목적지-기획안 3.2 "층을 뚫으면 그 길이
 *    열린 채로 남는다"). 매번 검사하면 조건을 채운 장비를 팔았을 때 도로 닫히고,
 *    그러면 "뚫었다" 가 아니라 "지금 마침 되는 것" 이 됩니다.
 */
export function portalProblem(world: World, portal: Portal): string | null {
  const needs = portal.needs;
  if (!needs) return null;
  if (world.me.opened.includes(portalId(world.mapId, portal))) return null;

  // 봉인 — 조건이 없으니 말할 것도 없습니다 (전체설계 4.3)
  if (needs.sealed) return needs.closed;

  if (needs.gear !== undefined) {
    const have = gearScore(world.me);
    if (have < needs.gear) {
      //  ★ 왜 안 되는지 숫자로 말합니다 (6장). 감출 것은 문 너머에 무엇이 있는가지,
      //    문이 왜 안 열리는가가 아닙니다.
      return `${needs.closed} 입은 것이 모자랍니다 (지금 ${have.toFixed(1)} / 필요 ${needs.gear})`;
    }
  }
  return null;
}

/**
 *  마을에서 조건 걸린 문 없이 걸어서 닿는 지역들.
 *
 *  ★ 그 지역의 문이 열려 있는가가 아니라 **들어오는 문이 열려 있는가**입니다.
 *    2층은 자기 문(위층으로)이 열려 있지만, 들어오는 문에 조건이 걸려 있습니다.
 *  ★ 한 칸이 아니라 이어서 봅니다 — 나중에 2층 너머에 지역이 생겨도 맞습니다.
 */
export function openRegions(): Set<MapId> {
  const found = new Set<MapId>(['town']);
  for (let pass = 0; pass < MAP_ORDER.length; pass++) {
    for (const id of MAP_ORDER) {
      if (!found.has(id)) continue;
      for (const portal of mapDef(id).portals) {
        if (!portal.needs) found.add(portal.to);
      }
    }
  }
  return found;
}

/** 이 문을 연 것으로 남깁니다 — 두 번 적지 않습니다 */
export function markOpened(world: World, portal: Portal): void {
  if (!portal.needs) return;
  const id = portalId(world.mapId, portal);
  if (!world.me.opened.includes(id)) world.me.opened.push(id);
}

/** 다른 지역으로 옮겨갑니다 */
export function enterMap(world: World, mapId: MapId, tx: number, ty: number): void {
  //  ★ 떠나기 전에 바닥을 챙겨 둡니다. 예전에는 그냥 비웠고, 그래서 놓아둔 것이
  //    지역을 옮기는 순간 사라졌습니다 — "돌아왔을 때 남아 있을까" 가 언제나 '아니오' 였습니다.
  stashGround(world);
  world.mapId = mapId;
  world.map = buildMap(mapDef(mapId), stageOf(world.me.town));
  world.me.pos = { x: tileCenter(tx), y: tileCenter(ty) };
  world.me.moveTarget = null;
  world.me.targetId = null;
  world.me.action = null;
  world.path = [];
  world.pathTimer = 0;
  world.ground = takeStashed(world, mapId);
  world.floaters = [];
  world.vfx = [];
  world.pendingNpc = null;
  populate(world);

  //  ★ 처음 온 자리에는 놓여 있던 것을 깔아 둡니다. 두 번째부터는 안 놓습니다 —
  //    안 주웠으면 바닥에 그대로 있고(stash 가 들고 있습니다), 주웠으면 없습니다.
  //    discovered 가 "처음인가" 를 이미 알고 있어서 새로 저장할 것이 없습니다.
  if (!world.me.discovered.includes(mapId)) {
    world.me.discovered.push(mapId);
    layRelics(world);
  }
}

/** 그 자리에 원래 놓여 있던 것 — 시간이 지나도 안 사라집니다 */
function layRelics(world: World): void {
  for (const relic of world.map.def.relics ?? []) {
    world.ground.push({
      id: world.nextId++,
      defId: relic.defId,
      count: 1,
      pos: { x: tileCenter(relic.tx), y: tileCenter(relic.ty) },
      // ★ 사람이 놓은 것이 아니라 원래 있던 것이라 삭지 않습니다
      until: null,
    });
  }
}

/* ===========================================================================
 *  길찾기
 *  ---------------------------------------------------------------------------
 *  목표를 향해 그냥 직진하면, 사이에 바위가 하나만 있어도 거기 붙어서 멈춥니다.
 *  (실제로 그 버그가 있었습니다 — 자동 사냥이 150초 동안 바위를 밀고 있었습니다.)
 *
 *  그래서 타일 격자 위에서 너비 우선 탐색으로 길을 찾고,
 *  찾은 길에서 곧장 갈 수 있는 구간은 이어 붙여 꺾이는 지점만 남깁니다.
 *  맵이 커야 50×40 칸이라 이 계산은 눈 깜짝할 사이에 끝납니다.
 * ======================================================================== */

/** a 에서 b 까지 벽에 걸리지 않고 곧장 갈 수 있는가 */
export function lineOfSight(map: MapRuntime, ax: number, ay: number, bx: number, by: number, r: number): boolean {
  const distance = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(distance / 6);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blockedAt(map, ax + (bx - ax) * t, ay + (by - ay) * t, r)) return false;
  }
  return true;
}

/** 목표 칸이 막혀 있으면, 그 근처에서 설 수 있는 칸을 찾습니다 */
function nearestOpenTile(map: MapRuntime, tx: number, ty: number): { tx: number; ty: number } | null {
  if (!tileBlocked(map, tx, ty)) return { tx, ty };

  for (let ring = 1; ring <= 6; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        if (!tileBlocked(map, tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
      }
    }
  }
  return null;
}

/**
 * from 에서 to 까지 걸어갈 길을 구합니다.
 * 곧장 갈 수 있으면 목적지 하나만, 돌아가야 하면 꺾이는 지점들을 돌려줍니다.
 * 길이 아예 없으면 null.
 */
export function findPath(map: MapRuntime, from: Vec2, to: Vec2, radius: number): Vec2[] | null {
  if (lineOfSight(map, from.x, from.y, to.x, to.y, radius)) return [{ x: to.x, y: to.y }];

  const { width, height } = map.def;
  const startTx = Math.floor(from.x / TILE);
  const startTy = Math.floor(from.y / TILE);

  const goal = nearestOpenTile(map, Math.floor(to.x / TILE), Math.floor(to.y / TILE));
  if (!goal) return null;
  if (tileBlocked(map, startTx, startTy)) return null;

  const start = startTy * width + startTx;
  const target = goal.ty * width + goal.tx;
  if (start === target) return [{ x: to.x, y: to.y }];

  const cameFrom = new Int32Array(width * height).fill(-1);
  cameFrom[start] = start;
  const queue = [start];

  // 대각선으로 질러가되, 모서리를 뚫고 지나가지는 않습니다
  const moves = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  let found = false;
  for (let head = 0; head < queue.length && !found; head++) {
    const index = queue[head]!;
    const x = index % width;
    const y = (index - x) / width;

    for (const [dx, dy] of moves) {
      const nx = x + dx!;
      const ny = y + dy!;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const next = ny * width + nx;
      if (cameFrom[next] !== -1 || tileBlocked(map, nx, ny)) continue;
      // 대각선은 양옆이 뚫려 있을 때만
      if (dx !== 0 && dy !== 0 && (tileBlocked(map, x + dx!, y) || tileBlocked(map, x, y + dy!))) continue;

      cameFrom[next] = index;
      if (next === target) {
        found = true;
        break;
      }
      queue.push(next);
    }
  }
  if (!found) return null;

  // 되짚어 올라가며 길을 만듭니다
  const tiles: Vec2[] = [];
  for (let index = target; index !== start; index = cameFrom[index]!) {
    const x = index % width;
    const y = (index - x) / width;
    tiles.unshift({ x: tileCenter(x), y: tileCenter(y) });
  }
  // 마지막은 칸 한가운데가 아니라 실제로 누른 자리로
  if (!tileBlocked(map, Math.floor(to.x / TILE), Math.floor(to.y / TILE))) {
    tiles[tiles.length - 1] = { x: to.x, y: to.y };
  }

  // 곧장 갈 수 있는 구간은 건너뜁니다 — 안 그러면 칸을 따라 계단처럼 걷습니다
  const path: Vec2[] = [];
  let cursor = { x: from.x, y: from.y };
  let i = 0;
  while (i < tiles.length) {
    let farthest = i;
    for (let j = tiles.length - 1; j > i; j--) {
      if (lineOfSight(map, cursor.x, cursor.y, tiles[j]!.x, tiles[j]!.y, radius)) {
        farthest = j;
        break;
      }
    }
    path.push(tiles[farthest]!);
    cursor = tiles[farthest]!;
    i = farthest + 1;
  }
  return path;
}
