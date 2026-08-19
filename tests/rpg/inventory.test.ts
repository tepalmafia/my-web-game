/**
 *  가방과 무게.
 *
 *  ★ 이 게임에서 가방의 진짜 제약은 칸이 아니라 무게입니다.
 *    "몇 덩이까지 지고 갈까"를 계속 재게 만드는 것이 이 규칙의 목적이므로,
 *    무게가 실제로 사람을 붙잡는지 여기서 확인합니다.
 */

import { describe, expect, it } from 'vitest';

import { WEIGHT, carryCapacity } from '../../src/rpg/balance';
import { itemDef } from '../../src/rpg/content/items';
import { createWorld } from '../../src/rpg/core/create';
import {
  addItem, buyItem, canCarry, consume, countOf, equip, freeWeight, removeItem, sellItem, unequip,
} from '../../src/rpg/core/inventory';
import { derive, loadPenalty, totalWeight } from '../../src/rpg/core/stats';

describe('무게', () => {
  it('소지 상한은 힘에서 나온다', () => {
    const world = createWorld('시험', 'miner');
    expect(derive(world.me).carry).toBe(carryCapacity(world.me.str));

    world.me.str = 100;
    expect(derive(world.me).carry).toBeGreaterThan(carryCapacity(20));
  });

  it('입은 것도 무게에 들어간다', () => {
    const world = createWorld('시험', 'guard');
    const before = totalWeight(world.me);

    unequip(world, 'armor');
    // 벗어도 가방으로 가므로 총 무게는 그대로여야 합니다
    expect(totalWeight(world.me)).toBeCloseTo(before, 5);
  });

  it('들 수 없는 만큼은 받지 않는다', () => {
    const world = createWorld('시험', 'miner');
    const free = freeWeight(world.me);
    const oreWeight = itemDef('iron-ore').weight;
    const tooMany = Math.ceil(free / oreWeight) + 5;

    expect(canCarry(world.me, 'iron-ore', tooMany)).toBe(false);
    expect(addItem(world, 'iron-ore', tooMany)).toBe(false);
    expect(countOf(world.me, 'iron-ore')).toBe(0);
  });

  it('광석을 채우면 실제로 느려진다 — 왕복이 강제되는 이유', () => {
    const world = createWorld('시험', 'miner');
    const fast = derive(world.me).moveSpeed;

    // 들 수 있는 만큼 광석을 채웁니다
    while (canCarry(world.me, 'iron-ore', 1)) addItem(world, 'iron-ore', 1);

    const slow = derive(world.me).moveSpeed;
    expect(slow).toBeLessThan(fast);
    expect(slow / fast).toBeGreaterThan(1 - WEIGHT.maxSlow - 0.01);
  });

  it('절반까지는 가뿐하고, 그 위로 점점 느려진다', () => {
    expect(loadPenalty(10, 100)).toBe(0);
    expect(loadPenalty(50, 100)).toBe(0);
    expect(loadPenalty(75, 100)).toBeGreaterThan(0);
    expect(loadPenalty(100, 100)).toBeCloseTo(WEIGHT.maxSlow, 5);
  });
});

describe('넣고 빼기', () => {
  it('겹치는 물건은 한 칸에 쌓인다', () => {
    const world = createWorld('시험', 'miner');
    const slots = world.me.backpack.length;

    addItem(world, 'iron-ore', 2);
    addItem(world, 'iron-ore', 3);

    expect(countOf(world.me, 'iron-ore')).toBe(5);
    expect(world.me.backpack.length).toBe(slots + 1);
  });

  it('닳는 물건은 내구도를 달고 태어난다', () => {
    const world = createWorld('시험', 'miner');
    addItem(world, 'iron-dagger', 1);
    const dagger = world.me.backpack.find((s) => s.defId === 'iron-dagger')!;

    expect(dagger.durability).toBe(itemDef('iron-dagger').durability);
    expect(dagger.maxDurability).toBe(dagger.durability);
  });

  it('우수품은 내구도가 더 높다', () => {
    const world = createWorld('시험', 'miner');
    addItem(world, 'iron-sword', 1, { quality: 'fine' });
    const sword = world.me.backpack.find((s) => s.defId === 'iron-sword')!;

    expect(sword.quality).toBe('fine');
    expect(sword.maxDurability!).toBeGreaterThan(itemDef('iron-sword').durability!);
  });

  it('재료를 여러 칸에서 끌어모아 덜어낸다', () => {
    const world = createWorld('시험', 'miner');
    addItem(world, 'iron-ingot', 4);

    expect(consume(world.me, 'iron-ingot', 3)).toBe(true);
    expect(countOf(world.me, 'iron-ingot')).toBe(1);
    expect(consume(world.me, 'iron-ingot', 5)).toBe(false);
  });

  it('다 쓰면 칸이 사라진다', () => {
    const world = createWorld('시험', 'miner');
    addItem(world, 'iron-ore', 2);
    const stack = world.me.backpack.find((s) => s.defId === 'iron-ore')!;

    removeItem(world.me, stack.uid, 2);
    expect(world.me.backpack.some((s) => s.uid === stack.uid)).toBe(false);
  });
});

describe('착용', () => {
  it('레벨도 직업도 따지지 않는다 — 들 수만 있으면 낀다', () => {
    const world = createWorld('시험', 'miner');
    world.me.str = 100; // 무거운 갑옷을 들 수 있게
    addItem(world, 'copper-mail', 1);
    const mail = world.me.backpack.find((s) => s.defId === 'copper-mail')!;

    equip(world, mail.uid);
    expect(world.me.equipped.armor!.defId).toBe('copper-mail');
  });

  it('망가진 물건은 낄 수 없다', () => {
    const world = createWorld('시험', 'miner');
    addItem(world, 'iron-sword', 1);
    const sword = world.me.backpack.find((s) => s.defId === 'iron-sword')!;
    sword.durability = 0;

    equip(world, sword.uid);
    expect(world.me.equipped.weapon!.defId).not.toBe('iron-sword');
  });

  it('끼고 있던 것은 가방으로 돌아온다', () => {
    const world = createWorld('시험', 'guard');
    const old = world.me.equipped.weapon!;
    addItem(world, 'iron-dagger', 1);
    equip(world, world.me.backpack.find((s) => s.defId === 'iron-dagger')!.uid);

    expect(world.me.equipped.weapon!.defId).toBe('iron-dagger');
    expect(world.me.backpack.some((s) => s.uid === old.uid)).toBe(true);
  });
});

describe('사고팔기', () => {
  it('산 만큼 골드가 줄고 물건이 들어온다', () => {
    const world = createWorld('시험', 'miner');
    const before = world.me.gold;

    buyItem(world, 'potion-heal', 2);

    expect(world.me.gold).toBe(before - itemDef('potion-heal').price * 2);
    expect(countOf(world.me, 'potion-heal')).toBe(5); // 시작할 때 3개
  });

  it('무거워서 못 드는 것은 사지지 않는다', () => {
    const world = createWorld('시험', 'miner');
    world.me.gold = 999_999;
    while (canCarry(world.me, 'iron-ore', 1)) addItem(world, 'iron-ore', 1);
    const gold = world.me.gold;

    buyItem(world, 'pickaxe', 1);
    expect(world.me.gold).toBe(gold);
  });

  it('닳은 물건은 값이 깎인다', () => {
    const world = createWorld('시험', 'miner');
    world.me.str = 100; // 검 두 자루를 들 수 있게
    addItem(world, 'iron-sword', 1);
    addItem(world, 'iron-sword', 1);
    const [fresh, worn] = world.me.backpack.filter((s) => s.defId === 'iron-sword');
    worn!.durability = worn!.maxDurability! * 0.3;

    const start = world.me.gold;
    sellItem(world, fresh!.uid, 1);
    const freshGain = world.me.gold - start;

    const mid = world.me.gold;
    sellItem(world, worn!.uid, 1);
    const wornGain = world.me.gold - mid;

    expect(wornGain).toBeLessThan(freshGain);
  });

  it('사고 되팔기를 반복해도 골드가 늘지 않는다', () => {
    const world = createWorld('시험', 'miner');
    world.me.gold = 50_000;
    const start = world.me.gold;

    for (let i = 0; i < 30; i++) {
      buyItem(world, 'potion-heal', 1);
      const stack = world.me.backpack.find((s) => s.defId === 'potion-heal')!;
      sellItem(world, stack.uid, 1);
    }
    expect(world.me.gold).toBeLessThan(start);
  });
});

describe('입은 것의 무게', () => {
  it('착용해도 무게는 그대로 짐에 남는다', () => {
    // ★ 예전에는 착용하는 순간 그 물건의 count 가 0 이 되어 무게가 0 으로 셈해졌습니다.
    //   갑옷을 껴입어도 짐이 늘지 않아, 이 게임의 뼈대인 무게 규칙이 통째로 죽어 있었습니다.
    const world = createWorld('시험', 'miner');
    world.me.equipped.weapon = null;
    world.me.backpack = [];
    world.me.gold = 10_000;

    const before = totalWeight(world.me);
    addItem(world, 'leather-vest', 1);
    const carried = totalWeight(world.me);
    expect(carried).toBe(before + itemDef('leather-vest').weight);

    const vest = world.me.backpack.find((s) => s.defId === 'leather-vest')!;
    equip(world, vest.uid);

    expect(world.me.equipped.armor?.defId).toBe('leather-vest');
    expect(world.me.equipped.armor?.count, '입은 물건의 개수가 0 이 되었습니다').toBe(1);
    expect(totalWeight(world.me), '입으니 무게가 사라졌습니다').toBe(carried);
  });
});
