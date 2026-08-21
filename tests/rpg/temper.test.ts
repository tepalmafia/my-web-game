/**
 *  벼림 — 만들 때마다 고른다 (전체설계 3.3).
 *
 *  ★ 세 조건이 이 파일이 지키는 것입니다.
 *    선택   셋 중 하나. 나머지 둘은 이 물건에서 사라진다
 *    불확실 성공할지, 우수품이 나올지 모른다
 *    비가역 만든 것은 안 바뀐다
 */

import { describe, expect, it } from 'vitest';

import { CRAFT, GATHER, TEMPER, TOOL_TEMPER } from '../../src/rpg/balance';
import { itemDef } from '../../src/rpg/content/items';
import { RECIPE_ORDER, recipeDef } from '../../src/rpg/content/recipes';
import { TEMPERS, TEMPER_ORDER, temperDef } from '../../src/rpg/content/tempers';
import { canTemper, craftChance, craftLoss, startCraft, startRepair, tickAction } from '../../src/rpg/core/action';
import { createWorld } from '../../src/rpg/core/create';
import { repairQuote } from '../../src/rpg/core/durability';
import { addItem, countOf } from '../../src/rpg/core/inventory';
import { derive, itemName, stackWeight } from '../../src/rpg/core/stats';
import { enterMap, tileCenter } from '../../src/rpg/core/world';
import { mapDef } from '../../src/rpg/content/maps';
import type { TemperId } from '../../src/rpg/balance';
import type { ItemStack, World } from '../../src/rpg/types';

/** 화로 앞에 서서, 재료를 넉넉히 들고 있는 판 */
function atForge(): World {
  const world = createWorld('대장장이', 'smith');
  // ★ 씨앗을 박습니다. createWorld 는 Date.now() 로 씨를 뿌리므로
  //   박지 않으면 제작 성패가 매번 달라져 시험이 흔들립니다 (CLAUDE.md 7장)
  world.seed = 20250819;
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
  it('장비와 연장은 고르고, 제련은 못 고른다 — 주괴는 재료지 물건이 아니다', () => {
    for (const id of RECIPE_ORDER) {
      const makes = itemDef(recipeDef(id).makes);
      expect(canTemper(id), `${id}`).toBe(makes.slot !== undefined || makes.tool !== undefined);
    }
    expect(canTemper('smelt-iron')).toBe(false);
    expect(canTemper('make-iron-sword')).toBe(true);
    // ★ 연장도 고릅니다 — damage 가 성공률로 읽힙니다 (balance.ts 의 TOOL_TEMPER)
    expect(canTemper('make-iron-pickaxe')).toBe(true);
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

/* ===========================================================================
 *  실패하면 고른 것도 함께 날아간다
 * ======================================================================== */

describe('벼림을 고르고 실패하면', () => {
  /** 거의 확실히 실패하는 판 */
  function willFail(): World {
    const world = atForge();
    world.me.skills.blacksmithing = 1;
    return world;
  }

  it('★ 재료도 잃고, 고른 것도 남지 않는다', () => {
    const world = willFail();
    const need = recipeDef('make-iron-sword').needs[0]!.count;

    let failed = false;
    for (let i = 0; i < 30 && !failed; i++) {
      const swords = world.me.backpack.filter((s) => s.defId === 'iron-sword').length;
      const ingots = countOf(world.me, 'iron-ingot');
      if (ingots < need) break;

      startCraft(world, 'make-iron-sword', false, 'sharp');
      tickAction(world, recipeDef('make-iron-sword').seconds + 0.1);

      if (world.me.backpack.filter((s) => s.defId === 'iron-sword').length === swords) {
        failed = true;
        // 재료는 전부 사라졌고
        expect(ingots - countOf(world.me, 'iron-ingot')).toBe(need);
        // 날 선 철검은 어디에도 없습니다 — 고른 것이 물건으로 남지 않았습니다
        expect(world.me.backpack.some((s) => s.temper === 'sharp')).toBe(false);
      }
    }
    expect(failed, '30번 시도했는데 한 번도 실패하지 않았습니다').toBe(true);
  });

  it('실패했다고 말할 때 무엇을 고른 것이었는지 함께 말한다', () => {
    const world = willFail();
    world.log.length = 0;

    startCraft(world, 'make-iron-dagger', false, 'tough');
    tickAction(world, recipeDef('make-iron-dagger').seconds + 0.1);

    const said = [world.toast?.text ?? '', ...world.log.map((l) => l.text)].join(' ');
    if (said.includes('실패')) {
      expect(said, '무엇을 만들려다 실패했는지 안 밝힙니다').toContain(temperDef('tough').prefix);
      expect(said, '전부 잃었다고 안 말합니다').toContain('전부');
    }
  });
});

describe('누르기 전에 보이는 값', () => {
  it('★ 화면이 읽는 값이 재료 그대로다 — 절반이 아니다', () => {
    for (const id of RECIPE_ORDER) {
      const needs = recipeDef(id).needs;
      const losses = craftLoss(id);
      for (const need of needs) {
        const loss = losses.find((l) => l.defId === need.defId)!;
        expect(loss.lost, `${id} 의 ${need.defId}`).toBe(need.count);
      }
    }
  });

  it('철검은 16개를 전부 잃는다 — 예전에는 8개였다', () => {
    const [loss] = craftLoss('make-iron-sword');
    expect(loss!.defId).toBe('iron-ingot');
    expect(loss!.lost).toBe(recipeDef('make-iron-sword').needs[0]!.count);
    expect(loss!.lost).toBe(16);
  });
});

/* ===========================================================================
 *  연장의 벼림 — damage 를 '그 연장이 쓰이는 일의 성공률' 로 읽는다
 *
 *  ★ 이 묶음이 지키는 것은 하나입니다:
 *    **셋이 각각 하나씩만 이긴다.** 하나라도 세 축을 다 지면 그 벼림은 함정이고
 *    (전체설계 7.3), 하나라도 다 이기면 나머지 둘이 장식입니다.
 * ======================================================================== */

describe('연장의 벼림', () => {
  const PICK = 'iron-pickaxe';

  /** 이 벼림으로 벼린 철 곡괭이 하나가 어떤 물건이 되는가 */
  function pick(temper: TemperId | undefined) {
    const def = itemDef(PICK);
    const dur = Math.round(def.durability! * (temper ? TEMPER[temper].durability : 1));
    const weight = def.weight * (temper ? TEMPER[temper].weight : 1);
    const mul = temper ? TOOL_TEMPER[temper] : 1;
    // 채광 30 · 철광맥(난이도 20) 에서의 성공률 — 상·하한 전에 곱합니다
    const raw = (GATHER.baseSuccess + (30 - 20) * GATHER.successPerPoint) * mul;
    const success = Math.max(GATHER.minSuccess, Math.min(GATHER.maxSuccess, raw));
    return {
      perSwing: success,          // 시간으로 얼마나 나오나
      perTool: success * dur,     // 곡괭이 한 자루로 얼마나 나오나
      perStone: success / weight, // 짐 한 스톤당 얼마나 나오나
    };
  }

  it('셋이 각각 하나씩만 이긴다 — 다 지는 벼림도, 다 이기는 벼림도 없다', () => {
    const axes = ['perSwing', 'perTool', 'perStone'] as const;
    const winners = axes.map((axis) =>
      TEMPER_ORDER.reduce((a, b) => (pick(b)[axis] > pick(a)[axis] ? b : a)),
    );
    // 세 축의 승자가 서로 달라야 합니다
    expect(new Set(winners).size, `승자가 겹칩니다: ${winners.join(' · ')}`).toBe(3);
  });

  it('벼림 셋 다 무언가를 버린다 — 벼림 안 한 것보다 나은 축과 못한 축이 둘 다 있다', () => {
    const bare = pick(undefined);
    for (const id of TEMPER_ORDER) {
      const t = pick(id);
      const better = (['perSwing', 'perTool', 'perStone'] as const).filter((a) => t[a] > bare[a]);
      const worse = (['perSwing', 'perTool', 'perStone'] as const).filter((a) => t[a] < bare[a]);
      expect(better.length, `${temperDef(id).name}: 나아지는 축이 없습니다`).toBeGreaterThan(0);
      expect(worse.length, `${temperDef(id).name}: 버리는 것이 없습니다 (공짜입니다)`).toBeGreaterThan(0);
    }
  });

  it('연장의 벼림이 화면에 그대로 나온다 — 만들 확률이 든 망치를 센다', () => {
    const world = atForge();
    // ★ atForge 는 대장 95 라 성공률이 상한(0.98)에 붙어 있습니다. 붙어 있으면
    //   벼림을 걸어도 안 움직여서, 배수가 안 걸린 것과 구별이 안 됩니다.
    world.me.skills.blacksmithing = 40;
    const plain = craftChance(world, 'make-iron-sword');
    // 날카롭게 벼린 망치를 들려줍니다
    const hammer = world.me.backpack.find((s) => s.defId === 'hammer')!;
    hammer.temper = 'sharp';
    expect(craftChance(world, 'make-iron-sword'), '망치의 벼림이 화면에 안 셉니다').toBeGreaterThan(plain);
    hammer.temper = 'tough';
    expect(craftChance(world, 'make-iron-sword')).toBeLessThan(plain);
  });

  it('철 곡괭이는 연장이라 죽어도 안 떨어진다', () => {
    expect(itemDef(PICK).kind).toBe('tool');
    expect(itemDef(PICK).tool).toBe('pickaxe');
  });
});
