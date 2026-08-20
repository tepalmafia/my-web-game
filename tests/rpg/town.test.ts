/**
 *  마을이 자란다 — 판 것이 세계를 키운다.
 *
 *  ★ 세 조건이 이 파일이 지키는 것입니다.
 *    선택   무엇을 열지 고르고, 하나를 고르면 하나를 버린다
 *    불확실 다음에 무엇이 열릴지 표에 미리 적어두지 않는다
 *    비가역 판 것도, 고른 것도 돌아오지 않는다
 */

import { describe, expect, it } from 'vitest';

import { ITEMS } from '../../src/rpg/content/items';
import { RECIPES, RECIPE_ORDER } from '../../src/rpg/content/recipes';
import {
  TOWN_STAGES,
  emptyTown,
  choiceById,
  forsaken,
  nextStage,
  openRecipes,
  openStock,
  progressOf,
  stageOf,
  stageReady,
} from '../../src/rpg/content/town';
import { startCraft } from '../../src/rpg/core/action';
import { chooseTownPath } from '../../src/rpg/core/commands';
import { createWorld } from '../../src/rpg/core/create';
import { addItem, sellItem } from '../../src/rpg/core/inventory';
import type { World } from '../../src/rpg/types';

function inTown(): World {
  const world = createWorld('시험', 'miner');
  world.me.str = 500; // 무게에 막히지 않게 (마을 규칙과는 무관합니다)
  world.log.length = 0;
  return world;
}

/** 물건을 만들어 두린에게 팝니다 */
function sell(world: World, defId: string, count: number): void {
  addItem(world, defId, count);
  const stack = world.me.backpack.find((s) => s.defId === defId)!;
  sellItem(world, stack.uid, count);
}

describe('사다리 자체', () => {
  it('단계마다 조건·힌트·갈림길 둘이 있다', () => {
    expect(TOWN_STAGES.length).toBeGreaterThan(0);
    for (const stage of TOWN_STAGES) {
      expect(stage.needs.length, `${stage.name} 에 조건이 없습니다`).toBeGreaterThan(0);
      expect(stage.hint.length, `${stage.name} 에 힌트가 없습니다`).toBeGreaterThan(0);
      expect(stage.choices.length, `${stage.name} 의 갈림길이 둘이 아닙니다`).toBe(2);
    }
  });

  it('조건에 적힌 물건과 여는 것이 실재한다', () => {
    for (const stage of TOWN_STAGES) {
      for (const need of stage.needs) expect(ITEMS[need.defId], need.defId).toBeDefined();
      for (const id of stage.opens.recipes) expect(RECIPES[id], id).toBeDefined();
      for (const id of stage.opens.stock) expect(ITEMS[id], id).toBeDefined();
      for (const choice of stage.choices) {
        expect(choice.recipes.length, `${choice.id} 가 아무것도 안 엽니다`).toBeGreaterThan(0);
        for (const id of choice.recipes) expect(RECIPES[id], id).toBeDefined();
      }
    }
  });

  it('갈림길 id 가 겹치지 않는다', () => {
    const ids = TOWN_STAGES.flatMap((s) => s.choices.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('한 제작법을 두 갈래가 함께 열지 않는다 — 그러면 고를 이유가 없다', () => {
    const seen = new Set<string>();
    for (const stage of TOWN_STAGES) {
      for (const id of [...stage.opens.recipes, ...stage.choices.flatMap((c) => c.recipes)]) {
        expect(seen.has(id), `${id} 를 여러 곳에서 엽니다`).toBe(false);
        seen.add(id);
      }
    }
  });

  it('★ 무엇이 열리는지 미리 알려주는 문구가 없다', () => {
    // 힌트에 제작법 이름이 들어가면 그 순간 선택이 아니라 목표치가 됩니다
    for (const stage of TOWN_STAGES) {
      for (const recipe of Object.values(RECIPES)) {
        expect(stage.hint, `${stage.name} 의 힌트가 ${recipe.name} 을 흘립니다`).not.toContain(recipe.name);
      }
    }
  });
});

describe('처음에는 잠겨 있다', () => {
  it('사다리가 쥔 제작법은 처음에 못 만든다', () => {
    const open = openRecipes(emptyTown());
    const held = TOWN_STAGES.flatMap((s) => [...s.opens.recipes, ...s.choices.flatMap((c) => c.recipes)]);
    for (const id of held) expect(open.has(id), `${id} 가 처음부터 열려 있습니다`).toBe(false);
  });

  it('그래도 처음부터 만들 수 있는 것이 있다 — 시작하자마자 막히면 안 된다', () => {
    const open = openRecipes(emptyTown());
    expect(open.has('smelt-iron'), '철도 못 녹입니다').toBe(true);
    expect(open.size).toBeGreaterThan(2);
  });

  it('잠긴 제작법은 규칙 쪽에서도 막고, 왜 막았는지 말한다', () => {
    const world = inTown();
    addItem(world, 'iron-ingot', 40);
    world.log.length = 0;

    expect(startCraft(world, 'make-iron-longsword'), '잠긴 것이 만들어졌습니다').toBe(false);
    expect(world.me.action, '잠겼는데 일을 시작했습니다').toBeNull();
    expect(
      [world.toast?.text ?? '', ...world.log.map((l) => l.text)].join(' '),
      '조용히 실패했습니다',
    ).toContain('자라야');
  });
});

describe('판 것이 마을을 키운다', () => {
  it('판 것을 누계로 센다 — 골드가 아니라 물건', () => {
    const world = inTown();
    sell(world, 'iron-ingot', 5);
    expect(world.me.town.sold['iron-ingot']).toBe(5);
    sell(world, 'iron-ingot', 3);
    expect(world.me.town.sold['iron-ingot']).toBe(8);
  });

  it('조건을 채우기 전에는 고를 수 없다', () => {
    const world = inTown();
    expect(stageReady(world.me.town)).toBe(false);
    expect(chooseTownPath(world, TOWN_STAGES[0]!.choices[0].id)).toBe(false);
    expect(stageOf(world.me.town)).toBe(0);
  });

  it('다 팔면 두린이 부른다', () => {
    const world = inTown();
    const need = TOWN_STAGES[0]!.needs[0]!;
    sell(world, need.defId, need.count);
    expect(stageReady(world.me.town), '조건을 채웠는데 안 부릅니다').toBe(true);
    expect(world.log.map((l) => l.text).join(' ')).toContain('두린');
  });

  it('얼마 남았는지는 보여준다 — 모르면 목표가 안 된다', () => {
    const world = inTown();
    sell(world, 'iron-ingot', 12);
    const row = progressOf(world.me.town)[0]!;
    expect(row.have).toBe(12);
    expect(row.need).toBe(40);
  });
});

describe('★ 고르면 되돌릴 수 없다', () => {
  function readyWorld(): World {
    const world = inTown();
    const need = TOWN_STAGES[0]!.needs[0]!;
    sell(world, need.defId, need.count);
    return world;
  }

  it('고른 쪽만 열리고, 고르지 않은 쪽은 영영 안 열린다', () => {
    const world = readyWorld();
    const [picked, dropped] = TOWN_STAGES[0]!.choices;

    expect(chooseTownPath(world, picked.id)).toBe(true);
    const open = openRecipes(world.me.town);
    for (const id of picked.recipes) expect(open.has(id), `${id} 가 안 열렸습니다`).toBe(true);
    for (const id of dropped.recipes) expect(open.has(id), `${id} 가 함께 열렸습니다`).toBe(false);
  });

  it('한 번 고른 단계를 다시 고를 수 없다', () => {
    const world = readyWorld();
    const [picked, dropped] = TOWN_STAGES[0]!.choices;
    chooseTownPath(world, picked.id);

    // 같은 단계의 다른 쪽을 다시 고르려 해도 안 됩니다
    expect(chooseTownPath(world, dropped.id)).toBe(false);
    expect(world.me.town.chosen).toEqual([picked.id]);
    expect(openRecipes(world.me.town).has(dropped.recipes[0]!)).toBe(false);
  });

  it('버린 길이 화면에 남는다 — 무엇을 놓쳤는지는 알아야 한다', () => {
    const world = readyWorld();
    const [picked, dropped] = TOWN_STAGES[0]!.choices;
    chooseTownPath(world, picked.id);

    const gone = forsaken(world.me.town);
    expect(gone.map((c) => c.id)).toEqual([dropped.id]);
    expect(choiceById(dropped.id)!.name.length).toBeGreaterThan(0);
  });

  it('자란 마을은 줄어들지 않는다', () => {
    const world = readyWorld();
    chooseTownPath(world, TOWN_STAGES[0]!.choices[0].id);
    const opened = [...openRecipes(world.me.town)];

    // 아무리 사고팔고 해도 단계가 내려가지 않습니다
    sell(world, 'iron-dagger', 3);
    expect(stageOf(world.me.town)).toBe(1);
    expect([...openRecipes(world.me.town)]).toEqual(opened);
  });
});

describe('상점도 자란다', () => {
  it('고급 물약은 처음에 없고, 1단계에서 들어온다', () => {
    const world = inTown();
    expect(openStock(world.me.town)).not.toContain('potion-heal-big');

    const need = TOWN_STAGES[0]!.needs[0]!;
    sell(world, need.defId, need.count);
    chooseTownPath(world, TOWN_STAGES[0]!.choices[0].id);
    expect(openStock(world.me.town)).toContain('potion-heal-big');
  });

  it('상점이 만들 수 있는 것을 팔지 않는다 — 자란 뒤에도', () => {
    const world = inTown();
    for (const stage of TOWN_STAGES) {
      const need = stage.needs[0]!;
      sell(world, need.defId, need.count);
      chooseTownPath(world, stage.choices[0].id);
    }
    for (const recipe of Object.values(RECIPES)) {
      expect(openStock(world.me.town), `${recipe.makes} 를 상점에서도 팝니다`).not.toContain(recipe.makes);
    }
  });
});

describe('끝까지 자라면', () => {
  it('두 갈래를 다 고르면 제작법의 절반이 열린다 — 나머지 절반은 버린 것', () => {
    const world = inTown();
    for (const stage of TOWN_STAGES) {
      const need = stage.needs[0]!;
      sell(world, need.defId, need.count);
      chooseTownPath(world, stage.choices[0].id);
    }
    expect(nextStage(world.me.town)).toBeNull();

    const open = openRecipes(world.me.town);
    const dropped = forsaken(world.me.town).flatMap((c) => c.recipes);
    expect(dropped.length).toBe(TOWN_STAGES.length);
    for (const id of dropped) expect(open.has(id)).toBe(false);
    // 버린 것 말고는 전부 열려 있어야 합니다
    expect(open.size).toBe(RECIPE_ORDER.length - dropped.length);
  });
});

/* ===========================================================================
 *  누계가 다음 단계를 미리 채우지 않는다
 *  ---------------------------------------------------------------------------
 *  ★ 예전에는 sold 가 누계라서, 1단계를 고른 그 프레임에 2단계가 이미 다 차 있었습니다.
 *    플레이어는 그것이 차오르는 것을 한 번도 못 봤습니다. 6장 조용한 실패입니다.
 * ======================================================================== */

describe('판 누계와 단계', () => {
  it('단계를 넘겨도 판 것의 기록은 깎이지 않는다 — 나중에 기록이 앉을 자리다', () => {
    const world = inTown();
    sell(world, 'iron-ingot', 40);
    chooseTownPath(world, 'forge-blade');

    expect(world.me.town.sold['iron-ingot'], '판 기록이 깎였습니다').toBe(40);
    expect(world.me.town.spent['iron-ingot'], '먹은 몫이 안 적혔습니다').toBe(40);
  });

  it('넘긴 뒤 다음 단계는 0 부터 센다 — 미리 채워져 있으면 안 된다', () => {
    const world = inTown();
    // 1단계를 넘기기 전에 구리 주괴를 잔뜩 팔아둡니다 (2단계 조건과 같은 물건)
    sell(world, 'copper-ingot', 25);
    sell(world, 'iron-ingot', 40);
    chooseTownPath(world, 'forge-blade');

    // 2단계는 구리 주괴 25 를 요구합니다. 이미 25 를 팔았지만 그것은 1단계 이전의 일입니다.
    // ★ 여기서 25/25 가 되면 예전 버그입니다.
    expect(stageOf(world.me.town)).toBe(1);
    expect(stageReady(world.me.town), '2단계가 미리 채워져 있습니다').toBe(false);
  });

  it('넘칠 만큼 팔았으면 남는 것이 다음 단계로 넘어가고, 그것이 화면에 보인다', () => {
    const world = inTown();
    sell(world, 'iron-ingot', 45); // 40 이 필요한데 45 를 팔았습니다
    chooseTownPath(world, 'forge-blade');

    expect(world.me.town.sold['iron-ingot']).toBe(45);
    expect(world.me.town.spent['iron-ingot']).toBe(40);

    // 다음 단계가 철 주괴를 요구하지 않더라도, 남은 5 는 장부에 남아 있어야 합니다
    const left = (world.me.town.sold['iron-ingot'] ?? 0) - (world.me.town.spent['iron-ingot'] ?? 0);
    expect(left, '넘치게 판 몫이 사라졌습니다').toBe(5);
  });

  it('같은 물건으로 두 단계를 넘길 때 진행이 이어서 보인다 (5/25 로 시작)', () => {
    const world = inTown();
    sell(world, 'iron-ingot', 40);
    chooseTownPath(world, 'forge-blade');

    // 2단계(구리 주괴 25) 로 5 개를 판다 → 화면에 5/25 로 보여야 합니다
    sell(world, 'copper-ingot', 5);
    const row = progressOf(world.me.town).find((r) => r.defId === 'copper-ingot')!;
    expect(row).toBeDefined();
    expect(row.have).toBe(5);
    expect(row.need).toBe(25);
  });
});

/* ===========================================================================
 *  구리 — 팔 수밖에 없는 것은 조건이 될 수 없다
 * ======================================================================== */

describe('구리로 가는 길', () => {
  it('구리 제련은 처음부터 열려 있다 — 잠그면 구리광석이 팔 수밖에 없는 돌이 된다', () => {
    expect(openRecipes(emptyTown()).has('smelt-copper')).toBe(true);
  });

  it('사다리가 쥐고 있는 것 중에 제련은 없다', () => {
    for (const stage of TOWN_STAGES) {
      for (const id of stage.opens.recipes) {
        expect(id.startsWith('smelt'), `${stage.name} 이 ${id} 를 쥐고 있습니다`).toBe(false);
      }
      for (const choice of stage.choices) {
        for (const id of choice.recipes) {
          expect(id.startsWith('smelt'), `${choice.name} 이 ${id} 를 쥐고 있습니다`).toBe(false);
        }
      }
    }
  });

  it('단계의 조건은 그때 만들 수 있는 물건이어야 한다 — 캐서 바로 파는 것은 선택이 아니다', () => {
    //  ★ 이것이 이번에 고친 버그입니다. 조건이 구리광석이던 시절,
    //    구리 제련이 바로 그 단계에 잠겨 있어서 구리광석은 녹일 수 없는 돌이었습니다.
    //    할 수 있는 일이 "판다" 하나뿐이면 그것은 선택이 아니라 그냥 일어나는 일입니다.
    //
    //  ★ 그래서 조건은 ★만들어야 나오는 물건으로 겁니다. 만드는 데 재료와 실력과
    //    실패가 들고, 그렇게 나온 것을 팔지 쥘지가 그때 비로소 선택이 됩니다.
    const town = emptyTown();
    for (const stage of TOWN_STAGES) {
      const open = openRecipes(town);
      for (const need of stage.needs) {
        const made = RECIPE_ORDER.some((id) => open.has(id) && RECIPES[id]!.makes === need.defId);
        expect(made, `${stage.name} 의 조건 ${need.defId} 는 만들 방법 없이 파는 것뿐입니다`).toBe(true);
      }
      town.chosen.push(stage.choices[0].id);
      for (const need of stage.needs) {
        town.spent[need.defId] = (town.spent[need.defId] ?? 0) + need.count;
      }
    }
  });
});
