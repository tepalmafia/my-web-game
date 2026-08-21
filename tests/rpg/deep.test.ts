/**
 *  광산 2층 — 내려가는 문과 무게 (전체설계 7.2 · 7.3).
 *
 *  ★ 이 파일이 지키는 것은 하나다.
 *    **갈림길에서 무엇을 골랐든, 벼림을 무엇으로 했든 문을 넘을 수 있어야 한다.**
 *    한쪽만 열리면 그것은 갈림길이 아니라 함정이다.
 */

import { describe, expect, it } from 'vitest';

import { DURABILITY, TEMPER } from '../../src/rpg/balance';
import { SHOP_STOCK, itemDef } from '../../src/rpg/content/items';
import { mapDef } from '../../src/rpg/content/maps';
import { RECIPES, RECIPE_ORDER, recipeDef } from '../../src/rpg/content/recipes';
import { TOWN_STAGES, emptyTown, openRecipes } from '../../src/rpg/content/town';
import { veinDef } from '../../src/rpg/content/veins';
import { startMining, tickAction } from '../../src/rpg/core/action';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { addItem, freeWeight } from '../../src/rpg/core/inventory';
import { gearScore } from '../../src/rpg/core/stats';
import { enterMap, portalId, portalProblem, tileCenter } from '../../src/rpg/core/world';
import type { TemperId } from '../../src/rpg/balance';
import type { EquipSlot, ItemStack, World } from '../../src/rpg/types';

/** 내려가는 문 */
const DOOR = mapDef('mine').portals.find((p) => p.to === 'mine-deep')!;
const GATE = DOOR.needs!.gear!;

const SLOTS: EquipSlot[] = ['weapon', 'armor', 'helmet'];
const TEMPERS: TemperId[] = ['sharp', 'tough', 'light'];

/** 이 갈림길들을 고른 사람이 만들거나 살 수 있는 장비 */
function reachableGear(chosen: string[]): string[] {
  const open = openRecipes({ sold: {}, spent: {}, chosen } as never);
  const made = RECIPE_ORDER.filter((id) => open.has(id)).map((id) => RECIPES[id]!.makes);
  return [...new Set([...made, ...SHOP_STOCK])].filter((id) => itemDef(id).slot !== undefined);
}

function wear(world: World, defId: string, temper: TemperId | undefined): void {
  const def = itemDef(defId);
  const stack: ItemStack = {
    uid: world.nextId++,
    defId,
    count: 1,
    durability: def.durability,
    maxDurability: def.durability,
    ...(temper ? { temper } : {}),
  };
  world.me.equipped[def.slot!] = stack;
}

/** 이 경로 · 이 벼림으로 갖출 수 있는 가장 좋은 차림 */
function dressBest(world: World, chosen: string[], temper: TemperId): void {
  const pool = reachableGear(chosen);
  for (const slot of SLOTS) {
    let bestId: string | null = null;
    let best = -1;
    for (const id of pool) {
      if (itemDef(id).slot !== slot) continue;
      const bought = SHOP_STOCK.includes(id);
      const mul = bought ? 1 : TEMPER[temper].damage;
      const s = ((itemDef(id).maxDamage ?? 0) + (itemDef(id).defense ?? 0)) * mul;
      if (s > best) { best = s; bestId = id; }
    }
    if (bestId) wear(world, bestId, SHOP_STOCK.includes(bestId) ? undefined : temper);
  }
}

const FIRST = TOWN_STAGES[0]!.id;
const ROUTES: { name: string; chosen: string[] }[] = [
  { name: '긴칼 → 구리검', chosen: [FIRST, 'forge-blade', 'copper-blade'] },
  { name: '긴칼 → 구리갑옷', chosen: [FIRST, 'forge-blade', 'copper-mail'] },
  { name: '철갑옷 → 구리검', chosen: [FIRST, 'forge-mail', 'copper-blade'] },
  { name: '철갑옷 → 구리갑옷', chosen: [FIRST, 'forge-mail', 'copper-mail'] },
];

describe('★ 문턱이 함정이 아니다', () => {
  it('갈림길 넷 × 벼림 셋 — 열두 가지가 다 넘는다', () => {
    const failed: string[] = [];
    for (const route of ROUTES) {
      for (const temper of TEMPERS) {
        const world = createWorld('시험', 'miner');
        world.me.equipped = { weapon: null, armor: null, helmet: null };
        dressBest(world, route.chosen, temper);
        const have = gearScore(world.me);
        if (have < GATE) failed.push(`${route.name} · ${temper} = ${have} < ${GATE}`);
      }
    }
    expect(failed, `이 조합은 못 넘습니다:\n${failed.join('\n')}`).toEqual([]);
  });

  it('가장 낮은 천장에도 여유가 남는다 — 수치를 조금 만져도 함정이 안 되게', () => {
    let floor = Infinity;
    for (const route of ROUTES) {
      for (const temper of TEMPERS) {
        const world = createWorld('시험', 'miner');
        world.me.equipped = { weapon: null, armor: null, helmet: null };
        dressBest(world, route.chosen, temper);
        floor = Math.min(floor, gearScore(world.me));
      }
    }
    expect(floor - GATE, `가장 낮은 천장이 ${floor} 인데 문턱이 ${GATE} 입니다`).toBeGreaterThan(1);
  });
});

describe('합산은 어떻게 세나', () => {
  it('무기의 공격과 갑옷의 방어를 더한다 — 서로 대신할 수 있어야 한다', () => {
    const world = createWorld('시험', 'miner');
    world.me.equipped = { weapon: null, armor: null, helmet: null };
    expect(gearScore(world.me)).toBe(0);

    wear(world, 'iron-sword', undefined);
    expect(gearScore(world.me)).toBe(itemDef('iron-sword').maxDamage);

    wear(world, 'iron-mail', undefined);
    expect(gearScore(world.me)).toBe(
      itemDef('iron-sword').maxDamage! + itemDef('iron-mail').defense!,
    );
  });

  it('벼림이 걸린다 — 갑옷도 damage 배율을 탄다 (derive 와 같게)', () => {
    const world = createWorld('시험', 'miner');
    world.me.equipped = { weapon: null, armor: null, helmet: null };
    wear(world, 'iron-mail', 'sharp');
    expect(gearScore(world.me)).toBeCloseTo(itemDef('iron-mail').defense! * TEMPER.sharp.damage, 1);
  });

  it('★ 힘도 스킬도 안 센다 — 장비로 걸기로 했다', () => {
    const world = createWorld('시험', 'miner');
    world.me.equipped = { weapon: null, armor: null, helmet: null };
    wear(world, 'iron-sword', undefined);
    const before = gearScore(world.me);

    world.me.str = 100;
    world.me.skills.swordsmanship = 100;
    expect(gearScore(world.me)).toBe(before);
  });
});

describe('문이 무엇을 말하나', () => {
  function atDoor(): World {
    const world = createWorld('시험', 'miner');
    enterMap(world, 'mine', mapDef('mine').entryTx, mapDef('mine').entryTy);
    return world;
  }

  it('★ 왜 안 되는지 숫자로 말한다 — 감출 것은 문 너머지 문이 아니다', () => {
    const world = atDoor();
    world.me.equipped = { weapon: null, armor: null, helmet: null };

    const problem = portalProblem(world, DOOR);
    expect(problem, '막혔는데 아무 말도 안 합니다').toBeTruthy();
    expect(problem).toContain('0');
    expect(problem).toContain(String(GATE));
  });

  it('갖추면 열린다', () => {
    const world = atDoor();
    world.me.equipped = { weapon: null, armor: null, helmet: null };
    dressBest(world, ROUTES[0]!.chosen, 'sharp');

    expect(gearScore(world.me)).toBeGreaterThanOrEqual(GATE);
    expect(portalProblem(world, DOOR)).toBeNull();
  });

  it('★ 한 번 열면 다시 닫히지 않는다 — 뚫은 것이지 마침 되는 것이 아니다', () => {
    const world = atDoor();
    world.me.equipped = { weapon: null, armor: null, helmet: null };
    dressBest(world, ROUTES[0]!.chosen, 'sharp');

    // 문을 밟습니다
    world.me.pos = { x: tileCenter(DOOR.tx), y: tileCenter(DOOR.ty) };
    for (let i = 0; i < 5 && world.mapId === 'mine'; i++) step(world, 1 / 30);
    expect(world.mapId, '문이 안 열렸습니다').toBe('mine-deep');
    expect(world.me.opened).toContain(portalId('mine', DOOR));

    // 장비를 다 팔아치워도
    world.me.equipped = { weapon: null, armor: null, helmet: null };
    enterMap(world, 'mine', mapDef('mine').entryTx, mapDef('mine').entryTy);
    expect(gearScore(world.me)).toBe(0);
    expect(portalProblem(world, DOOR), '장비를 벗었더니 길이 도로 닫혔습니다').toBeNull();
  });
});

describe('2층의 성격은 무게다', () => {
  const ORE = 'dark-iron-ore';

  it('검은쇠 광석은 철광석보다 훨씬 무겁다', () => {
    expect(itemDef(ORE).weight).toBeGreaterThan(itemDef('iron-ore').weight * 2);
  });

  it('★ 세 덩이면 짐이 찬다 — 그래서 무엇을 버릴지 고르게 된다', () => {
    const world = createWorld('시험', 'miner');
    const free = freeWeight(world.me);

    let carried = 0;
    while (addItem(world, ORE, 1)) carried += 1;

    expect(carried, `여유 ${free} 에 ${carried} 덩이가 들어갔습니다`).toBeLessThanOrEqual(4);
    expect(carried).toBeGreaterThan(0);
  });

  it('★ 철광석을 지고 있으면 검은쇠를 못 담는다 — 버려야 담긴다', () => {
    const world = createWorld('시험', 'miner');
    while (addItem(world, 'iron-ore', 1)) { /* 가방을 철광석으로 채웁니다 */ }

    expect(addItem(world, ORE, 1), '짐이 찼는데 검은쇠가 들어갔습니다').toBe(false);
  });

  it('2층 광맥 하나가 짐칸보다 크다 — 다 캐고 나갈 수 없다', () => {
    const world = createWorld('시험', 'miner');
    const def = veinDef('dark-iron');
    const stones = def.capacity * ((def.amountMin + def.amountMax) / 2) * itemDef(ORE).weight;
    expect(stones).toBeGreaterThan(freeWeight(world.me));
  });

  it('2층에 검은쇠 광맥이 있고, 1층에는 없다', () => {
    expect(mapDef('mine-deep').veins.some((v) => v.veinId === 'dark-iron')).toBe(true);
    expect(mapDef('mine').veins.some((v) => v.veinId === 'dark-iron')).toBe(false);
  });
});

/* ===========================================================================
 *  3단계 — 검은쇠 대장간 (C2b)
 *
 *  ★ 갈림길이 셋이 되면 경로가 여덟입니다. 벼림 셋을 곱해 스물넷.
 *    하나라도 못 넘으면 그것은 갈림길이 아니라 함정입니다.
 * ======================================================================== */

const DARK = ['dark-blade', 'dark-plate'] as const;
const ROUTES3: { name: string; chosen: string[] }[] = [];
for (const a of ['forge-blade', 'forge-mail']) {
  for (const b of ['copper-blade', 'copper-mail']) {
    for (const c of DARK) ROUTES3.push({ name: `${a}/${b}/${c}`, chosen: [FIRST, a, b, c] });
  }
}

/** 3단계까지 갖춘 사람이 낼 수 있는 **가장 낮은** 합산 — 다음 문의 상한입니다 */
function ceiling3(): number {
  let floor = Infinity;
  for (const route of ROUTES3) {
    for (const temper of TEMPERS) {
      const world = createWorld('시험', 'miner');
      world.me.equipped = { weapon: null, armor: null, helmet: null };
      dressBest(world, route.chosen, temper);
      floor = Math.min(floor, gearScore(world.me));
    }
  }
  return floor;
}

describe('★ 3단계도 함정이 아니다', () => {
  it('경로 여덟 × 벼림 셋 — 스물넷이 다 2층 문을 넘는다', () => {
    const failed: string[] = [];
    for (const route of ROUTES3) {
      for (const temper of TEMPERS) {
        const world = createWorld('시험', 'miner');
        world.me.equipped = { weapon: null, armor: null, helmet: null };
        dressBest(world, route.chosen, temper);
        const have = gearScore(world.me);
        if (have < GATE) failed.push(`${route.name} · ${temper} = ${have}`);
      }
    }
    expect(failed, `이 조합은 못 넘습니다:\n${failed.join('\n')}`).toEqual([]);
  });

  it('★ 3단계 장비가 2층 문보다 확실히 위다 — 다음 문을 걸 자리가 있다', () => {
    //  자리표시가 아니라 진짜 검사입니다 — 3층 문이 그 자리에 실제로 앉았습니다.
    expect(ceiling3(), `가장 낮은 천장이 ${ceiling3()} 인데 2층 문이 ${GATE} 입니다`).toBeGreaterThan(GATE + 5);
  });

  it('갈림길 둘이 합산을 비슷하게 올린다 — 한쪽만 답이면 갈림길이 아니다', () => {
    const of = (choice: string) => {
      const world = createWorld('시험', 'miner');
      world.me.equipped = { weapon: null, armor: null, helmet: null };
      dressBest(world, [FIRST, 'forge-blade', 'copper-mail', choice], 'tough');
      return gearScore(world.me);
    };
    const blade = of('dark-blade');
    const plate = of('dark-plate');
    //  같은 앞길에서 어느 쪽을 골라도 비슷해야 합니다
    expect(Math.abs(blade - plate) / Math.max(blade, plate)).toBeLessThan(0.15);
  });
});

describe('검은쇠에 쓸 데가 생겼다', () => {
  it('★ 녹일 수 있다 — 파는 것 말고 할 게 있다', () => {
    const world = createWorld('시험', 'miner');
    const open = openRecipes(world.me.town);
    expect(open.has('smelt-dark-iron'), '검은쇠 제련이 처음부터 열려 있지 않습니다').toBe(true);
  });

  it('★ 조건은 광석이 아니라 주괴다 — 구리 때 배운 것', () => {
    const stage = TOWN_STAGES.find((s) => s.id === 'dark-forge')!;
    expect(stage, '검은쇠 단계가 없습니다').toBeTruthy();
    for (const need of stage.needs) {
      expect(itemDef(need.defId).name, `${need.defId} 가 광석입니다`).toContain('주괴');
    }
  });

  it('제련 난이도가 그 광맥보다 낮다 — 캘 수 있으면 녹일 수 있어야 한다', () => {
    expect(RECIPES['smelt-dark-iron']!.difficulty).toBeLessThan(veinDef('dark-iron').difficulty);
  });

  it('검은쇠 주괴가 실제로 무언가의 재료다', () => {
    const used = RECIPE_ORDER.filter((id) => RECIPES[id]!.needs.some((n) => n.defId === 'dark-iron-ingot'));
    expect(used.length, '검은쇠 주괴를 쓰는 제작법이 없습니다').toBeGreaterThan(0);
  });
});


/* ===========================================================================
 *  광산 3층 — 문과 성격 (C2'a)
 *
 *  ★ 지키는 것은 2층과 같습니다. **갈림길에서 무엇을 골랐든, 벼림을 무엇으로
 *    했든 문을 넘을 수 있어야 한다.** 하나라도 못 넘으면 그 벼림이 함정입니다.
 * ======================================================================== */

const DOOR3 = mapDef('mine-deep').portals.find((p) => p.to === 'mine-third')!;
const GATE3 = DOOR3.needs!.gear!;

describe('★ 3층 문턱이 함정이 아니다', () => {
  it('경로 여덟 × 벼림 셋 — 스물넷이 다 3층 문을 넘는다', () => {
    const failed: string[] = [];
    for (const route of ROUTES3) {
      for (const temper of TEMPERS) {
        const world = createWorld('시험', 'miner');
        world.me.equipped = { weapon: null, armor: null, helmet: null };
        dressBest(world, route.chosen, temper);
        const have = gearScore(world.me);
        if (have < GATE3) failed.push(`${route.name} · ${temper} = ${have}`);
      }
    }
    expect(failed, `이 조합은 3층에 못 갑니다:\n${failed.join('\n')}`).toEqual([]);
  });

  /*
   *  ★ 재면서 알게 된 것 — **두 구간이 겹칩니다.**
   *    3단계까지 간 사람의 합산은 37.4 ~ 67.2 이고 4단계는 46.8 ~ 88.8 입니다.
   *    그래서 "4단계를 다 통과시키면서 3단계를 다 막는" 문턱은 **없습니다.**
   *    문턱을 67.2 위로 올리면 4단계의 몰빵 경로(46.8)가 함정이 됩니다.
   *
   *  ★ 그것이 잘못은 아닙니다. 7.3 이 "레벨이나 스킬로 걸지 않는다. 장비로 걸어야
   *    세 길이 **각자의 방법으로** 조건을 채운다" 라고 정해 두었습니다.
   *    벼림을 전부 날카롭게 하고 무기·갑옷을 섞어 고른 사람은 일찍 내려갑니다.
   *    대신 난이도 95 를 3단계 장비로 만납니다 — 세계가 알아서 값을 받습니다.
   *
   *  ★ 겹침이 벌어지는 원인은 **몰빵한 사람의 빈 칸**입니다. 갈림길이 매번
   *    무기 대 갑옷이라, 세 번 다 무기를 고르면 갑옷이 상점 가죽 조끼(6)에서 멈춥니다.
   *    4단계 갈림길을 다른 축으로 두기로 한 이유가 이것입니다.
   */
  it('★ 공짜는 아니다 — 3단계 몰빵으로는 못 넘는다', () => {
    let worst = Infinity;
    for (const a of ['forge-blade', 'forge-mail']) {
      for (const b of ['copper-blade', 'copper-mail']) {
        for (const temper of TEMPERS) {
          const world = createWorld('시험', 'miner');
          world.me.equipped = { weapon: null, armor: null, helmet: null };
          dressBest(world, [FIRST, a, b], temper);
          worst = Math.min(worst, gearScore(world.me));
        }
      }
    }
    expect(worst, `3단계 최악이 ${worst} 인데 3층 문이 ${GATE3} 입니다`).toBeLessThan(GATE3);
  });

  it('가장 낮은 천장에도 여유가 남는다', () => {
    expect(ceiling3() - GATE3, `여유가 ${(ceiling3() - GATE3).toFixed(1)} 뿐입니다`).toBeGreaterThan(1);
  });
});

describe("3층의 성격은 연장이다", () => {
  it('★ 서릿쇠 광맥은 곡괭이를 한 번에 여러 번 먹는다 — 2층과 다른 축이다', () => {
    expect(veinDef('frost-iron').toolWear).toBeGreaterThan(DURABILITY.toolPerUse);
    //  2층은 무게였습니다. 같은 축을 두 번 쓰면 층이 숫자 하나만 다른 같은 방입니다
    expect(veinDef('dark-iron').toolWear ?? DURABILITY.toolPerUse).toBe(DURABILITY.toolPerUse);
    expect(itemDef('frost-iron-ore').weight).toBeLessThan(itemDef('dark-iron-ore').weight);
  });

  it('★ 곡괭이 한 자루로 광맥 하나를 다 못 캔다 — 몇 자루 지고 갈지가 판단이 된다', () => {
    const wearPer = veinDef('frost-iron').toolWear!;
    const swings = itemDef('iron-pickaxe').durability! / wearPer;
    //  철 곡괭이(150)로 오십 번. 상점 곡괭이(60)는 스무 번입니다
    expect(swings).toBeLessThan(60);
    expect(itemDef('pickaxe').durability! / wearPer).toBeLessThan(25);
  });

  it('★ 실제로 그만큼 닳는다 — 표에만 있고 안 걸리면 조용한 실패다', () => {
    const world = createWorld('시험', 'miner');
    world.seed = 20250819;
    enterMap(world, 'mine-third', mapDef('mine-third').entryTx, mapDef('mine-third').entryTy);
    const pick = world.me.backpack.find((s) => s.defId === 'pickaxe')!;
    const before = pick.durability!;
    //  광맥 옆에 서서 한 번 캡니다
    const vein = world.veins.find((v) => v.defId === 'frost-iron')!;
    world.me.pos = { x: vein.pos.x, y: vein.pos.y + 20 };
    startMining(world, vein.id);
    //  한 번만 휘두르게 합니다 — 반복하면 몇 번 캤는지가 섞입니다
    while (world.me.action && pick.durability === before) tickAction(world, 1 / 20);
    expect(before - pick.durability!, '곡괭이가 표대로 안 닳았습니다').toBe(veinDef('frost-iron').toolWear);
  });

  it('3층에 서릿쇠가 있고, 2층에는 없다', () => {
    const has = (id: string) => mapDef(id).veins.some((v) => v.veinId === 'frost-iron');
    expect(has('mine-third')).toBe(true);
    expect(has('mine-deep')).toBe(false);
  });

  it('★ 녹일 수 있다 — 파는 것 말고 할 게 있다', () => {
    expect(openRecipes(emptyTown()).has('smelt-frost-iron')).toBe(true);
    expect(recipeDef('smelt-frost-iron').difficulty).toBeLessThan(veinDef('frost-iron').difficulty);
  });
});
