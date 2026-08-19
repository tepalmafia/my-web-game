/**
 *  스킬 성장 — 이 게임의 진행 방식 그 자체.
 *
 *  가장 중요한 것은 ★"너무 쉬운 일에서는 배우지 못한다"★ 입니다.
 *  이게 무너지면 가장 쉬운 광맥 무한 반복이 최적해가 되고,
 *  자동사냥에서 걷어낸 문제가 채집에서 그대로 되살아납니다.
 */

import { describe, expect, it } from 'vitest';

import { GAIN, MAX_SKILL, STATS, gainChance } from '../../src/rpg/balance';
import { createWorld } from '../../src/rpg/core/create';
import { trySkillGain } from '../../src/rpg/core/skillgain';
import type { World } from '../../src/rpg/types';

function fresh(seed: number): World {
  const world = createWorld('시험', 'miner');
  world.seed = seed;
  world.me.skills.mining = 0;
  return world;
}

describe('성장 확률', () => {
  it('지금 실력보다 한참 쉬우면 아무것도 배우지 못한다', () => {
    expect(gainChance(50, 29)).toBe(0);
    expect(gainChance(50, 30)).toBeGreaterThan(0);
    expect(gainChance(0, 0)).toBeGreaterThan(0);
  });

  it('실력이 오를수록 급격히 어려워진다', () => {
    const low = gainChance(10, 15);
    const mid = gainChance(50, 55);
    const high = gainChance(90, 95);

    expect(mid).toBeLessThan(low / 2);
    expect(high).toBeLessThan(mid / 2);
    expect(high).toBeGreaterThan(0);
  });

  it('딱 맞는 난이도(실력+5)에서 가장 잘 자란다', () => {
    const skill = 40;
    const best = gainChance(skill, skill + GAIN.optimal);
    expect(best).toBeGreaterThan(gainChance(skill, skill + 30));
    expect(best).toBeGreaterThan(gainChance(skill, skill - 15));
  });

  it('100 에 도달할 수 있다 — 확률에 바닥이 있어야 합니다', () => {
    expect(gainChance(99, 100)).toBeGreaterThan(0.01);
    expect(gainChance(MAX_SKILL, 100)).toBe(0);
  });
});

describe('실제 성장', () => {
  it('여러 번 시도하면 0.1 씩 오른다', () => {
    const world = fresh(1234);
    for (let i = 0; i < 40; i++) trySkillGain(world, 'mining', 5);

    expect(world.me.skills.mining).toBeGreaterThan(0);
    // 소수 첫째 자리까지만 (0.1 단위) — 부동소수 찌꺼기가 남으면 화면 숫자가 지저분해집니다
    expect(Math.round(world.me.skills.mining * 10) / 10).toBe(world.me.skills.mining);
  });

  it('너무 쉬운 일을 아무리 반복해도 오르지 않는다', () => {
    const world = fresh(555);
    world.me.skills.mining = 60;

    for (let i = 0; i < 2000; i++) trySkillGain(world, 'mining', 20);
    expect(world.me.skills.mining).toBe(60);
  });

  it('100 을 넘지 않는다', () => {
    const world = fresh(99);
    world.me.skills.mining = 99.9;
    for (let i = 0; i < 5000; i++) trySkillGain(world, 'mining', 100);
    expect(world.me.skills.mining).toBe(MAX_SKILL);
  });

  it('실력 50 까지 걸리는 시도 횟수가 설계값 근처다 (약 750회)', () => {
    const world = fresh(20250819);
    let attempts = 0;
    while (world.me.skills.mining < 50 && attempts < 20000) {
      // 언제나 딱 맞는 난이도를 골라 캔다고 가정
      trySkillGain(world, 'mining', world.me.skills.mining + GAIN.optimal);
      attempts += 1;
    }
    expect(world.me.skills.mining).toBeGreaterThanOrEqual(50);
    // 곡괭이 한 번이 2.5초이므로, 이 횟수가 곧 '채광 50 = 약 한 시간'입니다
    expect(attempts).toBeGreaterThan(500);
    expect(attempts).toBeLessThan(1200);
  });
});

describe('능력치', () => {
  it('스킬을 쓰면 관련 능력치가 함께 자란다', () => {
    const world = fresh(777);
    const before = world.me.str;
    for (let i = 0; i < 600; i++) trySkillGain(world, 'mining', 25);
    expect(world.me.str).toBeGreaterThan(before);
  });

  it('총합 상한을 넘지 않는다 — 넘으려 하면 다른 것이 내려간다', () => {
    const world = fresh(31337);
    world.me.str = 100;
    world.me.dex = 100;
    world.me.int = 25; // 합 225 = 상한

    for (let i = 0; i < 800; i++) trySkillGain(world, 'swordsmanship', 60);

    const total = world.me.str + world.me.dex + world.me.int;
    expect(total).toBeLessThanOrEqual(STATS.totalMax + 0.001);
  });

  it('능력치 하나가 100 을 넘지 않는다', () => {
    const world = fresh(4242);
    world.me.str = 99.9;
    world.me.dex = 20;
    world.me.int = 20;
    for (let i = 0; i < 2000; i++) trySkillGain(world, 'mining', 30);
    expect(world.me.str).toBeLessThanOrEqual(STATS.max);
  });
});
