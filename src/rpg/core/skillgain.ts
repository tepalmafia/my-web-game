/**
 *  스킬과 능력치의 성장.
 *
 *  ★ 이 게임에서 성장은 오직 여기서만 일어납니다. 경험치도 레벨도 없습니다.
 *
 *  두 가지 규칙이 전부입니다.
 *    ① 지금 스킬보다 한참 쉬운 일에서는 아무것도 배우지 못한다 (난이도 < 스킬 - 20)
 *    ② 스킬이 높을수록 오르기 어렵다
 *
 *  ①이 없으면 "가장 쉬운 것을 무한 반복"이 최적해가 됩니다.
 *  자동사냥에서 걷어낸 문제를 채집에서 되살리지 않으려는 규칙입니다.
 */

import { GAIN, MAX_SKILL, SKILL_TOTAL_MAX, STATS, gainChance } from '../balance';
import { MONSTERS } from '../content/monsters';
import { RECIPE_ORDER, recipeDef } from '../content/recipes';
import { AXES, SKILLS, SKILL_ORDER } from '../content/skills';
import { openRecipes } from '../content/town';
import { VEINS } from '../content/veins';
import { floater, log, toast, vfx } from './feedback';
import { chance, pick } from './rng';
import type { AxisId, Character, Difficulty, SkillId, StatId, World } from '../types';

const STAT_NAME: Record<StatId, string> = { str: '힘', dex: '민첩', int: '지능' };

/**
 *  지금까지 쓴 스킬 예산.
 *
 *  ★ 저장하지 않습니다 (CLAUDE.md 4장 1번). 셀 때마다 skills 에서 셉니다.
 *  ★ 무엇을 세는지는 content/skills.ts 의 counts 가 정합니다. 여기는 셈만 합니다.
 */
export function skillTotal(me: Character): number {
  let sum = 0;
  for (const id of SKILL_ORDER) if (SKILLS[id].counts) sum += me.skills[id];
  return Math.round(sum * 10) / 10;
}

/** 아직 쓸 수 있는 예산. 이미 넘긴 저장이면 0 입니다 (줄이지 않습니다) */
export function budgetLeft(me: Character): number {
  return Math.max(0, Math.round((SKILL_TOTAL_MAX - skillTotal(me)) * 10) / 10);
}

/** 이 축이 지금까지 쓴 예산 (화면 표시용) */
export function axisSpent(me: Character, axis: AxisId): number {
  let sum = 0;
  for (const id of AXES[axis].skills) if (SKILLS[id].counts) sum += me.skills[id];
  return Math.round(sum * 10) / 10;
}

/** 총합 상한에 막혀 있는가 — 이 스킬이 예산을 먹는 스킬일 때만 참입니다 */
export function budgetBlocks(me: Character, skillId: SkillId): boolean {
  return SKILLS[skillId].counts && budgetLeft(me) <= 0;
}

/** 상한에 닿았다는 말을 너무 자주 하지 않으려는 것뿐입니다 — 저장하지 않습니다 */
const toldAt = new WeakMap<World, number>();
const TELL_EVERY = 25;

/**
 * 한 번 시도했을 때의 성장 판정.
 * 성공했든 실패했든 부릅니다 — 실패에서도 배웁니다.
 */
export function trySkillGain(world: World, skillId: SkillId, difficulty: Difficulty): void {
  const me = world.me;
  const before = me.skills[skillId];
  if (before >= MAX_SKILL) return;

  if (chance(world, gainChance(before, difficulty))) {
    // 예산을 다 썼습니다 — 오르지 않습니다. ★ 다른 스킬을 깎지 않습니다
    if (budgetBlocks(me, skillId)) {
      tellBudgetSpent(world, skillId);
      return;
    }

    // 마지막 한 걸음은 남은 예산만큼만 걷습니다 — 총합이 상한을 정확히 채웁니다
    const room = SKILLS[skillId].counts ? budgetLeft(me) : GAIN.step;
    const after = Math.min(MAX_SKILL, Math.round((before + Math.min(GAIN.step, room)) * 10) / 10);
    me.skills[skillId] = after;

    const info = SKILLS[skillId];
    floater(world, { x: me.pos.x, y: me.pos.y - 26 }, `${info.name} ${after.toFixed(1)}`, 'gain', 'skill');

    // 10 단위를 넘길 때만 기록에 남깁니다 (0.1 마다 남기면 기록창이 잠깁니다)
    if (Math.floor(after / 10) > Math.floor(before / 10)) {
      log(world, `${info.name} ${Math.floor(after / 10) * 10} 에 이르렀습니다`, 'good');
    }
    if (after >= MAX_SKILL) {
      log(world, `${info.name} 이(가) 경지에 올랐습니다 (100)`, 'epic');
      toast(world, `${info.name} 100`, 'epic');
      vfx(world, 'levelup', me.pos, { life: 1.2, color: info.color, radius: 70 });
    }

    // 이 한 걸음으로 예산이 다 찼습니다 — 딱 한 번 지나가는 자리입니다
    if (SKILLS[skillId].counts && budgetLeft(me) <= 0) {
      log(world, `${skillTotal(me).toFixed(1)} 까지 왔습니다. 더 배울 자리가 없습니다 (총합 ${SKILL_TOTAL_MAX})`, 'epic');
      toast(world, `스킬 총합 ${SKILL_TOTAL_MAX}\n이제 무엇도 오르지 않습니다`, 'epic');
      vfx(world, 'levelup', me.pos, { life: 1.4, color: info.color, radius: 80 });
    }
  }

  tryStatGain(world, skillId);
}

/**
 * 능력치 성장.
 * 총합 상한(225)에 닿으면 가장 오래 안 쓴 능력치가 대신 내려갑니다.
 * 상한이 없으면 힘이 무한정 올라 무게 제한이 저절로 사라집니다.
 */
function tryStatGain(world: World, skillId: SkillId): void {
  const me = world.me;
  if (!chance(world, STATS.chance)) return;

  const candidates = SKILLS[skillId].stats;
  const statId = candidates.length === 1 ? candidates[0]! : pick(world, candidates);
  if (me[statId] >= STATS.max) return;

  const total = me.str + me.dex + me.int;
  if (total + STATS.step > STATS.totalMax) {
    // 상한에 닿았습니다 — 가장 오래 안 쓴 다른 능력치를 깎습니다
    const others = (['str', 'dex', 'int'] as StatId[])
      .filter((id) => id !== statId && me[id] > 10)
      .sort((a, b) => me.statTouched[a] - me.statTouched[b]);

    const victim = others[0];
    if (!victim) return;
    me[victim] = Math.round((me[victim] - STATS.step) * 10) / 10;
    log(world, `${STAT_NAME[victim]} 이(가) 조금 무뎌졌습니다`, 'normal');
  }

  me[statId] = Math.round((me[statId] + STATS.step) * 10) / 10;
  me.statTouched[statId] = world.time;

  if (Math.floor(me[statId]) > Math.floor(me[statId] - STATS.step)) {
    log(world, `${STAT_NAME[statId]} ${Math.floor(me[statId])}`, 'good');
  }
}

/**
 *  예산을 다 써서 안 올랐다는 것을 화면에 말합니다.
 *  ★ 조용히 안 오르면 그것도 조용한 실패입니다 (CLAUDE.md 6장).
 *    다만 휘두를 때마다 띄우면 소음이라 시간으로 눌러 둡니다.
 */
function tellBudgetSpent(world: World, skillId: SkillId): void {
  const last = toldAt.get(world);
  if (last !== undefined && world.time - last < TELL_EVERY) return;
  toldAt.set(world, world.time);

  const me = world.me;
  floater(world, { x: me.pos.x, y: me.pos.y - 26 }, `총합 ${SKILL_TOTAL_MAX} — 자리 없음`, 'miss', 'skill');
  log(world, `${SKILLS[skillId].name} 을(를) 배울 자리가 없습니다 — 스킬 총합이 ${SKILL_TOTAL_MAX} 입니다`, 'normal');
}

/** 지금 이 일을 하면 배울 것이 있는가 (화면에 표시용) */
export function canLearnFrom(world: World, skillId: SkillId, difficulty: Difficulty): boolean {
  return gainChance(world.me.skills[skillId], difficulty) > 0;
}

/* ===========================================================================
 *  무엇을 하면 배우는가 — 화면이 물어보는 것
 *
 *  ★ 판단은 전부 여기서 합니다. ui/ 는 받아서 그리기만 합니다 (4장 3번).
 * ======================================================================== */

/** 배울 거리 하나 — 광맥이든 제작법이든 몬스터든 같은 모양입니다 */
export interface Lesson {
  id: string;
  name: string;
  difficulty: Difficulty;
  /** 한 번 시도에 오를 확률. 0 이면 여기서 배울 것이 없습니다 */
  chance: number;
}

/**
 *  이 스킬이 안 오르는 이유.
 *
 *  ★ 이유가 둘입니다. 둘을 갈라 말하지 않으면 조용한 실패입니다 (6장).
 *    ceiling — 세상에 이보다 어려운 일이 없다
 *    budget  — 어려운 일은 남았는데 예산이 없다
 */
export type LearnBlock = 'none' | 'maxed' | 'budget' | 'ceiling';

/** 이 스킬을 올리는 일들 — 지금 할 수 있는 것만 (안 열린 제작법은 안 보여줍니다) */
export function lessonsFor(world: World, skillId: SkillId): Lesson[] {
  const skill = world.me.skills[skillId];
  const row = (id: string, name: string, difficulty: Difficulty): Lesson => ({
    id,
    name,
    difficulty,
    chance: gainChance(skill, difficulty),
  });

  if (skillId === 'mining') {
    return Object.values(VEINS).map((v) => row(v.id, v.name, v.difficulty));
  }
  if (skillId === 'blacksmithing') {
    const open = openRecipes(world.me.town);
    return RECIPE_ORDER.filter((id) => open.has(id)).map((id) => {
      const def = recipeDef(id);
      return row(def.id, def.name, def.difficulty);
    });
  }
  return Object.values(MONSTERS).map((m) => row(m.id, m.name, m.difficulty));
}

/** 왜 안 오르는가 — 안 막혀 있으면 'none' 입니다 */
export function learnBlock(world: World, skillId: SkillId): LearnBlock {
  if (world.me.skills[skillId] >= MAX_SKILL) return 'maxed';
  if (budgetBlocks(world.me, skillId)) return 'budget';
  if (lessonsFor(world, skillId).every((lesson) => lesson.chance <= 0)) return 'ceiling';
  return 'none';
}
