/**
 *  강화 — 이 게임에서 가장 잔인하고, 그래서 가장 정확해야 하는 규칙.
 *
 *  여기가 틀리면 부서지지 말아야 할 장비가 부서집니다. 되돌릴 방법이 없으므로
 *  확률표와 실제 결과가 맞는지, 축복 주문서가 정말로 장비를 지켜주는지를 표본으로 확인합니다.
 */

import { describe, expect, it } from 'vitest';

import { ENHANCE_CHANCE, MAX_PLUS } from '../../src/rpg/balance';
import { createWorld } from '../../src/rpg/core/create';
import { enhance, enhanceChance, findEnhanceable } from '../../src/rpg/core/enhance';
import { addItem, countOf } from '../../src/rpg/core/inventory';
import type { EnhanceOutcome } from '../../src/rpg/core/enhance';
import type { World } from '../../src/rpg/types';

/** 주문서를 넉넉히 쥐고, 무기를 원하는 강화 수치로 맞춘 판을 하나 만듭니다 */
function ready(seed: number, plus: number, scrolls = 1): World {
  const world = createWorld('대장장이', 'knight');
  world.seed = seed;
  world.player.equipped.weapon!.plus = plus;
  addItem(world, 'scroll-enhance', scrolls);
  addItem(world, 'scroll-blessed', scrolls);
  return world;
}

/** 같은 조건으로 여러 번 두들겨 보고 결과를 셉니다 */
function trial(plus: number, scrollId: string, times: number): Record<EnhanceOutcome, number> {
  const tally: Record<EnhanceOutcome, number> = { success: 0, reset: 0, destroyed: 0, blocked: 0 };
  for (let i = 0; i < times; i++) {
    const world = ready(i * 7919 + 13, plus);
    tally[enhance(world, world.player.equipped.weapon!.uid, scrollId)] += 1;
  }
  return tally;
}

describe('확률표대로 성공한다', () => {
  it('+3 까지는 100% 성공한다 (여기까지는 안전합니다)', () => {
    for (const plus of [0, 1, 2]) {
      const tally = trial(plus, 'scroll-enhance', 60);
      expect(tally.success, `+${plus} 에서 실패가 나왔습니다`).toBe(60);
      expect(tally.destroyed).toBe(0);
    }
  });

  it('+3→+4 는 표에 적힌 75% 언저리에서 성공한다', () => {
    const times = 2000;
    const tally = trial(3, 'scroll-enhance', times);
    const rate = tally.success / times;

    expect(enhanceChance(3)).toBe(ENHANCE_CHANCE[3]);
    expect(rate).toBeGreaterThan(ENHANCE_CHANCE[3]! - 0.04);
    expect(rate).toBeLessThan(ENHANCE_CHANCE[3]! + 0.04);
    // 성공하지 않으면 반드시 부서집니다 — 그 사이는 없습니다
    expect(tally.success + tally.destroyed).toBe(times);
  });

  it('강화 수치가 높아질수록 성공률이 떨어진다', () => {
    const low = trial(4, 'scroll-enhance', 400).success;
    const high = trial(8, 'scroll-enhance', 400).success;
    expect(high).toBeLessThan(low);
  });
});

describe('일반 주문서로 실패하면 장비가 사라진다', () => {
  it('착용 중이던 무기는 그 칸이 비고, 가방에도 남지 않는다', () => {
    let destroyed = 0;
    for (let i = 0; i < 200 && destroyed === 0; i++) {
      const world = ready(i * 104729 + 7, 9); // +9 → +10 은 8% 라 금방 부서집니다
      const uid = world.player.equipped.weapon!.uid;
      if (enhance(world, uid, 'scroll-enhance') !== 'destroyed') continue;

      destroyed += 1;
      expect(world.player.equipped.weapon).toBeNull();
      expect(world.player.inventory.some((s) => s.uid === uid)).toBe(false);
      expect(findEnhanceable(world, uid)).toBeNull();
    }
    expect(destroyed, '200번을 두들겼는데 한 번도 안 부서졌습니다').toBe(1);
  });

  it('가방에 있던 장비도 똑같이 사라진다', () => {
    let destroyed = 0;
    for (let i = 0; i < 200 && destroyed === 0; i++) {
      const world = ready(i * 22801 + 5, 9);
      addItem(world, 'sword-long', 1, 9);
      const stack = world.player.inventory.find((s) => s.defId === 'sword-long')!;
      if (enhance(world, stack.uid, 'scroll-enhance') !== 'destroyed') continue;

      destroyed += 1;
      expect(world.player.inventory.some((s) => s.uid === stack.uid)).toBe(false);
      expect(world.player.equipped.weapon).not.toBeNull(); // 엉뚱한 걸 부수지 않았는지
    }
    expect(destroyed).toBe(1);
  });
});

describe('축복받은 주문서는 장비를 지킨다', () => {
  it('1000번을 실패시켜도 단 한 자루도 부서지지 않는다', () => {
    const times = 1000;
    const tally = trial(8, 'scroll-blessed', times);

    expect(tally.destroyed, '축복 주문서로 장비가 부서졌습니다').toBe(0);
    expect(tally.success + tally.reset).toBe(times);
    expect(tally.reset).toBeGreaterThan(0);
  });

  it('실패하면 +0 으로 돌아갈 뿐이다', () => {
    for (let i = 0; i < 100; i++) {
      const world = ready(i * 48271 + 3, 8);
      const weapon = world.player.equipped.weapon!;
      const result = enhance(world, weapon.uid, 'scroll-blessed');

      if (result === 'reset') {
        expect(weapon.plus).toBe(0);
        return;
      }
    }
    throw new Error('100번 안에 실패가 한 번도 안 나왔습니다');
  });
});

describe('주문서와 예외 처리', () => {
  it('한 번 두들길 때 주문서는 정확히 한 장만 쓴다', () => {
    const world = ready(999, 5, 10);
    enhance(world, world.player.equipped.weapon!.uid, 'scroll-enhance');

    expect(countOf(world.player, 'scroll-enhance')).toBe(9);
    expect(countOf(world.player, 'scroll-blessed')).toBe(10);
  });

  it('주문서가 없으면 아무 일도 일어나지 않는다', () => {
    const world = createWorld('시험', 'knight');
    const weapon = world.player.equipped.weapon!;
    weapon.plus = 5;

    expect(enhance(world, weapon.uid, 'scroll-enhance')).toBe('blocked');
    expect(weapon.plus).toBe(5);
    expect(world.player.equipped.weapon).not.toBeNull();
  });

  it('강화할 수 없는 물건(반지·물약)은 막힌다', () => {
    const world = createWorld('시험', 'knight');
    world.player.level = 12;
    addItem(world, 'scroll-enhance', 5);
    addItem(world, 'ring-power', 1);
    const ring = world.player.inventory.find((s) => s.defId === 'ring-power')!;

    expect(enhance(world, ring.uid, 'scroll-enhance')).toBe('blocked');
    expect(countOf(world.player, 'scroll-enhance'), '막혔는데 주문서를 썼습니다').toBe(5);
  });

  it(`+${MAX_PLUS} 를 넘길 수 없다`, () => {
    const world = ready(4242, MAX_PLUS, 5);
    const weapon = world.player.equipped.weapon!;

    expect(enhance(world, weapon.uid, 'scroll-enhance')).toBe('blocked');
    expect(weapon.plus).toBe(MAX_PLUS);
    expect(countOf(world.player, 'scroll-enhance')).toBe(5);
  });

  it('없는 장비를 강화하려 하면 조용히 막힌다', () => {
    const world = ready(1, 0, 3);
    expect(enhance(world, 999_999, 'scroll-enhance')).toBe('blocked');
    expect(countOf(world.player, 'scroll-enhance')).toBe(3);
  });

  it('확률표는 마지막 단계까지 채워져 있다', () => {
    expect(ENHANCE_CHANCE).toHaveLength(MAX_PLUS);
    for (let plus = 0; plus < MAX_PLUS; plus++) {
      expect(enhanceChance(plus), `+${plus}`).toBeGreaterThan(0);
      expect(enhanceChance(plus)).toBeLessThanOrEqual(1);
    }
    expect(enhanceChance(MAX_PLUS), '최고 수치를 넘는 확률이 남아 있습니다').toBe(0);
  });
});
