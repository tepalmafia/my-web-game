/**
 *  능력치 계산.
 *
 *  ★ 규칙: 계산해서 알 수 있는 값은 저장하지 않습니다.
 *    최대 체력·공격력·방어력·소지 상한은 언제나 여기서 다시 구합니다.
 *
 *  레벨이 없으므로 모든 것이 두 곳에서만 나옵니다 — 능력치와 입고 있는 물건.
 */

import { BARE_HANDS, COMBAT, CRAFT, REGEN, WEIGHT, carryCapacity, maxHpOf } from '../balance';
import { itemDef } from '../content/items';
import type { Character, EquipSlot, ItemStack, Ratio, Stones } from '../types';

export interface Stats {
  maxHp: number;
  /** 무기와 힘에서 나오는 피해 */
  minDamage: number;
  maxDamage: number;
  /** 한 번 휘두르는 데 걸리는 시간 */
  swing: number;
  attackRange: number;
  /** 입고 있는 것의 방어값 합 (높을수록 좋음) */
  defense: number;
  /** 짐 때문에 깎인 뒤의 이동 속도 */
  moveSpeed: number;
  /** 소지 상한 */
  carry: Stones;
  /** 지금 지고 있는 무게 */
  load: Stones;
  /** 초당 체력 회복 */
  regen: number;
}

const SLOTS: EquipSlot[] = ['weapon', 'armor', 'helmet'];

/** 기본 이동 속도 (짐이 없을 때) */
const BASE_MOVE = 120;

/** 우수품은 성능이 조금 낫습니다 */
function qualityMul(stack: ItemStack): number {
  return stack.quality === 'fine' ? 1 + CRAFT.fineBonus : 1;
}

/** 물건 하나(겹친 개수 포함)의 무게 */
export function stackWeight(stack: ItemStack): Stones {
  return itemDef(stack.defId).weight * stack.count;
}

/** 지금 지고 있는 총 무게 — 입은 것도 무게에 들어갑니다 */
export function totalWeight(me: Character): Stones {
  let sum = 0;
  for (const stack of me.backpack) sum += stackWeight(stack);
  for (const slot of SLOTS) {
    const worn = me.equipped[slot];
    if (worn) sum += stackWeight(worn);
  }
  return Math.round(sum * 10) / 10;
}

/** 짐이 무거울수록 느려집니다 (상한을 넘기 전에도 이미 무겁습니다) */
export function loadPenalty(load: Stones, carry: Stones): Ratio {
  const ratio = carry > 0 ? load / carry : 0;
  if (ratio <= WEIGHT.slowFrom) return 0;
  const over = (ratio - WEIGHT.slowFrom) / (1 - WEIGHT.slowFrom);
  return Math.min(WEIGHT.maxSlow, over * WEIGHT.maxSlow);
}

export function derive(me: Character): Stats {
  const weapon = me.equipped.weapon;
  const weaponDef = weapon ? itemDef(weapon.defId) : null;

  let minDamage = BARE_HANDS.min;
  let maxDamage = BARE_HANDS.max;
  let swing = BARE_HANDS.swing;

  if (weaponDef && weaponDef.minDamage !== undefined) {
    const mul = qualityMul(weapon!);
    minDamage = weaponDef.minDamage * mul;
    maxDamage = (weaponDef.maxDamage ?? weaponDef.minDamage) * mul;
    swing = weaponDef.swing ?? BARE_HANDS.swing;
  }

  // 힘이 셀수록 같은 무기로도 더 아프게 때립니다
  const strBonus = 1 + me.str * COMBAT.strDamage;
  minDamage *= strBonus;
  maxDamage *= strBonus;

  // 민첩이 높을수록 빨리 휘두릅니다
  swing *= Math.max(0.45, 1 - me.dex * COMBAT.dexSpeed);

  let defense = 0;
  for (const slot of SLOTS) {
    const worn = me.equipped[slot];
    if (!worn) continue;
    const def = itemDef(worn.defId);
    if (def.defense) defense += def.defense * qualityMul(worn);
  }

  const carry = carryCapacity(me.str);
  const load = totalWeight(me);
  const moveSpeed = BASE_MOVE * (1 - loadPenalty(load, carry));

  return {
    maxHp: maxHpOf(me.str),
    minDamage,
    maxDamage,
    swing,
    attackRange: 40,
    defense: Math.round(defense * 10) / 10,
    moveSpeed,
    carry,
    load,
    regen: REGEN.base + me.str * REGEN.perStr,
  };
}

/** 방어값이 피해를 깎는 정도 (0 = 그대로, 0.7 = 상한) */
export function mitigation(defense: number): Ratio {
  return Math.min(COMBAT.maxMitigation, defense / (defense + COMBAT.defenseSoftness));
}

/* ===========================================================================
 *  물건 표기
 * ======================================================================== */

/** 품질이 이름 앞에 붙습니다 — "우수한 철검" */
export function itemName(stack: ItemStack): string {
  const def = itemDef(stack.defId);
  return stack.quality === 'fine' ? `우수한 ${def.name}` : def.name;
}

/** 남은 내구도 비율 (닳지 않는 물건이면 null) */
export function wearRatio(stack: ItemStack): Ratio | null {
  if (stack.durability === undefined || !stack.maxDurability) return null;
  return Math.max(0, stack.durability / stack.maxDurability);
}

/** 화면에 한 줄로 보여줄 성능 요약 */
export function itemSummary(stack: ItemStack): string {
  const def = itemDef(stack.defId);
  const mul = qualityMul(stack);
  const parts: string[] = [];

  if (def.minDamage !== undefined) {
    parts.push(`공격 ${Math.round(def.minDamage * mul)}~${Math.round((def.maxDamage ?? 0) * mul)}`);
    if (def.swing) parts.push(`${def.swing.toFixed(2)}초`);
  }
  if (def.defense) parts.push(`방어 ${Math.round(def.defense * mul)}`);
  if (def.healHp) parts.push(`체력 ${def.healHp} 회복`);
  if (def.tool) parts.push(def.tool === 'pickaxe' ? '채광 연장' : '제작 연장');

  if (stack.durability !== undefined && stack.maxDurability) {
    parts.push(`내구 ${Math.ceil(stack.durability)}/${Math.round(stack.maxDurability)}`);
  }
  parts.push(`${def.weight * stack.count} 스톤`);
  return parts.join(' · ');
}

/**
 * 이 물건을 지금 낄 수 있는가.
 * ★ 레벨 제한도 직업 제한도 없습니다 — 들 수만 있으면 됩니다.
 */
export function equipProblem(me: Character, stack: ItemStack): string | null {
  const def = itemDef(stack.defId);
  if (!def.slot) return '착용할 수 있는 물건이 아닙니다.';
  if (stack.durability !== undefined && stack.durability <= 0) return '망가져서 쓸 수 없습니다.';
  void me;
  return null;
}
