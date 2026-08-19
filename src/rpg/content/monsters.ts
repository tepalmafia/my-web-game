/**
 *  몬스터 목록.
 *
 *  사냥터는 다섯 곳이고, 각 사냥터마다 잡몹 두세 종 + 필드 보스 하나가 있습니다.
 *  마지막 용의 둥지에는 시계를 보고 기다려야 하는 진짜 보스가 있습니다.
 *
 *  ─ hp/exp 를 만질 때의 기준
 *      · 잡몹은 제 레벨 플레이어가 4~6초에 한 마리 잡는 정도
 *      · 필드 보스는 30~50초
 *      · 고룡은 2~3분
 */

import type { MonsterDef } from '../types';

const MONSTER_LIST: MonsterDef[] = [
  /* ================================================== 초원 (Lv 1~7) */
  {
    id: 'rat', name: '들쥐', level: 1, hp: 30, exp: 10, ac: 10,
    minDamage: 2, maxDamage: 4, hit: 0, moveSpeed: 62, attackRange: 26, attackInterval: 1.4,
    aggroRange: 0, ranged: false, shape: 'beast', color: '#a8896b', size: 9,
    goldMin: 2, goldMax: 8, respawn: 10,
    drops: [],
  },
  {
    id: 'slime', name: '슬라임', level: 3, hp: 58, exp: 20, ac: 8,
    minDamage: 4, maxDamage: 7, hit: 0, moveSpeed: 48, attackRange: 28, attackInterval: 1.6,
    aggroRange: 110, ranged: false, shape: 'blob', color: '#5eead4', size: 12,
    goldMin: 4, goldMax: 14, respawn: 12,
    drops: [{ defId: 'pot-hp-s', chance: 0.08 }],
  },
  {
    id: 'wolf', name: '들개', level: 5, hp: 78, exp: 34, ac: 5,
    minDamage: 7, maxDamage: 12, hit: 1, moveSpeed: 128, attackRange: 30, attackInterval: 1.25,
    aggroRange: 210, ranged: false, shape: 'beast', color: '#94a3b8', size: 12,
    goldMin: 8, goldMax: 22, respawn: 14,
    drops: [
      { defId: 'mat-pelt', chance: 0.4 },
      { defId: 'pot-hp-s', chance: 0.1 },
    ],
  },

  /* ================================================== 고블린 협곡 (Lv 7~14) */
  {
    id: 'goblin', name: '고블린', level: 8, hp: 130, exp: 72, ac: 2,
    minDamage: 12, maxDamage: 19, hit: 2, moveSpeed: 104, attackRange: 30, attackInterval: 1.5,
    aggroRange: 190, ranged: false, shape: 'humanoid', color: '#84cc16', size: 12,
    goldMin: 18, goldMax: 44, respawn: 13,
    drops: [
      { defId: 'mat-tooth', chance: 0.35 },
      { defId: 'pot-hp-s', chance: 0.14 },
      { defId: 'helm-cap', chance: 0.02 },
    ],
  },
  {
    id: 'goblin-archer', name: '고블린 궁수', level: 10, hp: 150, exp: 96, ac: 3,
    minDamage: 15, maxDamage: 23, hit: 3, moveSpeed: 96, attackRange: 175, attackInterval: 1.8,
    aggroRange: 250, ranged: true, shape: 'humanoid', color: '#a3e635', size: 11,
    goldMin: 24, goldMax: 56, respawn: 15,
    drops: [
      { defId: 'mat-tooth', chance: 0.3 },
      { defId: 'pot-hp', chance: 0.08 },
      { defId: 'bow-long', chance: 0.012 },
      { defId: 'sword-long', chance: 0.012 },
      { defId: 'staff-oak', chance: 0.012 },
    ],
  },
  {
    id: 'goblin-chief', name: '고블린 두목', level: 14, hp: 1700, exp: 900, ac: -4,
    minDamage: 26, maxDamage: 40, hit: 5, moveSpeed: 100, attackRange: 42, attackInterval: 1.5,
    aggroRange: 300, ranged: false, shape: 'humanoid', color: '#facc15', size: 19,
    goldMin: 400, goldMax: 900, respawn: 90, boss: true,
    aoe: { radius: 105, damageMul: 1.6, castTime: 1.1, cooldown: 9 },
    drops: [
      { defId: 'scroll-enhance', chance: 0.35 },
      { defId: 'armor-leather', chance: 0.2 },
      { defId: 'ring-hp', chance: 0.14 },
      { defId: 'ring-mp', chance: 0.14 },
      { defId: 'pot-hp', chance: 1, min: 3, max: 6 },
    ],
  },

  /* ================================================== 버려진 광산 (Lv 14~22) */
  {
    id: 'bat', name: '광산 박쥐', level: 15, hp: 210, exp: 175, ac: 0,
    minDamage: 20, maxDamage: 29, hit: 4, moveSpeed: 152, attackRange: 28, attackInterval: 1.1,
    aggroRange: 230, ranged: false, shape: 'bat', color: '#a78bfa', size: 11,
    goldMin: 35, goldMax: 80, respawn: 12,
    drops: [{ defId: 'pot-hp', chance: 0.1 }],
  },
  {
    id: 'miner', name: '언데드 광부', level: 17, hp: 300, exp: 240, ac: -3,
    minDamage: 25, maxDamage: 38, hit: 4, moveSpeed: 82, attackRange: 32, attackInterval: 1.5,
    aggroRange: 200, ranged: false, shape: 'undead', color: '#67e8f9', size: 13,
    goldMin: 50, goldMax: 120, respawn: 14,
    drops: [
      { defId: 'mat-ore', chance: 0.35 },
      { defId: 'scroll-enhance', chance: 0.05 },
      { defId: 'helm-iron', chance: 0.02 },
    ],
  },
  {
    id: 'golem', name: '석상 골렘', level: 20, hp: 700, exp: 430, ac: -14,
    minDamage: 40, maxDamage: 60, hit: 5, moveSpeed: 58, attackRange: 40, attackInterval: 2,
    aggroRange: 150, ranged: false, shape: 'golem', color: '#78716c', size: 17,
    goldMin: 100, goldMax: 220, respawn: 22,
    drops: [
      { defId: 'mat-ore', chance: 0.5 },
      { defId: 'scroll-enhance', chance: 0.08 },
      { defId: 'armor-scale', chance: 0.025 },
      { defId: 'helm-iron', chance: 0.03 },
    ],
  },
  {
    id: 'overseer', name: '광산 감독관', level: 23, hp: 2600, exp: 3500, ac: -16,
    minDamage: 52, maxDamage: 76, hit: 7, moveSpeed: 78, attackRange: 46, attackInterval: 1.6,
    aggroRange: 320, ranged: false, shape: 'golem', color: '#fb923c', size: 21,
    goldMin: 1200, goldMax: 2400, respawn: 110, boss: true,
    aoe: { radius: 125, damageMul: 1.7, castTime: 1.2, cooldown: 8.5 },
    drops: [
      { defId: 'scroll-enhance', chance: 0.5, min: 1, max: 2 },
      { defId: 'helm-knight', chance: 0.16 },
      { defId: 'ring-power', chance: 0.14 },
      { defId: 'armor-scale', chance: 0.25 },
      { defId: 'pot-hp-l', chance: 1, min: 2, max: 5 },
    ],
  },

  /* ================================================== 오크 요새 (Lv 22~30) */
  {
    id: 'orc', name: '오크 전사', level: 24, hp: 420, exp: 560, ac: -10,
    minDamage: 45, maxDamage: 66, hit: 6, moveSpeed: 100, attackRange: 36, attackInterval: 1.4,
    aggroRange: 240, ranged: false, shape: 'humanoid', color: '#65a30d', size: 15,
    goldMin: 160, goldMax: 320, respawn: 13,
    drops: [
      { defId: 'mat-tusk', chance: 0.35 },
      { defId: 'pot-hp', chance: 0.15 },
      { defId: 'scroll-enhance', chance: 0.06 },
    ],
  },
  {
    id: 'orc-shaman', name: '오크 주술사', level: 26, hp: 380, exp: 680, ac: -6,
    minDamage: 52, maxDamage: 78, hit: 7, moveSpeed: 88, attackRange: 190, attackInterval: 2,
    aggroRange: 280, ranged: true, shape: 'humanoid', color: '#14b8a6', size: 14,
    goldMin: 200, goldMax: 400, respawn: 15,
    aoe: { radius: 95, damageMul: 1.3, castTime: 1.3, cooldown: 11 },
    drops: [
      { defId: 'mat-tusk', chance: 0.3 },
      { defId: 'scroll-enhance', chance: 0.08 },
      { defId: 'ring-mp', chance: 0.03 },
      { defId: 'staff-arch', chance: 0.015 },
    ],
  },
  {
    id: 'orc-chief', name: '오크 대족장', level: 30, hp: 5200, exp: 6000, ac: -22,
    minDamage: 85, maxDamage: 125, hit: 9, moveSpeed: 96, attackRange: 50, attackInterval: 1.5,
    aggroRange: 340, ranged: false, shape: 'humanoid', color: '#ef4444', size: 23,
    goldMin: 3000, goldMax: 6000, respawn: 140, boss: true,
    aoe: { radius: 145, damageMul: 1.8, castTime: 1.2, cooldown: 8 },
    drops: [
      { defId: 'scroll-enhance', chance: 0.6, min: 1, max: 3 },
      { defId: 'scroll-blessed', chance: 0.15 },
      { defId: 'armor-plate', chance: 0.2 },
      { defId: 'sword-claymore', chance: 0.1 },
      { defId: 'bow-silver', chance: 0.1 },
      { defId: 'staff-arch', chance: 0.1 },
      { defId: 'sword-black', chance: 0.07 },
      { defId: 'bow-shadow', chance: 0.07 },
      { defId: 'staff-soul', chance: 0.07 },
      { defId: 'ring-blood', chance: 0.08 },
      { defId: 'pot-hp-l', chance: 1, min: 4, max: 8 },
    ],
  },

  /* ================================================== 용의 둥지 (Lv 30+) */
  {
    id: 'drake', name: '드레이크', level: 32, hp: 760, exp: 1050, ac: -26,
    minDamage: 95, maxDamage: 140, hit: 10, moveSpeed: 118, attackRange: 60, attackInterval: 1.5,
    aggroRange: 280, ranged: false, shape: 'dragon', color: '#f87171', size: 18,
    goldMin: 340, goldMax: 720, respawn: 15,
    drops: [
      { defId: 'mat-scale', chance: 0.3 },
      { defId: 'scroll-enhance', chance: 0.1 },
      { defId: 'pot-hp-l', chance: 0.2 },
      { defId: 'sword-black', chance: 0.03 },
      { defId: 'bow-shadow', chance: 0.03 },
      { defId: 'staff-soul', chance: 0.03 },
    ],
  },
  {
    id: 'flame', name: '화염 정령', level: 34, hp: 700, exp: 1200, ac: -20,
    minDamage: 105, maxDamage: 155, hit: 11, moveSpeed: 94, attackRange: 185, attackInterval: 1.9,
    aggroRange: 300, ranged: true, shape: 'elemental', color: '#fb923c', size: 16,
    goldMin: 400, goldMax: 850, respawn: 16,
    aoe: { radius: 110, damageMul: 1.5, castTime: 1.1, cooldown: 10 },
    drops: [
      { defId: 'mat-scale', chance: 0.25 },
      { defId: 'scroll-enhance', chance: 0.12 },
      { defId: 'helm-mithril', chance: 0.03 },
      { defId: 'ring-blood', chance: 0.02 },
    ],
  },
  {
    id: 'carnas', name: '고룡 카르나스', level: 40, hp: 32000, exp: 30000, ac: -34,
    minDamage: 190, maxDamage: 280, hit: 14, moveSpeed: 92, attackRange: 78, attackInterval: 1.5,
    aggroRange: 420, ranged: false, shape: 'dragon', color: '#dc2626', size: 34,
    goldMin: 30000, goldMax: 60000, respawn: 240, boss: true,
    aoe: { radius: 195, damageMul: 2.1, castTime: 1.4, cooldown: 7.5 },
    drops: [
      { defId: 'mat-scale', chance: 1, min: 4, max: 8 },
      { defId: 'scroll-blessed', chance: 0.8, min: 1, max: 2 },
      { defId: 'scroll-enhance', chance: 1, min: 3, max: 6 },
      { defId: 'helm-mithril', chance: 0.3 },
      { defId: 'armor-dragon', chance: 0.16 },
      { defId: 'ring-dragon', chance: 0.12 },
      { defId: 'sword-fang', chance: 0.13 },
      { defId: 'bow-dragon', chance: 0.13 },
      { defId: 'staff-carnas', chance: 0.13 },
    ],
  },
];

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(
  MONSTER_LIST.map((m) => [m.id, m]),
);

export function monsterDef(defId: string): MonsterDef {
  const def = MONSTERS[defId];
  if (!def) throw new Error(`알 수 없는 몬스터: ${defId}`);
  return def;
}
