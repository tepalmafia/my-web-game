/**
 *  광맥.
 *
 *  ★ 광석은 두 가지뿐이지만 광맥은 네 등급입니다.
 *    좋은 광석은 깊은 곳에 있고, 깊은 곳에는 거미가 삽니다.
 *    "위험한 곳에서 캘 것인가"가 채광의 진짜 질문이 되도록 하려는 배치입니다.
 */

import type { VeinDef } from '../types';

const LIST: VeinDef[] = [
  {
    id: 'iron-shallow', name: '철광맥', difficulty: 20,
    yields: 'iron-ore', amountMin: 1, amountMax: 2,
    capacity: 12, respawn: 90, color: '#8a7d6b',
  },
  {
    id: 'iron-deep', name: '깊은 철광맥', difficulty: 45,
    yields: 'iron-ore', amountMin: 2, amountMax: 3,
    capacity: 14, respawn: 120, color: '#a08a6a',
  },
  {
    id: 'copper-shallow', name: '구리 광맥', difficulty: 60,
    yields: 'copper-ore', amountMin: 1, amountMax: 2,
    capacity: 10, respawn: 150, color: '#c47a4a',
  },
  {
    id: 'copper-deep', name: '깊은 구리 광맥', difficulty: 80,
    yields: 'copper-ore', amountMin: 2, amountMax: 3,
    capacity: 12, respawn: 180, color: '#e08a4a',
  },
];

export const VEINS: Record<string, VeinDef> = Object.fromEntries(LIST.map((v) => [v.id, v]));

export function veinDef(defId: string): VeinDef {
  const def = VEINS[defId];
  if (!def) throw new Error(`알 수 없는 광맥: ${defId}`);
  return def;
}
