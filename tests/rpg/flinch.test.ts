/**
 *  맞은 쪽의 몸 반응.
 *
 *  ★ 여기서 지켜야 할 것은 "예쁘게 밀린다" 가 아니라 두 가지입니다 —
 *    실제 위치가 한 톨도 안 움직일 것, 그리고 멈춤을 새로 만들지 않을 것.
 *    앞의 것을 어기면 맞을 때마다 사거리가 흔들리고, 뒤의 것을 어기면
 *    늑대에게 둘러싸였을 때 게임이 통째로 끈적해집니다.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mapDef } from '../../src/rpg/content/maps';
import { damagePlayer } from '../../src/rpg/core/combat';
import { createWorld } from '../../src/rpg/core/create';
import { clearFeedbackListeners } from '../../src/rpg/core/feedback';
import { enterMap } from '../../src/rpg/core/world';
import { FLINCH, attachFlinch, flinchFlash, flinchOffset, resetFlinch, tickFlinch } from '../../src/rpg/ui/flinch';
import { MAX_FREEZE_SECONDS, attachImpact, frozen, resetImpact, tickImpact } from '../../src/rpg/ui/impact';
import type { World } from '../../src/rpg/types';

function inForest(): World {
  const world = createWorld('시험', 'miner');
  enterMap(world, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);
  return world;
}

beforeEach(() => {
  clearFeedbackListeners();
  resetFlinch();
  resetImpact();
});

afterEach(() => {
  clearFeedbackListeners();
  resetFlinch();
  resetImpact();
});

describe('맞으면 몸이 움찔한다', () => {
  it('맞기 전에는 아무 일도 없다', () => {
    attachFlinch();
    expect(flinchOffset()).toEqual({ x: 0, y: 0 });
    expect(flinchFlash()).toBe(0);
  });

  it('맞으면 밀리고 번쩍인다', () => {
    const world = inForest();
    attachFlinch();

    damagePlayer(world, 7);

    const shove = flinchOffset();
    expect(Math.hypot(shove.x, shove.y), '밀리지 않았습니다').toBeGreaterThan(0);
    expect(flinchFlash(), '번쩍이지 않았습니다').toBeGreaterThan(0);
  });

  it('★ 실제 위치는 한 톨도 안 움직인다', () => {
    const world = inForest();
    attachFlinch();
    const before = { x: world.me.pos.x, y: world.me.pos.y };

    damagePlayer(world, 12);
    tickFlinch(0.05);

    expect(world.me.pos.x, '맞았더니 자리가 옮겨졌습니다').toBe(before.x);
    expect(world.me.pos.y, '맞았더니 자리가 옮겨졌습니다').toBe(before.y);
  });

  it('때린 쪽 반대로 밀린다', () => {
    const world = inForest();
    attachFlinch();
    world.monsters.length = 0;
    // 나보다 왼쪽에 선 몬스터 하나를 만들어 붙입니다
    const source = createWorld('본보기', 'miner');
    enterMap(source, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);
    const monster = { ...source.monsters[0]!, pos: { x: world.me.pos.x - 30, y: world.me.pos.y }, state: 'chase' as const };
    world.monsters.push(monster);

    damagePlayer(world, 5);

    const shove = flinchOffset();
    expect(shove.x, '왼쪽에서 맞았는데 왼쪽으로 밀렸습니다').toBeGreaterThan(0);
    expect(Math.abs(shove.y)).toBeLessThan(0.001);
  });

  it('밀림은 정해진 거리를 넘지 않고 제자리로 돌아온다', () => {
    const world = inForest();
    attachFlinch();
    damagePlayer(world, 30);

    let farthest = 0;
    for (let i = 0; i < 40; i++) {
      const shove = flinchOffset();
      farthest = Math.max(farthest, Math.hypot(shove.x, shove.y));
      tickFlinch(0.01);
    }
    expect(farthest).toBeLessThanOrEqual(FLINCH.pixels + 0.001);
    expect(Math.hypot(flinchOffset().x, flinchOffset().y), '제자리로 안 돌아왔습니다').toBe(0);
    expect(flinchFlash()).toBe(0);
  });

  it('번쩍임이 밀림보다 먼저 끝난다', () => {
    expect(FLINCH.flashSeconds).toBeLessThan(FLINCH.seconds);
  });

  it('★ 멈춤을 새로 만들지 않는다 — 히트스톱과 겹치지 않게', () => {
    const world = inForest();
    attachFlinch();
    attachImpact();

    // 백 대를 맞아도 세계가 멈추면 안 됩니다 (때린 쪽이 아니라 맞은 쪽입니다)
    for (let i = 0; i < 100; i++) {
      world.me.hp = 200;
      damagePlayer(world, 3);
    }
    expect(frozen(), '맞았다고 세계가 멈췄습니다').toBe(false);

    // 히트스톱 자체의 상한은 그대로여야 합니다
    expect(MAX_FREEZE_SECONDS).toBe(0.06);
    tickImpact(0.1);
    expect(frozen()).toBe(false);
  });

  it('구독을 떼면 아무 일도 일어나지 않는다', () => {
    const world = inForest();
    const stop = attachFlinch();
    stop();

    damagePlayer(world, 9);
    expect(flinchOffset()).toEqual({ x: 0, y: 0 });
  });

  it('죽은 뒤에는 움찔하지 않는다 — damagePlayer 가 아예 안 도니까', () => {
    const world = inForest();
    attachFlinch();
    world.me.dead = true;

    damagePlayer(world, 9);
    expect(flinchOffset()).toEqual({ x: 0, y: 0 });
  });
});
