/**
 *  직업별 스킬 세 개씩.
 *
 *  1번은 처음부터, 2번은 중반, 3번은 후반에 열립니다.
 *  자동 사냥은 쿨타임이 도는 대로 알아서 씁니다 (마나가 넉넉할 때만).
 */

import type { ClassId, SkillDef } from '../types';

export const SKILLS: SkillDef[] = [
  /* ------------------------------------------------------------- 기사 */
  {
    id: 'k1', name: '강타', classId: 'knight', reqLevel: 1, mpCost: 8, cooldown: 4,
    kind: 'strike', power: 2.5, color: '#fca5a5',
    desc: '한 대상에게 평타의 2.5배로 내려칩니다.',
  },
  {
    id: 'k2', name: '광폭화', classId: 'knight', reqLevel: 10, mpCost: 26, cooldown: 26,
    kind: 'buff', power: 0, duration: 12, color: '#f97316',
    buff: { attackSpeedMul: 1.45, damageMul: 1.15 },
    desc: '12초 동안 공격 속도 45%, 피해 15% 증가.',
  },
  {
    id: 'k3', name: '대지 가르기', classId: 'knight', reqLevel: 20, mpCost: 45, cooldown: 12,
    kind: 'aoe', power: 2.2, radius: 125, color: '#fbbf24',
    desc: '주변의 적 전부에게 평타의 2.2배.',
  },

  /* ------------------------------------------------------------- 요정 */
  {
    id: 'e1', name: '이중 사격', classId: 'elf', reqLevel: 1, mpCost: 8, cooldown: 4,
    kind: 'multi', power: 1.35, hits: 2, color: '#86efac',
    desc: '화살 두 발을 연달아 쏩니다. 발당 평타의 1.35배.',
  },
  {
    id: 'e2', name: '바람의 가호', classId: 'elf', reqLevel: 10, mpCost: 24, cooldown: 24,
    kind: 'buff', power: 0, duration: 14, color: '#5eead4',
    buff: { attackSpeedMul: 1.3, moveSpeedMul: 1.35 },
    desc: '14초 동안 공격 속도 30%, 이동 속도 35% 증가.',
  },
  {
    id: 'e3', name: '화살비', classId: 'elf', reqLevel: 20, mpCost: 42, cooldown: 11,
    kind: 'aoe', power: 1.9, radius: 140, color: '#a7f3d0',
    desc: '주변 넓은 범위에 화살을 퍼붓습니다. 평타의 1.9배.',
  },

  /* ----------------------------------------------------------- 마법사 */
  {
    id: 'w1', name: '파이어볼', classId: 'wizard', reqLevel: 1, mpCost: 11, cooldown: 3.5,
    kind: 'strike', power: 2.7, color: '#fb923c',
    desc: '불덩이를 던집니다. 평타의 2.7배.',
  },
  {
    id: 'w2', name: '치유', classId: 'wizard', reqLevel: 8, mpCost: 32, cooldown: 14,
    kind: 'heal', power: 0, healRatio: 0.45, color: '#7dd3fc',
    desc: '최대 체력의 45%를 즉시 회복합니다.',
  },
  {
    id: 'w3', name: '메테오', classId: 'wizard', reqLevel: 20, mpCost: 58, cooldown: 13,
    kind: 'aoe', power: 3.1, radius: 155, color: '#f472b6',
    desc: '하늘에서 운석이 떨어집니다. 주변 전체에 평타의 3.1배.',
  },
];

/** 이 직업의 스킬 세 개를 순서대로 */
export function skillsOf(classId: ClassId): SkillDef[] {
  return SKILLS.filter((s) => s.classId === classId);
}

export function skillDef(id: string): SkillDef {
  const def = SKILLS.find((s) => s.id === id);
  if (!def) throw new Error(`알 수 없는 스킬: ${id}`);
  return def;
}
