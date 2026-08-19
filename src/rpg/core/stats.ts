/**
 *  능력치 계산.
 *
 *  ★ 규칙: 계산해서 알 수 있는 값은 저장하지 않습니다.
 *    최대 체력, 공격력, 방어력은 언제나 여기서 다시 구합니다.
 *    저장해두면 장비를 바꿨을 때 실제 값과 어긋나는 버그가 반드시 생깁니다.
 */

import { COMBAT, ENHANCE_BONUS } from '../balance';
import { CLASSES } from '../content/classes';
import { itemDef } from '../content/items';
import type { EquipSlot, ItemDef, ItemStack, Player, Ratio } from '../types';

/** 지금 이 순간의 실제 능력치 */
export interface Stats {
  maxHp: number;
  maxMp: number;
  minDamage: number;
  maxDamage: number;
  /** AC — 낮을수록 좋습니다 (화면에 그대로 보여줍니다) */
  ac: number;
  /** AC 를 피해 감소로 바꾼 값 */
  defense: number;
  hit: number;
  crit: Ratio;
  lifesteal: Ratio;
  attackInterval: number;
  attackRange: number;
  moveSpeed: number;
  hpRegen: number;
  mpRegen: number;
}

const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'helmet', 'ring'];

/** 강화 수치가 붙은 무기의 실제 피해 폭 */
export function weaponDamage(def: ItemDef, plus: number): { min: number; max: number } {
  const mul = 1 + ENHANCE_BONUS.weaponDamageMul * plus;
  const flat = ENHANCE_BONUS.weaponFlat * plus;
  return {
    min: ((def.minDamage ?? 0) + flat) * mul,
    max: ((def.maxDamage ?? 0) + flat) * mul,
  };
}

/** 강화 수치가 붙은 방어구의 실제 AC */
export function armorAc(def: ItemDef, plus: number): number {
  return (def.ac ?? 0) - ENHANCE_BONUS.armorAc * plus;
}

/** 강화 수치가 붙은 지팡이의 실제 마력 */
export function weaponMagic(def: ItemDef, plus: number): number {
  if (!def.magicPower) return 0;
  return def.magicPower * (1 + ENHANCE_BONUS.weaponDamageMul * plus);
}

export function derive(player: Player): Stats {
  const cls = CLASSES[player.classId];
  const lv = player.level - 1;

  let maxHp = cls.baseHp + cls.hpPerLevel * lv;
  let maxMp = cls.baseMp + cls.mpPerLevel * lv;
  let minDamage = cls.baseMinDamage + cls.damagePerLevel * lv;
  let maxDamage = cls.baseMaxDamage + cls.damagePerLevel * lv;
  let ac = 0;
  let hit = cls.hit + player.level * 0.35;
  let crit = cls.crit;
  let lifesteal = 0;
  let magicPower = 0;

  for (const slot of EQUIP_SLOTS) {
    const stack = player.equipped[slot];
    if (!stack) continue;
    const def = itemDef(stack.defId);

    if (slot === 'weapon') {
      const dmg = weaponDamage(def, stack.plus);
      minDamage += dmg.min;
      maxDamage += dmg.max;
      magicPower += weaponMagic(def, stack.plus);
    } else if (def.ac) {
      ac += armorAc(def, stack.plus);
    }

    maxHp += def.bonusHp ?? 0;
    maxMp += def.bonusMp ?? 0;
    minDamage += def.bonusDamage ?? 0;
    maxDamage += def.bonusDamage ?? 0;
    crit += def.bonusCrit ?? 0;
    lifesteal += def.lifesteal ?? 0;
  }

  // 마법사는 지팡이의 마력이 곧 화력입니다
  if (cls.usesMagic) {
    minDamage += magicPower * 0.55;
    maxDamage += magicPower * 0.85;
  }

  let attackInterval = cls.attackInterval;
  let moveSpeed = cls.moveSpeed;
  let damageMul = 1;

  for (const buff of player.buffs) {
    const e = buff.effects;
    if (e.attackSpeedMul) attackInterval /= e.attackSpeedMul;
    if (e.moveSpeedMul) moveSpeed *= e.moveSpeedMul;
    if (e.damageMul) damageMul *= e.damageMul;
    if (e.acBonus) ac -= e.acBonus;
  }

  minDamage *= damageMul;
  maxDamage *= damageMul;

  const defense = Math.max(0, -ac);

  return {
    maxHp: Math.round(maxHp),
    maxMp: Math.round(maxMp),
    minDamage,
    maxDamage,
    ac: Math.round(ac),
    defense,
    hit,
    crit,
    lifesteal,
    attackInterval,
    attackRange: cls.attackRange,
    moveSpeed,
    hpRegen: cls.hpRegen + player.level * 0.22,
    mpRegen: cls.mpRegen + player.level * 0.12,
  };
}

/** 방어력이 피해를 얼마나 깎아주는가 (0 = 그대로, 0.5 = 절반) */
export function mitigation(defense: number): Ratio {
  return Math.min(COMBAT.maxMitigation, defense / (defense + COMBAT.defenseSoftness));
}

/** 이 장비를 지금 낄 수 있는가. 못 낀다면 이유를 돌려줍니다 */
export function equipProblem(player: Player, def: ItemDef): string | null {
  if (!def.slot) return '착용할 수 있는 장비가 아닙니다.';
  if ((def.reqLevel ?? 1) > player.level) return `레벨 ${def.reqLevel} 부터 착용할 수 있습니다.`;
  if (def.family) {
    const cls = CLASSES[player.classId];
    if (def.family !== cls.weaponFamily) {
      return `${cls.name}는 이 무기를 들 수 없습니다.`;
    }
  }
  return null;
}

/** 장비 한 점이 실제로 주는 능력치를 한 줄로 (화면 표시용) */
export function itemSummary(stack: ItemStack): string {
  const def = itemDef(stack.defId);
  const parts: string[] = [];

  if (def.slot === 'weapon') {
    const dmg = weaponDamage(def, stack.plus);
    parts.push(`공격 ${Math.round(dmg.min)}~${Math.round(dmg.max)}`);
    if (def.magicPower) parts.push(`마력 ${Math.round(weaponMagic(def, stack.plus))}`);
  } else if (def.ac) {
    parts.push(`AC ${armorAc(def, stack.plus)}`);
  }
  if (def.bonusHp) parts.push(`체력 +${def.bonusHp}`);
  if (def.bonusMp) parts.push(`마나 +${def.bonusMp}`);
  if (def.bonusDamage) parts.push(`공격 +${def.bonusDamage}`);
  if (def.bonusCrit) parts.push(`치명타 +${Math.round(def.bonusCrit * 100)}%`);
  if (def.lifesteal) parts.push(`흡혈 ${Math.round(def.lifesteal * 100)}%`);
  if (def.healHp) parts.push(`체력 ${def.healHp} 회복`);
  if (def.healMp) parts.push(`마나 ${def.healMp} 회복`);

  return parts.join(' · ');
}

/** 강화 수치까지 붙인 이름 (+7 롱소드) */
export function itemName(stack: ItemStack): string {
  const def = itemDef(stack.defId);
  return stack.plus > 0 ? `+${stack.plus} ${def.name}` : def.name;
}
