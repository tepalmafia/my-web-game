/**
 *  스킬 성장 — 이 게임의 진행 방식 그 자체.
 *
 *  가장 중요한 것은 ★"너무 쉬운 일에서는 배우지 못한다"★ 입니다.
 *  이게 무너지면 가장 쉬운 광맥 무한 반복이 최적해가 되고,
 *  자동사냥에서 걷어낸 문제가 채집에서 그대로 되살아납니다.
 */

import { describe, expect, it } from 'vitest';

import { GAIN, MAX_SKILL, SKILL_TOTAL_MAX, STATS, gainChance } from '../../src/rpg/balance';
import { SKILLS, SKILL_ORDER } from '../../src/rpg/content/skills';
import { createWorld } from '../../src/rpg/core/create';
import { axisSpent, budgetBlocks, budgetLeft, learnBlock, lessonsFor, skillTotal, trySkillGain } from '../../src/rpg/core/skillgain';
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

/** 지금 총합에 들어가는 스킬 */
const COUNTED = SKILL_ORDER.filter((id) => SKILLS[id].counts);

/**
 *  예산을 다 쓴 캐릭터.
 *
 *  ★ 값을 손으로 박지 않고 상한에서 끌어옵니다. 상한이 바뀌어도 이 시험들이
 *    뜻을 잃지 않아야 합니다.
 *  ★ 상한이 (세는 스킬 수 × 100) 보다 높으면 100 을 넘는 값이 들어갑니다.
 *    그것은 '이미 넘긴 저장' 과 같은 자리이고, 규칙이 다루기로 한 자리입니다.
 */
function spent(seed: number): World {
  const world = fresh(seed);
  for (const id of COUNTED) world.me.skills[id] = 0;
  world.me.skills.defense = 0;
  // 검술은 0 으로 남겨 둡니다 — 예산만 없고 배울 것은 남은 자리를 보려는 것입니다
  world.me.skills.mining = SKILL_TOTAL_MAX / 2;
  world.me.skills.blacksmithing = SKILL_TOTAL_MAX / 2;
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

    expect(world.me.skills.mining).toBe(SKILL_TOTAL_MAX / 2);
    expect(world.me.skills.blacksmithing).toBe(SKILL_TOTAL_MAX / 2);
  });

  it('방어는 예산 밖이라 상한 뒤에도 오른다 — 맞아본 만큼은 는다', () => {
    const world = spent(11);
    for (let i = 0; i < 3000; i++) trySkillGain(world, 'defense', 5);

    expect(world.me.skills.defense).toBeGreaterThan(0);
    expect(budgetLeft(world.me)).toBe(0);
  });

  it('이미 넘긴 저장은 줄지 않는다 — 넘어서 안 오를 뿐이다', () => {
    const world = fresh(3);
    // 상한을 반쯤 넘긴 옛 저장
    const over = SKILL_TOTAL_MAX * 1.5;
    world.me.skills.mining = over / 3;
    world.me.skills.blacksmithing = over / 3;
    world.me.skills.swordsmanship = over / 3;

    for (let i = 0; i < 2000; i++) trySkillGain(world, 'mining', 100);

    expect(skillTotal(world.me)).toBe(over);
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
    //  ★ GAIN.step 이 0.18 이라 0.1 만 남았을 때 그냥 걸으면 상한을 넘습니다.
    //    남은 만큼만 걸어야 총합이 상한에 정확히 앉습니다.
    const world = fresh(99);
    world.me.skills.mining = SKILL_TOTAL_MAX / 2;
    world.me.skills.blacksmithing = SKILL_TOTAL_MAX / 2 - 0.1;
    world.me.skills.swordsmanship = 0; // 한 걸음(0.1)이 남았습니다
    world.log.length = 0;

    for (let i = 0; i < 4000 && budgetLeft(world.me) > 0; i++) {
      trySkillGain(world, 'swordsmanship', 5);
    }

    expect(world.me.skills.swordsmanship).toBe(0.1);
    expect(skillTotal(world.me)).toBe(SKILL_TOTAL_MAX);
    expect(world.log.some((line) => line.text.includes('더 배울 자리가 없습니다'))).toBe(true);
  });

  it('예산이 남아 있으면 막지 않는다', () => {
    const world = fresh(5);
    world.me.skills.mining = 50;
    world.me.skills.blacksmithing = 50;

    expect(budgetBlocks(world.me, 'mining')).toBe(false);
    expect(budgetLeft(world.me)).toBe(SKILL_TOTAL_MAX - 100);

    for (let i = 0; i < 500; i++) trySkillGain(world, 'mining', 55);
    expect(world.me.skills.mining).toBeGreaterThan(50);
  });

  it('★ 오늘 세는 스킬로는 상한에 못 닿는다 — 축이 늘어야 살아난다', () => {
    //  갈래가 셋인데 세는 스킬은 아직 셋(채광·대장기술·검술)뿐입니다.
    //  전부 100 이어도 300 이라 400 은 오늘 콘텐츠로는 물리지 않습니다.
    //  E 에서 벌목·낚시가 들어오면 이 시험이 먼저 깨지고, 그때 상한이 살아납니다.
    const reachable = COUNTED.length * MAX_SKILL;
    expect(
      reachable,
      `세는 스킬 ${COUNTED.length}개로 ${reachable} 까지 갈 수 있습니다 — 상한 ${SKILL_TOTAL_MAX} 이 이제 물립니다. 값을 다시 재십시오`,
    ).toBeLessThan(SKILL_TOTAL_MAX);
  });
});

/* ===========================================================================
 *  왜 안 오르는가 — 화면이 물어보는 것
 *
 *  ★ 이유가 둘입니다. 조용히 안 오르면 그것도 조용한 실패입니다 (6장).
 * ======================================================================== */

describe('배울 수 있는 것', () => {
  it('스킬마다 배울 거리가 있다 — 광맥만이 아니다', () => {
    const world = fresh(1);

    expect(lessonsFor(world, 'mining').length).toBeGreaterThan(0);
    expect(lessonsFor(world, 'blacksmithing').length).toBeGreaterThan(0);
    expect(lessonsFor(world, 'swordsmanship').length).toBeGreaterThan(0);
    expect(lessonsFor(world, 'defense').length).toBeGreaterThan(0);
  });

  it('★ 아직 안 열린 제작법은 안 보여준다 — 무엇이 열릴지 미리 알면 선택이 아니다', () => {
    const world = fresh(2);
    const shown = lessonsFor(world, 'blacksmithing').map((l) => l.id);

    expect(shown).toContain('smelt-iron');
    // 1단계 갈림길에서 고르는 것들 — 고르기 전에는 존재를 알려주지 않습니다
    expect(shown).not.toContain('make-iron-longsword');
    expect(shown).not.toContain('make-iron-mail');
  });

  //  ★ 「난이도 천장에 막히면 ceiling 이라고 말한다」 는 tests/rpg/learnblock.test.ts 로
  //    옮겼습니다. 그 성질은 합성 입력으로 봅니다 — 여기서 실제 제작법 표로 시험했더니
  //    서릿쇠 갑옷(90)이 들어온 순간 함수는 멀쩡한데 시험이 깨졌습니다.
  //    오늘 어느 축도 천장에 못 닿는다는 ★사실★ 은 docs/전체설계.md 6.2.2 에 적혀 있습니다.

  it('★ 예산이 막는 것과 천장이 막는 것을 가른다', () => {
    const world = spent(4);
    // 검술 0 — 배울 거리는 얼마든지 남았는데 예산이 없습니다
    expect(lessonsFor(world, 'swordsmanship').some((l) => l.chance > 0)).toBe(true);
    expect(learnBlock(world, 'swordsmanship')).toBe('budget');
  });

  it('방어는 예산이 다 차도 budget 이 아니다 — 총합 밖이다', () => {
    const world = spent(5);
    world.me.skills.defense = 0;

    expect(budgetLeft(world.me)).toBe(0);
    expect(learnBlock(world, 'defense')).toBe('none');
  });

  it('100 이면 maxed 라고 말한다', () => {
    const world = fresh(6);
    world.me.skills.mining = MAX_SKILL;
    expect(learnBlock(world, 'mining')).toBe('maxed');
  });

  it('막힌 데가 없으면 none', () => {
    const world = fresh(7);
    expect(learnBlock(world, 'mining')).toBe('none');
  });
});
