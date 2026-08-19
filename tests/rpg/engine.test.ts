/**
 *  실제로 굴려보기.
 *
 *  규칙 하나하나가 맞아도, 몇 분을 이어서 돌리면 어긋나는 것들이 있습니다 —
 *  벽에 박히거나, 좌표가 NaN 이 되거나, 잡을 몬스터가 바닥나거나, 효과 목록이 끝없이 쌓이거나.
 *  여기서는 자동 사냥을 켜둔 채 몇 분 치를 돌려보고 그런 것들이 없는지 확인합니다.
 */

import { describe, expect, it } from 'vitest';

import { PLAYER_RADIUS, TILE } from '../../src/rpg/balance';
import { mapDef } from '../../src/rpg/content/maps';
import { monsterDef } from '../../src/rpg/content/monsters';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { itemDef } from '../../src/rpg/content/items';
import { addItem, buyItem } from '../../src/rpg/core/inventory';
import { blockedAt, enterMap, tileCenter } from '../../src/rpg/core/world';
import { derive } from '../../src/rpg/core/stats';
import type { World } from '../../src/rpg/types';

const DT = 1 / 20;

/** 초 단위로 시간을 흘려보냅니다 */
function run(world: World, seconds: number, watch?: (world: World) => void): void {
  for (let i = 0; i < seconds / DT; i++) {
    step(world, DT);
    watch?.(world);
  }
}

function huntingGround(seed = 20250819): World {
  const world = createWorld('사냥꾼', 'knight');
  world.seed = seed;
  world.player.auto = true;
  buyItem(world, 'pot-hp-s', 10);
  enterMap(world, 'field', mapDef('field').entryTx, mapDef('field').entryTy);
  world.player.auto = true;
  return world;
}

describe('자동 사냥으로 3분', () => {
  const world = huntingGround();
  let sawDeadMonster = false;
  let sawRespawn = false;
  let deadCount = 0;

  run(world, 180, (w) => {
    // 매 순간 지켜야 할 것들
    expect(Number.isFinite(w.player.pos.x) && Number.isFinite(w.player.pos.y)).toBe(true);
    expect(Number.isFinite(w.player.hp)).toBe(true);
    expect(blockedAt(w.map, w.player.pos.x, w.player.pos.y, PLAYER_RADIUS), '벽 속으로 들어갔습니다').toBe(false);

    const now = w.monsters.filter((m) => m.state === 'dead').length;
    if (now > 0) sawDeadMonster = true;
    if (now < deadCount) sawRespawn = true;
    deadCount = now;
  });

  it('스스로 몬스터를 잡는다', () => {
    expect(sawDeadMonster).toBe(true);
    expect(Object.values(world.player.kills).reduce((a, b) => a + b, 0)).toBeGreaterThan(3);
  });

  it('경험치가 쌓여 레벨이 오른다', () => {
    expect(world.player.level).toBeGreaterThan(1);
  });

  it('잡은 몬스터가 다시 나타난다 — 사냥터가 비지 않는다', () => {
    expect(sawRespawn).toBe(true);
    expect(world.monsters.filter((m) => m.state !== 'dead').length).toBeGreaterThan(3);
  });

  it('체력과 마나가 범위를 벗어나지 않는다', () => {
    const stats = derive(world.player);
    expect(world.player.hp).toBeLessThanOrEqual(stats.maxHp);
    expect(world.player.mp).toBeLessThanOrEqual(stats.maxMp);
    expect(world.player.mp).toBeGreaterThanOrEqual(0);
  });

  it('화면 효과와 기록이 무한정 쌓이지 않는다', () => {
    expect(world.floaters.length).toBeLessThan(120);
    expect(world.vfx.length).toBeLessThan(400);
    expect(world.log.length).toBeLessThanOrEqual(60);
    expect(world.ground.length).toBeLessThan(80);
  });

  it('몬스터도 벽 속에 박히지 않는다', () => {
    for (const monster of world.monsters) {
      if (monster.state === 'dead') continue;
      const def = monsterDef(monster.defId);
      expect(Number.isFinite(monster.pos.x)).toBe(true);
      expect(blockedAt(world.map, monster.pos.x, monster.pos.y, def.size * 0.5), `${def.name}`).toBe(false);
    }
  });
});

describe('자동 사냥의 판단', () => {
  it('체력이 절반 아래로 내려가면 알아서 물약을 마신다', () => {
    const world = huntingGround(31337);
    addItem(world, 'pot-hp', 20);

    const countPotions = () =>
      world.player.inventory
        .filter((s) => itemDef(s.defId).healHp)
        .reduce((total, s) => total + s.count, 0);

    const before = countPotions();
    world.player.hp = derive(world.player).maxHp * 0.2;

    run(world, 3);

    // 어느 물약을 마실지는 '덜 남기는 쪽'으로 알아서 고릅니다
    expect(countPotions()).toBeLessThan(before);
    expect(world.player.hp).toBeGreaterThan(derive(world.player).maxHp * 0.2);
  });

  it('보스에게는 스스로 덤비지 않는다', () => {
    const world = createWorld('사냥꾼', 'knight');
    world.seed = 99;
    enterMap(world, 'canyon', mapDef('canyon').entryTx, mapDef('canyon').entryTy);
    world.player.auto = true;

    const boss = world.monsters.find((m) => monsterDef(m.defId).boss)!;
    run(world, 60);

    expect(world.player.targetId, '자동 사냥이 보스를 노렸습니다').not.toBe(boss.id);
    expect(boss.hp).toBe(boss.maxHp);
  });

  it('꺼두면 아무것도 하지 않는다', () => {
    const world = huntingGround(7);
    world.player.auto = false;
    world.player.targetId = null;
    const where = { ...world.player.pos };

    run(world, 20);

    expect(world.player.pos.x).toBeCloseTo(where.x, 5);
    expect(world.player.pos.y).toBeCloseTo(where.y, 5);
    expect(Object.keys(world.player.kills)).toHaveLength(0);
  });
});

describe('싸움이 끝난 몬스터', () => {
  it('체력을 회복한다 — 조금씩 깎아놓고 도망가는 수법을 막습니다', () => {
    const world = createWorld('시험', 'knight');
    world.seed = 5150;
    enterMap(world, 'field', mapDef('field').entryTx, mapDef('field').entryTy);

    const monster = world.monsters.find((m) => m.defId === 'wolf')!;
    monster.pos = { x: monster.home.x, y: monster.home.y };
    monster.hp = monster.maxHp * 0.2;

    // 플레이어를 멀리 치워두고 시간을 흘립니다
    world.player.pos = { x: tileCenter(mapDef('field').entryTx), y: tileCenter(mapDef('field').entryTy) };
    world.player.auto = false;
    monster.aggroUntil = 0;

    run(world, 20);

    expect(monster.hp).toBeGreaterThan(monster.maxHp * 0.5);
    expect(monster.hp).toBeLessThanOrEqual(monster.maxHp);
  });
});

describe('지역 이동', () => {
  it('문을 밟으면 다음 지역으로 넘어간다', () => {
    const world = createWorld('시험', 'knight');
    world.player.auto = false;

    const portal = mapDef('town').portals[0]!;
    world.player.moveTarget = { x: tileCenter(portal.tx), y: tileCenter(portal.ty) };

    run(world, 20);

    expect(world.mapId).toBe(portal.to);
    expect(world.player.discovered).toContain(portal.to);
  });

  it('넘어간 직후에는 문 위에 서 있지 않는다 — 곧바로 되돌아가면 안 됩니다', () => {
    const world = createWorld('시험', 'knight');
    world.player.auto = false;
    const portal = mapDef('town').portals[0]!;
    world.player.moveTarget = { x: tileCenter(portal.tx), y: tileCenter(portal.ty) };
    run(world, 20);

    const back = world.map.def.portals.find((p) => p.to === 'town')!;
    const distance = Math.hypot(
      tileCenter(back.tx) - world.player.pos.x,
      tileCenter(back.ty) - world.player.pos.y,
    );
    expect(distance).toBeGreaterThan(TILE * 0.7);
  });
});

describe('오래 꺼두었다 다시 켰을 때', () => {
  it('한 번에 큰 시간이 들어와도 순간이동하지 않는다', () => {
    const world = huntingGround(4242);
    world.player.auto = false;
    world.player.targetId = null;
    world.player.moveTarget = { x: world.player.pos.x + 4000, y: world.player.pos.y };
    const before = { ...world.player.pos };

    step(world, 30); // 30초가 한 번에 흘렀다고 치면

    const moved = Math.hypot(world.player.pos.x - before.x, world.player.pos.y - before.y);
    expect(moved, '한 번에 너무 멀리 갔습니다').toBeLessThan(TILE * 3);
    expect(blockedAt(world.map, world.player.pos.x, world.player.pos.y, PLAYER_RADIUS)).toBe(false);
  });
});
