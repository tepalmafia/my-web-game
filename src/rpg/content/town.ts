/**
 *  마을이 자라는 사다리.
 *
 *  ★ 판 것이 마을을 키웁니다. 한 번 자란 마을은 줄어들지 않습니다.
 *    그래서 "팔아서 세계를 키울까, 써서 나를 키울까" 가 선택이 됩니다.
 *
 *  ★ 단계가 오를 때 ★둘 중 하나를 고릅니다. 고르지 않은 쪽은 이 인물에서 영영 안 열립니다.
 *    새 제작법을 더하기만 하면 "안 하던 것이 늘어난 것" 이지 선택이 아닙니다.
 *    그래서 지금 처음부터 만들 수 있던 것들을 여기로 옮겼습니다 —
 *    철 장검 · 철 사슬갑옷 · 구리검 · 구리 사슬갑옷 · 고급 물약.
 *
 *  ★ 구리 제련은 여기 없습니다. 잠갔더니 구리광석이 "녹일 수 없는 돌" 이 되어
 *    파는 것 말고 할 게 없어졌습니다. 할 게 하나뿐인 것은 선택이 아닙니다.
 *
 *  ★ 다음에 무엇이 열리는지는 미리 보여주지 않습니다. hint 만 흘립니다.
 *    미리 알면 선택이 아니라 그냥 목표치입니다 (기획안 5.4).
 *
 *  ★ 이 파일은 표입니다. 계산은 없습니다 —
 *    난수도, 밸런스 식도, 세계를 바꾸는 것도 여기 없습니다.
 */

import { RECIPE_ORDER } from './recipes';
import { SHOP_STOCK } from './items';
import type { TownState } from '../types';

/** 단계가 오를 때 고르는 한쪽 */
export interface TownChoice {
  id: string;
  name: string;
  desc: string;
  /** 고르면 열리는 제작법 */
  recipes: string[];
}

export interface TownStage {
  /** 기록에 남는 이름. ★ 바꾸면 옛 저장의 단계가 어긋납니다 */
  id: string;
  name: string;
  /** 오르는 조건 — ★판 물건의 누계입니다 (골드가 아닙니다) */
  needs: { defId: string; count: number }[];
  /** 두린이 흘리는 말. 무엇이 열리는지는 적지 않습니다 */
  hint: string;
  /** 오르면 무조건 열리는 것 */
  opens: { recipes: string[]; stock: string[] };
  /**
   *  ★ 둘 중 하나만. null 이면 갈림길이 없는 단계입니다 —
   *    조건이 차는 순간 저절로 오릅니다.
   *
   *  ★ null 은 ★첫 단계 하나뿐이어야 합니다 (전체설계 3.2).
   *    "처음 것은 싸고 빠르게" 라서 첫 번째는 고르는 게 아니라 겪는 것입니다.
   *    두 번째부터도 이러면 세 조건 중 '선택' 이 빠진 목표치 목록이 됩니다.
   *    tests/rpg/town.test.ts 가 이것을 지킵니다.
   */
  choices: [TownChoice, TownChoice] | null;
}

export const TOWN_STAGES: TownStage[] = [
  {
    //  ★ 첫 단계는 거의 공짜입니다 (전체설계 3.2 — 처음 것은 싸고 빠르게).
    //    40개를 팔면 무슨 일이 생기는지 모르는 사람에게 40개를 요구할 수는 없습니다.
    //    네 개를 팔면 화로가 커집니다. 그 한 번을 겪어야 "팔면 세상이 변하는구나" 를 알고,
    //    그래야 다음 40개를 향해 갑니다.
    //
    //  ★ 갈림길이 없습니다. 고를 것이 없으니 조건이 차는 순간 저절로 오릅니다.
    //    무엇을 여는지도 없습니다 — 여는 것은 ★대장간 자체입니다.
    id: 'first-forge',
    name: '화로에 불이 세진다',
    needs: [{ defId: 'iron-ingot', count: 4 }],
    hint: '쇠를 좀 가져다주게. 화로가 영 시원찮아.',
    opens: { recipes: [], stock: [] },
    choices: null,
  },
  {
    id: 'forge-expand',
    name: '대장간 확장',
    needs: [{ defId: 'iron-ingot', count: 40 }],
    hint: '쇠가 더 모이면 보여줄 게 있네.',
    opens: { recipes: [], stock: ['potion-heal-big'] },
    choices: [
      {
        id: 'forge-blade',
        name: '긴 칼을 벼린다',
        desc: '자루가 길어 두 손으로 쥐는 칼. 더 멀리 닿고 더 깊이 벱니다.',
        recipes: ['make-iron-longsword'],
      },
      {
        id: 'forge-mail',
        name: '두꺼운 갑옷을 짠다',
        desc: '고리를 하나하나 엮은 갑옷. 맞아도 덜 아픕니다.',
        recipes: ['make-iron-mail'],
      },
    ],
  },
  {
    id: 'copper-forge',
    name: '구리 대장간',
    //  ★ 광석이 아니라 주괴입니다.
    //    광석으로 걸었더니 이렇게 됐습니다 — 구리 제련이 이 단계에 잠겨 있어서
    //    구리광석은 "녹일 수 없는 돌" 이 되고, 그러면 파는 것 말고 할 게 없습니다.
    //    할 게 하나뿐인 것은 선택이 아닙니다. 그래서 제련을 처음부터 열어두고,
    //    조건을 주괴로 옮겼습니다. 이제 판 주괴는 구리검·구리 사슬갑옷의 재료이기도 합니다 —
    //    팔면 문이 열리고, 쥐면 열리자마자 벼릴 수 있습니다.
    needs: [{ defId: 'copper-ingot', count: 25 }],
    hint: '구릿빛 쇠를 더 들여오게. 다뤄본 적은 없네만, 손이 근질거리는군.',
    opens: { recipes: [], stock: [] },
    choices: [
      {
        id: 'copper-blade',
        name: '구리를 벼린다',
        desc: '구리는 무르지만 무겁게 칩니다. 철보다 아프게 때리는 칼.',
        recipes: ['make-copper-sword'],
      },
      {
        id: 'copper-mail',
        name: '구리를 엮는다',
        desc: '구릿빛 사슬. 지금 만들 수 있는 가장 두꺼운 갑옷.',
        recipes: ['make-copper-mail'],
      },
    ],
  },
  {
    //  ★ 2층 재료로 거는 단계입니다 (전체설계 8절: 단계 → 층).
    //
    //  ★ 광석이 아니라 주괴입니다. 구리 때 배운 그대로입니다 —
    //    광석으로 걸면 "녹일 수 없는 돌" 이 되고, 파는 것 말고 할 게 없으면
    //    선택이 아닙니다. 검은쇠 제련을 처음부터 열어두는 것이 짝입니다.
    //
    //  ★ 12 개인 이유: 기존 단계가 힘 20 기준 왕복 1·5·4 번이었습니다.
    //    검은쇠는 한 덩이가 25 스톤이라 힘 20 이면 3덩이, 힘 51 이면 8덩이입니다.
    //    12 개면 힘 20 에 4번, 힘 51 에 2번 — 그 자리에 앉습니다.
    //    제련 실패로 태우는 몫까지 치면 실질은 그 두 배쯤입니다.
    id: 'dark-forge',
    name: '검은쇠 대장간',
    needs: [{ defId: 'dark-iron-ingot', count: 12 }],
    hint: '이런 쇠는 본 적이 없네. 스승이라면 알았을지도 모르지.',
    opens: { recipes: [], stock: [] },
    choices: [
      {
        id: 'dark-blade',
        name: '검은쇠를 벼린다',
        desc: '빛을 되쏘지 않는 검. 무겁고, 그만큼 깊이 들어갑니다.',
        recipes: ['make-dark-sword'],
      },
      {
        id: 'dark-plate',
        name: '검은쇠를 두드려 편다',
        desc: '사슬이 아니라 판입니다. 입으면 소리가 납니다.',
        recipes: ['make-dark-plate'],
      },
    ],
  },
];

/* ===========================================================================
 *  표를 읽는 도우미 — 세계를 바꾸지 않습니다
 * ======================================================================== */

export function emptyTown(): TownState {
  return { sold: {}, spent: {}, chosen: [] };
}

/** 지금 단계가 세는 몫 — 판 누계에서 지나간 단계가 먹은 것을 뺍니다 */
function toward(town: TownState, defId: string): number {
  return Math.max(0, (town.sold[defId] ?? 0) - (town.spent[defId] ?? 0));
}

/** 지금 몇 단계인가 (고른 횟수가 곧 단계입니다) */
export function stageOf(town: TownState): number {
  return town.chosen.length;
}

/** 다음에 오를 단계 (다 올랐으면 null) */
export function nextStage(town: TownState): TownStage | null {
  return TOWN_STAGES[stageOf(town)] ?? null;
}

/** 다음 단계까지 얼마나 왔는가 — 화면에 보여주기 위한 것 */
export function progressOf(town: TownState): Array<{ defId: string; have: number; need: number }> {
  const stage = nextStage(town);
  if (!stage) return [];
  return stage.needs.map((n) => ({
    defId: n.defId,
    have: Math.min(n.count, toward(town, n.defId)),
    need: n.count,
  }));
}

/** 다음 단계의 조건을 다 채웠는가 (아직 고르지는 않은 상태) */
export function stageReady(town: TownState): boolean {
  const stage = nextStage(town);
  if (!stage) return false;
  return stage.needs.every((n) => toward(town, n.defId) >= n.count);
}

export function choiceById(id: string): TownChoice | null {
  for (const stage of TOWN_STAGES) {
    for (const choice of stage.choices ?? []) if (choice.id === id) return choice;
  }
  return null;
}

/** 사다리가 쥐고 있는 제작법 전부 (처음부터 열려 있지 않은 것들) */
function heldRecipes(): Set<string> {
  const held = new Set<string>();
  for (const stage of TOWN_STAGES) {
    for (const id of stage.opens.recipes) held.add(id);
    for (const choice of stage.choices ?? []) for (const id of choice.recipes) held.add(id);
  }
  return held;
}

/** 지금 만들 수 있는 제작법 */
export function openRecipes(town: TownState): Set<string> {
  const held = heldRecipes();
  const open = new Set(RECIPE_ORDER.filter((id) => !held.has(id)));

  for (let i = 0; i < town.chosen.length; i++) {
    const stage = TOWN_STAGES[i];
    if (!stage) continue;
    for (const id of stage.opens.recipes) open.add(id);
    const choice = choiceById(town.chosen[i]!);
    if (choice) for (const id of choice.recipes) open.add(id);
  }
  return open;
}

/** 지금 상점이 취급하는 것 */
export function openStock(town: TownState): string[] {
  const stock = [...SHOP_STOCK];
  for (let i = 0; i < town.chosen.length; i++) {
    for (const id of TOWN_STAGES[i]?.opens.stock ?? []) {
      if (!stock.includes(id)) stock.push(id);
    }
  }
  return stock;
}

/**
 *  고르지 않아서 버린 갈래들.
 *
 *  ★ 화면에 남겨둡니다. 무엇을 놓쳤는지 모르면 조용한 실패이고,
 *    버린 것이 계속 보여야 되돌릴 수 없다는 것이 무게로 남습니다.
 */
export function forsaken(town: TownState): TownChoice[] {
  const list: TownChoice[] = [];
  for (let i = 0; i < town.chosen.length; i++) {
    const stage = TOWN_STAGES[i];
    if (!stage) continue;
    // 갈림길이 없던 단계는 버린 것도 없습니다
    for (const choice of stage.choices ?? []) {
      if (choice.id !== town.chosen[i]) list.push(choice);
    }
  }
  return list;
}
