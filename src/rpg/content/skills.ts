/**
 *  스킬 넷.
 *
 *  Phase 1 은 "캐고 → 만들고 → 싸우고 → 닳으면 다시 만든다" 한 바퀴가
 *  혼자 설 수 있는지만 봅니다. 그래서 이 넷 말고는 아무것도 넣지 않습니다.
 */

import type { AxisId, SkillId, StatId } from '../types';

export interface SkillInfo {
  id: SkillId;
  name: string;
  desc: string;
  /** 이 스킬을 쓸 때 함께 자라는 능력치 */
  stats: StatId[];
  /** 어느 길에 속하는가 — 전체설계 6.1 */
  axis: AxisId;
  /**
   *  총합 상한의 예산을 먹는가.
   *
   *  ★ 방어만 false 입니다. 방어는 내가 고른 일이 아니라 몬스터가 때릴 때 오릅니다
   *    (core/combat.ts 의 monsterStrike). 안 고른 것이 예산을 먹으면
   *    총합 상한이 선택이 아니라 세금이 됩니다.
   *    그래서 전투 축은 검술만 셉니다. 방어는 스킬로 남되 예산 밖입니다.
   */
  counts: boolean;
  color: string;
}

export const AXES: Record<AxisId, { name: string; skills: SkillId[] }> = {
  gather: { name: '채집', skills: ['mining'] },
  craft: { name: '제작', skills: ['blacksmithing'] },
  combat: { name: '전투', skills: ['swordsmanship', 'defense'] },
};

export const AXIS_ORDER: AxisId[] = ['gather', 'craft', 'combat'];

export const SKILLS: Record<SkillId, SkillInfo> = {
  mining: {
    id: 'mining',
    name: '채광',
    desc: '광맥에서 광석을 캡니다. 깊은 곳의 광맥일수록 어렵고, 어려운 것을 캐야 늡니다.',
    stats: ['str'],
    axis: 'gather',
    counts: true,
    color: '#c9a227',
  },
  blacksmithing: {
    id: 'blacksmithing',
    name: '대장기술',
    desc: '광석을 녹여 주괴로 만들고, 주괴로 무기와 갑옷을 만듭니다. 수리도 이 손끝에서 나옵니다.',
    stats: ['str', 'dex'],
    axis: 'craft',
    counts: true,
    color: '#e0764a',
  },
  swordsmanship: {
    id: 'swordsmanship',
    name: '검술',
    desc: '검으로 때립니다. 나보다 센 것을 상대해야 늘고, 만만한 것만 잡으면 제자리입니다.',
    stats: ['str', 'dex'],
    axis: 'combat',
    counts: true,
    color: '#c3cbd6',
  },
  defense: {
    id: 'defense',
    name: '방어',
    desc: '맞을 때마다 조금씩 늡니다. 맞아본 사람만 피할 줄 알게 됩니다.',
    stats: ['str'],
    axis: 'combat',
    counts: false,
    color: '#6d8fb0',
  },
};

export const SKILL_ORDER: SkillId[] = ['mining', 'blacksmithing', 'swordsmanship', 'defense'];
