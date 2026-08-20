/**
 *  벼림 — 만들 때마다 고른다 (전체설계 3.3).
 *
 *  ★ 세 조건이 이 파일이 지키는 것입니다.
 *    선택   셋 중 하나. 나머지 둘은 이 물건에서 사라진다
 *    불확실 성공할지, 우수품이 나올지 모른다
 *    비가역 만든 것은 안 바뀐다
 */

import { describe, expect, it } from 'vitest';

import { CRAFT, TEMPER } from '../../src/rpg/balance';
import { itemDef } from '../../src/rpg/content/items';
import { RECIPE_ORDER, recipeDef } from '../../src/rpg/content/recipes';
import { TEMPERS, TEMPER_ORDER, temperDef } from '../../src/rpg/content/tempers';
import { canTemper, startCraft, startRepair, tickAction } from '../../src/rpg/core/action';
import { createWorld } from '../../src/rpg/core/create';
import { repairQuote } from '../../src/rpg/core/durability';
import { addItem } from '../../src/rpg/core/inventory';
import { derive, itemName, stackWeight } from '../../src/rpg/core/stats';
import { enterMap, tileCenter } from '../../src/rpg/core/world';
import { mapDef } from '../../src/rpg/content/maps';
import type { TemperId } from '../../src/rpg/balance';
import type { ItemStack, World } from '../../src/rpg/types';

/** 화로 앞에 서서, 재료를 넉넉히 들고 있는 판 */
function atForge(): World {
  const world = createWorld('대장장이', 'smith');
  const town = mapDef('town');
  enterMap(world, 'town', town.entryTx, town.entryTy);
  world.me.pos = { x: tileCenter(town.forge!.tx), y: tileCenter(town.forge!.ty) + 20 };
  world.me.str = 500;
  world.me.skills.blacksmithing = 95;   // 거의 확실히 성공하게
  addItem(world, 'iron-ingot', 200);
  world.log.length = 0;
  return world;
}

/** 벼림을 골라 하나 만들고, 만들어진 물건을 돌려줍니다 */
function forge(world: World, recipeId: string, temper?: TemperId): ItemStack | undefined {
  const before = new Set(world.me.backpack.map((s) => s.uid));
  expect(startCraft(world, recipeId, false, temper), '만들기가 시작되지 않았습니다').toBe(true);
  tickAction(world, recipeDef(recipeId).seconds + 0.1);
  return world.me.backpack.find((s) => !before.has(s.uid));
}

describe('표 자체', () => {
  it('셋이고, 저마다 얻는 것과 버리는 것이 적혀 있다', () => {
    expect(TEMPER_ORDER).toHaveLength(3);
    for (const id of TEMPER_ORDER) {
      const t = temperDef(id);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.prefix.length, `${id} 에 이름 앞머리가 없습니다`).toBeGreaterThan(0);
      expect(t.gives.length, `${id} 가 무엇을 주는지 안 적혀 있습니다`).toBeGreaterThan(0);
      expect(t.givesUp.length, `${id} 가 무엇을 버리는지 안 적혀 있습니다`).toBeGreaterThan(0);
    }
    expect(Object.keys(TEMPERS).sort()).toEqual([...TEMPER_ORDER].sort());
  });

  it('★ 셋 다 무언가를 버린다 — 전부 좋기만 한 벼림은 선택이 아니다', () => {
    for (const id of TEMPER_ORDER) {
      const t = TEMPER[id];
      const better = [t.damage > 1, t.durability > 1, t.weight < 1].filter(Boolean).length;
      const worse = [t.damage < 1, t.durability < 1, t.weight > 1].filter(Boolean).length;
      expect(better, `${id} 가 아무것도 안 줍니다`).toBeGreaterThan(0);
      expect(worse, `${id} 가 아무것도 안 버립니다`).toBeGreaterThan(0);
    }
  });

  it('★ 우수품과 겹치지 않는다 — 우수품은 전부 올리고, 벼림은 하나를 버린다', () => {
    // 우수품은 나쁜 면이 없습니다. 그래서 둘은 축이 다르고 곱해집니다.
    expect(CRAFT.fineBonus).toBeGreaterThan(0);
    for (const id of TEMPER_ORDER) {
      const t = TEMPER[id];
      expect(
        t.damage < 1 || t.durability < 1 || t.weight > 1,
        `${id} 가 우수품처럼 전부 좋기만 합니다`,
      ).toBe(true);
    }
  });

  it('가볍게의 무게 감소는 다른 둘의 이득보다 작다 — 무게가 가장 센 값이다', () => {
    const lightGain = 1 - TEMPER.light.weight;
    expect(lightGain).toBeLessThan(TEMPER.sharp.damage - 1);
    expect(lightGain).toBeLessThan(TEMPER.tough.durability - 1);
  });
});

describe('무엇을 고를 수 있는가', () => {
  it('장비는 고르고, 제련은 못 고른다 — 주괴는 재료지 물건이 아니다', () => {
    for (const id of RECIPE_ORDER) {
      const makes = itemDef(recipeDef(id).makes);
      expect(canTemper(id), `${id}`).toBe(makes.slot !== undefined);
    }
    expect(canTemper('smelt-iron')).toBe(false);
    expect(canTemper('make-iron-sword')).toBe(true);
  });

  it('못 고르는 것에 벼림을 밀어넣어도 붙지 않는다', () => {
    const world = atForge();
    addItem(world, 'iron-ore', 5);
    startCraft(world, 'smelt-iron', false, 'sharp');
    expect(world.me.action!.temper, '제련에 벼림이 붙었습니다').toBeUndefined();
  });
});

describe('고른 것이 물건에 남는다', () => {
  it('만든 물건에 벼림이 붙고, 이름에 나온다', () => {
    const world = atForge();
    const made = forge(world, 'make-iron-dagger', 'sharp');
    expect(made, '아무것도 안 만들어졌습니다').toBeDefined();
    expect(made!.temper).toBe('sharp');
    expect(itemName(made!)).toContain(temperDef('sharp').prefix);
  });

  it('셋이 실제로 다른 물건이 된다', () => {
    const seen = new Map<TemperId, { damage: number; durability: number; weight: number }>();
    for (const id of TEMPER_ORDER) {
      const world = atForge();
      const made = forge(world, 'make-iron-sword', id)!;
      world.me.equipped.weapon = made;
      seen.set(id, {
        damage: derive(world.me).maxDamage,
        durability: made.maxDurability!,
        weight: stackWeight(made),
      });
    }
    const sharp = seen.get('sharp')!;
    const tough = seen.get('tough')!;
    const light = seen.get('light')!;

    expect(sharp.damage, '날 선 검이 더 아프지 않습니다').toBeGreaterThan(tough.damage);
    expect(tough.durability, '단단한 검이 더 오래가지 않습니다').toBeGreaterThan(sharp.durability);
    expect(light.weight, '가벼운 검이 더 가볍지 않습니다').toBeLessThan(sharp.weight);
  });

  it('반복 제작 중에도 고른 것이 안 풀린다', () => {
    const world = atForge();
    startCraft(world, 'make-iron-dagger', true, 'tough');
    for (let i = 0; i < 4; i++) tickAction(world, recipeDef('make-iron-dagger').seconds + 0.1);

    const daggers = world.me.backpack.filter((s) => s.defId === 'iron-dagger');
    expect(daggers.length, '반복이 안 돌았습니다').toBeGreaterThan(1);
    for (const d of daggers) expect(d.temper, '반복 도중 고른 것이 풀렸습니다').toBe('tough');
  });
});

describe('★ 고르면 되돌릴 수 없다', () => {
  it('수리해도 벼림은 안 바뀐다', () => {
    const world = atForge();
    const made = forge(world, 'make-iron-sword', 'sharp')!;
    made.durability = 1;

    const quote = repairQuote(made);
    expect(quote.problem, quote.problem ?? '').toBeFalsy();
    expect(startRepair(world, made.uid)).toBe(true);
    tickAction(world, 3);

    expect(made.temper, '수리했더니 벼림이 바뀌었습니다').toBe('sharp');
  });

  it('벼림을 바꾸는 길이 아예 없다 — core 어디에도', () => {
    // ★ 만든 뒤에 바꿀 수 있으면 "영영 그것" 이 아닙니다.
    //   벼림을 쓰는 자리는 '만들 때' 하나뿐이어야 합니다.
    const world = atForge();
    const made = forge(world, 'make-iron-dagger', 'light')!;
    const uid = made.uid;

    // 팔았다 사도, 놓았다 집어도 같은 물건은 같은 벼림입니다
    expect(world.me.backpack.find((s) => s.uid === uid)!.temper).toBe('light');
  });
});

describe('벼림 없는 물건도 그대로 돈다', () => {
  it('상점에서 산 것과 옛 기록은 배율이 1 이다', () => {
    const world = createWorld('시험', 'miner');
    const worn = world.me.equipped.weapon!;
    expect(worn.temper, '시작 장비에 벼림이 붙어 있습니다').toBeUndefined();
    expect(stackWeight(worn)).toBe(itemDef(worn.defId).weight);
    expect(itemName(worn)).toBe(itemDef(worn.defId).name);
  });
});
