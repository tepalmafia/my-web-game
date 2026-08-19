/**
 *  물약을 못 마시는 다섯 가지.
 *
 *  ★ 전부 조용히 false 만 돌려주고 있었습니다. Q 를 눌러도 아무 일이 없으면
 *    물약이 없는 건지, 아직인 건지, 이미 다 찬 건지 알 수 없습니다.
 *
 *  ★ 알리는 방식은 이유마다 다릅니다 — 싸우다 Q 를 연타하는 상황이 기준입니다.
 *    급한 것(물약이 없다)만 크게 띄우고, 나머지는 조용히 알립니다.
 */

import { describe, expect, it } from 'vitest';

import { mapDef } from '../../src/rpg/content/maps';
import { itemDef } from '../../src/rpg/content/items';
import { drinkBestPotion, drinkPotion } from '../../src/rpg/core/commands';
import { createWorld } from '../../src/rpg/core/create';
import { addItem } from '../../src/rpg/core/inventory';
import { derive } from '../../src/rpg/core/stats';
import { enterMap } from '../../src/rpg/core/world';
import type { World } from '../../src/rpg/types';

const DT = 1 / 20;

function hurtInForest(): World {
  const world = createWorld('시험', 'miner');
  enterMap(world, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);
  world.me.hp = 5;
  // 시작 물약을 비웁니다 — "물약이 없다" 를 시험하려면 정말 없어야 합니다
  world.me.backpack = world.me.backpack.filter((s) => !itemDef(s.defId).healHp);
  world.log.length = 0;
  world.floaters.length = 0;
  world.toast = null;
  return world;
}

/** 화면에 무엇이든 나왔는가 */
function said(world: World): boolean {
  return world.log.length > 0 || world.floaters.length > 0 || world.toast !== null;
}

describe('물약을 못 마신 이유', () => {
  it('물약이 없으면 크게 알린다 — 죽기 직전이니까', () => {
    const world = hurtInForest();
    expect(drinkBestPotion(world)).toBe(false);
    expect(world.toast?.text, '토스트가 없습니다').toContain('물약이 없습니다');
  });

  it('아직 때가 아니면 조용히 알린다 — 토스트로 띄우지 않는다', () => {
    const world = hurtInForest();
    addItem(world, 'potion-heal', 2);
    expect(drinkBestPotion(world), '첫 모금은 들어가야 합니다').toBe(true);

    world.toast = null;
    world.floaters.length = 0;
    expect(drinkBestPotion(world), '연달아 마셔졌습니다').toBe(false);
    expect(world.floaters.length, '아무 표시도 없습니다').toBeGreaterThan(0);
    expect(world.toast, '토스트로 띄우면 싸우는 중에 시끄럽습니다').toBeNull();
  });

  it('체력이 가득이면 조용히 알린다', () => {
    const world = hurtInForest();
    addItem(world, 'potion-heal', 1);
    world.me.hp = derive(world.me).maxHp;

    expect(drinkBestPotion(world)).toBe(false);
    expect(world.floaters.map((f) => f.text).join(' ')).toContain('가득');
    expect(world.toast).toBeNull();
  });

  it('쓰러진 채로는 마실 수 없다고 알린다', () => {
    const world = hurtInForest();
    addItem(world, 'potion-heal', 1);
    world.me.dead = true;

    expect(drinkBestPotion(world)).toBe(false);
    expect(world.log.map((line) => line.text).join(' ')).toContain('쓰러진');
  });

  it('마실 수 있는 것이 아니면 그렇게 알린다', () => {
    const world = hurtInForest();
    addItem(world, 'iron-ore', 1);
    const ore = world.me.backpack.find((s) => s.defId === 'iron-ore')!;

    expect(drinkPotion(world, ore.uid)).toBe(false);
    expect(world.log.map((line) => line.text).join(' ')).toContain('마실 수 있는 것이 아닙니다');
  });

  it('없는 물건을 마시라고 해도 조용히 넘어가지 않는다', () => {
    const world = hurtInForest();
    expect(drinkPotion(world, 999999)).toBe(false);
    expect(said(world), '아무 말도 없습니다').toBe(true);
  });

  it('다섯 가지가 서로 다른 말을 한다', () => {
    const texts = new Set<string>();

    for (const [name, prepare] of [
      ['없음', (w: World) => { /* 아무것도 안 넣습니다 */ void w; }],
      ['가득', (w: World) => { addItem(w, 'potion-heal', 1); w.me.hp = derive(w.me).maxHp; }],
      ['죽음', (w: World) => { addItem(w, 'potion-heal', 1); w.me.dead = true; }],
      ['아직', (w: World) => { addItem(w, 'potion-heal', 2); drinkBestPotion(w); w.log.length = 0; w.floaters.length = 0; w.toast = null; }],
    ] as const) {
      const world = hurtInForest();
      prepare(world);
      drinkBestPotion(world);
      const said = [...world.log.map((l) => l.text), ...world.floaters.map((f) => f.text), world.toast?.text ?? '']
        .filter(Boolean)
        .join(' | ');
      expect(said, `${name} 일 때 아무 말도 없습니다`).not.toBe('');
      texts.add(said.replace(/[\d.]+/g, '#')); // 남은 시간 숫자는 지우고 견줍니다
    }

    expect(texts.size, `겹치는 말: ${[...texts].join(' // ')}`).toBe(4);
  });

  it('같은 말이 연달아 쏟아지지 않는다', () => {
    const world = hurtInForest();
    world.me.hp = derive(world.me).maxHp;
    addItem(world, 'potion-heal', 1);

    // 싸우는 중에 Q 를 연타하는 상황
    for (let i = 0; i < 40; i++) {
      world.time += DT;
      drinkBestPotion(world);
    }

    expect(world.floaters.length, `${world.floaters.length} 개가 쏟아졌습니다`).toBe(1);
  });

  it('시간이 흐르면 다시 알려준다 — 영영 입을 다물지는 않는다', () => {
    const world = hurtInForest();
    world.me.hp = derive(world.me).maxHp;
    addItem(world, 'potion-heal', 1);

    drinkBestPotion(world);
    expect(world.floaters.length).toBe(1);

    world.time += 10;
    drinkBestPotion(world);
    expect(world.floaters.length).toBe(2);
  });
});
