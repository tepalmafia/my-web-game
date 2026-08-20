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
import { DURIN } from '../content/lines';
import { nextStage, stageReady } from '../content/town';
import { countOf } from './inventory';
import type { World } from '../types';

/** 대장장이 두린이 지금 하는 말 */
export function durinSays(world: World): string {
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
