/**
 *  놓기 — 짐을 고른다 (전체설계 3.2).
 *
 *  ★ 이 게임에서 짐을 더는 길은 그동안 "마을에서 파는 것" 하나뿐이었습니다.
 *    무게가 뼈대인데 버리는 판단이 없었습니다.
 *
 *  ★ 세 조건이 이 파일이 지키는 것입니다.
 *    선택   무엇을 들고 나갈까. 무엇을 버릴까
 *    불확실 돌아왔을 때 남아 있을까
 *    비가역 사라진다
 */

import { describe, expect, it } from 'vitest';

import { LOOT } from '../../src/rpg/balance';
import { mapDef } from '../../src/rpg/content/maps';
import { dropItem, takeGround } from '../../src/rpg/core/commands';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { addItem, countOf } from '../../src/rpg/core/inventory';
import { exportSave, readSaveCode } from '../../src/rpg/core/save';
import { enterMap } from '../../src/rpg/core/world';
import type { World } from '../../src/rpg/types';

function withItem(mapId = 'town', defId = 'hammer'): World {
  const world = createWorld('시험', 'miner');
  const def = mapDef(mapId);
  enterMap(world, mapId, def.entryTx, def.entryTy);
  world.ground.length = 0;
  addItem(world, defId, 1);
  world.log.length = 0;
  return world;
}

// ★ 광부는 곡괭이·망치를 들고 시작합니다 — 개수는 늘 '전과 비교' 로 봅니다

/** 가방에서 그 물건의 uid */
const uidOf = (world: World, defId: string) =>
  world.me.backpack.find((s) => s.defId === defId)!.uid;

describe('놓기', () => {
  it('가방에서 빠지고 바닥에 놓인다', () => {
    const world = withItem();
    const before = countOf(world.me, 'hammer');

    expect(dropItem(world, uidOf(world, 'hammer'), 1)).toBe(true);

    expect(countOf(world.me, 'hammer'), '가방에 그대로 있습니다').toBe(before - 1);
    expect(world.ground, '바닥에 안 놓였습니다').toHaveLength(1);
    expect(world.ground[0]!.placed).toBe(true);
  });

  it('놓으면 짐이 실제로 가벼워진다 — 그게 놓는 이유다', () => {
    const world = withItem();
    const heavy = world.me.backpack.reduce(
      (sum, s) => sum + s.count, 0);
    dropItem(world, uidOf(world, 'hammer'), 1);
    expect(world.me.backpack.reduce((sum, s) => sum + s.count, 0)).toBeLessThan(heavy);
  });

  it('조용히 놓지 않는다 — 없어지는지 아닌지 말해준다', () => {
    const town = withItem('town');
    dropItem(town, uidOf(town, 'hammer'), 1);
    expect(town.log.map((l) => l.text).join(' ')).toContain('없어지지 않습니다');

    const field = withItem('forest');
    dropItem(field, uidOf(field, 'hammer'), 1);
    expect(field.log.map((l) => l.text).join(' ')).toContain('사라집니다');
  });
});

describe('놓아둔 것은 되집히지 않는다', () => {
  it('★ 밟고 서 있어도 저절로 주워지지 않는다', () => {
    // ★ 이게 없으면 놓자마자 그 자리에서 되집습니다 — 놓을 수가 없습니다
    const world = withItem();
    const before = countOf(world.me, 'hammer');
    dropItem(world, uidOf(world, 'hammer'), 1);

    for (let i = 0; i < 60; i++) step(world, 1 / 30);   // 2초 동안 그 위에 서 있기

    expect(world.ground, '저절로 주워졌습니다').toHaveLength(1);
    expect(countOf(world.me, 'hammer')).toBe(before - 1);
  });

  it('누르면 가져온다', () => {
    const world = withItem();
    const before = countOf(world.me, 'hammer');
    dropItem(world, uidOf(world, 'hammer'), 1);
    const spot = world.ground[0]!.pos;

    expect(takeGround(world, spot.x, spot.y)).toBe(true);
    expect(countOf(world.me, 'hammer'), '눌렀는데 안 가져왔습니다').toBe(before);
    expect(world.ground).toHaveLength(0);
  });

  it('몬스터가 떨군 것은 예전처럼 밟으면 주워진다', () => {
    const world = withItem();
    world.ground.push({
      id: 999, defId: 'iron-ore', count: 1,
      pos: { ...world.me.pos }, until: world.time + LOOT.lifetime,
    });

    step(world, 1 / 30);

    expect(countOf(world.me, 'iron-ore'), '전리품 줍기가 망가졌습니다').toBe(1);
  });
});

describe('언제 사라지는가', () => {
  it('마을에 놓은 것은 안 사라진다 — 아니면 놓는 것이 함정이 된다', () => {
    const world = withItem('town');
    dropItem(world, uidOf(world, 'hammer'), 1);
    expect(world.ground[0]!.until, '마을에 놓은 것에 수명이 붙었습니다').toBeNull();

    world.time += LOOT.placedLifetime * 10;
    step(world, 1 / 30);
    expect(world.ground, '마을에 둔 것이 사라졌습니다').toHaveLength(1);
  });

  it('밖에 놓은 것은 정해진 시간 뒤에 사라진다', () => {
    const world = withItem('forest');
    dropItem(world, uidOf(world, 'hammer'), 1);
    expect(world.ground[0]!.until).toBe(world.time + LOOT.placedLifetime);

    world.time += LOOT.placedLifetime - 1;
    step(world, 1 / 30);
    expect(world.ground, '아직 있어야 합니다').toHaveLength(1);

    world.time += 2;
    step(world, 1 / 30);
    expect(world.ground, '사라지지 않았습니다').toHaveLength(0);
  });

  it('놓아둔 것은 전리품보다 훨씬 오래 간다 — 왕복할 틈이 있어야 한다', () => {
    expect(LOOT.placedLifetime).toBeGreaterThan(LOOT.lifetime * 5);
  });
});

describe('저장을 건너서도 남는다', () => {
  it('★ 껐다 켜도 놓아둔 것이 그 자리에 있다', () => {
    //  ★ 지형은 씨앗으로 다시 만들지만 사람이 놓은 것은 다시 만들 수 없습니다.
    //    저장에 안 넣으면 새로고침 한 번에 사라집니다.
    const world = withItem('town');
    dropItem(world, uidOf(world, 'hammer'), 1);

    const back = readSaveCode(exportSave(world));
    expect(back.ok).toBe(true);
    if (!back.ok) return;

    expect(back.world.ground, '불러오니 없어졌습니다').toHaveLength(1);
    expect(back.world.ground[0]!.defId).toBe('hammer');
    expect(back.world.ground[0]!.placed).toBe(true);
  });

  it('다른 지역에 둔 것도 남는다', () => {
    const world = withItem('forest');
    dropItem(world, uidOf(world, 'hammer'), 1);
    enterMap(world, 'town', mapDef('town').entryTx, mapDef('town').entryTy);
    expect(world.ground).toHaveLength(0);          // 눈앞에서는 치워졌지만

    const back = readSaveCode(exportSave(world));
    expect(back.ok).toBe(true);
    if (!back.ok) return;

    enterMap(back.world, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);
    expect(back.world.ground, '숲에 둔 것이 사라졌습니다').toHaveLength(1);
  });

  it('저장해 둔 사이에 수명이 다한 것은 없어져 있다', () => {
    const world = withItem('forest');
    dropItem(world, uidOf(world, 'hammer'), 1);
    const code = exportSave(world);

    // 그 뒤로 한참 지난 세계에서 열어봅니다
    const later = readSaveCode(code);
    expect(later.ok).toBe(true);
    if (!later.ok) return;
    later.world.time += LOOT.placedLifetime * 2;
    step(later.world, 1 / 30);
    expect(later.world.ground, '밖에 둔 것이 영원히 남았습니다').toHaveLength(0);
  });

  it('바닥이 없던 옛 기록도 그냥 읽힌다', () => {
    const world = withItem('town');
    const packed = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(exportSave(world)), (c) => c.charCodeAt(0)),
      ),
    ) as { ground?: unknown };
    delete packed.ground;

    const bytes = new TextEncoder().encode(JSON.stringify(packed));
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);

    const back = readSaveCode(btoa(binary));
    expect(back.ok, '바닥이 없는 기록을 못 읽습니다').toBe(true);
    if (!back.ok) return;
    expect(back.world.ground).toEqual([]);
  });
});
