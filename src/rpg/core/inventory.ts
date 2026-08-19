/**
 *  가방 — 넣고, 빼고, 입고, 사고, 팝니다.
 *
 *  ★ 이 게임에서 가방의 진짜 제약은 칸이 아니라 무게입니다.
 *    철광석 한 덩이가 10 스톤이라, 광맥 앞에서 "몇 덩이까지 지고 갈까"를 계속 재게 됩니다.
 */

import { LOOT } from '../balance';
import { itemDef } from '../content/items';
import { log, toast } from './feedback';
import { derive, equipProblem, itemName, stackWeight, totalWeight } from './stats';
import type { Character, EquipSlot, ItemStack, Stones, World } from '../types';

const SLOTS: EquipSlot[] = ['weapon', 'armor', 'helmet'];

export function countOf(me: Character, defId: string): number {
  let total = 0;
  for (const stack of me.backpack) if (stack.defId === defId) total += stack.count;
  return total;
}

export function findStack(me: Character, uid: number): ItemStack | undefined {
  return me.backpack.find((s) => s.uid === uid);
}

/** 입은 것까지 통틀어 이 uid 를 찾습니다 */
export function findAnywhere(me: Character, uid: number): { stack: ItemStack; slot: EquipSlot | null } | null {
  const inPack = findStack(me, uid);
  if (inPack) return { stack: inPack, slot: null };
  for (const slot of SLOTS) {
    const worn = me.equipped[slot];
    if (worn && worn.uid === uid) return { stack: worn, slot };
  }
  return null;
}

/** 남은 여유 무게 */
export function freeWeight(me: Character): Stones {
  return derive(me).carry - totalWeight(me);
}

/** 이만큼 더 들 수 있는가 */
export function canCarry(me: Character, defId: string, count = 1): boolean {
  return itemDef(defId).weight * count <= freeWeight(me);
}

/** 새 물건에 붙일 내구도 (닳는 물건이면) */
function freshDurability(defId: string, quality: 'normal' | 'fine' | undefined): Partial<ItemStack> {
  const def = itemDef(defId);
  if (!def.durability) return {};
  const max = Math.round(def.durability * (quality === 'fine' ? 1.25 : 1));
  return { durability: max, maxDurability: max };
}

/**
 * 가방에 넣습니다.
 * 무게가 넘치거나 칸이 없으면 false 를 돌려주고 아무 일도 하지 않습니다.
 */
export function addItem(
  world: World,
  defId: string,
  count = 1,
  options: { quality?: 'normal' | 'fine'; durability?: number; maxDurability?: number } = {},
): boolean {
  const me = world.me;
  const def = itemDef(defId);

  if (!canCarry(me, defId, count)) return false;

  if (def.stackable) {
    const stack = me.backpack.find((s) => s.defId === defId);
    if (stack) {
      stack.count += count;
      return true;
    }
  }
  if (me.backpack.length >= LOOT.packSlots) return false;

  me.backpack.push({
    uid: world.nextId++,
    defId,
    count,
    quality: options.quality,
    ...freshDurability(defId, options.quality),
    ...(options.durability !== undefined ? { durability: options.durability } : {}),
    ...(options.maxDurability !== undefined ? { maxDurability: options.maxDurability } : {}),
  });
  return true;
}

export function removeItem(me: Character, uid: number, count = 1): void {
  const index = me.backpack.findIndex((s) => s.uid === uid);
  if (index < 0) return;
  const stack = me.backpack[index]!;
  stack.count -= count;
  if (stack.count <= 0) me.backpack.splice(index, 1);
}

/** 재료를 defId 기준으로 필요한 만큼 덜어냅니다 (제작이 씁니다) */
export function consume(me: Character, defId: string, count: number): boolean {
  if (countOf(me, defId) < count) return false;
  let left = count;
  for (const stack of [...me.backpack]) {
    if (stack.defId !== defId || left <= 0) continue;
    const take = Math.min(left, stack.count);
    stack.count -= take;
    left -= take;
    if (stack.count <= 0) me.backpack = me.backpack.filter((s) => s.uid !== stack.uid);
  }
  return true;
}

/** 착용 — 이미 낀 게 있으면 가방으로 돌아갑니다 */
export function equip(world: World, uid: number): void {
  const me = world.me;
  const stack = findStack(me, uid);
  if (!stack) return;

  const problem = equipProblem(me, stack);
  if (problem) {
    toast(world, problem, 'bad');
    return;
  }
  const slot = itemDef(stack.defId).slot as EquipSlot;
  const previous = me.equipped[slot];

  removeItem(me, uid, stack.count);
  // ★ removeItem 이 같은 객체의 count 를 0 으로 만들어 놓습니다.
  //   그대로 입히면 '입은 것은 무게가 0' 이 되어 무게 규칙 전체가 무너집니다.
  //   (실제로 녹슨 검을 차고도 짐이 늘지 않았습니다)
  stack.count = 1;
  me.equipped[slot] = stack;
  if (previous) me.backpack.push(previous);

  log(world, `${itemName(stack)} 착용`, 'normal');
}

export function unequip(world: World, slot: EquipSlot): void {
  const me = world.me;
  const stack = me.equipped[slot];
  if (!stack) return;
  if (me.backpack.length >= LOOT.packSlots) {
    toast(world, '가방이 가득 찼습니다.', 'bad');
    return;
  }
  me.equipped[slot] = null;
  me.backpack.push(stack);
}

/** 상점에 팔기 — 닳은 물건은 값이 깎입니다 */
export function sellItem(world: World, uid: number, count = 1): void {
  const me = world.me;
  const stack = findStack(me, uid);
  if (!stack) return;
  const def = itemDef(stack.defId);

  const sold = Math.min(count, stack.count);
  const worn = stack.maxDurability ? Math.max(0.3, (stack.durability ?? 0) / stack.maxDurability) : 1;
  const fine = stack.quality === 'fine' ? 1.4 : 1;
  const total = Math.max(1, Math.round(def.sell * worn * fine)) * sold;

  removeItem(me, uid, sold);
  me.gold += total;
  log(world, `${itemName(stack)}${sold > 1 ? ` ${sold}개` : ''} 판매 — ${total.toLocaleString()} 골드`, 'normal');
}

/** 상점에서 사기 */
export function buyItem(world: World, defId: string, count = 1): void {
  const me = world.me;
  const def = itemDef(defId);
  if (def.price <= 0) return;

  const total = def.price * count;
  if (me.gold < total) {
    toast(world, '골드가 부족합니다.', 'bad');
    return;
  }
  if (!canCarry(me, defId, count)) {
    toast(world, '그만큼 들 수 없습니다.', 'bad');
    return;
  }
  me.gold -= total;
  addItem(world, defId, count);
  log(world, `${def.name}${count > 1 ? ` ${count}개` : ''} 구입 — ${total.toLocaleString()} 골드`, 'normal');
}

/** 지금 지고 있는 무게 (화면용 재수출) */
export { totalWeight, stackWeight };
