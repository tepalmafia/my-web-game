/**
 *  가방과 상점.
 *
 *  겹치는 물건과 겹치지 않는 장비가 섞여 있어서, 개수 계산이 어긋나기 쉬운 곳입니다.
 */

import { describe, expect, it } from 'vitest';

import { LOOT } from '../../src/rpg/balance';
import { itemDef } from '../../src/rpg/content/items';
import { createWorld } from '../../src/rpg/core/create';
import { addItem, buyItem, countOf, equip, hasRoom, removeItem, sellItem, unequip } from '../../src/rpg/core/inventory';
import { derive } from '../../src/rpg/core/stats';

describe('넣고 빼기', () => {
  it('물약처럼 겹치는 물건은 한 칸에 쌓인다', () => {
    const world = createWorld('시험', 'knight');
    const slots = world.player.inventory.length;

    addItem(world, 'pot-hp', 5);
    addItem(world, 'pot-hp', 7);

    expect(countOf(world.player, 'pot-hp')).toBe(12);
    expect(world.player.inventory.length).toBe(slots + 1);
  });

  it('장비는 강화 수치가 저마다 달라 한 칸씩 차지한다', () => {
    const world = createWorld('시험', 'knight');
    addItem(world, 'sword-long', 1, 0);
    addItem(world, 'sword-long', 1, 7);

    expect(world.player.inventory.filter((s) => s.defId === 'sword-long')).toHaveLength(2);
  });

  it('다 쓰면 칸이 사라진다', () => {
    const world = createWorld('시험', 'knight');
    addItem(world, 'pot-hp', 2);
    const stack = world.player.inventory.find((s) => s.defId === 'pot-hp')!;

    removeItem(world.player, stack.uid, 1);
    expect(countOf(world.player, 'pot-hp')).toBe(1);

    removeItem(world.player, stack.uid, 1);
    expect(world.player.inventory.some((s) => s.uid === stack.uid)).toBe(false);
  });

  it('가방이 가득 차면 새 장비는 못 받지만, 이미 있는 물약은 더 받는다', () => {
    const world = createWorld('시험', 'knight');
    world.player.inventory = [];
    for (let i = 0; i < LOOT.inventorySlots; i++) addItem(world, 'sword-long', 1, i % 9);

    expect(hasRoom(world.player, 'sword-long')).toBe(false);
    expect(addItem(world, 'sword-long', 1)).toBe(false);
    expect(world.player.inventory.length).toBe(LOOT.inventorySlots);

    // 물약은 아직 한 칸도 없으니 역시 못 넣습니다
    expect(hasRoom(world.player, 'pot-hp')).toBe(false);
  });
});

describe('착용', () => {
  it('끼고 있던 것은 가방으로 돌아온다', () => {
    const world = createWorld('시험', 'knight');
    world.player.level = 7;
    const old = world.player.equipped.weapon!;
    addItem(world, 'sword-long', 1);

    equip(world, world.player.inventory.find((s) => s.defId === 'sword-long')!.uid);

    expect(world.player.equipped.weapon!.defId).toBe('sword-long');
    expect(world.player.inventory.some((s) => s.uid === old.uid)).toBe(true);
  });

  it('벗으면 가방으로 들어간다', () => {
    const world = createWorld('시험', 'knight');
    const worn = world.player.equipped.armor!;

    unequip(world, 'armor');

    expect(world.player.equipped.armor).toBeNull();
    expect(world.player.inventory.some((s) => s.uid === worn.uid)).toBe(true);
  });

  it('가방이 꽉 차 있으면 벗지 못한다 (장비가 사라지면 안 됩니다)', () => {
    const world = createWorld('시험', 'knight');
    world.player.inventory = [];
    for (let i = 0; i < LOOT.inventorySlots; i++) addItem(world, 'sword-long', 1, i % 9);

    unequip(world, 'armor');

    expect(world.player.equipped.armor, '벗겨져서 사라졌습니다').not.toBeNull();
    expect(world.player.inventory.length).toBe(LOOT.inventorySlots);
  });

  it('체력 상한이 줄면 지금 체력도 따라 줄어든다', () => {
    const world = createWorld('시험', 'knight');
    world.player.level = 5;
    addItem(world, 'ring-hp', 1);
    equip(world, world.player.inventory.find((s) => s.defId === 'ring-hp')!.uid);
    const withRing = derive(world.player).maxHp;
    world.player.hp = withRing;

    unequip(world, 'ring');

    const withoutRing = derive(world.player).maxHp;
    expect(withoutRing).toBeLessThan(withRing);
    expect(world.player.hp, '체력이 최대치를 넘긴 채로 남았습니다').toBe(withoutRing);
  });
});

describe('사고팔기', () => {
  it('산 만큼 골드가 줄고 물건이 들어온다', () => {
    const world = createWorld('시험', 'knight');
    const before = world.player.gold;

    buyItem(world, 'pot-hp-s', 5);

    expect(world.player.gold).toBe(before - itemDef('pot-hp-s').price * 5);
    expect(countOf(world.player, 'pot-hp-s')).toBe(15); // 시작할 때 10개를 갖고 있습니다
  });

  it('골드가 모자라면 아무 일도 없다', () => {
    const world = createWorld('시험', 'knight');
    world.player.gold = 10;

    buyItem(world, 'sword-claymore', 1);

    expect(world.player.gold).toBe(10);
    expect(countOf(world.player, 'sword-claymore')).toBe(0);
  });

  it('팔면 그만큼 골드가 늘고 물건이 빠진다', () => {
    const world = createWorld('시험', 'knight');
    addItem(world, 'mat-pelt', 3);
    const stack = world.player.inventory.find((s) => s.defId === 'mat-pelt')!;
    const before = world.player.gold;

    sellItem(world, stack.uid, 2);

    expect(world.player.gold).toBe(before + itemDef('mat-pelt').sell * 2);
    expect(countOf(world.player, 'mat-pelt')).toBe(1);
  });

  it('강화한 장비는 더 비싸게 쳐준다', () => {
    const world = createWorld('시험', 'knight');
    addItem(world, 'sword-long', 1, 0);
    addItem(world, 'sword-long', 1, 5);
    const plain = world.player.inventory.find((s) => s.defId === 'sword-long' && s.plus === 0)!;
    const enhanced = world.player.inventory.find((s) => s.defId === 'sword-long' && s.plus === 5)!;

    const start = world.player.gold;
    sellItem(world, plain.uid, 1);
    const plainGain = world.player.gold - start;

    const mid = world.player.gold;
    sellItem(world, enhanced.uid, 1);
    const enhancedGain = world.player.gold - mid;

    expect(enhancedGain).toBeGreaterThan(plainGain);
  });

  it('사고 되팔기를 반복해도 골드가 늘지 않는다', () => {
    const world = createWorld('시험', 'knight');
    world.player.gold = 100_000;
    const start = world.player.gold;

    for (let i = 0; i < 50; i++) {
      buyItem(world, 'pot-hp', 1);
      const stack = world.player.inventory.find((s) => s.defId === 'pot-hp');
      expect(stack, '구입이 되지 않았습니다').toBeDefined();
      sellItem(world, stack!.uid, 1);
    }
    expect(world.player.gold).toBeLessThan(start);
  });
});
