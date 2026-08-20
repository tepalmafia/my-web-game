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
import { nextStage, stageReady } from '../content/town';
import { veinDef } from '../content/veins';
import { cancelAction, startCraft, startMining, startRepair } from './action';
import { revive } from './death';
import { floater, log, toast } from './feedback';
import { findStack, removeItem } from './inventory';
import { pickUpAt, placeItem } from './loot';
import { advanceTown } from './town';
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

/**
 *  물약을 못 마시는 다섯 가지 이유.
 *
 *  ★ 전부 조용히 false 만 돌려주고 있었습니다. Q 를 눌렀는데 아무 일도 안 일어나면
 *    "물약이 없나? 아직인가? 이미 다 찼나?" 를 알 길이 없습니다.
 *
 *  ★ 알리는 방식이 이유마다 다릅니다. 싸우는 중에 Q 를 연타하는 상황이 기준입니다.
 *      none      토스트 — 죽기 직전인데 물약이 없다는 건 크게 알려야 합니다
 *      cooldown  머리 위 작은 글자 — 0.55초 뒤면 풀립니다. 크게 띄우면 시끄럽습니다
 *      full      머리 위 작은 글자 — "안 마셔도 된다"는 좋은 소식입니다
 *      dead·not-potion   기록 한 줄 — 급하지 않습니다
 */
type PotionProblem = 'dead' | 'cooldown' | 'full' | 'none' | 'not-potion';

/**
 *  같은 이유를 연달아 알리지 않기 위한 간격 (초).
 *  ★ core/loot.ts 가 못 주운 전리품에 쓰는 것과 같은 방식입니다 — 세계를 키로 잡아
 *    저장되지 않고, 새로 시작하거나 불러오면 저절로 처음부터입니다.
 */
const POTION_TELL_INTERVAL = 3;

const potionToldAt = new WeakMap<World, Map<PotionProblem, number>>();

function tellPotionProblem(world: World, problem: PotionProblem): void {
  let seen = potionToldAt.get(world);
  if (!seen) {
    seen = new Map();
    potionToldAt.set(world, seen);
  }
  const last = seen.get(problem);
  if (last !== undefined && world.time - last < POTION_TELL_INTERVAL) return;
  seen.set(problem, world.time);

  const me = world.me;
  const overhead = { x: me.pos.x, y: me.pos.y - 22 };

  switch (problem) {
    case 'none':
      toast(world, '물약이 없습니다', 'bad');
      log(world, '물약이 없습니다', 'bad');
      break;
    case 'cooldown':
      floater(world, overhead, `아직 ${me.potionCooldown.toFixed(1)}초`, 'miss');
      break;
    case 'full':
      floater(world, overhead, '체력이 가득', 'info');
      break;
    case 'dead':
      log(world, '쓰러진 채로는 마실 수 없습니다', 'bad');
      break;
    case 'not-potion':
      log(world, '마실 수 있는 것이 아닙니다', 'bad');
      break;
  }
}

export function drinkPotion(world: World, uid: number): boolean {
  const me = world.me;
  if (me.dead) {
    tellPotionProblem(world, 'dead');
    return false;
  }
  if (me.potionCooldown > 0) {
    tellPotionProblem(world, 'cooldown');
    return false;
  }

  const stack = findStack(me, uid);
  if (!stack) {
    tellPotionProblem(world, 'not-potion');
    return false;
  }
  const def = itemDef(stack.defId);
  if (!def.healHp) {
    tellPotionProblem(world, 'not-potion');
    return false;
  }

  const stats = derive(me);
  if (me.hp >= stats.maxHp) {
    tellPotionProblem(world, 'full');
    return false;
  }

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
  if (me.dead) {
    tellPotionProblem(world, 'dead');
    return false;
  }
  if (me.potionCooldown > 0) {
    tellPotionProblem(world, 'cooldown');
    return false;
  }

  const stats = derive(me);
  const missing = stats.maxHp - me.hp;
  if (missing <= 0) {
    tellPotionProblem(world, 'full');
    return false;
  }

  const best = me.backpack
    .filter((s) => itemDef(s.defId).healHp)
    .sort(
      (a, b) =>
        Math.abs((itemDef(a.defId).healHp ?? 0) - missing) -
        Math.abs((itemDef(b.defId).healHp ?? 0) - missing),
    )[0];

  if (!best) {
    tellPotionProblem(world, 'none');
    return false;
  }
  return drinkPotion(world, best.uid);
}

/* ===========================================================================
 *  마을이 자란다
 * ======================================================================== */

/**
 *  갈림길을 고릅니다. ★ 되돌릴 수 없습니다.
 *
 *  화면은 규칙을 모릅니다 — 조건을 채웠는지, 고를 수 있는 갈래가 맞는지,
 *  이미 고른 단계가 아닌지를 전부 여기서 봅니다.
 */
export function chooseTownPath(world: World, choiceId: string): boolean {
  const town = world.me.town;
  const stage = nextStage(town);

  if (!stage) {
    toast(world, '더 자랄 것이 없습니다.', 'bad');
    return false;
  }
  if (!stageReady(town)) {
    toast(world, '아직 두린이 부르지 않았습니다.', 'bad');
    return false;
  }
  //  ★ 갈림길이 없는 단계는 판매가 끝나는 자리에서 저절로 오릅니다(core/town.ts).
  //    화면이 여기로 올 일이 없지만, 와도 조용히 실패하지는 않습니다.
  if (!stage.choices) {
    log(world, `${stage.name} — 여기서는 고를 것이 없습니다`, 'bad');
    return false;
  }
  if (!stage.choices.some((c) => c.id === choiceId)) {
    log(world, '지금 고를 수 있는 것이 아닙니다', 'bad');
    return false;
  }

  advanceTown(world, choiceId);
  return true;
}

/* ===========================================================================
 *  기타
 * ======================================================================== */

/** 가방에서 꺼내 발밑에 놓습니다 */
export function dropItem(world: World, uid: number, count = 1): boolean {
  return placeItem(world, uid, count);
}

/** 바닥에 놓인 것을 눌러서 가져옵니다 */
export function takeGround(world: World, x: number, y: number): boolean {
  return pickUpAt(world, x, y);
}

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
