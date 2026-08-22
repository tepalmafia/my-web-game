/**
 *  세계가 한 칸 흐릅니다.
 *
 *  화면이 한 장 그려질 때마다 step() 이 한 번 불립니다.
 *      시계 → 내 이동 → 하던 일 → 내 공격 → 몬스터 → 줍기 → 회복 → 문·사람 → 정리
 *
 *  ★ 자동 사냥은 여기 없습니다.
 *    판단하는 두뇌는 tools/autopilot.ts 로 옮겼습니다 — 봇이 밸런스를 재는 데는 그대로 쓰고,
 *    게임 빌드에는 넣지 않습니다. 사람은 직접 누릅니다.
 */

import {
  AI, LOOT, MAX_STEP, PLAYER_RADIUS, REGEN, TILE, VIEW,
} from '../balance';
import { monsterDef } from '../content/monsters';
import { veinDef } from '../content/veins';
import { currentTarget, distanceTo, monsterStrike, swingAtMonster, tickRespawn } from './combat';
import { cancelAction, tickAction } from './action';
import { decayCorpse, die } from './death';
import { checkTitles } from './titles';
import { log, toast, vfx } from './feedback';
import { pickUpNearby } from './loot';
import { nextRandom, randRange } from './rng';
import { derive } from './stats';
import { blockedAt, enterMap, findPath, markOpened, portalId, portalProblem, portalWarning, slideMove, tileCenter } from './world';
import type { Monster, Seconds, World } from '../types';

export function step(world: World, rawDt: number): void {
  const dt = Math.min(rawDt, MAX_STEP);
  const me = world.me;

  world.time += dt;
  me.playSeconds += dt;

  tickTimers(world, dt);

  if (me.dead) {
    me.deadFor += dt;
    decay(world, dt);
    followCamera(world, dt);
    return;
  }

  movePlayer(world, dt);
  tickAction(world, dt);
  playerAttack(world);
  updateMonsters(world, dt);
  updateVeins(world, dt);
  pickUpNearby(world);
  regenerate(world, dt);
  checkPortals(world);
  //  ★ 한 자리에서만 봅니다. 도달은 네 종류(장소·물건·실력·행위)라 어디서
  //    조건이 차는지 미리 알 수 없습니다 — 흩어 두면 어느 하나는 반드시 빠집니다.
  //    다 얻은 뒤에는 첫 줄에서 곧장 돌아옵니다.
  checkTitles(world);
  checkNpc(world);
  decay(world, dt);
  followCamera(world, dt);

  decayCorpse(world);

  if (me.hp <= 0 && !me.dead) die(world);
}

/* ===========================================================================
 *  시계
 * ======================================================================== */

function tickTimers(world: World, dt: number): void {
  const me = world.me;
  me.attackCooldown = Math.max(0, me.attackCooldown - dt);
  me.potionCooldown = Math.max(0, me.potionCooldown - dt);
  world.meSwing = Math.max(0, world.meSwing - dt);

  if (world.toast) {
    world.toast.life -= dt;
    if (world.toast.life <= 0) world.toast = null;
  }
  world.shake = Math.max(0, world.shake - dt);
}

/* ===========================================================================
 *  내 이동
 * ======================================================================== */

function movePlayer(world: World, dt: number): void {
  const me = world.me;
  const stats = derive(me);
  const target = currentTarget(world);

  let destX: number | null = null;
  let destY: number | null = null;
  let stopAt = 4;

  if (target) {
    const def = monsterDef(target.defId);
    destX = target.pos.x;
    destY = target.pos.y;
    stopAt = stats.attackRange + def.size * 0.6 - 6;
  } else if (me.moveTarget) {
    destX = me.moveTarget.x;
    destY = me.moveTarget.y;
  }

  if (destX === null || destY === null) {
    world.path = [];
    world.meMoving = false;
    return;
  }

  world.pathTimer = Math.max(0, world.pathTimer - dt);

  const straight = Math.hypot(destX - me.pos.x, destY - me.pos.y);
  if (straight <= stopAt) {
    if (!target) me.moveTarget = null;
    world.path = [];
    world.meMoving = false;
    me.facing = Math.atan2(destY - me.pos.y, destX - me.pos.x);
    return;
  }

  const end = world.path[world.path.length - 1];
  const stale = !end || Math.hypot(end.x - destX, end.y - destY) > TILE * 1.2;
  if ((stale || world.path.length === 0) && world.pathTimer <= 0) {
    world.pathTimer = 0.35;
    world.path = findPath(world.map, me.pos, { x: destX, y: destY }, PLAYER_RADIUS) ?? [];
  }

  const waypoint = world.path[0] ?? { x: destX, y: destY };
  const dx = waypoint.x - me.pos.x;
  const dy = waypoint.y - me.pos.y;
  const distance = Math.hypot(dx, dy);
  me.facing = Math.atan2(destY - me.pos.y, destX - me.pos.x);

  if (distance < 6) {
    world.path.shift();
    return;
  }

  const stepLength = Math.min(stats.moveSpeed * dt, distance);
  const beforeX = me.pos.x;
  const beforeY = me.pos.y;
  slideMove(world.map, me.pos, (dx / distance) * stepLength, (dy / distance) * stepLength, PLAYER_RADIUS);

  const walked = Math.hypot(me.pos.x - beforeX, me.pos.y - beforeY);

  // 무언가 하는 중에 **실제로 발을 옮기면** 그 일은 끊깁니다.
  // ★ 예전에는 여기가 아니라 함수 맨 위에 있었습니다. 그래서 노리는 몬스터가
  //   하나라도 있으면 — 그 옆에 가만히 붙어 서 있어도, 길이 막혀 한 발도 못
  //   떼고 있어도 — 매 프레임 취소가 걸려서 채광·제작·수리를 **아예 시작할 수
  //   없었습니다.** 목적지에 이미 닿았거나 벽에 막혀 못 움직이면 끊지 않습니다.
  if (walked > 0 && me.action) cancelAction(world, '하던 일을 멈췄습니다');

  world.meAnim += walked * 0.055;
  world.meMoving = walked > stepLength * 0.25;

  if (walked < stepLength * 0.2) {
    world.path = [];
    world.pathTimer = 0;
  }
}

/* ===========================================================================
 *  내 공격 — 대상을 고르면 사거리 안에서 알아서 계속 때립니다
 * ======================================================================== */

function playerAttack(world: World): void {
  const me = world.me;
  const target = currentTarget(world);
  if (!target || me.action) return;

  const stats = derive(me);
  const def = monsterDef(target.defId);
  if (distanceTo(world, target) > stats.attackRange + def.size * 0.6) return;
  if (me.attackCooldown > 0) return;

  me.attackCooldown = stats.swing;
  world.meSwing = 0.28;
  me.facing = Math.atan2(target.pos.y - me.pos.y, target.pos.x - me.pos.x);
  vfx(world, 'slash', me.pos, { to: target.pos, life: 0.16, color: '#d8d2c4' });
  swingAtMonster(world, target);
}

/* ===========================================================================
 *  몬스터 — 길을 찾아 따라옵니다 (지형이 무적 방패가 되지 않도록)
 * ======================================================================== */

function updateMonsters(world: World, dt: number): void {
  const me = world.me;

  for (const monster of world.monsters) {
    if (monster.state === 'dead') {
      tickRespawn(monster, dt);
      continue;
    }
    const def = monsterDef(monster.defId);
    monster.hitFlash = Math.max(0, monster.hitFlash - dt);
    monster.attackCooldown = Math.max(0, monster.attackCooldown - dt);
    monster.swing = Math.max(0, monster.swing - dt);
    monster.pathTimer = Math.max(0, monster.pathTimer - dt);
    monster.moving = false;

    const distance = distanceTo(world, monster);
    if (def.aggroRange > 0 && distance <= def.aggroRange && !me.dead) {
      monster.aggroUntil = world.time + AI.aggroDuration;
    }

    const homeDistance = Math.hypot(monster.pos.x - monster.home.x, monster.pos.y - monster.home.y);
    if (homeDistance > AI.leashRange) monster.state = 'return';

    if (monster.state === 'return') {
      returnHome(world, monster, dt);
      continue;
    }

    if (monster.aggroUntil > world.time && !me.dead) {
      monster.state = distance <= def.attackRange ? 'attack' : 'chase';
      monster.facing = Math.atan2(me.pos.y - monster.pos.y, me.pos.x - monster.pos.x);

      if (distance > def.attackRange * 0.85) {
        chasePlayer(world, monster, dt);
      } else if (monster.attackCooldown <= 0) {
        monster.attackCooldown = def.attackInterval;
        monster.swing = 0.3;
        vfx(world, 'slash', monster.pos, { to: me.pos, life: 0.14, color: def.color });
        monsterStrike(world, monster);
        if (me.action) cancelAction(world, '공격을 받아 하던 일이 끊겼습니다');
      }
    } else {
      wander(world, monster, dt);
      if (monster.hp < def.hp) {
        monster.hp = Math.min(def.hp, monster.hp + def.hp * AI.outOfCombatRegen * dt);
      }
    }

    separate(world, monster);
  }
}

/**
 * 쫓아오기 — 플레이어와 같은 길찾기를 씁니다.
 * 이게 없으면 바위 뒤에 서 있는 것만으로 안전해져서, 오픈월드에 위험이 사라집니다.
 */
function chasePlayer(world: World, monster: Monster, dt: number): void {
  const def = monsterDef(monster.defId);
  const me = world.me;
  const radius = def.size * 0.7;

  const straight = Math.hypot(me.pos.x - monster.pos.x, me.pos.y - monster.pos.y);
  const end = monster.path[monster.path.length - 1];
  const stale = !end || Math.hypot(end.x - me.pos.x, end.y - me.pos.y) > TILE * 1.5;

  if ((stale || monster.path.length === 0) && monster.pathTimer <= 0) {
    monster.pathTimer = AI.repathSeconds;
    monster.path = findPath(world.map, monster.pos, me.pos, radius) ?? [];
  }

  const waypoint = monster.path[0] ?? me.pos;
  const dx = waypoint.x - monster.pos.x;
  const dy = waypoint.y - monster.pos.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (distance < 8 && monster.path.length > 0) {
    monster.path.shift();
    return;
  }

  const stepLength = def.moveSpeed * dt;
  moveMonster(world, monster, (dx / distance) * stepLength, (dy / distance) * stepLength);
  void straight;
}

function returnHome(world: World, monster: Monster, dt: number): void {
  const def = monsterDef(monster.defId);
  const dx = monster.home.x - monster.pos.x;
  const dy = monster.home.y - monster.pos.y;
  const d = Math.hypot(dx, dy);

  if (d < 8) {
    monster.state = 'idle';
    monster.path = [];
    monster.hp = Math.min(def.hp, monster.hp + def.hp * 0.3 * dt);
    return;
  }
  monster.facing = Math.atan2(dy, dx);
  const stepLength = def.moveSpeed * AI.returnSpeedMul * dt;
  moveMonster(world, monster, (dx / d) * stepLength, (dy / d) * stepLength);
  monster.hp = Math.min(def.hp, monster.hp + def.hp * 0.25 * dt);
}

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
  monster.facing = Math.atan2(dy, dx);
  const stepLength = def.moveSpeed * 0.45 * dt;
  moveMonster(world, monster, (dx / d) * stepLength, (dy / d) * stepLength);
}

function moveMonster(world: World, monster: Monster, dx: number, dy: number): void {
  const def = monsterDef(monster.defId);
  const beforeX = monster.pos.x;
  const beforeY = monster.pos.y;
  slideMove(world.map, monster.pos, dx, dy, def.size * 0.7);

  const walked = Math.hypot(monster.pos.x - beforeX, monster.pos.y - beforeY);
  monster.anim += walked * 0.06;
  monster.moving = walked > 0.05;
  if (walked < 0.05) monster.path = [];
}

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
 *  광맥 회복
 * ======================================================================== */

function updateVeins(world: World, dt: number): void {
  for (const vein of world.veins) {
    if (vein.remaining > 0) continue;
    vein.respawnIn -= dt;
    if (vein.respawnIn <= 0) vein.remaining = veinDef(vein.defId).capacity;
  }
}

/* ===========================================================================
 *  회복 · 문 · 사람 · 정리
 * ======================================================================== */

function regenerate(world: World, dt: number): void {
  const me = world.me;
  // 쓰러진 사람은 저절로 일어나지 않습니다
  if (me.hp <= 0) return;
  const stats = derive(me);

  const fighting = world.monsters.some(
    (m) => m.state !== 'dead' && m.aggroUntil > world.time - REGEN.restAfter,
  );
  const multiplier = world.map.def.safe ? REGEN.town : fighting ? 1 : REGEN.resting;
  me.hp = Math.min(stats.maxHp, me.hp + stats.regen * multiplier * dt);
}

/**
 *  닫힌 문 앞에서 방금 말을 걸었는가.
 *
 *  ★ 문 앞에 서 있으면 매 프레임 판정이 돌아갑니다. 그대로 두면 같은 말이
 *    초당 예순 번 뜹니다. 세계마다 따로 세되 저장에는 넣지 않습니다 —
 *    "굳게 닫혀 있다" 는 사실은 기록할 것이 아니라 그때그때 알려줄 것입니다.
 */
const knockedAt = new WeakMap<World, { tx: number; ty: number; at: Seconds }>();
const KNOCK_AGAIN = 6;

function checkPortals(world: World): void {
  const me = world.me;
  //  ★ 문에서 멀어지면 물음을 거둡니다. 발밑에 없는 문의 확인 단추가
  //    화면에 남아 있으면 무엇에 답하는 것인지 알 수 없습니다.
  if (world.pendingPortal) {
    const p = world.pendingPortal;
    const away = Math.hypot(tileCenter(p.tx) - me.pos.x, tileCenter(p.ty) - me.pos.y) > TILE * 1.1;
    if (away || !world.map.def.portals.includes(p)) world.pendingPortal = null;
  }
  for (const portal of world.map.def.portals) {
    const px = tileCenter(portal.tx);
    const py = tileCenter(portal.ty);
    if (Math.hypot(px - me.pos.x, py - me.pos.y) > TILE * 0.7) continue;

    //  ★ 조건이 걸린 문은 여기서 막힙니다. 조용히 막지 않고,
    //    무엇이 얼마나 모자란지 숫자로 말합니다 (전체설계 4.3 · 6장).
    const problem = portalProblem(world, portal);
    if (problem) {
      const last = knockedAt.get(world);
      const same = last && last.tx === portal.tx && last.ty === portal.ty;
      if (!same || world.time - last!.at > KNOCK_AGAIN) {
        knockedAt.set(world, { tx: portal.tx, ty: portal.ty, at: world.time });
        toast(world, problem, 'bad');
        log(world, `${portal.label} — ${problem}`, 'bad');
      }
      continue;
    }

    //  ★ 되돌아갈 수 없는 문은 **여기서 절대 안 들어갑니다.** 묻기만 합니다.
    //    들어가는 것은 사람이 commands.enterPending() 을 부를 때뿐입니다.
    const warning = portalWarning(world, portal);
    if (warning) {
      if (world.pendingPortal !== portal) {
        world.pendingPortal = portal;
        toast(world, warning, 'bad');
        log(world, `${portal.label} — ${warning}`, 'bad');
      }
      return;
    }

    //  ★ 한 번 연 문은 다시 안 닫힙니다 (목적지-기획안 3.2).
    //    enterMap 이 world.mapId 를 바꾸므로 그 전에 적어야 합니다.
    const first = portal.needs !== undefined && !world.me.opened.includes(portalId(world.mapId, portal));
    markOpened(world, portal);

    enterMap(world, portal.to, portal.toTx, portal.toTy);
    log(world, `${world.map.def.name} 진입`, 'normal');
    toast(world, world.map.def.name, 'good');
    if (first) {
      log(world, `${portal.label} 이 열렸습니다. 이 길은 다시 닫히지 않습니다`, 'epic');
    }
    return;
  }
}

function checkNpc(world: World): void {
  if (!world.pendingNpc) return;
  const me = world.me;

  const npc = world.map.def.npcs.find((n) => n.kind === world.pendingNpc);
  if (!npc) {
    world.pendingNpc = null;
    return;
  }
  const distance = Math.hypot(tileCenter(npc.tx) - me.pos.x, tileCenter(npc.ty) - me.pos.y);
  if (distance > TILE * 1.6) return;

  me.moveTarget = null;
  world.panel = npc.kind === 'shop' ? 'shop' : 'craft';
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
    // ★ 시각으로 봅니다. until 이 null 이면 안 사라지는 것입니다 (안전지대에 놓아둔 것)
    if (item.until !== null && world.time >= item.until) world.ground.splice(i, 1);
  }
  if (world.floaters.length > 80) world.floaters.splice(0, world.floaters.length - 80);
  void LOOT;
}

function followCamera(world: World, dt: number): void {
  const me = world.me;
  const lerp = Math.min(1, dt * 8);
  world.camera.x += (me.pos.x - world.camera.x) * lerp;
  world.camera.y += (me.pos.y - world.camera.y) * lerp;

  if (world.shake > 0) {
    world.camera.x += randRange(world, -1, 1) * VIEW.shakeAmount * world.shake;
    world.camera.y += randRange(world, -1, 1) * VIEW.shakeAmount * world.shake;
  }
}
