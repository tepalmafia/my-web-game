/**
 *  스킬 성장 — 이 게임의 진행 방식 그 자체.
 *
 *  가장 중요한 것은 ★"너무 쉬운 일에서는 배우지 못한다"★ 입니다.
 *  이게 무너지면 가장 쉬운 광맥 무한 반복이 최적해가 되고,
 *  자동사냥에서 걷어낸 문제가 채집에서 그대로 되살아납니다.
 */

import { describe, expect, it } from 'vitest';

import { GAIN, MAX_SKILL, SKILL_TOTAL_MAX, STATS, gainChance } from '../../src/rpg/balance';
import { createWorld } from '../../src/rpg/core/create';
import { axisSpent, budgetBlocks, budgetLeft, skillTotal, trySkillGain } from '../../src/rpg/core/skillgain';
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

/* ===========================================================================
 *  총합 상한 — 전체설계 6.2
 *
 *  ★ 이 상한이 "선택" 이 되려면 예산을 쓰는 것이 전부 내가 고른 일이어야 합니다.
 *    방어는 몬스터가 때릴 때 오릅니다. 그래서 예산 밖입니다.
 * ======================================================================== */

/** 예산을 다 쓴 캐릭터 — 채광 100 · 대장 100 = 200 */
function spent(seed: number): World {
  const world = fresh(seed);
  world.me.skills.mining = 100;
  world.me.skills.blacksmithing = 100;
  world.me.skills.swordsmanship = 0;
  world.me.skills.defense = 0;
  return world;
}

describe('스킬 총합 상한', () => {
  it('★ 방어는 총합에 안 들어간다 — 내가 고른 일이 아니다', () => {
    const world = fresh(1);
    world.me.skills.mining = 30;
    world.me.skills.blacksmithing = 20;
    world.me.skills.swordsmanship = 10;
    world.me.skills.defense = 90;

    expect(skillTotal(world.me)).toBe(60);
    expect(axisSpent(world.me, 'combat')).toBe(10);
  });

  it('예산을 다 쓰면 세는 스킬은 더 안 오른다', () => {
    const world = spent(42);
    for (let i = 0; i < 4000; i++) trySkillGain(world, 'swordsmanship', 5);

    expect(world.me.skills.swordsmanship).toBe(0);
    expect(skillTotal(world.me)).toBe(SKILL_TOTAL_MAX);
  });

  it('★ 다른 스킬을 깎지 않는다 — 능력치와 다르다', () => {
    const world = spent(7);
    // 능력치는 상한에서 가장 오래 안 쓴 것을 깎습니다. 스킬에 그러면
    // 검술을 놀려 채광을 올릴 수 있어 길 선택이 되돌려집니다.
    for (let i = 0; i < 4000; i++) trySkillGain(world, 'swordsmanship', 5);

    expect(world.me.skills.mining).toBe(100);
    expect(world.me.skills.blacksmithing).toBe(100);
  });

  it('방어는 예산 밖이라 상한 뒤에도 오른다 — 맞아본 만큼은 는다', () => {
    const world = spent(11);
    for (let i = 0; i < 3000; i++) trySkillGain(world, 'defense', 5);

    expect(world.me.skills.defense).toBeGreaterThan(0);
    expect(budgetLeft(world.me)).toBe(0);
  });

  it('이미 넘긴 저장은 줄지 않는다 — 넘어서 안 오를 뿐이다', () => {
    const world = fresh(3);
    world.me.skills.mining = 100;
    world.me.skills.blacksmithing = 100;
    world.me.skills.swordsmanship = 100; // 상한을 넘긴 옛 저장 (총합 300)

    for (let i = 0; i < 2000; i++) trySkillGain(world, 'mining', 100);

    expect(skillTotal(world.me)).toBe(300);
    expect(budgetLeft(world.me)).toBe(0);
  });

  it('★ 조용히 안 오르지 않는다 — 왜 안 오르는지 화면에 나온다', () => {
    const world = spent(20250819);
    world.log.length = 0;

    for (let i = 0; i < 4000; i++) {
      world.time += 1;
      trySkillGain(world, 'swordsmanship', 5);
    }

    const said = world.log.some((line) => line.text.includes(`${SKILL_TOTAL_MAX}`));
    expect(said, '예산을 다 써서 안 올랐다는 말이 기록에 없습니다').toBe(true);
  });

  it('마지막 한 걸음에서 다 찼다고 말한다', () => {
    const world = fresh(99);
    world.me.skills.mining = 100;
    world.me.skills.blacksmithing = 99.9; // 한 걸음 남았습니다
    world.log.length = 0;

    for (let i = 0; i < 4000 && world.me.skills.blacksmithing < 100; i++) {
      trySkillGain(world, 'blacksmithing', 100);
    }

    expect(skillTotal(world.me)).toBe(SKILL_TOTAL_MAX);
    expect(world.log.some((line) => line.text.includes('더 배울 자리가 없습니다'))).toBe(true);
  });

  it('예산이 남아 있으면 막지 않는다', () => {
    const world = fresh(5);
    world.me.skills.mining = 50;
    world.me.skills.blacksmithing = 50;

    expect(budgetBlocks(world.me, 'mining')).toBe(false);
    expect(budgetLeft(world.me)).toBe(100);

    for (let i = 0; i < 500; i++) trySkillGain(world, 'mining', 55);
    expect(world.me.skills.mining).toBeGreaterThan(50);
  });
});
