/**
 *  내구도 — 만든 물건은 닳고, 고칠수록 수명이 줄고, 결국 죽습니다.
 *
 *  ★ 이 규칙 하나가 이 게임의 순환을 닫습니다.
 *    검이 영원하면 대장장이는 한 번만 필요하고, 광산에 다시 갈 이유도 사라집니다.
 *
 *  수리는 공짜가 아닙니다. 고칠 때마다 최대 내구도가 12%씩 깎여서,
 *  여덟 번쯤 고치면 더는 고칠 수 없는 쇳조각이 됩니다.
 */

import { DURABILITY } from '../balance';
import { itemDef } from '../content/items';
import { log, toast } from './feedback';
import { itemName } from './stats';
import type { Character, EquipSlot, ItemStack, ToolKind, World } from '../types';

/** 이 물건이 닳는 물건인가 */
export function wears(stack: ItemStack): boolean {
  return stack.durability !== undefined && stack.maxDurability !== undefined;
}

/**
 * 내구도를 깎습니다. 0 이 되면 부서집니다.
 * slot 을 주면 부서질 때 그 칸을 비웁니다.
 */
export function wear(world: World, stack: ItemStack, amount: number, slot: EquipSlot | null): void {
  if (!wears(stack)) return;
  stack.durability = Math.max(0, (stack.durability ?? 0) - amount);
  if (stack.durability > 0) return;

  const me = world.me;
  if (slot) me.equipped[slot] = null;
  else me.backpack = me.backpack.filter((s) => s.uid !== stack.uid);

  log(world, `${itemName(stack)} 이(가) 부러졌습니다`, 'bad');
  toast(world, `${itemName(stack)}\n부러짐`, 'bad');
}

/**
 *  지금 쓸 수 있는 연장 하나. 없으면 null.
 *
 *  ★ 연장은 가방에 있어도 됩니다 — 손에 드는 칸을 따로 두지 않습니다.
 *  ★ 여럿이면 가방 순서로 먼저 것을 씁니다. 고르게 하지 않습니다.
 */
export function toolOf(me: Character, kind: ToolKind): ItemStack | null {
  return me.backpack.find((s) => itemDef(s.defId).tool === kind && (s.durability ?? 1) > 0) ?? null;
}

/**
 *  손에 든 연장을 한 번 씁니다. 연장이 없거나 부서졌으면 null.
 *
 *  ★ amount 는 광맥마다 다릅니다 (VeinDef.toolWear). 3층 광맥은 한 번에 3 을 먹습니다.
 *  ★ **쓴 연장을 돌려줍니다.** 부르는 쪽이 그 연장의 벼림을 봐야 하기 때문입니다
 *    (연장의 벼림은 성공률에 걸립니다 — stats.ts 의 toolTemperMul).
 *    이 한 번으로 부러졌더라도 그 휘두름은 이 연장으로 한 것이라 그대로 돌려줍니다.
 */
export function useTool(
  world: World,
  kind: ToolKind,
  amount: number = DURABILITY.toolPerUse,
): ItemStack | null {
  const tool = toolOf(world.me, kind);
  if (!tool) return null;

  wear(world, tool, amount, null);
  return tool;
}

export function hasTool(me: Character, kind: ToolKind): boolean {
  return toolOf(me, kind) !== null;
}

/* ===========================================================================
 *  수리
 * ======================================================================== */

export interface RepairQuote {
  /** 채워질 내구도 */
  restore: number;
  /** 드는 주괴 */
  ingotId: string;
  ingots: number;
  /** 수리 뒤의 최대 내구도 */
  newMax: number;
  problem: string | null;
}

/** 이 물건에 드는 재료를 미리 계산합니다 (화면에 보여주기 위해) */
export function repairQuote(stack: ItemStack): RepairQuote {
  const def = itemDef(stack.defId);
  const max = stack.maxDurability ?? 0;
  const now = stack.durability ?? 0;
  const restore = Math.max(0, max - now);

  // 구리로 만든 것은 구리로 고칩니다
  const ingotId = def.id.startsWith('copper') ? 'copper-ingot' : 'iron-ingot';
  const ingots = Math.max(1, Math.ceil(restore / DURABILITY.ingotsPerPoint));
  const newMax = Math.round(max * (1 - DURABILITY.repairCost));

  let problem: string | null = null;
  if (!wears(stack)) problem = '고칠 수 있는 물건이 아닙니다.';
  else if (restore <= 0) problem = '이미 멀쩡합니다.';
  else if (newMax < DURABILITY.scrapAt) problem = '너무 여러 번 고쳤습니다. 이제 새로 만들어야 합니다.';

  return { restore, ingotId, ingots, newMax, problem };
}
