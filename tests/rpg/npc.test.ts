/**
 *  마을 사람이 무슨 말을 하는가.
 *
 *  ★ 이 파일이 생긴 이유: 이 판단이 ui/Panels.tsx 안에 있었습니다.
 *    ui 가 가방을 뒤지고 마을 단계를 읽어 줄을 골랐습니다 (4장 3번 위반).
 *    옮기면서 **한 글자도 안 바뀌었다는 것**을 여기서 지킵니다.
 */

import { describe, expect, it } from 'vitest';

import { itemDef } from '../../src/rpg/content/items';
import { DURIN } from '../../src/rpg/content/lines';
import { nextStage } from '../../src/rpg/content/town';
import { createWorld } from '../../src/rpg/core/create';
import { addItem } from '../../src/rpg/core/inventory';
import { durinSays } from '../../src/rpg/core/npc';
import { advanceTown } from '../../src/rpg/core/town';
import type { World } from '../../src/rpg/types';

/** 곡괭이를 든 채 시작합니다 (광부) */
function fresh(): World {
  const world = createWorld('시험', 'miner');
  world.me.backpack = world.me.backpack.filter((s) => itemDef(s.defId).tool !== 'pickaxe');
  return world;
}

function withPickaxe(): World {
  const world = fresh();
  addItem(world, 'pickaxe', 1);
  return world;
}

describe('대장장이 두린', () => {
  it('곡괭이가 없으면 곡괭이부터 말한다 — 아무것도 시작할 수 없는 자리다', () => {
    expect(durinSays(fresh())).toBe(DURIN.noPickaxe);
  });

  it('곡괭이는 있고 쇠가 없으면 어디로 가라고 말한다', () => {
    expect(durinSays(withPickaxe())).toBe(DURIN.noIron);
  });

  it('쇠를 가져오면 다음 단계의 흘리는 말이 뒤에 붙는다', () => {
    const world = withPickaxe();
    addItem(world, 'iron-ingot', 1);

    const stage = nextStage(world.me.town)!;
    expect(durinSays(world)).toBe(`${DURIN.broughtIron} ${stage.hint}`);
    // ★ 무엇이 열리는지는 안 적혀 있습니다 (목적지-기획안 5.4)
    expect(stage.hint).not.toContain(stage.name);
  });

  it('단계 조건이 차면 아래를 보라고 한다', () => {
    const world = withPickaxe();
    addItem(world, 'iron-ore', 1);
    world.me.town.sold['iron-ingot'] = 999; // 조건을 채웁니다

    expect(durinSays(world)).toBe(DURIN.stageReady);
  });

  it('열 단계가 더 없으면 그냥 만들어 보라고 한다', () => {
    const world = withPickaxe();
    addItem(world, 'iron-ingot', 1);

    // 있는 단계를 전부 올립니다
    for (let guard = 0; guard < 20; guard++) {
      const stage = nextStage(world.me.town);
      if (!stage) break;
      world.me.town.sold[stage.needs[0]!.defId] = 999;
      advanceTown(world, stage.choices?.[0]?.id ?? null);
    }
    expect(nextStage(world.me.town), '아직 올릴 단계가 남았습니다').toBeFalsy();

    expect(durinSays(world)).toBe(DURIN.keepAtIt);
  });

  it('★ 표에 죽은 줄이 없다 — 적어놓고 안 쓰는 말은 없는 말이다', () => {
    const said = new Set<string>();

    said.add(durinSays(fresh()));
    said.add(durinSays(withPickaxe()));

    const ready = withPickaxe();
    addItem(ready, 'iron-ore', 1);
    ready.me.town.sold['iron-ingot'] = 999;
    said.add(durinSays(ready));

    const carrying = withPickaxe();
    addItem(carrying, 'iron-ingot', 1);
    said.add(durinSays(carrying));

    const done = withPickaxe();
    addItem(done, 'iron-ingot', 1);
    for (let guard = 0; guard < 20; guard++) {
      const stage = nextStage(done.me.town);
      if (!stage) break;
      done.me.town.sold[stage.needs[0]!.defId] = 999;
      advanceTown(done, stage.choices?.[0]?.id ?? null);
    }
    said.add(durinSays(done));

    const unused = Object.entries(DURIN)
      .filter(([, line]) => ![...said].some((s) => s.startsWith(line)))
      .map(([key]) => key);
    expect(unused, `아무 상황에서도 안 나오는 줄: ${unused.join(', ')}`).toEqual([]);
  });
});
