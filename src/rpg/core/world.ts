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
import { mapDef } from '../content/maps';
import { monsterDef } from '../content/monsters';
import { hash2, nextRandom, randInt } from './rng';
import { veinDef } from '../content/veins';
import type { MapDef, MapId, MapRuntime, Monster, Vec2, World } from '../types';

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
const TOWN_BUILDINGS = [
  { x: 7, y: 4, w: 6, h: 4 },
  { x: 17, y: 4, w: 6, h: 4 },
  { x: 4, y: 12, w: 4, h: 5 },
  { x: 22, y: 12, w: 4, h: 5 },
];

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
export function buildMap(def: MapDef): MapRuntime {
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
    for (const b of TOWN_BUILDINGS) {
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

  // 3) 문·사람·입구 앞은 반드시 비워둡니다
  clearAround(map, def.entryTx, def.entryTy, 2);
  for (const portal of def.portals) clearAround(map, portal.tx, portal.ty, 2);
  for (const npc of def.npcs) clearAround(map, npc.tx, npc.ty, 2);

  // 4) 입구에서 모든 문까지 실제로 걸어갈 수 있는지 확인하고, 막혔으면 길을 냅니다
  let mask = reachableMask(map, def.entryTx, def.entryTy);
  for (const portal of def.portals) {
    if (!mask[portal.ty * def.width + portal.tx]) {
      carve(map, def.entryTx, def.entryTy, portal.tx, portal.ty);
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

/** 다른 지역으로 옮겨갑니다 */
export function enterMap(world: World, mapId: MapId, tx: number, ty: number): void {
  world.mapId = mapId;
  world.map = buildMap(mapDef(mapId));
  world.me.pos = { x: tileCenter(tx), y: tileCenter(ty) };
  world.me.moveTarget = null;
  world.me.targetId = null;
  world.me.action = null;
  world.path = [];
  world.pathTimer = 0;
  world.ground = [];
  world.floaters = [];
  world.vfx = [];
  world.pendingNpc = null;
  populate(world);

  if (!world.me.discovered.includes(mapId)) world.me.discovered.push(mapId);
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
