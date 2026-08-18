/**
 *  전투 계산.
 *
 *  한 번의 공격은 두 단계입니다.
 *      1) 맞았는가   — 레벨 차이와 명중치로 확률을 구합니다 (35%~95% 사이)
 *      2) 얼마나 아픈가 — 피해 폭에서 뽑고, 방어력만큼 깎습니다
 *
 *  방어력은 아무리 높아도 피해를 72%까지만 줄여줍니다.
 *  그래서 상위 사냥터에서는 장비가 좋아도 결국 맞아 죽습니다.
 */

import { COMBAT, expPenalty } from '../balance';
import { monsterDef } from '../content/monsters';
import { floater, log, shake, vfx } from './feedback';
import { dropLoot } from './loot';
import { die, gainExp } from './progression';
import { recordKill } from './quests';
import { chance, randRange } from './rng';
import { derive, mitigation } from './stats';
import type { Monster, World } from '../types';

/** 공격이 맞을 확률 */
function hitChance(
  world: World,
  attackerLevel: number,
  attackerHit: number,
  defenderLevel: number,
  defenderHit: number,
): number {
  const raw =
    COMBAT.baseHitChance +
    (attackerLevel - defenderLevel) * COMBAT.hitPerLevel +
    (attackerHit - defenderHit * 0.5) * COMBAT.hitPerPoint;
  const clamped = Math.max(COMBAT.minHitChance, Math.min(COMBAT.maxHitChance, raw));
  return chance(world, clamped) ? 1 : 0;
}

/** 피해 폭에서 하나 뽑고 방어력만큼 깎습니다 */
function resolveDamage(world: World, min: number, max: number, defense: number, mul: number): number {
  const jitter = 1 + randRange(world, -COMBAT.damageJitter, COMBAT.damageJitter);
  const raw = randRange(world, min, max) * mul * jitter;
  const after = raw * (1 - mitigation(defense));
  return Math.max(COMBAT.minDamage, Math.round(after));
}

/* ===========================================================================
 *  플레이어 → 몬스터
 * ======================================================================== */

/**
 * 몬스터 한 마리를 때립니다.
 * powerMul 이 1 이면 평타, 2.5 면 평타의 2.5배짜리 스킬입니다.
 */
export function strikeMonster(
  world: World,
  monster: Monster,
  powerMul: number,
  color?: string,
): void {
  if (monster.state === 'dead') return;

  const player = world.player;
  const stats = derive(player);
  const def = monsterDef(monster.defId);

  // 맞은 쪽은 반드시 반격합니다 — 뒤에서 때리고 도망가는 건 안 됩니다
  monster.aggroUntil = world.time + 8;
  if (monster.state === 'idle' || monster.state === 'return') monster.state = 'chase';

  if (!hitChance(world, player.level, stats.hit, def.level, def.hit)) {
    floater(world, monster.pos, '빗나감', 'miss');
    return;
  }

  const isCrit = chance(world, stats.crit);
  const critMul = isCrit ? COMBAT.critMultiplier : 1;
  const defense = Math.max(0, -def.ac);
  const damage = resolveDamage(world, stats.minDamage, stats.maxDamage, defense, powerMul * critMul);

  monster.hp -= damage;
  monster.hitFlash = 0.12;

  floater(world, { x: monster.pos.x, y: monster.pos.y - def.size }, String(damage), isCrit ? 'crit' : 'damage');
  vfx(world, 'impact', monster.pos, { life: 0.18, color: color ?? (isCrit ? '#fde047' : '#ffffff'), radius: def.size });

  if (stats.lifesteal > 0) {
    const healed = Math.max(1, Math.round(damage * stats.lifesteal));
    player.hp = Math.min(stats.maxHp, player.hp + healed);
  }

  if (monster.hp <= 0) killMonster(world, monster);
}

/** 나를 중심으로 반경 안의 모든 적을 때립니다 */
export function strikeArea(world: World, radius: number, powerMul: number, color: string): number {
  const player = world.player;
  let hits = 0;

  vfx(world, 'aoe', player.pos, { life: 0.45, color, radius });
  shake(world, 0.16);

  for (const monster of [...world.monsters]) {
    if (monster.state === 'dead') continue;
    const distance = Math.hypot(monster.pos.x - player.pos.x, monster.pos.y - player.pos.y);
    if (distance > radius) continue;
    strikeMonster(world, monster, powerMul, color);
    hits += 1;
  }
  return hits;
}

function killMonster(world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);
  const player = world.player;

  monster.state = 'dead';
  monster.hp = 0;
  monster.respawnIn = def.respawn;
  monster.castTimer = 0;

  if (player.targetId === monster.id) player.targetId = null;

  const exp = Math.max(1, Math.round(def.exp * expPenalty(player.level, def.level)));
  floater(world, { x: monster.pos.x, y: monster.pos.y - def.size - 14 }, `+${exp.toLocaleString()} EXP`, 'exp');

  if (def.boss) {
    world.bossRespawnAt[monster.defId] = world.time + def.respawn;
    log(world, `${def.name} 처치!`, 'epic');
    shake(world, 0.5);
    vfx(world, 'ring', monster.pos, { life: 1.4, color: '#fbbf24', radius: def.size * 2.4 });
    if (monster.defId === 'carnas') {
      player.bossKills += 1;
    }
  }

  dropLoot(world, monster);
  gainExp(world, exp);
  recordKill(world, monster.defId);
}

/* ===========================================================================
 *  몬스터 → 플레이어
 * ======================================================================== */

export function monsterStrike(world: World, monster: Monster, powerMul = 1): void {
  const player = world.player;
  if (player.dead) return;

  const stats = derive(player);
  const def = monsterDef(monster.defId);

  if (!hitChance(world, def.level, def.hit, player.level, stats.hit)) {
    floater(world, { x: player.pos.x, y: player.pos.y - 20 }, '회피', 'miss');
    return;
  }

  const damage = resolveDamage(world, def.minDamage, def.maxDamage, stats.defense, powerMul);
  damagePlayer(world, damage);
}

export function damagePlayer(world: World, damage: number): void {
  const player = world.player;
  if (player.dead) return;

  player.hp -= damage;
  floater(world, { x: player.pos.x, y: player.pos.y - 22 }, String(damage), 'taken');

  const stats = derive(player);
  if (damage > stats.maxHp * 0.18) shake(world, 0.22);

  if (player.hp <= 0) die(world);
}

/** 원거리 몬스터가 쏜 것이 날아가는 그림 */
export function monsterProjectile(world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);
  vfx(world, 'projectile', monster.pos, {
    to: { x: world.player.pos.x, y: world.player.pos.y },
    life: 0.22,
    color: def.color,
  });
}

/** 몬스터의 광역기 — 바닥에 원이 그려지고, 시간이 끝나면 그 안에 있는 사람이 맞습니다 */
export function monsterAoeLand(world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);
  if (!def.aoe) return;

  vfx(world, 'aoe', monster.pos, { life: 0.5, color: def.color, radius: def.aoe.radius });
  shake(world, 0.3);

  const distance = Math.hypot(world.player.pos.x - monster.pos.x, world.player.pos.y - monster.pos.y);
  if (distance <= def.aoe.radius) {
    monsterStrike(world, monster, def.aoe.damageMul);
  } else {
    floater(world, { x: world.player.pos.x, y: world.player.pos.y - 22 }, '피함', 'miss');
  }
}

/** 목표까지의 거리 */
export function distanceTo(world: World, monster: Monster): number {
  return Math.hypot(monster.pos.x - world.player.pos.x, monster.pos.y - world.player.pos.y);
}

/** 지금 노리고 있는 몬스터 */
export function currentTarget(world: World): Monster | null {
  if (world.player.targetId === null) return null;
  const monster = world.monsters.find((m) => m.id === world.player.targetId);
  if (!monster || monster.state === 'dead') return null;
  return monster;
}

/** 가장 가까운 살아 있는 몬스터 (자동 사냥이 씁니다) */
export function nearestMonster(world: World, range: number, skipBoss = false): Monster | null {
  let best: Monster | null = null;
  let bestDistance = range;

  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    if (skipBoss && monsterDef(monster.defId).boss) continue;
    const distance = distanceTo(world, monster);
    if (distance < bestDistance) {
      best = monster;
      bestDistance = distance;
    }
  }
  return best;
}

/** 몬스터가 죽어 있는 동안 흐르는 부활 시계 — 시간이 다 되면 자기 자리에서 다시 일어납니다 */
export function tickRespawn(world: World, monster: Monster, dt: number): void {
  const def = monsterDef(monster.defId);
  monster.respawnIn -= dt;
  if (monster.respawnIn > 0) return;

  monster.state = 'idle';
  monster.hp = def.hp;
  monster.pos = { x: monster.home.x, y: monster.home.y };
  monster.attackCooldown = 0;
  monster.castTimer = 0;
  monster.aoeCooldown = def.aoe ? def.aoe.cooldown * 0.5 : 0;
  monster.aggroUntil = 0;

  if (def.boss) {
    delete world.bossRespawnAt[monster.defId];
    log(world, `${def.name}이(가) 다시 나타났습니다`, 'bad');
    vfx(world, 'ring', monster.pos, { life: 1.2, color: def.color, radius: def.size * 2 });
  }
}
