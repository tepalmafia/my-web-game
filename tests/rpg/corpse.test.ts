/**
 *  첫 죽음 — 가방을 떨구고 되찾으러 간다 (전체설계 10절 A1.5).
 *
 *  ★ 되찾으러 가는 길이 또 죽을 만큼 위험하면 무게가 아니라 함정입니다.
 *    그래서 연장과 입은 것은 지킵니다 — 맨손으로 되살아나면 되찾으러 갈
 *    수단조차 없습니다.
 */

import { describe, expect, it } from 'vitest';

import { DEATH, LOOT } from '../../src/rpg/balance';
import { itemDef } from '../../src/rpg/content/items';
import { mapDef } from '../../src/rpg/content/maps';
import { takeMyPack } from '../../src/rpg/core/commands';
import { createWorld } from '../../src/rpg/core/create';
import { die, revive } from '../../src/rpg/core/death';
import { step } from '../../src/rpg/core/engine';
import { addItem, countOf } from '../../src/rpg/core/inventory';
import { exportSave, readSaveCode } from '../../src/rpg/core/save';
import { enterMap } from '../../src/rpg/core/world';
import type { World } from '../../src/rpg/types';

/** 광산에서 광석을 지고 있다가 쓰러진 판 */
function fell(mapId = 'mine'): World {
  const world = createWorld('시험', 'miner');
  const def = mapDef(mapId);
  enterMap(world, mapId, def.entryTx, def.entryTy);
  addItem(world, 'iron-ore', 3);
  world.log.length = 0;
  die(world);
  return world;
}

describe('쓰러지면 가방을 떨군다', () => {
  it('가방은 떨구고, 입은 것과 연장은 지킨다', () => {
    const world = fell();
    const me = world.me;

    expect(me.corpse, '시체가 안 생겼습니다').not.toBeNull();
    expect(countOf(me, 'iron-ore'), '광석을 그대로 들고 있습니다').toBe(0);

    // ★ 이 둘이 없으면 되찾으러 갈 수단이 없습니다
    expect(countOf(me, 'pickaxe'), '곡괭이까지 떨궜습니다').toBeGreaterThan(0);
    expect(countOf(me, 'hammer'), '망치까지 떨궜습니다').toBeGreaterThan(0);
    expect(me.equipped.weapon, '입은 무기까지 떨궜습니다').not.toBeNull();
  });

  it('떨군 것이 시체 안에 그대로 들어 있다', () => {
    // 시작 짐이 바뀌어도 흔들리지 않게, 죽기 직전의 연장 아닌 것과 견줍니다
    const before = createWorld('시험', 'miner');
    addItem(before, 'iron-ore', 3);
    const expected = before.me.backpack
      .filter((s) => itemDef(s.defId).kind !== 'tool')
      .reduce((sum, s) => sum + s.count, 0);

    const world = fell();
    const inside = world.me.corpse!.items.reduce((sum, s) => sum + s.count, 0);
    expect(inside).toBe(expected);
    expect(world.me.corpse!.items.some((s) => itemDef(s.defId).kind === 'tool')).toBe(false);
  });

  it('어디에 떨어뜨렸는지 말해준다 — 모르면 되찾을 수 없다', () => {
    const world = fell();
    const said = world.log.map((l) => l.text).join(' ');
    expect(said).toContain('가방을 떨어뜨렸습니다');
    expect(said, '어느 지역인지 안 알려줍니다').toContain(mapDef('mine').name);
  });

  it('골드는 예전대로 10% 만 잃는다', () => {
    const world = createWorld('시험', 'miner');
    world.me.gold = 1000;
    die(world);
    expect(world.me.gold).toBe(1000 - Math.floor(1000 * DEATH.goldLossRatio));
  });

  it('떨굴 것이 없으면 시체를 만들지 않는다 — 빈 시체는 아무 선택도 아니다', () => {
    const world = createWorld('시험', 'miner');
    world.me.backpack = world.me.backpack.filter((s) => itemDef(s.defId).kind === 'tool');
    die(world);
    expect(world.me.corpse).toBeNull();
  });
});

describe('시체는 하나뿐이다', () => {
  it('두 번 죽으면 앞의 것이 사라지고, 반드시 말한다', () => {
    const world = fell();
    const first = world.me.corpse!;

    world.me.dead = false;
    addItem(world, 'iron-ore', 2);
    world.log.length = 0;
    die(world);

    expect(world.me.corpse, '시체가 둘이 됐습니다').not.toBe(first);
    expect(world.me.corpse!.items.reduce((s, x) => s + x.count, 0)).toBe(2);
    expect(
      world.log.map((l) => l.text).join(' '),
      '앞의 짐이 조용히 사라졌습니다',
    ).toContain('이제 사라졌습니다');
  });
});

describe('되찾으러 간다', () => {
  it('★ 마을에서 되살아나도 시체는 남는다', () => {
    // ★ revive() 는 enterMap(town) 을 부릅니다. A1 에서 바닥이 stash 로 바뀌었는데,
    //   시체는 인물에 붙어 있으므로 그 영향을 받지 않아야 합니다.
    const world = fell();
    revive(world);

    expect(world.mapId).toBe('town');
    expect(world.me.corpse, '되살아났더니 시체가 사라졌습니다').not.toBeNull();
    expect(world.me.corpse!.mapId).toBe('mine');
  });

  it('눌러서 되찾으면 가방으로 돌아온다', () => {
    const world = fell();
    const spot = world.me.corpse!.pos;
    world.me.dead = false;
    world.me.pos = { ...spot };

    expect(takeMyPack(world, spot.x, spot.y)).toBe(true);
    expect(countOf(world.me, 'iron-ore')).toBe(3);
    expect(world.me.corpse, '되찾았는데 시체가 남았습니다').toBeNull();
  });

  it('다 못 들면 드는 만큼만 가져가고 나머지는 남는다', () => {
    const world = fell();
    const spot = world.me.corpse!.pos;
    world.me.dead = false;
    world.me.pos = { ...spot };
    // 광석 여러 덩이를 넣기엔 모자란 힘으로 만들어 둡니다
    world.me.str = 1;
    world.me.corpse!.items = [{ uid: 9001, defId: 'iron-ore', count: 40 }];

    takeMyPack(world, spot.x, spot.y);
    expect(world.me.corpse, '못 드는데 시체가 없어졌습니다').not.toBeNull();
    expect(world.log.map((l) => l.text).join(' ')).toContain('무거워서 두고 갑니다');
  });

  it('다른 지역에서는 눌러도 안 잡힌다', () => {
    const world = fell();
    const spot = world.me.corpse!.pos;
    revive(world);
    expect(takeMyPack(world, spot.x, spot.y)).toBe(false);
    expect(world.me.corpse).not.toBeNull();
  });
});

describe('언제 사라지는가', () => {
  it('놓아둔 것과 같은 시간을 버틴다', () => {
    const world = fell();
    expect(world.me.corpse!.until).toBe(world.time + LOOT.placedLifetime);
  });

  it('시간이 다하면 사라지고, 조용히 사라지지 않는다', () => {
    const world = fell();
    world.me.dead = false;
    world.log.length = 0;

    world.time += LOOT.placedLifetime + 1;
    step(world, 1 / 30);

    expect(world.me.corpse).toBeNull();
    expect(
      world.log.map((l) => l.text).join(' '),
      '말없이 없어졌습니다 — 되찾으러 갔다가 헛걸음합니다',
    ).toContain('사라졌습니다');
  });

  it('껐다 켜도 시체는 그 자리에 있다', () => {
    const world = fell();
    world.me.dead = false;

    const back = readSaveCode(exportSave(world));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.world.me.corpse, '불러오니 시체가 없어졌습니다').not.toBeNull();
    expect(back.world.me.corpse!.mapId).toBe('mine');
  });

  it('시체를 넣기 전의 옛 기록도 그냥 읽힌다', () => {
    const world = createWorld('시험', 'miner');
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(exportSave(world)), (c) => c.charCodeAt(0)),
    );
    const packed = JSON.parse(json) as { me: { corpse?: unknown } };
    delete packed.me.corpse;

    const bytes = new TextEncoder().encode(JSON.stringify(packed));
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);

    const back = readSaveCode(btoa(binary));
    expect(back.ok, '시체가 없는 기록을 못 읽습니다').toBe(true);
    if (!back.ok) return;
    expect(back.world.me.corpse).toBeNull();
  });
});
