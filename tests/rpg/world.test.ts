/**
 *  지형.
 *
 *  지도는 저장하지 않고 씨앗으로 매번 만들어냅니다. 그래서 두 가지가 반드시 참이어야 합니다.
 *      1) 같은 씨앗이면 언제나 같은 지도가 나온다 (안 그러면 저장했다 켤 때 벽 속에 갇힙니다)
 *      2) 입구에서 모든 문·사람·몬스터에게 걸어서 닿는다 (안 그러면 못 잡는 몬스터가 생깁니다)
 */

import { describe, expect, it } from 'vitest';

import { PLAYER_RADIUS, TILE } from '../../src/rpg/balance';
import { MAPS, mapDef } from '../../src/rpg/content/maps';
import { monsterDef } from '../../src/rpg/content/monsters';
import { createWorld } from '../../src/rpg/core/create';
import { blockedAt, buildMap, enterMap, findPath, lineOfSight, slideMove, tileBlocked, tileCenter } from '../../src/rpg/core/world';
import type { MapRuntime } from '../../src/rpg/types';

/** 입구에서 걸어서 닿는 칸을 전부 표시합니다 (게임 코드와 별개로 여기서 다시 구합니다) */
function walkable(map: MapRuntime, startTx: number, startTy: number): Set<number> {
  const { width, height } = map.def;
  const seen = new Set<number>([startTy * width + startTx]);
  const queue = [[startTx, startTy]];

  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x! + 1, y!], [x! - 1, y!], [x!, y! + 1], [x!, y! - 1]]) {
      if (nx! < 0 || ny! < 0 || nx! >= width || ny! >= height) continue;
      const index = ny! * width + nx!;
      if (seen.has(index) || tileBlocked(map, nx!, ny!)) continue;
      seen.add(index);
      queue.push([nx!, ny!]);
    }
  }
  return seen;
}

describe.each(Object.values(MAPS))('$name', (def) => {
  const map = buildMap(def);
  const reachable = walkable(map, def.entryTx, def.entryTy);

  it('같은 씨앗이면 똑같은 지도가 나온다', () => {
    expect(Array.from(buildMap(def).tiles)).toEqual(Array.from(map.tiles));
  });

  it('바깥 테두리가 벽으로 막혀 있다', () => {
    for (let x = 0; x < def.width; x++) {
      expect(tileBlocked(map, x, 0)).toBe(true);
      expect(tileBlocked(map, x, def.height - 1)).toBe(true);
    }
    for (let y = 0; y < def.height; y++) {
      expect(tileBlocked(map, 0, y)).toBe(true);
      expect(tileBlocked(map, def.width - 1, y)).toBe(true);
    }
  });

  it('입구에 설 수 있다', () => {
    expect(tileBlocked(map, def.entryTx, def.entryTy)).toBe(false);
  });

  it('입구에서 모든 문까지 걸어갈 수 있다', () => {
    for (const portal of def.portals) {
      expect(
        reachable.has(portal.ty * def.width + portal.tx),
        `${def.name} 의 ${portal.label} 문에 닿을 수 없습니다`,
      ).toBe(true);
    }
  });

  it('입구에서 모든 사람에게 걸어갈 수 있다', () => {
    for (const npc of def.npcs) {
      expect(reachable.has(npc.ty * def.width + npc.tx), `${npc.name} 에게 닿을 수 없습니다`).toBe(true);
    }
  });

  it('걸어서 닿지 않는 빈 칸이 하나도 남아 있지 않다', () => {
    let stranded = 0;
    for (let ty = 0; ty < def.height; ty++) {
      for (let tx = 0; tx < def.width; tx++) {
        if (tileBlocked(map, tx, ty)) continue;
        if (!reachable.has(ty * def.width + tx)) stranded += 1;
      }
    }
    expect(stranded, `${def.name} 에 갇힌 칸이 ${stranded} 개 있습니다`).toBe(0);
  });

  it('막힌 칸이 지나치게 많지 않다 (돌아다닐 자리는 남아야 합니다)', () => {
    const blocked = Array.from(map.tiles).filter((t) => t !== 0).length;
    expect(blocked / map.tiles.length).toBeLessThan(0.45);
  });
});

describe('몬스터 배치', () => {
  it('전부 걸어갈 수 있는 자리에 태어난다', () => {
    for (const id of ['forest', 'mine']) {
      const world = createWorld('시험', 'miner');
      world.seed = 20250819;
      enterMap(world, id, mapDef(id).entryTx, mapDef(id).entryTy);

      const reachable = walkable(world.map, mapDef(id).entryTx, mapDef(id).entryTy);
      expect(world.monsters.length, `${id} 에 몬스터가 없습니다`).toBeGreaterThan(0);

      for (const monster of world.monsters) {
        const tx = Math.floor(monster.pos.x / TILE);
        const ty = Math.floor(monster.pos.y / TILE);
        expect(
          reachable.has(ty * world.map.def.width + tx),
          `${id} 의 ${monsterDef(monster.defId).name} 이(가) 닿을 수 없는 곳에 있습니다`,
        ).toBe(true);
      }
    }
  });

  it('사나운 것은 깊은 곳에만 있다 — 들어서자마자 거미를 만나면 안 됩니다', () => {
    const world = createWorld('시험', 'miner');
    world.seed = 777;
    enterMap(world, 'mine', mapDef('mine').entryTx, mapDef('mine').entryTy);

    const entryX = tileCenter(mapDef('mine').entryTx);
    const entryY = tileCenter(mapDef('mine').entryTy);

    for (const monster of world.monsters.filter((m) => m.defId === 'cave-spider')) {
      const depth = Math.hypot(monster.pos.x - entryX, monster.pos.y - entryY) / TILE;
      expect(depth, '거미가 입구 근처에 있습니다').toBeGreaterThanOrEqual(20);
    }
  });

  it('좋은 광맥일수록 깊은 곳에 있다', () => {
    const world = createWorld('시험', 'miner');
    world.seed = 4242;
    enterMap(world, 'mine', mapDef('mine').entryTx, mapDef('mine').entryTy);

    const entryX = tileCenter(mapDef('mine').entryTx);
    const entryY = tileCenter(mapDef('mine').entryTy);
    const depthOf = (v: { pos: { x: number; y: number } }) =>
      Math.hypot(v.pos.x - entryX, v.pos.y - entryY) / TILE;

    const shallow = world.veins.filter((v) => v.defId === 'iron-shallow').map(depthOf);
    const deep = world.veins.filter((v) => v.defId === 'copper-deep').map(depthOf);

    expect(shallow.length).toBeGreaterThan(0);
    expect(deep.length).toBeGreaterThan(0);
    expect(Math.min(...deep), '구리 광맥이 철광맥보다 얕은 곳에 있습니다').toBeGreaterThan(Math.min(...shallow));
  });

  it('마을에는 몬스터가 없다', () => {
    const world = createWorld('시험', 'miner');
    expect(world.mapId).toBe('town');
    expect(world.monsters).toHaveLength(0);
  });
});

describe('이동과 벽', () => {
  it('벽을 뚫고 지나갈 수 없다', () => {
    const world = createWorld('시험', 'miner');
    const map = world.map;

    // 벽으로 둘러싸인 칸을 찾아 그쪽으로 계속 밀어봅니다
    for (let step = 0; step < 400; step++) {
      slideMove(map, world.me.pos, 6, 0, PLAYER_RADIUS);
      slideMove(map, world.me.pos, 0, 6, PLAYER_RADIUS);
      expect(blockedAt(map, world.me.pos.x, world.me.pos.y, PLAYER_RADIUS)).toBe(false);
    }
  });

  it('한 축이 막혀도 다른 축으로는 미끄러진다', () => {
    const world = createWorld('시험', 'miner');
    const before = { ...world.me.pos };

    // 위쪽 벽에 대각선으로 밀어붙이면, 벽에 걸려도 옆으로는 나아가야 합니다
    for (let i = 0; i < 60; i++) slideMove(world.map, world.me.pos, 4, -4, PLAYER_RADIUS);

    expect(world.me.pos.x).toBeGreaterThan(before.x);
  });
});

describe('지역 이동', () => {
  it('넘어가면 몬스터가 새로 배치되고, 그 지역 바닥은 눈앞에서 치워진다', () => {
    const world = createWorld('시험', 'miner');
    world.ground.push({
      id: 1, defId: 'potion-heal', count: 1,
      pos: { x: 0, y: 0 }, until: world.time + 10,
    });

    enterMap(world, 'forest', 5, 18);

    expect(world.mapId).toBe('forest');
    expect(world.ground, '새 지역에 옛 지역 물건이 따라왔습니다').toHaveLength(0);
    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.me.moveTarget).toBeNull();
    expect(world.me.targetId).toBeNull();
  });

  it('★ 치워진 것이지 없어진 것이 아니다 — 돌아오면 그대로 있다', () => {
    //  ★ 예전에는 enterMap 이 바닥을 그냥 비웠습니다. 그래서 놓아둔 것이
    //    지역을 옮기는 순간 사라졌고, "돌아왔을 때 남아 있을까" 가 언제나 '아니오' 였습니다.
    const world = createWorld('시험', 'miner');
    world.ground.push({
      id: 1, defId: 'potion-heal', count: 1,
      pos: { x: 0, y: 0 }, until: null, placed: true,
    });

    enterMap(world, 'forest', 5, 18);
    expect(world.ground).toHaveLength(0);

    enterMap(world, 'town', 15, 13);
    expect(world.ground, '놓아둔 것이 사라졌습니다').toHaveLength(1);
    expect(world.ground[0]!.defId).toBe('potion-heal');
  });

  it('다른 지역에 가 있는 동안에도 수명은 흐른다', () => {
    const world = createWorld('시험', 'miner');
    world.ground.push({
      id: 1, defId: 'potion-heal', count: 1,
      pos: { x: 0, y: 0 }, until: world.time + 60, placed: true,
    });

    enterMap(world, 'forest', 5, 18);
    world.time += 120;               // 숲에서 2분을 보냅니다
    enterMap(world, 'town', 15, 13);

    expect(world.ground, '내가 안 보는 동안 시간이 멈춰 있었습니다').toHaveLength(0);
  });

  it('처음 간 곳은 순간이동 목록에 남는다', () => {
    const world = createWorld('시험', 'miner');
    expect(world.me.discovered).toEqual(['town']);

    enterMap(world, 'forest', 5, 18);
    enterMap(world, 'forest', 5, 18);

    expect(world.me.discovered).toEqual(['town', 'forest']);
  });
});


describe('길찾기', () => {
  /**
   *  길찾기가 없던 시절, 자동 사냥이 바위 뒤 몬스터를 향해 직진하다가
   *  150초 동안 벽을 밀고 서 있던 적이 있습니다. 그 일이 다시 없도록 지킵니다.
   */
  const world = createWorld('시험', 'miner');

  it('곧장 갈 수 있으면 목적지 하나만 돌려준다', () => {
    enterMap(world, 'town', mapDef('town').entryTx, mapDef('town').entryTy);
    const to = { x: world.me.pos.x + TILE, y: world.me.pos.y };

    const path = findPath(world.map, world.me.pos, to, PLAYER_RADIUS)!;
    expect(path).toHaveLength(1);
    expect(path[0]).toEqual(to);
  });

  it('막힌 곳은 돌아가는 길을 찾아준다', () => {
    enterMap(world, 'mine', mapDef('mine').entryTx, mapDef('mine').entryTy);

    // 곧장은 못 가지만 걸어서는 닿는 자리를 찾습니다
    let detours = 0;
    for (const monster of world.monsters) {
      if (lineOfSight(world.map, world.me.pos.x, world.me.pos.y, monster.pos.x, monster.pos.y, PLAYER_RADIUS)) {
        continue;
      }
      const path = findPath(world.map, world.me.pos, monster.pos, PLAYER_RADIUS);
      expect(path, '걸어서 닿는 몬스터인데 길을 못 찾았습니다').not.toBeNull();
      expect(path!.length, '돌아가는 길인데 꺾이는 지점이 없습니다').toBeGreaterThan(1);
      detours += 1;
    }
    expect(detours, '가려진 몬스터가 하나도 없어 시험이 되지 않았습니다').toBeGreaterThan(0);
  });

  it('길 위의 모든 구간을 벽에 걸리지 않고 지날 수 있다', () => {
    enterMap(world, 'mine', mapDef('mine').entryTx, mapDef('mine').entryTy);

    for (const monster of world.monsters.slice(0, 8)) {
      const path = findPath(world.map, world.me.pos, monster.pos, PLAYER_RADIUS);
      if (!path) continue;

      let from = world.me.pos;
      for (const point of path) {
        expect(
          lineOfSight(world.map, from.x, from.y, point.x, point.y, PLAYER_RADIUS),
          '길 한 구간이 벽을 뚫고 지나갑니다',
        ).toBe(true);
        from = point;
      }
    }
  });

  it('벽 한가운데로 가라고 하면 그 앞까지만 안내한다', () => {
    enterMap(world, 'town', mapDef('town').entryTx, mapDef('town').entryTy);

    // 마을 건물 한가운데 (지붕 속)
    const inside = { x: tileCenter(9), y: tileCenter(5) };
    expect(tileBlocked(world.map, 9, 5)).toBe(true);

    const path = findPath(world.map, world.me.pos, inside, PLAYER_RADIUS);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1]!;
    expect(blockedAt(world.map, last.x, last.y, PLAYER_RADIUS), '벽 속을 목적지로 삼았습니다').toBe(false);
  });
});
