/**
 *  마을 사람이 무슨 말을 하는가.
 *
 *  ★ 이 파일이 생긴 이유: 이 판단이 ui/Panels.tsx 안에 있었습니다.
 *    ui 가 가방을 뒤지고 마을 단계를 읽어 줄을 골랐습니다 (4장 3번 위반).
 *    옮기면서 **한 글자도 안 바뀌었다는 것**을 여기서 지킵니다.
 */

import { describe, expect, it } from 'vitest';

import { itemDef } from '../../src/rpg/content/items';
import { mapDef } from '../../src/rpg/content/maps';
import { DURIN, DURIN_NOTES } from '../../src/rpg/content/lines';
import { nextStage } from '../../src/rpg/content/town';
import { createWorld } from '../../src/rpg/core/create';
import { addItem } from '../../src/rpg/core/inventory';
import { durinSays } from '../../src/rpg/core/npc';
import { advanceTown } from '../../src/rpg/core/town';
import { enterMap } from '../../src/rpg/core/world';
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

describe('대장장이 두린 — 안내', () => {
  it('곡괭이가 없으면 곡괭이부터 말한다 — 아무것도 시작할 수 없는 자리다', () => {
    expect(durinSays(fresh()).guide).toBe(DURIN.noPickaxe);
  });

  it('곡괭이는 있고 쇠가 없으면 어디로 가라고 말한다', () => {
    expect(durinSays(withPickaxe()).guide).toBe(DURIN.noIron);
  });

  it('쇠를 가져오면 다음 단계의 흘리는 말이 뒤에 붙는다', () => {
    const world = withPickaxe();
    addItem(world, 'iron-ingot', 1);

    const stage = nextStage(world.me.town)!;
    expect(durinSays(world).guide).toBe(`${DURIN.broughtIron} ${stage.hint}`);
    // ★ 무엇이 열리는지는 안 적혀 있습니다 (목적지-기획안 5.4)
    expect(stage.hint).not.toContain(stage.name);
  });

  it('단계 조건이 차면 아래를 보라고 한다', () => {
    const world = withPickaxe();
    addItem(world, 'iron-ore', 1);
    world.me.town.sold['iron-ingot'] = 999; // 조건을 채웁니다

    expect(durinSays(world).guide).toBe(DURIN.stageReady);
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

    expect(durinSays(world).guide).toBe(DURIN.keepAtIt);
  });

  it('★ 표에 죽은 줄이 없다 — 적어놓고 안 쓰는 말은 없는 말이다', () => {
    const said = new Set<string>();

    said.add(durinSays(fresh()).guide);
    said.add(durinSays(withPickaxe()).guide);

    const ready = withPickaxe();
    addItem(ready, 'iron-ore', 1);
    ready.me.town.sold['iron-ingot'] = 999;
    said.add(durinSays(ready).guide);

    const carrying = withPickaxe();
    addItem(carrying, 'iron-ingot', 1);
    said.add(durinSays(carrying).guide);

    const done = withPickaxe();
    addItem(done, 'iron-ingot', 1);
    for (let guard = 0; guard < 20; guard++) {
      const stage = nextStage(done.me.town);
      if (!stage) break;
      done.me.town.sold[stage.needs[0]!.defId] = 999;
      advanceTown(done, stage.choices?.[0]?.id ?? null);
    }
    said.add(durinSays(done).guide);

    const unused = Object.entries(DURIN)
      .filter(([, line]) => ![...said].some((s) => s.startsWith(line)))
      .map(([key]) => key);
    expect(unused, `아무 상황에서도 안 나오는 줄: ${unused.join(', ')}`).toEqual([]);
  });
});

/* ===========================================================================
 *  인정 — 도달했을 때만 얹힙니다 (이야기-기획안 2.2)
 *
 *  ★ 안내는 늘 있습니다. 인정이 생겨도 안내가 사라지면 안 됩니다 —
 *    이 게임에는 퀘스트가 없어서 그 한 줄이 유일한 길잡이입니다.
 * ======================================================================== */

const NOTE = Object.fromEntries(DURIN_NOTES.map((n) => [n.id, n.line]));

describe('대장장이 두린 — 인정', () => {
  it('아무 데도 안 갔으면 인정할 것이 없다', () => {
    expect(durinSays(withPickaxe()).noted).toBeNull();
  });

  it('★ 인정이 생겨도 안내는 그대로 있다 — 두 겹이다', () => {
    const world = withPickaxe();
    enterMap(world, 'mine-deep', mapDef('mine-deep').entryTx, mapDef('mine-deep').entryTy);

    const said = durinSays(world);
    expect(said.noted, '2층에 다녀왔는데 아무 말도 안 합니다').toBe(NOTE['went-below']);
    expect(said.guide.length, '안내가 사라졌습니다').toBeGreaterThan(0);
  });

  it('★ 발도르의 것을 줍기 전에는 그 말을 안 한다', () => {
    const world = withPickaxe();
    enterMap(world, 'mine-deep', mapDef('mine-deep').entryTx, mapDef('mine-deep').entryTy);

    expect(durinSays(world).noted).not.toBe(NOTE['baldor']);
  });

  it('★ 들고 가야 알아본다 — 2층에 다녀온 것만으로는 모른다', () => {
    const world = withPickaxe();
    enterMap(world, 'mine-deep', mapDef('mine-deep').entryTx, mapDef('mine-deep').entryTy);
    expect(durinSays(world).noted).toBe(NOTE['went-below']);

    addItem(world, 'baldor-pickaxe', 1);
    expect(durinSays(world).noted, '자루를 들고 갔는데 못 알아봅니다').toBe(NOTE['baldor']);
  });

  it('내려놓으면 도로 모른다 — 보여준 것이 아니다', () => {
    const world = withPickaxe();
    enterMap(world, 'mine-deep', mapDef('mine-deep').entryTx, mapDef('mine-deep').entryTy);
    addItem(world, 'baldor-pickaxe', 1);
    expect(durinSays(world).noted).toBe(NOTE['baldor']);

    world.me.backpack = world.me.backpack.filter((s) => s.defId !== 'baldor-pickaxe');
    expect(durinSays(world).noted).toBe(NOTE['went-below']);
  });

  it('★ 인정 표에 죽은 줄이 없다', () => {
    const world = withPickaxe();
    enterMap(world, 'mine-deep', mapDef('mine-deep').entryTx, mapDef('mine-deep').entryTy);
    const below = durinSays(world).noted;
    addItem(world, 'baldor-pickaxe', 1);
    const baldor = durinSays(world).noted;

    const seen = new Set([below, baldor]);
    const unused = DURIN_NOTES.filter((n) => !seen.has(n.line)).map((n) => n.id);
    expect(unused, `아무 상황에서도 안 나오는 줄: ${unused.join(', ')}`).toEqual([]);
  });
});

/* ===========================================================================
 *  발도르가 남긴 것 — 2층 바닥에 하나
 * ======================================================================== */

describe('발도르의 낡은 곡괭이', () => {
  it('★ 처음 2층에 들어가면 바닥에 놓여 있다', () => {
    const world = withPickaxe();
    const def = mapDef('mine-deep');
    enterMap(world, 'mine-deep', def.entryTx, def.entryTy);

    expect(world.ground.some((g) => g.defId === 'baldor-pickaxe'), '바닥에 없습니다').toBe(true);
  });

  it('★ 시간이 지나도 안 삭는다 — 사람이 놓은 것이 아니라 원래 있던 것이다', () => {
    const world = withPickaxe();
    const def = mapDef('mine-deep');
    enterMap(world, 'mine-deep', def.entryTx, def.entryTy);

    const relic = world.ground.find((g) => g.defId === 'baldor-pickaxe')!;
    expect(relic.until, '언젠가 사라지게 되어 있습니다').toBeNull();
  });

  it('★ 두 번째로 들어가면 또 놓이지 않는다', () => {
    const world = withPickaxe();
    const def = mapDef('mine-deep');
    enterMap(world, 'mine-deep', def.entryTx, def.entryTy);
    enterMap(world, 'mine', mapDef('mine').entryTx, mapDef('mine').entryTy);
    enterMap(world, 'mine-deep', def.entryTx, def.entryTy);

    const count = world.ground.filter((g) => g.defId === 'baldor-pickaxe').length;
    expect(count, `${count}개가 놓여 있습니다`).toBe(1);
  });

  it('두고 나갔다 돌아와도 그대로 있다', () => {
    const world = withPickaxe();
    const def = mapDef('mine-deep');
    enterMap(world, 'mine-deep', def.entryTx, def.entryTy);
    world.time += 3600; // 한 시간이 지나도
    enterMap(world, 'mine', mapDef('mine').entryTx, mapDef('mine').entryTy);
    enterMap(world, 'mine-deep', def.entryTx, def.entryTy);

    expect(world.ground.some((g) => g.defId === 'baldor-pickaxe')).toBe(true);
  });

  it('자루에 이름이 새겨져 있고, 누구인지는 안 적혀 있다', () => {
    const desc = itemDef('baldor-pickaxe').desc;
    expect(desc).toContain('발도르');
    expect(desc).toContain('누구인지는 적혀 있지 않습니다');
  });
});
