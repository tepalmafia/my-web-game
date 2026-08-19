/**
 *  플레이어가 시키는 일.
 *
 *  화면(ui/)은 규칙을 모릅니다. 버튼을 누르면 여기 있는 함수를 부르기만 하고,
 *  "지금 쓸 수 있는가 / 얼마인가 / 왜 안 되는가"의 판단은 전부 이 파일에서 합니다.
 */

import { AUTO, POTION_COOLDOWN, TELEPORT_COST_PER_LEVEL, TILE } from '../balance';
import { itemDef } from '../content/items';
import { MAP_LEVEL, mapDef } from '../content/maps';
import { monsterDef } from '../content/monsters';
import { skillsOf } from '../content/skills';
import { currentTarget, distanceTo, strikeArea, strikeMonster } from './combat';
import { floater, log, toast, vfx } from './feedback';
import { clampVitals, findStack, removeItem } from './inventory';
import { restoreExp, revive } from './progression';
import { derive } from './stats';
import { enterMap, tileCenter } from './world';
import type { EquipSlot, MapId, SkillDef, World } from '../types';

/* ===========================================================================
 *  이동과 목표
 * ======================================================================== */

export function moveTo(world: World, x: number, y: number): void {
  if (world.player.dead) return;
  world.player.moveTarget = { x, y };
}

export function setTarget(world: World, id: number | null): void {
  world.player.targetId = id;
}

/**
 * 화면을 눌렀을 때.
 * 몬스터를 눌렀으면 그 몬스터를 노리고, NPC 를 눌렀으면 말을 걸러 걸어가고,
 * 아무것도 없는 곳이면 그냥 그리로 걸어갑니다.
 */
export function clickWorld(world: World, x: number, y: number): void {
  const player = world.player;
  if (player.dead) return;

  // 1) 몬스터
  let picked: number | null = null;
  let bestDistance = Infinity;
  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    const def = monsterDef(monster.defId);
    const distance = Math.hypot(monster.pos.x - x, monster.pos.y - y);
    if (distance <= def.size + 12 && distance < bestDistance) {
      picked = monster.id;
      bestDistance = distance;
    }
  }
  if (picked !== null) {
    player.targetId = picked;
    player.moveTarget = null;
    world.pendingNpc = null;
    return;
  }

  // 2) NPC
  for (const npc of world.map.def.npcs) {
    const npcX = tileCenter(npc.tx);
    const npcY = tileCenter(npc.ty);
    if (Math.hypot(npcX - x, npcY - y) <= TILE * 0.8) {
      world.pendingNpc = npc.kind;
      player.moveTarget = { x: npcX, y: npcY + TILE * 0.8 };
      player.targetId = null;
      return;
    }
  }

  // 3) 빈 땅
  player.targetId = null;
  world.pendingNpc = null;
  player.moveTarget = { x, y };
}

/* ===========================================================================
 *  스킬
 * ======================================================================== */

/** 지금 이 스킬을 쓸 수 있는가. 못 쓴다면 이유 */
export function skillProblem(world: World, skill: SkillDef): string | null {
  const player = world.player;
  if (player.level < skill.reqLevel) return `레벨 ${skill.reqLevel} 필요`;
  if ((player.skillCooldowns[skill.id] ?? 0) > 0) return '재사용 대기 중';
  if (player.mp < skill.mpCost) return '마나 부족';
  if (skill.kind === 'strike' || skill.kind === 'multi') {
    const target = currentTarget(world);
    if (!target) return '대상 없음';
    const stats = derive(player);
    if (distanceTo(world, target) > (skill.range ?? stats.attackRange) + 24) return '너무 멉니다';
  }
  return null;
}

/** 스킬 사용 (0, 1, 2 번째 스킬) */
export function useSkill(world: World, index: number): boolean {
  const player = world.player;
  if (player.dead) return false;

  const skill = skillsOf(player.classId)[index];
  if (!skill) return false;

  const problem = skillProblem(world, skill);
  if (problem) {
    toast(world, `${skill.name} — ${problem}`, 'bad');
    return false;
  }

  player.mp -= skill.mpCost;
  player.skillCooldowns[skill.id] = skill.cooldown;
  const stats = derive(player);

  switch (skill.kind) {
    case 'strike': {
      const target = currentTarget(world);
      if (!target) return false;
      faceToward(world, target.pos.x, target.pos.y);
      vfx(world, 'projectile', player.pos, { to: target.pos, life: 0.16, color: skill.color });
      strikeMonster(world, target, skill.power, skill.color);
      break;
    }
    case 'multi': {
      const target = currentTarget(world);
      if (!target) return false;
      faceToward(world, target.pos.x, target.pos.y);
      for (let i = 0; i < (skill.hits ?? 2); i++) {
        vfx(world, 'projectile', player.pos, { to: target.pos, life: 0.16 + i * 0.06, color: skill.color });
        strikeMonster(world, target, skill.power, skill.color);
        if (target.state === 'dead') break;
      }
      break;
    }
    case 'aoe': {
      strikeArea(world, skill.radius ?? 120, skill.power, skill.color);
      break;
    }
    case 'heal': {
      const healed = Math.round(stats.maxHp * (skill.healRatio ?? 0.4));
      player.hp = Math.min(stats.maxHp, player.hp + healed);
      floater(world, { x: player.pos.x, y: player.pos.y - 22 }, `+${healed}`, 'heal');
      vfx(world, 'ring', player.pos, { life: 0.6, color: skill.color, radius: 34 });
      break;
    }
    case 'buff': {
      player.buffs = player.buffs.filter((b) => b.id !== skill.id);
      player.buffs.push({
        id: skill.id,
        name: skill.name,
        until: world.time + (skill.duration ?? 10),
        color: skill.color,
        effects: skill.buff ?? {},
      });
      vfx(world, 'ring', player.pos, { life: 0.7, color: skill.color, radius: 40 });
      log(world, `${skill.name} 발동`, 'good');
      break;
    }
  }
  return true;
}

function faceToward(world: World, x: number, y: number): void {
  world.player.facing = Math.atan2(y - world.player.pos.y, x - world.player.pos.x);
}

/* ===========================================================================
 *  아이템 사용
 * ======================================================================== */

/** 가방의 물건 하나를 씁니다 (물약·주문서) */
export function useItem(world: World, uid: number): boolean {
  const player = world.player;
  const stack = findStack(player, uid);
  if (!stack) return false;
  const def = itemDef(stack.defId);

  if (def.kind === 'potion') return drinkPotion(world, uid);

  if (def.scroll === 'return') {
    if (world.mapId === 'town') {
      toast(world, '이미 마을에 있습니다.', 'bad');
      return false;
    }
    removeItem(player, uid, 1);
    const town = mapDef('town');
    enterMap(world, 'town', town.entryTx, town.entryTy);
    log(world, '귀환 주문서를 찢었습니다 — 마을', 'normal');
    return true;
  }

  if (def.scroll === 'resurrect') {
    if (player.lostExp <= 0) {
      toast(world, '되찾을 경험치가 없습니다.', 'bad');
      return false;
    }
    removeItem(player, uid, 1);
    restoreExp(world);
    return true;
  }

  if (def.scroll === 'enhance' || def.scroll === 'blessedEnhance') {
    world.panel = 'enhance';
    toast(world, '대장간 창에서 강화할 장비를 고르세요.', 'good');
    return false;
  }

  return false;
}

/** 물약 한 병 */
export function drinkPotion(world: World, uid: number): boolean {
  const player = world.player;
  if (player.dead) return false;
  if (player.potionCooldown > 0) return false;

  const stack = findStack(player, uid);
  if (!stack) return false;
  const def = itemDef(stack.defId);
  if (def.kind !== 'potion') return false;

  const stats = derive(player);
  let used = false;

  if (def.healHp && player.hp < stats.maxHp) {
    const healed = Math.min(def.healHp, stats.maxHp - player.hp);
    player.hp += healed;
    floater(world, { x: player.pos.x, y: player.pos.y - 22 }, `+${healed}`, 'heal');
    used = true;
  }
  if (def.healMp && player.mp < stats.maxMp) {
    const healed = Math.min(def.healMp, stats.maxMp - player.mp);
    player.mp += healed;
    floater(world, { x: player.pos.x + 14, y: player.pos.y - 22 }, `+${healed}`, 'info');
    used = true;
  }
  if (!used) return false;

  removeItem(player, uid, 1);
  player.potionCooldown = POTION_COOLDOWN;
  return true;
}

/** 가진 것 중 가장 알맞은 체력 물약을 마십니다 (남는 회복이 적은 것부터) */
export function drinkBestPotion(world: World, kind: 'hp' | 'mp'): boolean {
  const player = world.player;
  if (player.potionCooldown > 0) return false;

  const stats = derive(player);
  const missing = kind === 'hp' ? stats.maxHp - player.hp : stats.maxMp - player.mp;
  if (missing <= 0) return false;

  const candidates = player.inventory
    .filter((s) => {
      const def = itemDef(s.defId);
      return def.kind === 'potion' && (kind === 'hp' ? def.healHp : def.healMp);
    })
    .sort((a, b) => {
      const heal = (defId: string) => {
        const def = itemDef(defId);
        return (kind === 'hp' ? def.healHp : def.healMp) ?? 0;
      };
      const wasteA = Math.abs(heal(a.defId) - missing);
      const wasteB = Math.abs(heal(b.defId) - missing);
      return wasteA - wasteB;
    });

  const best = candidates[0];
  if (!best) return false;
  return drinkPotion(world, best.uid);
}

/* ===========================================================================
 *  기타
 * ======================================================================== */

export function toggleAuto(world: World): void {
  const player = world.player;
  player.auto = !player.auto;
  log(world, player.auto ? '자동 사냥을 켰습니다' : '자동 사냥을 껐습니다', 'normal');
  if (!player.auto) {
    player.moveTarget = null;
  }
}

export function setAutoPotionAt(world: World, ratio: number): void {
  world.player.autoPotionAt = Math.max(0, Math.min(0.95, ratio));
}

/** 마법사 리엔의 순간이동 요금 */
export function teleportCost(world: World, mapId: MapId): number {
  if (mapId === world.mapId) return 0;
  return MAP_LEVEL[mapId]! * TELEPORT_COST_PER_LEVEL;
}

export function teleportTo(world: World, mapId: MapId): void {
  const player = world.player;
  if (!player.discovered.includes(mapId)) {
    toast(world, '아직 가본 적 없는 곳입니다. 한 번은 걸어가야 합니다.', 'bad');
    return;
  }
  const cost = teleportCost(world, mapId);
  if (player.gold < cost) {
    toast(world, '골드가 부족합니다.', 'bad');
    return;
  }
  player.gold -= cost;
  const def = mapDef(mapId);
  enterMap(world, mapId, def.entryTx, def.entryTy);
  world.panel = null;
  log(world, `${def.name}(으)로 이동했습니다`, 'normal');
}

export function respawnInTown(world: World): void {
  revive(world);
  clampVitals(world);
}

/** 자동 사냥이 스킬을 쓸지 판단합니다 */
export function autoUseSkills(world: World): void {
  const player = world.player;
  const stats = derive(player);
  const skills = skillsOf(player.classId);

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i]!;
    if (player.level < skill.reqLevel) continue;
    if ((player.skillCooldowns[skill.id] ?? 0) > 0) continue;

    // 회복 스킬은 정말 필요할 때만
    if (skill.kind === 'heal') {
      if (player.hp / stats.maxHp < 0.55 && player.mp >= skill.mpCost) useSkill(world, i);
      continue;
    }
    // 나머지는 마나에 여유가 있을 때만 (마나가 마르면 평타도 못 버팁니다)
    if (player.mp - skill.mpCost < stats.maxMp * AUTO.skillManaReserve) continue;
    if (skillProblem(world, skill)) continue;
    useSkill(world, i);
    return;
  }
}

/** 장비 칸 이름 (화면에서 씁니다) */
export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: '무기',
  armor: '갑옷',
  helmet: '투구',
  ring: '반지',
};
