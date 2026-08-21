/**
 *  왜 안 오르는가 — learnBlock 의 ★성질★ 만 봅니다.
 *
 *  ★ 이 파일은 실제 표(recipes·veins·monsters)를 보지 않습니다.
 *    「스킬 50 · 할 수 있는 것 중 가장 어려운 것이 25」 라는 상황을 합성 입력으로
 *    직접 만들고, learnBlock 이 그것을 'ceiling' 이라고 말하는지만 봅니다.
 *    그래야 광맥을 옮기든 갑옷을 넣든 이 시험이 안 깨집니다.
 *
 *  ★ 왜 갈랐나. 전에는 이 성질을 실제 제작법 표에서 끌어온 값으로 시험했습니다.
 *    서릿쇠 갑옷(난이도 90)이 들어오자 제작 천장이 110 이 되어,
 *    함수는 멀쩡한데 시험이 깨졌습니다. 시험 하나가 두 가지를 주장하고 있었습니다 —
 *      (ㄱ) 천장 상황을 만나면 'ceiling' 이라고 답하는가  … 함수의 성질. 늘 참이어야 한다
 *      (ㄴ) 오늘 콘텐츠에 그 상황이 실제로 있는가        … 사실. 콘텐츠가 자라면 바뀐다
 *    (ㄴ)이 바뀌자 (ㄱ)까지 깨진 것처럼 보였습니다. → docs/밟은-지뢰.md
 *
 *  ★ 오늘 콘텐츠에서는 어느 축도 여기 안 걸립니다. 그 사실은 시험이 아니라
 *    docs/전체설계.md 6.2.2 에 적혀 있습니다.
 *    ★ 시험은 성질을 지키고, 문서는 상태를 적습니다.
 */

import { describe, expect, it, vi } from 'vitest';

import { MAX_SKILL } from '../../src/rpg/balance';
import { createWorld } from '../../src/rpg/core/create';
import { learnBlock, lessonsFor } from '../../src/rpg/core/skillgain';
import type { RecipeDef } from '../../src/rpg/types';

/**
 *  합성 표 — 난이도 25 짜리 하나가 전부입니다.
 *  ★ 대장기술을 쓰는 이유: 표가 가장 작아서(제작법 하나) 상황을 손으로 만들 수 있습니다.
 *    성질 자체는 스킬을 안 가립니다 — learnBlock 은 lessonsFor 의 결과만 봅니다.
 */
vi.mock('../../src/rpg/content/recipes', () => {
  const only: RecipeDef = {
    id: 'test-easy-thing',
    name: '시험용 쉬운 것',
    makes: 'iron-ingot',
    makesCount: 1,
    needs: [],
    difficulty: 25,
    seconds: 1,
    needsForge: true,
  };
  return {
    RECIPES: { [only.id]: only },
    RECIPE_ORDER: [only.id],
    recipeDef: (id: string): RecipeDef => {
      if (id !== only.id) throw new Error(`알 수 없는 제작법: ${id}`);
      return only;
    },
  };
});

/** 배울 거리가 난이도 25 하나뿐인 세계. 스킬만 손으로 놓습니다 */
function world(skill: number) {
  const w = createWorld('시험', 'miner');
  w.seed = 20260821; // 씨앗은 늘 박습니다 (CLAUDE.md 7장)
  w.me.skills.mining = 0;
  w.me.skills.blacksmithing = skill;
  w.me.skills.swordsmanship = 0;
  w.me.skills.defense = 0;
  return w;
}

describe('난이도 천장', () => {
  it('★ 스킬 50 인데 할 수 있는 것이 25 뿐이면 ceiling 이라고 말한다', () => {
    const w = world(50);

    // 25 는 50 - 20 아래입니다 — 아무리 두드려도 안 오릅니다
    expect(lessonsFor(w, 'blacksmithing').map((l) => l.difficulty)).toEqual([25]);
    expect(lessonsFor(w, 'blacksmithing').every((l) => l.chance <= 0)).toBe(true);

    expect(learnBlock(w, 'blacksmithing')).toBe('ceiling');
  });

  it('같은 표라도 스킬이 낮으면 ceiling 이 아니다 — 막힌 것은 표가 아니라 자리다', () => {
    const w = world(40);

    expect(lessonsFor(w, 'blacksmithing').some((l) => l.chance > 0)).toBe(true);
    expect(learnBlock(w, 'blacksmithing')).toBe('none');
  });

  it('100 이면 ceiling 이 아니라 maxed 라고 말한다 — maxed 를 먼저 본다', () => {
    //  ★ 이 순서가 오늘 화면에서 ceiling 이 안 보이는 이유입니다 (전체설계 6.2.2).
    //    세 축 모두 천장이 100 위라, 천장에 닿기 전에 100 에 먼저 닿습니다.
    const w = world(MAX_SKILL);

    expect(lessonsFor(w, 'blacksmithing').every((l) => l.chance <= 0)).toBe(true);
    expect(learnBlock(w, 'blacksmithing')).toBe('maxed');
  });
});
