/**
 *  스킬 넷.
 *
 *  Phase 1 은 "캐고 → 만들고 → 싸우고 → 닳으면 다시 만든다" 한 바퀴가
 *  혼자 설 수 있는지만 봅니다. 그래서 이 넷 말고는 아무것도 넣지 않습니다.
 */

import type { SkillId, StatId } from '../types';

export interface SkillInfo {
  id: SkillId;
  name: string;
  desc: string;
  /** 이 스킬을 쓸 때 함께 자라는 능력치 */
  stats: StatId[];
  color: string;
}

export const SKILLS: Record<SkillId, SkillInfo> = {
  mining: {
    id: 'mining',
    name: '채광',
    desc: '광맥에서 광석을 캡니다. 깊은 곳의 광맥일수록 어렵고, 어려운 것을 캐야 늡니다.',
    stats: ['str'],
    color: '#c9a227',
  },
  blacksmithing: {
    id: 'blacksmithing',
    name: '대장기술',
    desc: '광석을 녹여 주괴로 만들고, 주괴로 무기와 갑옷을 만듭니다. 수리도 이 손끝에서 나옵니다.',
    stats: ['str', 'dex'],
    color: '#e0764a',
  },
  swordsmanship: {
    id: 'swordsmanship',
    name: '검술',
    desc: '검으로 때립니다. 나보다 센 것을 상대해야 늘고, 만만한 것만 잡으면 제자리입니다.',
    stats: ['str', 'dex'],
    color: '#c3cbd6',
  },
  defense: {
    id: 'defense',
    name: '방어',
    desc: '맞을 때마다 조금씩 늡니다. 맞아본 사람만 피할 줄 알게 됩니다.',
    stats: ['str'],
    color: '#6d8fb0',
  },
};

export const SKILL_ORDER: SkillId[] = ['mining', 'blacksmithing', 'swordsmanship', 'defense'];
