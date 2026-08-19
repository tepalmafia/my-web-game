/**
 *  플레이어가 시키는 일.
 *
 *  화면은 규칙을 모릅니다. 버튼을 누르면 여기 있는 함수를 부르기만 하고,
 *  "지금 할 수 있는가 / 무엇이 필요한가 / 왜 안 되는가"의 판단은 전부 여기서 합니다.
 *
 *  ★ 자동 사냥 명령은 없습니다. 남은 것은 넷뿐입니다 —
 *    걷기 · 대상을 눌러 계속 때리기 · 채집 반복 · 물약.
 */

import { GATHER, POTION_COOLDOWN, TILE } from '../balance';
import { itemDef } from '../content/items';
import { monsterDef } from '../content/monsters';
import { veinDef } from '../content/veins';
import { cancelAction, startCraft, startMining, startRepair } from './action';
import { revive } from './death';
import { floater, log, toast } from './feedback';
import { findStack, removeItem } from './inventory';
import { derive } from './stats';
import { tileCenter } from './world';
import type { EquipSlot, World } from '../types';

/* ===========================================================================
 *  걷기와 대상
 * ======================================================================== */

export function moveTo(world: World, x: number, y: number): void {
  if (world.me.dead) return;
  world.me.moveTarget = { x, y };
}

/**
 * 화면을 눌렀을 때.
 * 몬스터 → 노린다 · 광맥 → 캔다 · 사람 → 말을 건다 · 빈 땅 → 걸어간다
 */
export function clickWorld(world: World, x: number, y: number): void {
  const me = world.me;
  if (me.dead) return;

  // 1) 몬스터 — 누른 자리에서 가장 가까운 것
  let picked: number | null = null;
  let monsterAt = Infinity;
  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    const def = monsterDef(monster.defId);
    const distance = Math.hypot(monster.pos.x - x, monster.pos.y - y);
    if (distance <= def.size + 12 && distance < monsterAt) {
      picked = monster.id;
      monsterAt = distance;
    }
  }

  // 2) 광맥 — 마찬가지로 가장 가까운 것
  let veinId: number | null = null;
  let veinAt = Infinity;
  for (const vein of world.veins) {
    const distance = Math.hypot(vein.pos.x - x, vein.pos.y - y);
    if (distance <= TILE * 0.7 && distance < veinAt) {
      veinId = vein.id;
      veinAt = distance;
    }
  }

  // ★ 둘 다 후보에 들면 **누른 자리에서 더 가까운 쪽**입니다.
  //   예전에는 몬스터를 무조건 먼저 봐서, 광맥 한가운데를 정확히 눌러도
  //   25px 옆에 선 늑대가 대상이 됐습니다. 광맥을 누를 방법이 없었습니다.
  //   같은 거리면 몬스터가 이깁니다 — 광맥 앞을 막고 선 것도 때릴 수 있어야 하니까.
  if (picked !== null && monsterAt <= veinAt) {
    cancelAction(world);
    me.targetId = picked;
    me.moveTarget = null;
    world.pendingNpc = null;
    return;
  }
  if (veinId !== null) {
    me.targetId = null;
    world.pendingNpc = null;
    mineVein(world, veinId);
    return;
  }

  // 3) 사람
  for (const npc of world.map.def.npcs) {
    const npcX = tileCenter(npc.tx);
    const npcY = tileCenter(npc.ty);
    if (Math.hypot(npcX - x, npcY - y) <= TILE * 0.8) {
      world.pendingNpc = npc.kind;
      me.moveTarget = { x: npcX, y: npcY + TILE * 0.8 };
      me.targetId = null;
      return;
    }
  }

  // 4) 빈 땅
  cancelAction(world);
  me.targetId = null;
  world.pendingNpc = null;
  me.moveTarget = { x, y };
}

/**
 * 광맥을 캡니다. 멀면 먼저 걸어갑니다.
 * 도착한 뒤 다시 부르는 일은 화면 쪽(GameScreen)이 맡습니다.
 */
export function mineVein(world: World, veinId: number): void {
  const started = startMining(world, veinId, true);
  if (!started) {
    const vein = world.veins.find((v) => v.id === veinId);
    if (vein && Math.hypot(vein.pos.x - world.me.pos.x, vein.pos.y - world.me.pos.y) > GATHER.reach) {
      log(world, `${veinDef(vein.defId).name}(으)로 갑니다`, 'normal');
    }
  }
}

export function stopAction(world: World): void {
  cancelAction(world, '하던 일을 멈췄습니다');
  world.me.targetId = null;
}

/* ===========================================================================
 *  물약
 * ======================================================================== */

export function drinkPotion(world: World, uid: number): boolean {
  const me = world.me;
  if (me.dead || me.potionCooldown > 0) return false;

  const stack = findStack(me, uid);
  if (!stack) return false;
  const def = itemDef(stack.defId);
  if (!def.healHp) return false;

  const stats = derive(me);
  if (me.hp >= stats.maxHp) return false;

  const healed = Math.min(def.healHp, stats.maxHp - me.hp);
  me.hp += healed;
  floater(world, { x: me.pos.x, y: me.pos.y - 22 }, `+${healed}`, 'heal', 'heal');
  removeItem(me, uid, 1);
  me.potionCooldown = POTION_COOLDOWN;
  return true;
}

/** 가진 물약 중 가장 덜 남기는 것을 마십니다 (Q 단축키) */
export function drinkBestPotion(world: World): boolean {
  const me = world.me;
  if (me.potionCooldown > 0) return false;

  const stats = derive(me);
  const missing = stats.maxHp - me.hp;
  if (missing <= 0) return false;

  const best = me.backpack
    .filter((s) => itemDef(s.defId).healHp)
    .sort(
      (a, b) =>
        Math.abs((itemDef(a.defId).healHp ?? 0) - missing) -
        Math.abs((itemDef(b.defId).healHp ?? 0) - missing),
    )[0];

  if (!best) return false;
  return drinkPotion(world, best.uid);
}

/* ===========================================================================
 *  기타
 * ======================================================================== */

export function useItem(world: World, uid: number): boolean {
  const stack = findStack(world.me, uid);
  if (!stack) return false;
  if (itemDef(stack.defId).healHp) return drinkPotion(world, uid);
  return false;
}

export function craft(world: World, recipeId: string, repeat = false): void {
  startCraft(world, recipeId, repeat);
}

export function repair(world: World, uid: number): void {
  startRepair(world, uid);
}

export function respawnInTown(world: World): void {
  revive(world);
}

export function closePanel(world: World): void {
  world.panel = null;
}

export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: '무기',
  armor: '갑옷',
  helmet: '투구',
};

/** 가진 물약 개수 (화면 표시용) */
export function potionCount(world: World): number {
  return world.me.backpack
    .filter((s) => itemDef(s.defId).healHp)
    .reduce((total, s) => total + s.count, 0);
}

export function warnIfHeavy(world: World): void {
  const stats = derive(world.me);
  if (stats.load > stats.carry * 0.9) toast(world, '짐이 무겁습니다', 'bad');
}
