/**
 *  가방 — 넣고, 빼고, 입고, 사고, 팝니다.
 *
 *  겹칠 수 있는 물건(물약·주문서·재료)은 한 칸에 쌓이고,
 *  장비는 강화 수치가 저마다 달라서 한 칸에 하나씩 들어갑니다.
 */

import { LOOT } from '../balance';
import { itemDef } from '../content/items';
import { log, toast } from './feedback';
import { derive, equipProblem, itemName } from './stats';
import type { EquipSlot, ItemStack, Player, World } from '../types';

/** 같은 종류의 물건을 몇 개 가지고 있는가 */
export function countOf(player: Player, defId: string): number {
  let total = 0;
  for (const stack of player.inventory) {
    if (stack.defId === defId) total += stack.count;
  }
  return total;
}

export function findStack(player: Player, uid: number): ItemStack | undefined {
  return player.inventory.find((s) => s.uid === uid);
}

/** 가방에 자리가 있는가 */
export function hasRoom(player: Player, defId: string): boolean {
  if (player.inventory.length < LOOT.inventorySlots) return true;
  const def = itemDef(defId);
  if (!def.stackable) return false;
  return player.inventory.some((s) => s.defId === defId);
}

/**
 * 물건을 가방에 넣습니다. 자리가 없으면 false 를 돌려주고 아무 일도 하지 않습니다.
 */
export function addItem(world: World, defId: string, count = 1, plus = 0): boolean {
  const player = world.player;
  const def = itemDef(defId);

  if (def.stackable) {
    const stack = player.inventory.find((s) => s.defId === defId);
    if (stack) {
      stack.count += count;
      return true;
    }
  }
  if (player.inventory.length >= LOOT.inventorySlots) return false;

  player.inventory.push({ uid: world.nextId++, defId, plus, count });
  return true;
}

/** 물건을 덜어냅니다 (개수가 0 이 되면 칸이 사라집니다) */
export function removeItem(player: Player, uid: number, count = 1): void {
  const index = player.inventory.findIndex((s) => s.uid === uid);
  if (index < 0) return;
  const stack = player.inventory[index]!;
  stack.count -= count;
  if (stack.count <= 0) player.inventory.splice(index, 1);
}

/** 장비를 착용합니다. 이미 낀 게 있으면 가방으로 돌아갑니다 */
export function equip(world: World, uid: number): void {
  const player = world.player;
  const stack = findStack(player, uid);
  if (!stack) return;

  const def = itemDef(stack.defId);
  const problem = equipProblem(player, def);
  if (problem) {
    toast(world, problem, 'bad');
    return;
  }
  const slot = def.slot as EquipSlot;
  const previous = player.equipped[slot];

  removeItem(player, uid, stack.count);
  player.equipped[slot] = stack;
  if (previous) player.inventory.push(previous);

  log(world, `${itemName(stack)} 착용`, 'normal');
  clampVitals(world);
}

/** 장비를 벗습니다 */
export function unequip(world: World, slot: EquipSlot): void {
  const player = world.player;
  const stack = player.equipped[slot];
  if (!stack) return;
  if (player.inventory.length >= LOOT.inventorySlots) {
    toast(world, '가방이 가득 찼습니다.', 'bad');
    return;
  }
  player.equipped[slot] = null;
  player.inventory.push(stack);
  clampVitals(world);
}

/** 최대치가 줄었을 때 현재 체력·마나가 넘치지 않게 맞춥니다 */
export function clampVitals(world: World): void {
  const stats = derive(world.player);
  world.player.hp = Math.min(world.player.hp, stats.maxHp);
  world.player.mp = Math.min(world.player.mp, stats.maxMp);
}

/** 상점에 팔기 */
export function sellItem(world: World, uid: number, count = 1): void {
  const player = world.player;
  const stack = findStack(player, uid);
  if (!stack) return;
  const def = itemDef(stack.defId);

  const sold = Math.min(count, stack.count);
  // 강화한 장비는 더 쳐줍니다
  const unit = Math.round(def.sell * (1 + stack.plus * 0.4));
  const total = unit * sold;

  removeItem(player, uid, sold);
  player.gold += total;
  log(world, `${itemName(stack)}${sold > 1 ? ` ${sold}개` : ''} 판매 — ${total.toLocaleString()} 골드`, 'normal');
}

/** 상점에서 사기 */
export function buyItem(world: World, defId: string, count = 1): void {
  const player = world.player;
  const def = itemDef(defId);
  if (def.price <= 0) return;

  const total = def.price * count;
  if (player.gold < total) {
    toast(world, '골드가 부족합니다.', 'bad');
    return;
  }
  if (!hasRoom(player, defId)) {
    toast(world, '가방이 가득 찼습니다.', 'bad');
    return;
  }
  player.gold -= total;
  addItem(world, defId, count);
  log(world, `${def.name}${count > 1 ? ` ${count}개` : ''} 구입 — ${total.toLocaleString()} 골드`, 'normal');
}
