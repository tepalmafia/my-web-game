/**
 *  바깥으로 나가는 통로.
 *
 *  ★ 여기서 지키는 것은 하나입니다 — **아무도 듣지 않으면 아무 일도 일어나지 않는다.**
 *    봇(tools/)은 구독자 없이 몇 시간을 돌립니다. 그 판에서 이벤트 객체가 하나라도
 *    만들어지면 수십만 개의 쓰레기가 됩니다.
 */

import { describe, expect, it, afterEach } from 'vitest';

import {
  clearFeedbackListeners,
  feedbackEventsBuilt,
  floater,
  hasFeedbackListeners,
  log,
  onFeedback,
  shake,
  toast,
  vfx,
  type FeedbackEvent,
} from '../../src/rpg/core/feedback';
import { createWorld } from '../../src/rpg/core/create';
import type { World } from '../../src/rpg/types';

function fresh(): World {
  return createWorld('시험', 'miner');
}

afterEach(() => clearFeedbackListeners());

describe('듣는 사람이 없을 때', () => {
  it('이벤트 객체를 아예 만들지 않는다', () => {
    const world = fresh();
    expect(hasFeedbackListeners()).toBe(false);

    const before = feedbackEventsBuilt();
    for (let i = 0; i < 50; i++) {
      log(world, '기록');
      floater(world, { x: 0, y: 0 }, '7', 'damage');
      vfx(world, 'impact', { x: 0, y: 0 });
      toast(world, '알림');
      shake(world, 0.2);
    }
    expect(feedbackEventsBuilt() - before, '듣는 사람이 없는데 이벤트가 만들어졌습니다').toBe(0);
  });

  it('그래도 기존 소비자에게는 그대로 쌓인다', () => {
    const world = fresh();
    const logs = world.log.length;

    log(world, '기록');
    floater(world, { x: 10, y: 20 }, '7', 'damage');
    vfx(world, 'impact', { x: 10, y: 20 }, { color: '#fff' });
    toast(world, '알림', 'bad');
    shake(world, 0.3);

    expect(world.log.length).toBe(logs + 1);
    expect(world.floaters.at(-1)?.text).toBe('7');
    expect(world.vfx.at(-1)?.kind).toBe('impact');
    expect(world.toast?.tone).toBe('bad');
    expect(world.shake).toBeGreaterThanOrEqual(0.3);
  });
});

describe('구독', () => {
  it('붙이면 받고, 떼면 받지 않는다', () => {
    const world = fresh();
    const seen: FeedbackEvent[] = [];
    const off = onFeedback((event) => seen.push(event));

    floater(world, { x: 1, y: 2 }, '12', 'crit');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ at: 'floater', kind: 'crit', text: '12' });

    off();
    floater(world, { x: 1, y: 2 }, '12', 'crit');
    expect(seen, '뗐는데도 계속 옵니다').toHaveLength(1);
    expect(hasFeedbackListeners()).toBe(false);
  });

  it('듣는 사람이 던져도 게임은 계속된다', () => {
    const world = fresh();
    onFeedback(() => {
      throw new Error('소리 쪽이 터졌습니다');
    });

    expect(() => floater(world, { x: 0, y: 0 }, '7', 'damage')).not.toThrow();
    expect(world.floaters.at(-1)?.text).toBe('7');
  });

  it('검이 맞은 것과 크리티컬을 구분할 수 있다', () => {
    // ★ core 에 새 필드를 달지 않은 근거입니다.
    //   'damage'/'crit' 은 combat.ts 에서 플레이어의 검이 맞았을 때만 나옵니다.
    const world = fresh();
    const kinds: string[] = [];
    onFeedback((event) => {
      if (event.at === 'floater') kinds.push(event.kind);
    });

    floater(world, { x: 0, y: 0 }, '7', 'damage');
    floater(world, { x: 0, y: 0 }, '19', 'crit');
    floater(world, { x: 0, y: 0 }, '빗나감', 'miss');

    expect(kinds).toEqual(['damage', 'crit', 'miss']);
  });
});
