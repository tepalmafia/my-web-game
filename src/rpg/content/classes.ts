/**
 *  직업 세 가지.
 *
 *  셋의 차이는 "숫자가 조금 다르다"가 아니라 싸우는 방식 자체입니다.
 *    기사   — 붙어서 맞으면서 팬다
 *    요정   — 멀리서 쏘고 거리를 유지한다
 *    마법사 — 유리대포. 지팡이 마력이 곧 화력
 */

import type { ClassDef, ClassId } from '../types';

export const CLASSES: Record<ClassId, ClassDef> = {
  knight: {
    id: 'knight',
    name: '기사',
    tagline: '맞으면서 이긴다',
    desc: '체력이 가장 높고 방어구를 제일 잘 씁니다. 사거리가 짧아 반드시 붙어야 하지만, 한번 붙으면 잘 죽지 않습니다. 처음이라면 이쪽을 권합니다.',
    color: '#e2e8f0',
    baseHp: 190,
    baseMp: 40,
    hpPerLevel: 26,
    mpPerLevel: 6,
    baseMinDamage: 5,
    baseMaxDamage: 9,
    damagePerLevel: 1.5,
    hpRegen: 2.2,
    mpRegen: 0.8,
    attackInterval: 1.05,
    attackRange: 40,
    projectile: 'none',
    moveSpeed: 118,
    hit: 3,
    crit: 0.06,
    weaponFamily: 'sword',
    usesMagic: false,
  },
  elf: {
    id: 'elf',
    name: '요정',
    tagline: '닿기 전에 끝낸다',
    desc: '활로 멀리서 공격합니다. 공격 속도가 가장 빠르고 발도 빠르지만, 붙잡히면 오래 버티지 못합니다. 치고 빠지는 손이 필요합니다.',
    color: '#86efac',
    baseHp: 140,
    baseMp: 70,
    hpPerLevel: 18,
    mpPerLevel: 10,
    baseMinDamage: 4,
    baseMaxDamage: 8,
    damagePerLevel: 1.35,
    hpRegen: 1.7,
    mpRegen: 1.4,
    attackInterval: 0.78,
    attackRange: 190,
    projectile: 'arrow',
    moveSpeed: 132,
    hit: 6,
    crit: 0.12,
    weaponFamily: 'bow',
    usesMagic: false,
  },
  wizard: {
    id: 'wizard',
    name: '마법사',
    tagline: '한 방이 다르다',
    desc: '지팡이의 마력이 그대로 화력이 됩니다. 광역 마법으로 여러 마리를 한꺼번에 녹이지만 체력이 종잇장이라, 마나가 떨어지는 순간이 가장 위험합니다.',
    color: '#c4b5fd',
    baseHp: 115,
    baseMp: 120,
    hpPerLevel: 14,
    mpPerLevel: 18,
    baseMinDamage: 3,
    baseMaxDamage: 6,
    damagePerLevel: 0.9,
    hpRegen: 1.4,
    mpRegen: 2.6,
    attackInterval: 1.15,
    attackRange: 210,
    projectile: 'bolt',
    moveSpeed: 112,
    hit: 4,
    crit: 0.07,
    weaponFamily: 'staff',
    usesMagic: true,
  },
};

export const CLASS_ORDER: ClassId[] = ['knight', 'elf', 'wizard'];
