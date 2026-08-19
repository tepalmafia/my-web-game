/**
 *  전투.
 *
 *  ★ 레벨이 없으므로 명중은 오직 실력 대 실력입니다.
 *
 *      명중률 = (내 실력 + 25) / ((상대 실력 + 25) × 2)
 *
 *    같으면 50%, 내가 두 배면 83% 근처. 아무리 벌어져도 10~95% 를 넘지 않습니다.
 *    몬스터의 '실력'은 난이도(difficulty) 값이고, 내 실력은 검술(때릴 때)과 방어(맞을 때)입니다.
 *
 *  그래서 센 몬스터를 상대하면 자주 빗나가지만, 그만큼 검술이 빨리 늡니다.
 */

import { COMBAT, DURABILITY } from '../balance';
import { monsterDef } from '../content/monsters';
import { floater, shake, vfx } from './feedback';
import { dropLoot } from './loot';
import { chance, randRange } from './rng';
import { trySkillGain } from './skillgain';
import { derive, mitigation } from './stats';
import { wear } from './durability';
import type { Monster, World } from '../types';

/** 실력 대 실력의 명중 확률 */
export function hitChance(attacker: number, defender: number): number {
  const raw = (attacker + COMBAT.hitBias) / ((defender + COMBAT.hitBias) * 2);
  return Math.max(COMBAT.minHit, Math.min(COMBAT.maxHit, raw));
}

function rollDamage(world: World, min: number, max: number, defense: number, mul: number): number {
  const jitter = 1 + randRange(world, -COMBAT.damageJitter, COMBAT.damageJitter);
  const raw = randRange(world, min, max) * mul * jitter;
  return Math.max(COMBAT.minDamage, Math.round(raw * (1 - mitigation(defense))));
}

/* ===========================================================================
 *  나 → 몬스터
 * ======================================================================== */

export function swingAtMonster(world: World, monster: Monster): void {
  if (monster.state === 'dead') return;

  const me = world.me;
  const stats = derive(me);
  const def = monsterDef(monster.defId);

  // 맞은 쪽은 반드시 돌아섭니다
  monster.aggroUntil = world.time + 8;
  if (monster.state === 'idle' || monster.state === 'return') monster.state = 'chase';

  // 휘두르면 검이 닳습니다 (빗나가도 닳습니다)
  const weapon = me.equipped.weapon;
  if (weapon) wear(world, weapon, 1 / DURABILITY.hitsPerLoss, 'weapon');

  // 성공하든 실패하든 배웁니다
  trySkillGain(world, 'swordsmanship', def.difficulty);

  if (!chance(world, hitChance(me.skills.swordsmanship, def.difficulty))) {
    floater(world, monster.pos, '빗나감', 'miss', 'sword-miss');
    return;
  }

  const crit = chance(world, COMBAT.critChance);
  const damage = rollDamage(
    world,
    stats.minDamage,
    stats.maxDamage,
    def.defense,
    crit ? COMBAT.critMultiplier : 1,
  );

  monster.hp -= damage;
  monster.hitFlash = 0.12;
  floater(
    world,
    { x: monster.pos.x, y: monster.pos.y - def.size },
    String(damage),
    crit ? 'crit' : 'damage',
    crit ? 'sword-crit' : 'sword-hit',
  );
  vfx(world, 'impact', monster.pos, { life: 0.18, color: crit ? '#ffd23f' : '#ffffff', radius: def.size });

  if (monster.hp <= 0) killMonster(world, monster);
}

function killMonster(world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);
  const me = world.me;

  monster.state = 'dead';
  monster.hp = 0;
  monster.respawnIn = def.respawn;
  monster.path = [];
  if (me.targetId === monster.id) me.targetId = null;

  me.tally[def.id] = (me.tally[def.id] ?? 0) + 1;
  dropLoot(world, monster);
}

/* ===========================================================================
 *  몬스터 → 나
 * ======================================================================== */

export function monsterStrike(world: World, monster: Monster): void {
  const me = world.me;
  if (me.dead) return;

  const def = monsterDef(monster.defId);
  const stats = derive(me);

  // 맞아봐야 피할 줄 알게 됩니다 — 빗나가도 방어가 늡니다
  trySkillGain(world, 'defense', def.difficulty);

  if (!chance(world, hitChance(def.difficulty, me.skills.defense))) {
    floater(world, { x: me.pos.x, y: me.pos.y - 22 }, '회피', 'miss', 'dodge');
    return;
  }

  const damage = rollDamage(world, def.minDamage, def.maxDamage, stats.defense, 1);

  // 맞으면 입은 것이 닳습니다
  const armor = me.equipped.armor ?? me.equipped.helmet;
  if (armor) {
    const slot = me.equipped.armor ? 'armor' : 'helmet';
    wear(world, armor, 1 / DURABILITY.takenPerLoss, slot);
  }

  damagePlayer(world, damage);
}

export function damagePlayer(world: World, damage: number): void {
  const me = world.me;
  if (me.dead) return;

  me.hp -= damage;
  floater(world, { x: me.pos.x, y: me.pos.y - 22 }, String(damage), 'taken', 'taken');

  const stats = derive(me);
  if (damage > stats.maxHp * 0.18) shake(world, 0.22);

  // ★ 여기서 hp 를 0 으로 붙잡아 두면 안 됩니다.
  //   붙잡아 두면 다음 회복이 곧바로 1 이상으로 끌어올려서, 죽음 판정(engine.ts 끝)이
  //   영영 걸리지 않습니다. 실제로 늑대에게 한 시간을 맞으면서도 죽지 않았습니다.
  //   죽음 처리는 death.ts 가 합니다 (여기서 부르면 서로를 물고 들어갑니다).
}

/* ===========================================================================
 *  대상 고르기와 부활
 * ======================================================================== */

export function distanceTo(world: World, monster: Monster): number {
  return Math.hypot(monster.pos.x - world.me.pos.x, monster.pos.y - world.me.pos.y);
}

export function currentTarget(world: World): Monster | null {
  if (world.me.targetId === null) return null;
  const monster = world.monsters.find((m) => m.id === world.me.targetId);
  return monster && monster.state !== 'dead' ? monster : null;
}

export function nearestMonster(world: World, range: number): Monster | null {
  let best: Monster | null = null;
  let bestDistance = range;
  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    const distance = distanceTo(world, monster);
    if (distance < bestDistance) {
      best = monster;
      bestDistance = distance;
    }
  }
  return best;
}

export function tickRespawn(monster: Monster, dt: number): void {
  const def = monsterDef(monster.defId);
  monster.respawnIn -= dt;
  if (monster.respawnIn > 0) return;

  monster.state = 'idle';
  monster.hp = def.hp;
  monster.pos = { x: monster.home.x, y: monster.home.y };
  monster.attackCooldown = 0;
  monster.aggroUntil = 0;
  monster.path = [];
}
