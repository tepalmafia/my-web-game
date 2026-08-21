/**
 *  몬스터 여섯.
 *
 *  ★ 레벨도 권장 레벨도 없습니다. 난이도(difficulty)만 있습니다.
 *
 *  ★ 되살아나는 데 걸리는 시간(respawn)이 깁니다 — 1분 안팎.
 *    짧게 두었더니(13~16초) 한 마리를 잡는 동안 다음 한 마리가 돌아와서,
 *    광맥 옆에서 곡괭이를 들 틈이 영영 나지 않았습니다.
 *    한 구역을 치워두면 한동안은 조용해야 합니다.
 *    이 값은 두 곳에 쓰입니다 — 명중 계산, 그리고 검술·방어 스킬의 성장 기준.
 *
 *  숲에는 들개와 늑대가, 광산에는 박쥐와 거미가 삽니다.
 *  거미가 사는 곳이 마침 구리 광맥이 있는 자리입니다. 우연이 아닙니다.
 */

import type { MonsterDef } from '../types';

const LIST: MonsterDef[] = [
  {
    // ★ 먼저 덤비지 않습니다 (aggroRange 0). 건드리면 뭅니다.
    //   모든 짐승이 달려들면 광부가 일을 할 수 없습니다 — 숲은 일터이기도 해야 합니다.
    id: 'stray-dog', name: '들개', difficulty: 15,
    hp: 40, minDamage: 3, maxDamage: 6, defense: 2,
    attackRange: 30, attackInterval: 1.3, moveSpeed: 120, aggroRange: 0,
    shape: 'beast', color: '#a0937d', size: 12,
    goldMin: 3, goldMax: 10, respawn: 50,
    drops: [{ defId: 'potion-heal', chance: 0.05 }],
  },
  {
    id: 'wolf', name: '늑대', difficulty: 30,
    hp: 85, minDamage: 7, maxDamage: 12, defense: 6,
    attackRange: 32, attackInterval: 1.2, moveSpeed: 142, aggroRange: 240,
    shape: 'beast', color: '#7d8590', size: 14,
    goldMin: 8, goldMax: 22, respawn: 70,
    drops: [{ defId: 'potion-heal', chance: 0.09 }],
  },
  {
    id: 'cave-bat', name: '광산 박쥐', difficulty: 25,
    hp: 55, minDamage: 5, maxDamage: 9, defense: 3,
    attackRange: 28, attackInterval: 1.05, moveSpeed: 152, aggroRange: 220,
    shape: 'bat', color: '#8a7aa8', size: 11,
    goldMin: 6, goldMax: 15, respawn: 60,
    drops: [{ defId: 'potion-heal', chance: 0.07 }],
  },
  {
    // ★ 늑대(30)와 거미(65) 사이가 비어 있었습니다. 강가가 그 자리입니다.
    //   게 다리는 거미와 같은 실루엣을 쓰되 색이 달라서, 동굴 것과 헷갈리지 않습니다.
    id: 'river-crab', name: '강가 큰게', difficulty: 45,
    hp: 130, minDamage: 11, maxDamage: 18, defense: 9,
    attackRange: 32, attackInterval: 1.35, moveSpeed: 104, aggroRange: 200,
    shape: 'spider', color: '#9c5a44', size: 15,
    goldMin: 14, goldMax: 34, respawn: 85,
    drops: [
      { defId: 'potion-heal', chance: 0.1 },
      { defId: 'copper-ore', chance: 0.12 },
    ],
  },
  {
    //  ★ 2층에서만 나옵니다. 난이도 82 는 지금까지의 천장(거미 65)을 넘습니다 —
    //    검술이 85 에서 멈추던 것이 여기서 풀립니다 (전체설계 6.2.2).
    id: 'deep-lurker', name: '굴 밑의 것', difficulty: 82,
    hp: 300, minDamage: 22, maxDamage: 36, defense: 20,
    attackRange: 36, attackInterval: 1.5, moveSpeed: 88, aggroRange: 230,
    shape: 'spider', color: '#3a3040', size: 19,
    goldMin: 40, goldMax: 95, respawn: 140,
    drops: [
      { defId: 'potion-heal-big', chance: 0.18 },
      { defId: 'dark-iron-ore', chance: 0.15 },
    ],
  },
  {
    id: 'cave-spider', name: '동굴 거미', difficulty: 65,
    hp: 210, minDamage: 16, maxDamage: 26, defense: 14,
    attackRange: 34, attackInterval: 1.4, moveSpeed: 92, aggroRange: 210,
    shape: 'spider', color: '#4a5a3a', size: 16,
    goldMin: 25, goldMax: 60, respawn: 110,
    drops: [
      { defId: 'potion-heal-big', chance: 0.14 },
      { defId: 'copper-ore', chance: 0.2, min: 1, max: 2 },
    ],
  },
];

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(LIST.map((m) => [m.id, m]));

export function monsterDef(defId: string): MonsterDef {
  const def = MONSTERS[defId];
  if (!def) throw new Error(`알 수 없는 몬스터: ${defId}`);
  return def;
}
