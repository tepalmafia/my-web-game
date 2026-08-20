/**
 *  캐기 · 만들기 · 고치기 — Phase 1 의 순환 그 자체.
 *
 *      광맥을 캔다 → 무거워진다 → 마을로 → 녹인다 → 만든다 → 닳는다 → 고친다 → 또 캔다
 *
 *  이 한 바퀴가 실제로 도는지, 중간에 끊기지 않는지 확인합니다.
 */

import { describe, expect, it } from 'vitest';

import { DURABILITY, GATHER } from '../../src/rpg/balance';
import { itemDef } from '../../src/rpg/content/items';
import { mapDef } from '../../src/rpg/content/maps';
import { RECIPE_ORDER, recipeDef } from '../../src/rpg/content/recipes';
import { veinDef } from '../../src/rpg/content/veins';
import { craftChance, craftLoss, nearForge, startCraft, startMining, startRepair, tickAction } from '../../src/rpg/core/action';
import { createWorld } from '../../src/rpg/core/create';
import { repairQuote } from '../../src/rpg/core/durability';
import { addItem, countOf } from '../../src/rpg/core/inventory';
import { enterMap } from '../../src/rpg/core/world';
import type { World } from '../../src/rpg/types';

/** 광맥 앞에 세워둔 판 */
function atVein(seed = 4242, veinId = 'iron-shallow'): { world: World; veinNum: number } {
  const world = createWorld('광부', 'miner');
  world.seed = seed;
  enterMap(world, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);

  const vein = world.veins.find((v) => v.defId === veinId)!;
  world.me.pos = { x: vein.pos.x, y: vein.pos.y + 20 };
  return { world, veinNum: vein.id };
}

/** 화로 앞에 세워둔 판 */
function atForge(seed = 999): World {
  const world = createWorld('대장장이', 'smith');
  world.seed = seed;
  // 주괴 한 개가 6 스톤이라 시험에 쓸 만큼 들려면 힘이 필요합니다
  world.me.str = 100;
  const forge = mapDef('town').forge!;
  world.me.pos = { x: forge.tx * 32 + 16, y: forge.ty * 32 + 16 };
  return world;
}

/** 행동 한 번을 끝까지 굴립니다 */
function finish(world: World): void {
  const total = world.me.action?.total ?? 0;
  tickAction(world, total + 0.01);
}

describe('캐기', () => {
  it('곡괭이가 없으면 시작할 수 없다', () => {
    const { world, veinNum } = atVein();
    world.me.backpack = world.me.backpack.filter((s) => itemDef(s.defId).tool !== 'pickaxe');

    expect(startMining(world, veinNum, false)).toBe(false);
    expect(world.me.action).toBeNull();
  });

  it('멀면 시작하지 않고 그쪽으로 걸어간다', () => {
    const { world, veinNum } = atVein();
    world.me.pos = { x: world.me.pos.x + 400, y: world.me.pos.y };

    expect(startMining(world, veinNum, false)).toBe(false);
    expect(world.me.moveTarget).not.toBeNull();
  });

  it('캐면 광석이 들어오고 광맥이 줄어든다', () => {
    const { world, veinNum } = atVein();
    world.me.skills.mining = 60; // 확실히 성공하도록
    const vein = world.veins.find((v) => v.id === veinNum)!;
    const before = vein.remaining;

    startMining(world, veinNum, false);
    finish(world);

    expect(countOf(world.me, 'iron-ore')).toBeGreaterThan(0);
    expect(vein.remaining).toBe(before - 1);
  });

  it('반복을 켜면 계속 캔다', () => {
    const { world, veinNum } = atVein();
    world.me.skills.mining = 60;

    startMining(world, veinNum, true);
    for (let i = 0; i < 4; i++) finish(world);

    expect(countOf(world.me, 'iron-ore')).toBeGreaterThan(2);
    expect(world.me.action, '반복인데 멈췄습니다').not.toBeNull();
  });

  it('곡괭이가 닳는다', () => {
    const { world, veinNum } = atVein();
    const pick = world.me.backpack.find((s) => s.defId === 'pickaxe')!;
    const before = pick.durability!;

    startMining(world, veinNum, false);
    finish(world);

    expect(pick.durability!).toBe(before - DURABILITY.toolPerUse);
  });

  it('짐이 가득 차면 더 캐지지 않는다 — 마을로 돌아갈 때입니다', () => {
    const { world, veinNum } = atVein();
    world.me.skills.mining = 80;
    while (world.me.backpack.length < 20 && addItem(world, 'iron-ore', 1)) {
      /* 들 수 있는 만큼 채웁니다 */
    }
    const before = countOf(world.me, 'iron-ore');

    startMining(world, veinNum, false);
    finish(world);

    expect(countOf(world.me, 'iron-ore')).toBe(before);
  });

  it('광맥이 바닥나면 회복 시계가 돈다', () => {
    const { world, veinNum } = atVein();
    world.me.skills.mining = 90;
    const vein = world.veins.find((v) => v.id === veinNum)!;
    vein.remaining = 1;

    startMining(world, veinNum, false);
    finish(world);

    expect(vein.remaining).toBe(0);
    expect(vein.respawnIn).toBe(veinDef(vein.defId).respawn);
  });

  it('실패해도 배운다 — 성장 판정은 성공과 무관합니다', () => {
    const { world, veinNum } = atVein(31337);
    world.me.skills.mining = 5; // 성공률이 낮은 상태
    const before = world.me.skills.mining;

    startMining(world, veinNum, true);
    for (let i = 0; i < 30; i++) finish(world);

    expect(world.me.skills.mining).toBeGreaterThan(before);
  });
});

describe('만들기', () => {
  it('화로 앞이 아니면 만들 수 없다', () => {
    const world = createWorld('대장장이', 'smith');
    world.me.pos = { x: 100, y: 100 };
    addItem(world, 'iron-ore', 4);

    expect(nearForge(world)).toBe(false);
    expect(startCraft(world, 'smelt-iron')).toBe(false);
  });

  it('재료가 모자라면 시작하지 않는다', () => {
    const world = atForge();
    expect(startCraft(world, 'smelt-iron')).toBe(false);
  });

  it('제련하면 광석이 주괴가 된다', () => {
    const world = atForge();
    world.me.skills.blacksmithing = 60;
    const recipe = recipeDef('smelt-iron');
    const need = recipe.needs[0]!.count;
    addItem(world, 'iron-ore', need + 2);

    startCraft(world, 'smelt-iron', false);
    finish(world);

    // 표에 적힌 만큼만 쓰고, 표에 적힌 만큼 나옵니다
    expect(countOf(world.me, 'iron-ore')).toBe(2);
    expect(countOf(world.me, 'iron-ingot')).toBe(recipe.makesCount);
  });

  it('실패하면 재료의 절반만 돌아온다', () => {
    const world = atForge(7);
    world.me.skills.blacksmithing = 0;
    const need = recipeDef('make-iron-sword').needs[0]!.count;
    world.me.str = 90; // 주괴를 넉넉히 들 수 있게
    addItem(world, 'iron-ingot', need * 4);

    let failed = false;
    for (let i = 0; i < 40 && !failed; i++) {
      const beforeIngots = countOf(world.me, 'iron-ingot');
      const beforeSwords = countOf(world.me, 'iron-sword');
      if (beforeIngots < need) break;

      startCraft(world, 'make-iron-sword', false);
      finish(world);

      const madeOne = countOf(world.me, 'iron-sword') > beforeSwords;
      if (!madeOne) {
        // ★ 실패하면 재료를 전부 잃습니다. 돌려받는 몫은 없습니다
        expect(beforeIngots - countOf(world.me, 'iron-ingot')).toBe(need);
        failed = true;
      }
    }
    expect(failed, '40번 시도했는데 한 번도 실패하지 않았습니다').toBe(true);
  });

  it('실력이 난이도보다 한참 높으면 우수품이 나온다', () => {
    const world = atForge(555);
    world.me.skills.blacksmithing = 100;
    addItem(world, 'iron-ingot', 30);

    let fine = 0;
    for (let i = 0; i < 10; i++) {
      startCraft(world, 'make-iron-dagger', false);
      finish(world);
      fine = world.me.backpack.filter((s) => s.defId === 'iron-dagger' && s.quality === 'fine').length;
      if (fine > 0) break;
    }
    expect(fine).toBeGreaterThan(0);
  });

  it('성공 확률은 실력이 오를수록 높아진다', () => {
    const world = atForge();
    world.me.skills.blacksmithing = 10;
    const low = craftChance(world, 'make-iron-sword');
    world.me.skills.blacksmithing = 80;
    const high = craftChance(world, 'make-iron-sword');

    expect(high).toBeGreaterThan(low);
  });
});

describe('고치기', () => {
  it('고칠수록 최대 내구도가 줄어든다 — 언젠가는 새로 만들어야 합니다', () => {
    const world = atForge();
    addItem(world, 'iron-sword', 1);
    addItem(world, 'iron-ingot', 30);
    const sword = world.me.backpack.find((s) => s.defId === 'iron-sword')!;

    const originalMax = sword.maxDurability!;
    sword.durability = 10;

    startRepair(world, sword.uid);
    finish(world);

    expect(sword.durability).toBe(sword.maxDurability);
    expect(sword.maxDurability!).toBeLessThan(originalMax);
  });

  it('여러 번 고치면 결국 고칠 수 없게 된다', () => {
    const world = atForge();
    addItem(world, 'iron-sword', 1);
    addItem(world, 'iron-ingot', 40);
    const sword = world.me.backpack.find((s) => s.defId === 'iron-sword')!;

    for (let i = 0; i < 30; i++) {
      sword.durability = 1;
      const quote = repairQuote(sword);
      if (quote.problem) break;
      startRepair(world, sword.uid);
      finish(world);
    }

    expect(sword.maxDurability!).toBeLessThan(DURABILITY.scrapAt / (1 - DURABILITY.repairCost) + 1);
    expect(repairQuote(sword).problem).toBeTruthy();
  });

  it('주괴가 없으면 고칠 수 없다', () => {
    const world = atForge();
    addItem(world, 'iron-sword', 1);
    const sword = world.me.backpack.find((s) => s.defId === 'iron-sword')!;
    sword.durability = 10;

    expect(startRepair(world, sword.uid)).toBe(false);
  });
});

describe('한 바퀴', () => {
  it('캐고 → 녹이고 → 만들면 검이 손에 들어온다', () => {
    // 1) 캔다
    const { world, veinNum } = atVein(20250819);
    world.me.skills.mining = 70;
    world.me.skills.blacksmithing = 70;
    world.me.str = 60; // 광석을 넉넉히 지고 올 수 있게

    // 검 한 자루에 드는 쇠는 광맥 하나로는 모자랍니다 — 여러 광맥을 돕니다
    const oreNeeded = recipeDef('make-iron-sword').needs[0]!.count;
    const veins = [veinNum, ...world.veins.filter((v) => v.id !== veinNum).map((v) => v.id)];
    for (const id of veins) {
      if (countOf(world.me, 'iron-ore') >= oreNeeded) break;
      const vein = world.veins.find((v) => v.id === id)!;
      world.me.pos = { x: vein.pos.x, y: vein.pos.y + 20 };
      startMining(world, id, true);
      for (let i = 0; i < 60 && world.me.action; i++) finish(world);
    }
    const ore = countOf(world.me, 'iron-ore');
    expect(ore, '광석을 못 캤습니다').toBeGreaterThanOrEqual(oreNeeded);

    // 2) 마을로 돌아와 녹인다
    const forge = mapDef('town').forge!;
    enterMap(world, 'town', mapDef('town').entryTx, mapDef('town').entryTy);
    world.me.pos = { x: forge.tx * 32 + 16, y: forge.ty * 32 + 16 };

    const perSmelt = recipeDef('smelt-iron').needs[0]!.count;
    for (let i = 0; i < 60; i++) {
      if (countOf(world.me, 'iron-ore') < perSmelt) break;
      startCraft(world, 'smelt-iron', false);
      finish(world);
    }
    expect(countOf(world.me, 'iron-ingot'), '주괴를 못 만들었습니다').toBeGreaterThanOrEqual(4);

    // 3) 검을 만든다
    let made = 0;
    for (let i = 0; i < 10 && made === 0; i++) {
      if (countOf(world.me, 'iron-ingot') < oreNeeded) break;
      startCraft(world, 'make-iron-sword', false);
      finish(world);
      made = countOf(world.me, 'iron-sword');
    }
    expect(made, '한 바퀴가 돌지 않았습니다').toBeGreaterThan(0);
  });
});

describe('시간', () => {
  it('한 번 캐는 데 정해진 시간이 걸린다', () => {
    const { world, veinNum } = atVein();
    startMining(world, veinNum, false);

    expect(world.me.action!.total).toBe(GATHER.swingSeconds);
    tickAction(world, GATHER.swingSeconds * 0.5);
    expect(world.me.action, '절반 만에 끝났습니다').not.toBeNull();
  });
});

/* ===========================================================================
 *  실패하면 무엇을 잃는가 — 화면이 말하는 것과 실제가 같아야 한다
 *  ---------------------------------------------------------------------------
 *  ★ 예전에는 절반이 돌아왔습니다. 이 게임의 감정 축이 제작인데 절반이 돌아오면
 *    아프지 않습니다 (전체설계 9절). 그리고 돌려받는 몫이 내림이라
 *    한 개짜리 제련만 전부를 잃고 있었습니다 — 같은 규칙이 물건마다 달랐습니다.
 * ======================================================================== */

describe('제작 실패의 값', () => {
  it('★ 모든 제작법이 재료를 전부 잃는다 — 같은 규칙이 물건마다 다르지 않다', () => {
    for (const id of RECIPE_ORDER) {
      const losses = craftLoss(id);
      expect(losses.length, `${id}`).toBe(recipeDef(id).needs.length);
      for (const loss of losses) {
        const need = recipeDef(id).needs.find((n) => n.defId === loss.defId)!;
        expect(loss.lost, `${id} 의 ${loss.defId} 가 전부가 아닙니다`).toBe(need.count);
      }
    }
  });

  it('화면이 읽는 값과 실제로 사라지는 양이 같다', () => {
    // ★ craftLoss 는 누르기 전에 화면이 보여주는 값입니다.
    //   실제와 어긋나면 그게 바로 조용한 실패입니다.
    const world = atForge();
    world.me.skills.blacksmithing = 1;      // 거의 확실히 실패하게
    addItem(world, 'iron-ingot', 60);

    const before = countOf(world.me, 'iron-ingot');
    const need = recipeDef('make-iron-sword').needs[0]!.count;
    let failedOnce = false;
    for (let i = 0; i < 30 && !failedOnce; i++) {
      const swords = countOf(world.me, 'iron-sword');
      const ingots = countOf(world.me, 'iron-ingot');
      if (ingots < need) break;
      startCraft(world, 'make-iron-sword', false);
      finish(world);
      if (countOf(world.me, 'iron-sword') === swords) {
        expect(ingots - countOf(world.me, 'iron-ingot')).toBe(craftLoss('make-iron-sword')[0]!.lost);
        failedOnce = true;
      }
    }
    expect(failedOnce, '30번 시도했는데 한 번도 실패하지 않았습니다').toBe(true);
    expect(countOf(world.me, 'iron-ingot')).toBeLessThan(before);
  });

  it('구리 제련은 대장기술 30 에서 성공이 20% 아래다 — 태우는 값이 분명해야 한다', () => {
    const world = createWorld('시험', 'miner');
    world.me.skills.blacksmithing = 30;
    expect(craftChance(world, 'smelt-copper')).toBeLessThan(0.2);
    expect(craftLoss('smelt-copper')[0]!.lost).toBe(1);
  });
});
