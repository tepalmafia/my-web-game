/**
 *  광산 2층 — 내려가는 문과 무게 (전체설계 7.2 · 7.3).
 *
 *  ★ 이 파일이 지키는 것은 하나다.
 *    **갈림길에서 무엇을 골랐든, 벼림을 무엇으로 했든 문을 넘을 수 있어야 한다.**
 *    한쪽만 열리면 그것은 갈림길이 아니라 함정이다.
 */

import { describe, expect, it } from 'vitest';

import { TEMPER } from '../../src/rpg/balance';
import { SHOP_STOCK, itemDef } from '../../src/rpg/content/items';
import { mapDef } from '../../src/rpg/content/maps';
import { RECIPES, RECIPE_ORDER } from '../../src/rpg/content/recipes';
import { TOWN_STAGES, openRecipes } from '../../src/rpg/content/town';
import { veinDef } from '../../src/rpg/content/veins';
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
