/**
 *  마을 사람이 무슨 말을 하는가 — 고르는 계산.
 *
 *  ★ 여기 있는 이유: 예전에는 ui/Panels.tsx 가 이 판단을 했습니다.
 *    가방을 뒤지고, 마을 단계를 읽고, 조건이 찼는지 보고 줄을 골랐습니다.
 *    그것은 규칙 판단이라 ui 가 할 일이 아닙니다 (CLAUDE.md 4장 3번).
 *    말(표)은 content/lines.ts 에, 고르는 것(계산)은 여기에 있습니다.
 *
 *  ★ 이 게임은 무엇을 해야 하는지 알려주는 퀘스트가 없습니다. 그래서 적어도
 *    "어디로 가서 무엇을 누르는가" 한 줄은 사람 입으로 나와야 합니다.
 *    쇠가 없으면 캐 오라 하고, 쇠가 있으면 두드리라 합니다.
 */

import { itemDef } from '../content/items';
import { DURIN, DURIN_NOTES } from '../content/lines';
import { recipeDef } from '../content/recipes';
import { nextStage, stageReady } from '../content/town';
import { countOf } from './inventory';
import type { World } from '../types';

/**
 *  두린의 말은 두 겹입니다 (이야기-기획안 2.2).
 *
 *    noted  — 인정. 도달했을 때만 있습니다. 없으면 null
 *    guide  — 안내. 늘 있습니다. ★ 지우지 마십시오
 */
export interface DurinLines {
  noted: string | null;
  guide: string;
}

/**
 *  두린이 알아본 것.
 *
 *  ★ 발도르의 것은 **들고 있어야** 압니다 — "두린이 2층 도구를 보면" 이라
 *    가방에 없으면 보여준 것이 아닙니다. 그래서 따로 저장할 것이 없습니다.
 */
function durinNotes(world: World): string | null {
  const me = world.me;
  for (const note of DURIN_NOTES) {
    if (note.id === 'baldor' && me.backpack.some((s) => s.defId === 'baldor-pickaxe')) return note.line;
    if (note.id === 'went-below' && me.discovered.includes('mine-deep')) return note.line;
  }
  return null;
}

/** 지금 해야 할 일을 알려주는 줄 — 늘 있습니다 */
function durinGuides(world: World): string {
  const me = world.me;
  const iron = countOf(me, 'iron-ore') + countOf(me, 'iron-ingot');
  const pickaxe = me.backpack.some((s) => itemDef(s.defId).tool === 'pickaxe' && (s.durability ?? 0) > 0);

  if (!pickaxe) return DURIN.noPickaxe;
  if (iron <= 0) return DURIN.noIron;
  if (stageReady(me.town)) return DURIN.stageReady;

  const stage = nextStage(me.town);
  if (stage && countOf(me, 'iron-ingot') > 0) return `${DURIN.broughtIron} ${stage.hint}`;

  return DURIN.keepAtIt;
}

/** 대장장이 두린이 지금 하는 말 */
export function durinSays(world: World): DurinLines {
  return { noted: durinNotes(world), guide: durinGuides(world) };
}

/* ===========================================================================
 *  막다른 길을 여는 것 — 두린이 곡괭이를 내준다
 *
 *  ★ 곡괭이가 없고 · 살 돈도 없고 · 만들 재료도 없으면 **나갈 길이 없습니다.**
 *    재보니 맨손(공격 1.1~3.4)으로는 들개(체력 40) 한 마리를 60분 동안 못 잡습니다.
 *    그것은 무게가 아니라 막힘입니다 (CLAUDE.md 0장).
 *
 *  ★ 판단은 여기서 합니다. ui 는 물어보고 받아 그립니다 (4장 3번).
 * ======================================================================== */

/** 두린이 내주는 곡괭이 */
export const LOAN_PICKAXE = 'worn-pickaxe';

/**
 *  지금 빌릴 수 있는가. null 이면 빌릴 수 있고, 아니면 **왜 안 되는지**입니다.
 *  ★ 조용히 false 를 돌려주지 않습니다 (6장). 안 되는 이유가 화면에 나와야 합니다.
 */
export function pickaxeLoanProblem(world: World): string | null {
  const me = world.me;

  const hasPickaxe = me.backpack.some(
    (s) => itemDef(s.defId).tool === 'pickaxe' && (s.durability ?? 0) > 0,
  );
  if (hasPickaxe) return DURIN.lentAlready;

  const price = itemDef('pickaxe').price;
  if (me.gold >= price) return `마르카에게 사면 되네. ${price} 골드일세 (지금 ${me.gold}).`;

  const need = recipeDef('make-iron-pickaxe').needs[0]!;
  const have = countOf(me, need.defId);
  if (have >= need.count) {
    return `쇠는 있잖은가. 화로에서 두드려 보게 (${itemDef(need.defId).name} ${have}/${need.count}).`;
  }
  return null;
}

/** 두린이 하는 말 — 빌릴 수 있으면 그 말, 아니면 왜 안 되는지 */
export function pickaxeLoanSays(world: World): string {
  return pickaxeLoanProblem(world) ?? DURIN.lend;
}
