/**
 *  실제로 겪은 고장들.
 *
 *  ★ 둘 다 "조용히" 망가지던 것들입니다. 화면에는 아무 일도 없는 것처럼 보이는데
 *    한쪽은 아무것도 캘 수 없었고, 한쪽은 재료가 사라지면서 '완성'이라고 적혔습니다.
 *    그래서 여기 못 박아 둡니다.
 */

import { describe, expect, it } from 'vitest';

import { LOOT } from '../../src/rpg/balance';
import { mapDef } from '../../src/rpg/content/maps';
import { startCraft, startMining, tickAction } from '../../src/rpg/core/action';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { clickWorld } from '../../src/rpg/core/commands';
import { addItem, buyItem, canCarry, countOf } from '../../src/rpg/core/inventory';
import { enterMap, tileCenter } from '../../src/rpg/core/world';
import type { World } from '../../src/rpg/types';

const DT = 1 / 20;
const forge = mapDef('town').forge!;

function inForest(seed = 11): World {
  const world = createWorld('시험', 'miner');
  world.seed = seed;
  enterMap(world, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);
  return world;
}

function atForge(seed = 11): World {
  const world = createWorld('시험', 'smith');
  world.seed = seed;
  world.me.pos = { x: tileCenter(forge.tx), y: tileCenter(forge.ty) + 20 };
  return world;
}

/** 가방 칸을 끝까지 채웁니다 (겹치지 않는 물건으로) */
function fillPack(world: World): void {
  world.me.str = 100;
  while (world.me.backpack.length < LOOT.packSlots) {
    world.me.backpack.push({
      uid: world.nextId++, defId: 'rusty-sword', count: 1, durability: 40, maxDurability: 40,
    });
  }
}

describe('노리는 대상이 있어도 하던 일은 이어진다', () => {
  it('대상 바로 옆에 서 있으면 캘 수 있다', () => {
    // ★ 예전에는 movePlayer 가 함수 맨 위에서 무조건 취소해서, 노리는 것이
    //   하나라도 있으면 채광·제작·수리를 시작조차 할 수 없었습니다.
    const world = inForest();
    const vein = world.veins.find((v) => v.remaining > 0)!;
    world.me.pos = { x: vein.pos.x, y: vein.pos.y + 20 };
    world.me.skills.mining = 60;

    const monster = world.monsters[0]!;
    monster.pos = { x: world.me.pos.x + 8, y: world.me.pos.y };
    monster.aggroUntil = 0;
    world.me.targetId = monster.id;

    expect(startMining(world, vein.id, true)).toBe(true);
    for (let i = 0; i < 200 && world.me.action; i++) tickAction(world, DT);
    expect(countOf(world.me, 'iron-ore'), '노리는 대상 옆에서 캐지 못했습니다').toBeGreaterThan(0);
  });

  it('벽에 막혀 한 발도 못 떼면 하던 일이 끊기지 않는다', () => {
    const world = atForge();
    addItem(world, 'iron-ore', 2);
    // 지도 밖을 향해 걷게 두면 벽에 막혀 제자리입니다
    world.me.moveTarget = { x: -500, y: world.me.pos.y };

    expect(startCraft(world, 'smelt-iron', false)).toBe(true);
    for (let i = 0; i < 10; i++) step(world, DT);
    expect(world.me.action, '움직이지도 못했는데 하던 일이 끊겼습니다').not.toBeNull();
  });

  it('실제로 걸어가면 하던 일은 끊긴다', () => {
    // 이건 그대로여야 합니다 — 땅을 눌러 걸어가면 캐던 것을 멈춥니다
    const world = atForge();
    addItem(world, 'iron-ore', 2);
    startCraft(world, 'smelt-iron', false);
    world.me.moveTarget = { x: world.me.pos.x + 200, y: world.me.pos.y };

    for (let i = 0; i < 20; i++) step(world, DT);
    expect(world.me.action).toBeNull();
  });
});

describe('가방에 자리가 없을 때', () => {
  it('제련해도 재료가 사라지지 않는다', () => {
    // ★ 예전에는 광석만 사라지고 기록에 "완성" 이라고 적혔습니다
    const world = atForge();
    addItem(world, 'iron-ore', 3);
    fillPack(world);

    const before = countOf(world.me, 'iron-ore');
    startCraft(world, 'smelt-iron', false);
    for (let i = 0; i < 100 && world.me.action; i++) step(world, DT);

    expect(countOf(world.me, 'iron-ore'), '재료가 사라졌습니다').toBe(before);
    expect(world.me.tally['iron-ingot'] ?? 0, '만들지도 않았는데 기록에 올랐습니다').toBe(0);
    expect(world.log.some((l) => l.text.includes('완성')), '못 만들었는데 완성이라고 적혔습니다').toBe(false);
  });

  it('캐도 광맥이 줄지 않는다', () => {
    const world = inForest();
    const vein = world.veins.find((v) => v.remaining > 0)!;
    world.me.pos = { x: vein.pos.x, y: vein.pos.y + 20 };
    world.me.skills.mining = 60;
    fillPack(world);

    const remaining = vein.remaining;
    startMining(world, vein.id, true);
    for (let i = 0; i < 100 && world.me.action; i++) tickAction(world, DT);

    expect(vein.remaining, '못 담았는데 광맥만 줄었습니다').toBe(remaining);
    expect(world.me.tally['iron-ore'] ?? 0).toBe(0);
  });

  it('상점에서 사도 골드가 사라지지 않는다', () => {
    const world = atForge();
    fillPack(world);
    world.me.gold = 1000;

    buyItem(world, 'pickaxe', 1);
    expect(world.me.gold, '물건은 안 오고 골드만 빠졌습니다').toBe(1000);
  });

  it('canCarry 가 칸까지 본다', () => {
    const world = atForge();
    fillPack(world);
    // 가벼워도 넣을 칸이 없습니다
    expect(canCarry(world.me, 'iron-ingot', 1)).toBe(false);
    // 이미 더미가 있는 물건은 얹으면 되므로 칸이 필요 없습니다
    addItem(world, 'potion-heal', 1);
    world.me.backpack.push({ uid: world.nextId++, defId: 'potion-heal', count: 1 });
    expect(canCarry(world.me, 'potion-heal', 1)).toBe(true);
  });
});

describe('광맥 위에 몬스터가 서 있을 때 무엇을 누른 것인가', () => {
  /** 광맥 하나와 그 옆에 몬스터 하나를 세워 둡니다 */
  function scene(gap: number) {
    const world = inForest();
    const vein = world.veins.find((v) => v.remaining > 0)!;
    const monster = world.monsters[0]!;
    monster.pos = { x: vein.pos.x + gap, y: vein.pos.y };
    monster.state = 'idle';
    world.me.pos = { x: vein.pos.x, y: vein.pos.y + 60 };
    world.me.targetId = null;
    return { world, vein, monster };
  }

  it('광맥 한가운데를 누르면 광맥이다 — 몬스터가 25px 옆에 있어도', () => {
    // ★ 예전에는 몬스터를 무조건 먼저 봐서(반경 26px) 광맥을 누를 방법이 없었습니다
    const { world, vein, monster } = scene(25);
    clickWorld(world, vein.pos.x, vein.pos.y);

    expect(world.me.targetId, '몬스터가 대상이 되었습니다').toBeNull();
    expect(world.me.moveTarget, '광맥 쪽으로 걸어가지 않습니다').not.toBeNull();
    void monster;
  });

  it('몬스터를 직접 누르면 몬스터다 — 광맥 앞을 막고 서 있어도', () => {
    const { world, monster } = scene(20);
    clickWorld(world, monster.pos.x, monster.pos.y);

    expect(world.me.targetId).toBe(monster.id);
  });

  it('둘 다 멀면 그냥 그리로 걸어간다', () => {
    const { world, vein } = scene(25);
    const far = { x: vein.pos.x + 200, y: vein.pos.y + 200 };
    clickWorld(world, far.x, far.y);

    expect(world.me.targetId).toBeNull();
    expect(world.me.moveTarget).toEqual(far);
  });
});
