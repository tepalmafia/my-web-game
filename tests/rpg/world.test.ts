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
    for (const id of ['field', 'canyon', 'mine', 'fortress', 'nest']) {
      const world = createWorld('시험', 'knight');
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

  it('보스는 입구에서 멀리 떨어져 있다 — 들어서자마자 만나면 안 됩니다', () => {
    const world = createWorld('시험', 'knight');
    world.seed = 777;
    enterMap(world, 'nest', mapDef('nest').entryTx, mapDef('nest').entryTy);

    const boss = world.monsters.find((m) => monsterDef(m.defId).boss)!;
    const entryX = tileCenter(mapDef('nest').entryTx);
    const entryY = tileCenter(mapDef('nest').entryTy);

    expect(Math.hypot(boss.pos.x - entryX, boss.pos.y - entryY)).toBeGreaterThan(20 * TILE);
  });

  it('마을에는 몬스터가 없다', () => {
    const world = createWorld('시험', 'knight');
    expect(world.mapId).toBe('town');
    expect(world.monsters).toHaveLength(0);
  });
});

describe('이동과 벽', () => {
  it('벽을 뚫고 지나갈 수 없다', () => {
    const world = createWorld('시험', 'knight');
    const map = world.map;

    // 벽으로 둘러싸인 칸을 찾아 그쪽으로 계속 밀어봅니다
    for (let step = 0; step < 400; step++) {
      slideMove(map, world.player.pos, 6, 0, PLAYER_RADIUS);
      slideMove(map, world.player.pos, 0, 6, PLAYER_RADIUS);
      expect(blockedAt(map, world.player.pos.x, world.player.pos.y, PLAYER_RADIUS)).toBe(false);
    }
  });

  it('한 축이 막혀도 다른 축으로는 미끄러진다', () => {
    const world = createWorld('시험', 'knight');
    const before = { ...world.player.pos };

    // 위쪽 벽에 대각선으로 밀어붙이면, 벽에 걸려도 옆으로는 나아가야 합니다
    for (let i = 0; i < 60; i++) slideMove(world.map, world.player.pos, 4, -4, PLAYER_RADIUS);

    expect(world.player.pos.x).toBeGreaterThan(before.x);
  });
});

describe('지역 이동', () => {
  it('넘어가면 몬스터가 새로 배치되고 바닥의 물건은 정리된다', () => {
    const world = createWorld('시험', 'knight');
    world.ground.push({ id: 1, defId: 'pot-hp', plus: 0, count: 1, pos: { x: 0, y: 0 }, life: 10 });

    enterMap(world, 'field', 4, 18);

    expect(world.mapId).toBe('field');
    expect(world.ground).toHaveLength(0);
    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.player.moveTarget).toBeNull();
    expect(world.player.targetId).toBeNull();
  });

  it('처음 간 곳은 순간이동 목록에 남는다', () => {
    const world = createWorld('시험', 'knight');
    expect(world.player.discovered).toEqual(['town']);

    enterMap(world, 'field', 4, 18);
    enterMap(world, 'field', 4, 18);

    expect(world.player.discovered).toEqual(['town', 'field']);
  });
});


describe('길찾기', () => {
  /**
   *  길찾기가 없던 시절, 자동 사냥이 바위 뒤 몬스터를 향해 직진하다가
   *  150초 동안 벽을 밀고 서 있던 적이 있습니다. 그 일이 다시 없도록 지킵니다.
   */
  const world = createWorld('시험', 'knight');

  it('곧장 갈 수 있으면 목적지 하나만 돌려준다', () => {
    enterMap(world, 'town', mapDef('town').entryTx, mapDef('town').entryTy);
    const to = { x: world.player.pos.x + TILE, y: world.player.pos.y };

    const path = findPath(world.map, world.player.pos, to, PLAYER_RADIUS)!;
    expect(path).toHaveLength(1);
    expect(path[0]).toEqual(to);
  });

  it('막힌 곳은 돌아가는 길을 찾아준다', () => {
    enterMap(world, 'mine', mapDef('mine').entryTx, mapDef('mine').entryTy);

    // 곧장은 못 가지만 걸어서는 닿는 자리를 찾습니다
    let detours = 0;
    for (const monster of world.monsters) {
      if (lineOfSight(world.map, world.player.pos.x, world.player.pos.y, monster.pos.x, monster.pos.y, PLAYER_RADIUS)) {
        continue;
      }
      const path = findPath(world.map, world.player.pos, monster.pos, PLAYER_RADIUS);
      expect(path, '걸어서 닿는 몬스터인데 길을 못 찾았습니다').not.toBeNull();
      expect(path!.length, '돌아가는 길인데 꺾이는 지점이 없습니다').toBeGreaterThan(1);
      detours += 1;
    }
    expect(detours, '가려진 몬스터가 하나도 없어 시험이 되지 않았습니다').toBeGreaterThan(0);
  });

  it('길 위의 모든 구간을 벽에 걸리지 않고 지날 수 있다', () => {
    enterMap(world, 'canyon', mapDef('canyon').entryTx, mapDef('canyon').entryTy);

    for (const monster of world.monsters.slice(0, 8)) {
      const path = findPath(world.map, world.player.pos, monster.pos, PLAYER_RADIUS);
      if (!path) continue;

      let from = world.player.pos;
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

    const path = findPath(world.map, world.player.pos, inside, PLAYER_RADIUS);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1]!;
    expect(blockedAt(world.map, last.x, last.y, PLAYER_RADIUS), '벽 속을 목적지로 삼았습니다').toBe(false);
  });
});
