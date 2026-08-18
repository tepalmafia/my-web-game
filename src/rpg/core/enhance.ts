/**
 *  강화.
 *
 *  이 게임에서 가장 오래 기억에 남는 순간은 대부분 여기서 나옵니다.
 *
 *      +3 까지는 반드시 성공합니다.
 *      +4 부터 75% → 60% → 45% → 33% → 22% → 14% → 8% 로 떨어집니다.
 *      일반 주문서로 실패하면 그 장비는 사라집니다. 되돌릴 방법은 없습니다.
 *      축복받은 주문서로 실패하면 +0 으로 돌아갑니다. 장비는 남습니다.
 *
 *  숫자를 바꾸고 싶다면 balance.ts 의 ENHANCE_CHANCE 만 고치면 됩니다.
 */

import { ENHANCE_CHANCE, MAX_PLUS } from '../balance';
import { itemDef } from '../content/items';
import { log, shake, toast, vfx } from './feedback';
import { clampVitals, countOf, findStack, removeItem } from './inventory';
import { chance } from './rng';
import { itemName } from './stats';
import type { EquipSlot, ItemStack, World } from '../types';

/** 이 수치에서 한 단계 더 올라갈 확률 */
export function enhanceChance(plus: number): number {
  return ENHANCE_CHANCE[plus] ?? 0;
}

/** 강화창에 고른 장비 찾기 (가방과 착용 중인 것 모두에서) */
export function findEnhanceable(world: World, uid: number): { stack: ItemStack; slot: EquipSlot | null } | null {
  const player = world.player;

  const inBag = findStack(player, uid);
  if (inBag) return { stack: inBag, slot: null };

  for (const slot of ['weapon', 'armor', 'helmet', 'ring'] as EquipSlot[]) {
    const equipped = player.equipped[slot];
    if (equipped && equipped.uid === uid) return { stack: equipped, slot };
  }
  return null;
}

export type EnhanceOutcome = 'success' | 'reset' | 'destroyed' | 'blocked';

/**
 * 주문서 한 장을 씁니다.
 * scrollId 는 'scroll-enhance'(일반) 또는 'scroll-blessed'(축복) 입니다.
 */
export function enhance(world: World, uid: number, scrollId: string): EnhanceOutcome {
  const player = world.player;
  const found = findEnhanceable(world, uid);
  if (!found) return 'blocked';

  const { stack, slot } = found;
  const def = itemDef(stack.defId);

  if (!def.enhanceable) {
    world.enhanceResult = { text: '강화할 수 없는 물건입니다.', tone: 'bad', life: 3 };
    return 'blocked';
  }
  if (stack.plus >= MAX_PLUS) {
    world.enhanceResult = { text: `이미 +${MAX_PLUS} 입니다. 더는 올라가지 않습니다.`, tone: 'bad', life: 3 };
    return 'blocked';
  }
  if (countOf(player, scrollId) <= 0) {
    world.enhanceResult = { text: '주문서가 없습니다.', tone: 'bad', life: 3 };
    return 'blocked';
  }

  // 주문서 한 장 소모
  const scrollStack = player.inventory.find((s) => s.defId === scrollId);
  if (!scrollStack) return 'blocked';
  removeItem(player, scrollStack.uid, 1);

  const blessed = scrollId === 'scroll-blessed';
  const before = itemName(stack);
  const rate = enhanceChance(stack.plus);

  if (chance(world, rate)) {
    stack.plus += 1;
    const after = itemName(stack);
    log(world, `강화 성공 — ${after}`, 'epic');
    toast(world, `강화 성공\n${after}`, 'epic');
    world.enhanceResult = { text: `성공! ${before} → ${after}`, tone: 'epic', life: 4 };
    vfx(world, 'levelup', player.pos, { life: 0.9, color: '#fbbf24', radius: 56 });
    clampVitals(world);
    return 'success';
  }

  if (blessed) {
    stack.plus = 0;
    log(world, `강화 실패 — ${before} 이(가) +0 으로 돌아갔습니다`, 'bad');
    world.enhanceResult = { text: `실패. ${before} → +0 (장비는 남았습니다)`, tone: 'bad', life: 4 };
    shake(world, 0.25);
    clampVitals(world);
    return 'reset';
  }

  // 일반 주문서 실패 — 장비가 사라집니다
  if (slot) player.equipped[slot] = null;
  else removeItem(player, stack.uid, stack.count);

  if (world.enhanceUid === uid) world.enhanceUid = null;

  log(world, `${before} 이(가) 산산조각 났습니다`, 'bad');
  toast(world, `${before}\n산산조각`, 'bad');
  world.enhanceResult = { text: `실패. ${before} 이(가) 사라졌습니다.`, tone: 'bad', life: 5 };
  shake(world, 0.5);
  vfx(world, 'impact', player.pos, { life: 0.6, color: '#ef4444', radius: 40 });
  clampVitals(world);
  return 'destroyed';
}
