/**
 *  제작법.
 *
 *  난이도가 10 에서 88 까지 이어져 있어, 만들 줄 아는 것을 하나씩 늘려가며
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

  {
    //  ★ 난이도 65 의 근거: 철 제련(10)은 철광맥 최저(20)의 0.50배,
    //    구리 제련(45)은 구리 광맥 최저(60)의 0.75배입니다. 검은쇠 광맥은 88 하나뿐이라
    //    같은 비율이면 66 이고, 딱 떨어지게 65 로 둡니다.
    //  ★ 더 올리지 않는 이유: 실패하면 재료가 전부 사라지는데(A2),
    //    검은쇠 광석은 한 덩이가 25 스톤이라 왕복해서 가져온 것입니다.
    //    태우는 값이 다른 광석과 다릅니다.
    id: 'smelt-dark-iron', name: '검은쇠 제련', makes: 'dark-iron-ingot', makesCount: 1,
    needs: [{ defId: 'dark-iron-ore', count: 1 }], difficulty: 65, seconds: 2.5, needsForge: true,
  },
  {
    //  ★ 난이도 68 의 근거: 앞선 제련들이 광맥 최저 난이도의 0.50 · 0.75 · 0.74 배였습니다.
    //    서릿쇠 광맥은 92 하나뿐이라 같은 비율이면 68 입니다.
    //  ★ 처음부터 열어둡니다 — 구리·검은쇠 때 배운 그대로입니다.
    //    잠그면 서릿쇠 광석이 "녹일 수 없는 돌" 이 되고, 파는 것 말고 할 게 없으면
    //    선택이 아닙니다.
    id: 'smelt-frost-iron', name: '서릿쇠 제련', makes: 'frost-iron-ingot', makesCount: 1,
    needs: [{ defId: 'frost-iron-ore', count: 1 }], difficulty: 68, seconds: 3, needsForge: true,
  },
  {
    id: 'smelt-ember-iron', name: '불꽃쇠 제련', makes: 'ember-iron-ingot', makesCount: 1,
    needs: [{ defId: 'ember-iron-ore', count: 1 }], difficulty: 74, seconds: 3.5, needsForge: true,
  },

  /* --- 무기 --- */
  {
    id: 'make-iron-dagger', name: '철 단검', makes: 'iron-dagger', makesCount: 1,
    needs: [{ defId: 'iron-ingot', count: 3 }], difficulty: 18, seconds: 4, needsForge: true,
  },
  /* --- 연장 --- */
  {
    //  ★ 난이도 사다리의 25~38 이 비어 있었습니다 — 철 단검(18) 다음이 철검(41) 이라
    //    틈이 23 으로 게임에서 제일 컸고, 그 안에 있던 것은 표에도 없는 수리(30) 뿐이었습니다.
    //
    //  ★ 재료가 싼 것이 요점입니다. 대장 30 에서 대장기술 +1.0 을 올리는 값이
    //    철검은 철 주괴 259 개(왕복 29 번)인데 철 곡괭이는 79 개입니다.
    //    두드릴 것이 없던 게 아니라 두드리는 값이 왕복 스물아홉 번이었습니다.
    //
    //  ★ 30 인 이유: 철 단검(18) 과 철검(41) 사이이고, 수리(30)와 같은 자리입니다.
    id: 'make-iron-pickaxe', name: '철 곡괭이', makes: 'iron-pickaxe', makesCount: 1,
    needs: [{ defId: 'iron-ingot', count: 5 }], difficulty: 30, seconds: 4.5, needsForge: true,
  },

  /* --- 무기 (이어서) --- */
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
    id: 'make-dark-sword', name: '검은쇠 검', makes: 'dark-iron-sword', makesCount: 1,
    needs: [{ defId: 'dark-iron-ingot', count: 10 }], difficulty: 78, seconds: 6.5, needsForge: true,
  },
  {
    id: 'make-dark-plate', name: '검은쇠 판금', makes: 'dark-iron-plate', makesCount: 1,
    needs: [{ defId: 'dark-iron-ingot', count: 12 }], difficulty: 84, seconds: 7.5, needsForge: true,
  },
  {
    //  ★ 마을 단계에 안 넣습니다 — 어느 단계의 opens 에도 없는 제작법은
    //    openRecipes 가 처음부터 열어 줍니다. 잠그는 것은 난이도 하나입니다.
    id: 'make-frost-helm', name: '서릿쇠 투구', makes: 'frost-iron-helm', makesCount: 1,
    needs: [{ defId: 'frost-iron-ingot', count: 6 }], difficulty: 82, seconds: 6, needsForge: true,
  },
  {
    id: 'make-frost-plate', name: '서릿쇠 갑옷', makes: 'frost-iron-plate', makesCount: 1,
    needs: [{ defId: 'frost-iron-ingot', count: 12 }], difficulty: 90, seconds: 8, needsForge: true,
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
