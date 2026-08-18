/**
 *  세계가 한 칸 흐릅니다.
 *
 *  화면이 한 장 그려질 때마다 step() 이 한 번 불립니다.
 *  순서는 이렇습니다.
 *      시계 → 자동 사냥 판단 → 내 이동 → 내 공격 → 몬스터 → 줍기 → 회복 → 문/사람 → 정리
 *
 *  ※ 여기서는 화면을 전혀 모릅니다. 그리는 일은 ui/draw.ts 가 따로 합니다.
 */

import { AI, AUTO, MAX_STEP, PLAYER_RADIUS, REST_AFTER, REST_REGEN_MULTIPLIER, TILE, TOWN_REGEN_MULTIPLIER, VIEW } from '../balance';
import { CLASSES } from '../content/classes';
import { monsterDef } from '../content/monsters';
import {
  currentTarget,
  distanceTo,
  monsterAoeLand,
  monsterProjectile,
  monsterStrike,
  nearestMonster,
  strikeMonster,
  tickRespawn,
} from './combat';
import { autoUseSkills, drinkBestPotion } from './commands';
import { log, toast, vfx } from './feedback';
import { pickUpNearby } from './loot';
import { nextRandom, randRange } from './rng';
import { derive } from './stats';
import { blockedAt, enterMap, slideMove, tileCenter } from './world';
import type { Monster, World } from '../types';

export function step(world: World, rawDt: number): void {
  const dt = Math.min(rawDt, MAX_STEP);
  const player = world.player;

  world.time += dt;
  player.playSeconds += dt;

  tickTimers(world, dt);

  if (player.dead) {
    player.deadFor += dt;
    decay(world, dt);
    followCamera(world, dt);
    return;
  }

  if (player.auto) runAuto(world);

  movePlayer(world, dt);
  playerAttack(world, dt);
  updateMonsters(world, dt);
  pickUpNearby(world);
  regenerate(world, dt);
  checkPortals(world);
  checkNpc(world);
  decay(world, dt);
  followCamera(world, dt);
}

/* ===========================================================================
 *  시계
 * ======================================================================== */

function tickTimers(world: World, dt: number): void {
  const player = world.player;

  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.potionCooldown = Math.max(0, player.potionCooldown - dt);

  for (const id of Object.keys(player.skillCooldowns)) {
    const left = player.skillCooldowns[id]! - dt;
    if (left <= 0) delete player.skillCooldowns[id];
    else player.skillCooldowns[id] = left;
  }

  player.buffs = player.buffs.filter((buff) => {
    if (buff.until > world.time) return true;
    log(world, `${buff.name} 효과가 끝났습니다`, 'normal');
    return false;
  });

  if (world.toast) {
    world.toast.life -= dt;
    if (world.toast.life <= 0) world.toast = null;
  }
  if (world.enhanceResult) {
    world.enhanceResult.life -= dt;
    if (world.enhanceResult.life <= 0) world.enhanceResult = null;
  }
  world.shake = Math.max(0, world.shake - dt);
}

/* ===========================================================================
 *  자동 사냥
 * ======================================================================== */

function runAuto(world: World): void {
  const player = world.player;
  const stats = derive(player);

  if (player.hp / stats.maxHp < player.autoPotionAt) drinkBestPotion(world, 'hp');
  if (player.mp / stats.maxMp < AUTO.manaPotionAt) drinkBestPotion(world, 'mp');

  const target = currentTarget(world);
  if (!target) {
    // 바닥에 떨어진 게 가까이 있으면 먼저 줍고
    const loot = world.ground.find(
      (item) => Math.hypot(item.pos.x - player.pos.x, item.pos.y - player.pos.y) < 220,
    );
    // 보스는 자동으로 건드리지 않습니다 — 준비 없이 달려들면 그대로 죽습니다
    const next = nearestMonster(world, AUTO.searchRange, true);
    if (next) {
      player.targetId = next.id;
      return;
    }
    if (loot) {
      player.moveTarget = { x: loot.pos.x, y: loot.pos.y };
      return;
    }
    // 근처가 텅 비었으면 사냥터 안쪽으로 걸어갑니다 (제자리에 멈춰 서지 않도록)
    const far = nearestMonster(world, Infinity, true);
    if (far) player.moveTarget = { x: far.pos.x, y: far.pos.y };
    return;
  }
  autoUseSkills(world);
}

/* ===========================================================================
 *  내 이동과 공격
 * ======================================================================== */

function movePlayer(world: World, dt: number): void {
  const player = world.player;
  const stats = derive(player);
  const target = currentTarget(world);

  let destX: number | null = null;
  let destY: number | null = null;
  let stopAt = 4;

  if (target) {
    const def = monsterDef(target.defId);
    destX = target.pos.x;
    destY = target.pos.y;
    // 사거리 안에 들어오면 더 다가가지 않습니다
    stopAt = stats.attackRange + def.size * 0.6 - 6;
  } else if (player.moveTarget) {
    destX = player.moveTarget.x;
    destY = player.moveTarget.y;
  }

  if (destX === null || destY === null) return;

  const dx = destX - player.pos.x;
  const dy = destY - player.pos.y;
  const distance = Math.hypot(dx, dy);

  player.facing = Math.atan2(dy, dx);

  if (distance <= stopAt) {
    if (!target) player.moveTarget = null;
    return;
  }

  const stepLength = Math.min(stats.moveSpeed * dt, distance);
  const beforeX = player.pos.x;
  const beforeY = player.pos.y;

  slideMove(world.map, player.pos, (dx / distance) * stepLength, (dy / distance) * stepLength, PLAYER_RADIUS);

  // 완전히 막혀 한 발도 못 갔다면 목적지를 포기합니다 (벽에 붙어 덜덜 떠는 것을 막습니다)
  if (!target && Math.hypot(player.pos.x - beforeX, player.pos.y - beforeY) < stepLength * 0.2) {
    player.moveTarget = null;
  }
}

function playerAttack(world: World, _dt: number): void {
  const player = world.player;
  const target = currentTarget(world);
  if (!target) return;

  const stats = derive(player);
  const def = monsterDef(target.defId);
  const reach = stats.attackRange + def.size * 0.6;

  if (distanceTo(world, target) > reach) return;
  if (player.attackCooldown > 0) return;

  player.attackCooldown = stats.attackInterval;
  player.facing = Math.atan2(target.pos.y - player.pos.y, target.pos.x - player.pos.x);

  const cls = CLASSES[player.classId];
  if (cls.projectile === 'none') {
    vfx(world, 'slash', player.pos, { to: target.pos, life: 0.16, color: cls.color });
  } else {
    vfx(world, 'projectile', player.pos, {
      to: target.pos,
      life: 0.14,
      color: cls.projectile === 'arrow' ? '#bbf7d0' : '#c4b5fd',
    });
  }
  strikeMonster(world, target, 1);
}

/* ===========================================================================
 *  몬스터
 * ======================================================================== */

function updateMonsters(world: World, dt: number): void {
  const player = world.player;

  for (const monster of world.monsters) {
    if (monster.state === 'dead') {
      tickRespawn(world, monster, dt);
      continue;
    }
    const def = monsterDef(monster.defId);
    monster.hitFlash = Math.max(0, monster.hitFlash - dt);
    monster.attackCooldown = Math.max(0, monster.attackCooldown - dt);
    monster.aoeCooldown = Math.max(0, monster.aoeCooldown - dt);

    const distance = distanceTo(world, monster);

    // 광역기 시전 중에는 그 자리에 멈춰 섭니다
    if (monster.castTimer > 0) {
      monster.castTimer -= dt;
      if (monster.castTimer <= 0) monsterAoeLand(world, monster);
      continue;
    }

    if (def.aggroRange > 0 && distance <= def.aggroRange) {
      monster.aggroUntil = world.time + AI.aggroDuration;
    }

    const homeDistance = Math.hypot(monster.pos.x - monster.home.x, monster.pos.y - monster.home.y);
    if (homeDistance > AI.leashRange) monster.state = 'return';

    const chasing = monster.aggroUntil > world.time && monster.state !== 'return';

    if (monster.state === 'return') {
      const dx = monster.home.x - monster.pos.x;
      const dy = monster.home.y - monster.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        monster.state = 'idle';
        monster.hp = Math.min(def.hp, monster.hp + def.hp * 0.3 * dt);
      } else {
        const stepLength = def.moveSpeed * AI.returnSpeedMul * dt;
        slideMove(world.map, monster.pos, (dx / d) * stepLength, (dy / d) * stepLength, def.size * 0.7);
        // 자리로 돌아가는 동안은 체력을 회복합니다
        monster.hp = Math.min(def.hp, monster.hp + def.hp * 0.25 * dt);
      }
      continue;
    }

    if (chasing) {
      monster.state = distance <= def.attackRange ? 'attack' : 'chase';

      // 광역기 준비
      if (def.aoe && monster.aoeCooldown <= 0 && distance < def.aoe.radius * 1.15) {
        monster.castTimer = def.aoe.castTime;
        monster.aoeCooldown = def.aoe.cooldown;
        vfx(world, 'warn', monster.pos, { life: def.aoe.castTime, color: def.color, radius: def.aoe.radius });
        continue;
      }

      if (distance > def.attackRange * 0.85) {
        const dx = player.pos.x - monster.pos.x;
        const dy = player.pos.y - monster.pos.y;
        const stepLength = def.moveSpeed * dt;
        slideMove(world.map, monster.pos, (dx / distance) * stepLength, (dy / distance) * stepLength, def.size * 0.7);
      } else if (monster.attackCooldown <= 0) {
        monster.attackCooldown = def.attackInterval;
        if (def.ranged) monsterProjectile(world, monster);
        else vfx(world, 'slash', monster.pos, { to: player.pos, life: 0.14, color: def.color });
        monsterStrike(world, monster);
      }
    } else {
      wander(world, monster, dt);
      // 싸움이 끝났으면 체력을 회복합니다 (조금씩 깎아놓고 도망가는 수법을 막습니다)
      if (monster.hp < def.hp) {
        monster.hp = Math.min(def.hp, monster.hp + def.hp * AI.outOfCombatRegen * dt);
      }
    }

    separate(world, monster);
  }
}

/** 할 일 없는 몬스터는 제자리 근처를 서성입니다 */
function wander(world: World, monster: Monster, dt: number): void {
  const def = monsterDef(monster.defId);
  monster.state = 'idle';
  monster.wanderTimer -= dt;

  if (monster.wanderTimer <= 0) {
    monster.wanderTimer = AI.wanderInterval * (0.6 + nextRandom(world));
    monster.wanderTarget = {
      x: monster.home.x + randRange(world, -AI.wanderRange, AI.wanderRange),
      y: monster.home.y + randRange(world, -AI.wanderRange, AI.wanderRange),
    };
  }
  if (!monster.wanderTarget) return;

  const dx = monster.wanderTarget.x - monster.pos.x;
  const dy = monster.wanderTarget.y - monster.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) {
    monster.wanderTarget = null;
    return;
  }
  const stepLength = def.moveSpeed * 0.45 * dt;
  slideMove(world.map, monster.pos, (dx / d) * stepLength, (dy / d) * stepLength, def.size * 0.7);
}

/** 몬스터끼리 완전히 겹쳐 서지 않게 살짝 밀어냅니다 */
function separate(world: World, monster: Monster): void {
  for (const other of world.monsters) {
    if (other === monster || other.state === 'dead') continue;
    const dx = monster.pos.x - other.pos.x;
    const dy = monster.pos.y - other.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > AI.separation || d === 0) continue;

    const push = (AI.separation - d) * 0.5;
    const nx = (dx / d) * push;
    const ny = (dy / d) * push;
    if (!blockedAt(world.map, monster.pos.x + nx, monster.pos.y + ny, 8)) {
      monster.pos.x += nx;
      monster.pos.y += ny;
    }
  }
}

/* ===========================================================================
 *  회복 · 문 · 사람 · 정리
 * ======================================================================== */

function regenerate(world: World, dt: number): void {
  const player = world.player;
  const stats = derive(player);

  const fighting = world.monsters.some(
    (m) => m.state !== 'dead' && m.aggroUntil > world.time - REST_AFTER,
  );
  const multiplier = world.map.def.safe
    ? TOWN_REGEN_MULTIPLIER
    : fighting
      ? 1
      : REST_REGEN_MULTIPLIER;

  player.hp = Math.min(stats.maxHp, player.hp + stats.hpRegen * multiplier * dt);
  player.mp = Math.min(stats.maxMp, player.mp + stats.mpRegen * multiplier * dt);
}

function checkPortals(world: World): void {
  const player = world.player;

  for (const portal of world.map.def.portals) {
    const px = tileCenter(portal.tx);
    const py = tileCenter(portal.ty);
    if (Math.hypot(px - player.pos.x, py - player.pos.y) > TILE * 0.7) continue;

    const under = player.level < portal.recommendLevel - 2;
    enterMap(world, portal.to, portal.toTx, portal.toTy);
    log(world, `${world.map.def.name} 진입`, 'normal');
    toast(world, world.map.def.name, under ? 'bad' : 'good');
    if (under) {
      log(world, `이곳의 권장 레벨은 ${portal.recommendLevel} 입니다. 조심하세요.`, 'bad');
    }
    return;
  }
}

function checkNpc(world: World): void {
  if (!world.pendingNpc) return;
  const player = world.player;

  const npc = world.map.def.npcs.find((n) => n.kind === world.pendingNpc);
  if (!npc) {
    world.pendingNpc = null;
    return;
  }
  const distance = Math.hypot(tileCenter(npc.tx) - player.pos.x, tileCenter(npc.ty) - player.pos.y);
  if (distance > TILE * 1.6) return;

  player.moveTarget = null;
  world.panel =
    npc.kind === 'shop' ? 'shop' : npc.kind === 'enhance' ? 'enhance' : npc.kind === 'teleport' ? 'teleport' : 'quest';
  world.pendingNpc = null;
}

function decay(world: World, dt: number): void {
  for (let i = world.floaters.length - 1; i >= 0; i--) {
    const floater = world.floaters[i]!;
    floater.life -= dt;
    floater.pos.y -= 26 * dt;
    if (floater.life <= 0) world.floaters.splice(i, 1);
  }
  for (let i = world.vfx.length - 1; i >= 0; i--) {
    const effect = world.vfx[i]!;
    effect.life -= dt;
    if (effect.life <= 0) world.vfx.splice(i, 1);
  }
  for (let i = world.ground.length - 1; i >= 0; i--) {
    const item = world.ground[i]!;
    item.life -= dt;
    if (item.life <= 0) world.ground.splice(i, 1);
  }
  if (world.floaters.length > 80) world.floaters.splice(0, world.floaters.length - 80);
}

function followCamera(world: World, dt: number): void {
  const player = world.player;
  const lerp = Math.min(1, dt * 8);
  world.camera.x += (player.pos.x - world.camera.x) * lerp;
  world.camera.y += (player.pos.y - world.camera.y) * lerp;

  if (world.shake > 0) {
    world.camera.x += randRange(world, -1, 1) * VIEW.shakeAmount * world.shake;
    world.camera.y += randRange(world, -1, 1) * VIEW.shakeAmount * world.shake;
  }
}
