/**
 *  마을이 자라는 사다리.
 *
 *  ★ 판 것이 마을을 키웁니다. 한 번 자란 마을은 줄어들지 않습니다.
 *    그래서 "팔아서 세계를 키울까, 써서 나를 키울까" 가 선택이 됩니다.
 *
 *  ★ 단계가 오를 때 ★둘 중 하나를 고릅니다. 고르지 않은 쪽은 이 인물에서 영영 안 열립니다.
 *    새 제작법을 더하기만 하면 "안 하던 것이 늘어난 것" 이지 선택이 아닙니다.
 *    그래서 지금 처음부터 만들 수 있던 것들을 여기로 옮겼습니다 —
 *    철 장검 · 철 사슬갑옷 · 구리검 · 구리 사슬갑옷 · 구리 제련 · 고급 물약.
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
  name: string;
  /** 오르는 조건 — ★판 물건의 누계입니다 (골드가 아닙니다) */
  needs: { defId: string; count: number }[];
  /** 두린이 흘리는 말. 무엇이 열리는지는 적지 않습니다 */
  hint: string;
  /** 오르면 무조건 열리는 것 */
  opens: { recipes: string[]; stock: string[] };
  /** ★ 둘 중 하나만 */
  choices: [TownChoice, TownChoice];
}

export const TOWN_STAGES: TownStage[] = [
  {
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
    name: '구리 대장간',
    // ★ 주괴가 아니라 광석입니다. 주괴로 하면 "구리 제련을 열려면 구리 주괴가 필요한" 순환이 됩니다.
    needs: [{ defId: 'copper-ore', count: 25 }],
    hint: '구릿빛 돌을 더 들여오게. 다뤄본 적은 없네만, 손이 근질거리는군.',
    opens: { recipes: ['smelt-copper'], stock: [] },
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
];

/* ===========================================================================
 *  표를 읽는 도우미 — 세계를 바꾸지 않습니다
 * ======================================================================== */

export function emptyTown(): TownState {
  return { sold: {}, chosen: [] };
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
    have: Math.min(n.count, town.sold[n.defId] ?? 0),
    need: n.count,
  }));
}

/** 다음 단계의 조건을 다 채웠는가 (아직 고르지는 않은 상태) */
export function stageReady(town: TownState): boolean {
  const stage = nextStage(town);
  if (!stage) return false;
  return stage.needs.every((n) => (town.sold[n.defId] ?? 0) >= n.count);
}

export function choiceById(id: string): TownChoice | null {
  for (const stage of TOWN_STAGES) {
    for (const choice of stage.choices) if (choice.id === id) return choice;
  }
  return null;
}

/** 사다리가 쥐고 있는 제작법 전부 (처음부터 열려 있지 않은 것들) */
function heldRecipes(): Set<string> {
  const held = new Set<string>();
  for (const stage of TOWN_STAGES) {
    for (const id of stage.opens.recipes) held.add(id);
    for (const choice of stage.choices) for (const id of choice.recipes) held.add(id);
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
    for (const choice of stage.choices) {
      if (choice.id !== town.chosen[i]) list.push(choice);
    }
  }
  return list;
}
