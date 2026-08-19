/**
 *  제작법.
 *
 *  난이도가 20 에서 88 까지 이어져 있어, 만들 줄 아는 것을 하나씩 늘려가며
 *  대장기술을 100 까지 끌어올릴 수 있습니다.
 *
 *  ★ 광석 하나가 주괴 하나입니다. 대신 물건 하나에 드는 주괴가 많습니다.
 *    (검 한 자루 16개) 손을 푸는 횟수 자체가 실력이 되도록 하려는 배치입니다.
 *  (난이도가 '스킬 - 20' 아래로 떨어지면 그 제작법으로는 더 배우지 못합니다)
 */

import type { RecipeDef } from '../types';

const LIST: RecipeDef[] = [
  /* --- 제련 --- */
  {
    id: 'smelt-iron', name: '철 제련', makes: 'iron-ingot', makesCount: 1,
    needs: [{ defId: 'iron-ore', count: 1 }], difficulty: 10, seconds: 1.5, needsForge: true,
  },
  {
    id: 'smelt-copper', name: '구리 제련', makes: 'copper-ingot', makesCount: 1,
    needs: [{ defId: 'copper-ore', count: 1 }], difficulty: 45, seconds: 2, needsForge: true,
  },

  /* --- 무기 --- */
  {
    id: 'make-iron-dagger', name: '철 단검', makes: 'iron-dagger', makesCount: 1,
    needs: [{ defId: 'iron-ingot', count: 3 }], difficulty: 18, seconds: 4, needsForge: true,
  },
  {
    id: 'make-iron-sword', name: '철검', makes: 'iron-sword', makesCount: 1,
    needs: [{ defId: 'iron-ingot', count: 16 }], difficulty: 41, seconds: 5, needsForge: true,
  },
  {
    id: 'make-iron-longsword', name: '철 장검', makes: 'iron-longsword', makesCount: 1,
    needs: [{ defId: 'iron-ingot', count: 24 }], difficulty: 55, seconds: 5.5, needsForge: true,
  },
  {
    id: 'make-copper-sword', name: '구리검', makes: 'copper-sword', makesCount: 1,
    needs: [{ defId: 'copper-ingot', count: 20 }], difficulty: 75, seconds: 6, needsForge: true,
  },

  /* --- 방어구 --- */
  {
    id: 'make-iron-helm', name: '철 투구', makes: 'iron-helm', makesCount: 1,
    needs: [{ defId: 'iron-ingot', count: 18 }], difficulty: 48, seconds: 5, needsForge: true,
  },
  {
    id: 'make-iron-mail', name: '철 사슬갑옷', makes: 'iron-mail', makesCount: 1,
    needs: [{ defId: 'iron-ingot', count: 32 }], difficulty: 62, seconds: 6, needsForge: true,
  },
  {
    id: 'make-copper-mail', name: '구리 사슬갑옷', makes: 'copper-mail', makesCount: 1,
    needs: [{ defId: 'copper-ingot', count: 40 }], difficulty: 88, seconds: 7, needsForge: true,
  },
];

export const RECIPES: Record<string, RecipeDef> = Object.fromEntries(LIST.map((r) => [r.id, r]));
export const RECIPE_ORDER: string[] = LIST.map((r) => r.id);

export function recipeDef(id: string): RecipeDef {
  const def = RECIPES[id];
  if (!def) throw new Error(`알 수 없는 제작법: ${id}`);
  return def;
}
