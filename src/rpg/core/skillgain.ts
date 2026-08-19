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

import { GAIN, MAX_SKILL, STATS, gainChance } from '../balance';
import { SKILLS } from '../content/skills';
import { floater, log, toast, vfx } from './feedback';
import { chance, pick } from './rng';
import type { Difficulty, SkillId, StatId, World } from '../types';

const STAT_NAME: Record<StatId, string> = { str: '힘', dex: '민첩', int: '지능' };

/**
 * 한 번 시도했을 때의 성장 판정.
 * 성공했든 실패했든 부릅니다 — 실패에서도 배웁니다.
 */
export function trySkillGain(world: World, skillId: SkillId, difficulty: Difficulty): void {
  const me = world.me;
  const before = me.skills[skillId];
  if (before >= MAX_SKILL) return;

  if (chance(world, gainChance(before, difficulty))) {
    const after = Math.min(MAX_SKILL, Math.round((before + GAIN.step) * 10) / 10);
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

/** 지금 이 일을 하면 배울 것이 있는가 (화면에 표시용) */
export function canLearnFrom(world: World, skillId: SkillId, difficulty: Difficulty): boolean {
  return gainChance(world.me.skills[skillId], difficulty) > 0;
}
