/**
 * ===========================================================================
 *  봇의 두뇌 (게임 빌드에는 들어가지 않습니다)
 * ===========================================================================
 *
 *  ★ 예전 `core/engine.ts` 의 runAuto() 가 여기로 옮겨 왔습니다.
 *
 *  사람에게서는 자동 사냥을 걷어냈지만, 봇은 남겨야 합니다.
 *  몇 시간 치를 몇 초에 돌려보는 이 장치가 밸런스를 재는 유일한 수단이기 때문입니다.
 *  ("만렙 2시간 33분" 같은 실측치는 전부 여기서 나왔습니다.)
 *
 *  두뇌는 core/commands.ts 의 함수만 부릅니다 — 사람이 누를 수 있는 것만 누릅니다.
 */

import { GATHER } from '../src/rpg/balance';
import { itemDef } from '../src/rpg/content/items';
import { MAP_ORDER, mapDef } from '../src/rpg/content/maps';
import { monsterDef } from '../src/rpg/content/monsters';
import { RECIPE_ORDER, recipeDef } from '../src/rpg/content/recipes';
import { veinDef } from '../src/rpg/content/veins';
import { craftChance, nearForge, startCraft, startMining, startRepair } from '../src/rpg/core/action';
import { gainChance } from '../src/rpg/balance';
import { drinkBestPotion, respawnInTown } from '../src/rpg/core/commands';
import { repairQuote } from '../src/rpg/core/durability';
import { buyItem, countOf, equip, sellItem } from '../src/rpg/core/inventory';
import { derive, wearRatio } from '../src/rpg/core/stats';
import { tileCenter } from '../src/rpg/core/world';
import type { ItemStack, MapId, World } from '../src/rpg/types';

export type Goal = 'gather' | 'haul' | 'work' | 'hunt';

/** 수리에 쓸 쇠가 이만큼도 없으면 사냥이 아니라 광산으로 갑니다 */
const INGOT_RESERVE = 4;

/**
 * 무엇에 무게를 둘 것인가.
 *  · 'balanced' — 캐고 만들고 싸우는 한 바퀴를 그대로 돕니다 (기본)
 *  · 'mine'     — 곡괭이질 곡선을 재기 위해, 싸움은 피할 수 없을 때만 합니다
 *  · 'fight'    — 검술·방어 곡선을 재기 위해, 쇠가 떨어지지 않을 만큼만 캡니다
 */
export type Focus = 'balanced' | 'mine' | 'fight';

export interface Pilot {
  goal: Goal;
  focus: Focus;
  /** 사냥하러 갈 때 목표로 삼는 지역 */
  hunting: MapId;
  /** 지금 지역을 옮겨 걷는 중인가 — 걷는 중에는 싸움을 피합니다 */
  traveling: boolean;
  /** 이 시각까지는 마을로 돌아가지 않습니다 (마을에서 막 나왔을 때) */
  outUntil: number;
  /** 길을 못 찾은 적 — 비어 있어야 정상입니다 (조용히 넘어가지 않으려고 남깁니다) */
  stranded: string[];
}

export function newPilot(focus: Focus = 'balanced'): Pilot {
  return { goal: 'gather', focus, hunting: 'forest', traveling: false, outUntil: 0, stranded: [] };
}

/* --------------------------------------------------------------- 길 안내 */

/**
 *  다음에 넘어갈 지역 한 칸.
 *
 *  ★ 예전에는 ['town','forest','mine'] 한 줄을 박아두고 앞뒤로만 갔습니다.
 *    마을에서 나가는 길이 셋이 되자 그 가정이 무너집니다 —
 *    광산 직통이 있어도 숲으로 돌아가고, 그 줄에 없는 강은 아예 못 찾습니다.
 *    이제 문이 만든 그래프를 그대로 너비 우선으로 훑습니다.
 *    지역이 몇 개든, 어떤 모양이든, 문만 이어져 있으면 길을 찾습니다.
 */
export function nextHop(from: MapId, to: MapId): MapId | null {
  if (from === to) return null;

  const cameFrom = new Map<MapId, MapId>();
  const seen = new Set<MapId>([from]);
  const queue: MapId[] = [from];

  while (queue.length > 0) {
    const here = queue.shift()!;
    for (const portal of mapDef(here).portals) {
      if (seen.has(portal.to)) continue;
      seen.add(portal.to);
      cameFrom.set(portal.to, here);

      if (portal.to === to) {
        // 목적지에서 거슬러 올라가, 지금 지역 바로 다음 칸을 집어냅니다
        let step: MapId = to;
        while (cameFrom.get(step) !== from) {
          const back = cameFrom.get(step);
          if (back === undefined) return null;
          step = back;
        }
        return step;
      }
      queue.push(portal.to);
    }
  }
  return null;
}

/** 목표 지역 쪽 문으로 걸어갑니다. 도착했으면 true */
function travel(world: World, to: MapId, pilot: Pilot): boolean {
  if (world.mapId === to) return true;

  const hop = nextHop(world.mapId, to);
  const portal = hop === null ? undefined : world.map.def.portals.find((p) => p.to === hop);

  if (hop === null || !portal) {
    // ★ 예전에는 여기서 그냥 true("도착했다")를 돌려줬습니다.
    //   봇은 엉뚱한 지역에 선 채로 캐기 시작하고, 실측은 아무 일 없다는 듯 숫자를 냈습니다.
    //   길이 없으면 없다고 적어둡니다 — sim 이 이 값을 함께 찍습니다.
    pilot.stranded.push(`${world.mapId} → ${to}`);
    pilot.traveling = false;
    return true;
  }

  pilot.traveling = true;
  world.me.targetId = null;
  world.me.moveTarget = { x: tileCenter(portal.tx), y: tileCenter(portal.ty) };
  return false;
}

/* --------------------------------------------------------------- 판단 */

export function autopilot(world: World, pilot: Pilot): void {
  const me = world.me;

  if (me.dead) {
    respawnInTown(world);
    pilot.goal = 'work';
    return;
  }

  const stats = derive(me);
  if (me.hp / stats.maxHp < 0.5) drinkBestPotion(world);

  // ★ 이길 수 없는 싸움에서는 빠집니다. 죽으면 골드를 잃고, 무엇보다
  //   지고 온 광석을 들고 마을까지 다시 걸어야 합니다.
  if (me.hp / stats.maxHp < 0.35 && pilot.goal !== 'work') {
    pilot.goal = 'haul';
    me.targetId = null;
  }

  // ★ 맨손으로 돌아다니지 않습니다. 검이 부러지면 그 자리에서 여벌을 쥡니다.
  //   (맨손 공격 1~4 로 늑대를 잡느라 한 시간의 82%를 싸움에 쓴 적이 있습니다)
  if (!me.equipped.weapon && !me.action) equipBest(world);

  // 무기가 부러졌거나 짐이 찼으면 무엇을 하던 중이든 마을로.
  //   ★ 단, 마을에서 막 나왔다면 잠시는 밖에 있습니다.
  //     마을이 고쳐주지 못하는 이유로 돌아가면 그 자리에서 영원히 맴돕니다 —
  //     이 안전장치를 넣기 전까지 그 고장을 네 번 서로 다른 이유로 만났습니다.
  if (pilot.goal !== 'haul' && pilot.goal !== 'work' && world.time >= pilot.outUntil && needsTown(world)) {
    pilot.goal = 'haul';
    me.targetId = null;
    return;
  }

  // ★ 얻어맞으면서 캘 수는 없습니다.
  //   달라붙은 것이 있으면 무엇을 하던 중이든 먼저 처리합니다.
  //   (이걸 빠뜨렸더니 봇이 한 시간 내내 들개에게 맞으며 곡괭이질만 취소당했습니다)
  //   ★ 다만 짐을 지고 마을로 걸어가는 중에는 뒤도 안 돌아보고 걷습니다.
  //     쫓아오던 것들은 제자리에서 멀어지면 알아서 포기합니다.
  //     (돌아설 때마다 싸웠더니 마을까지 95초가 걸렸습니다)
  // 마을로 돌아가는 길에는 뒤도 안 돌아봅니다 (쫓아오던 것은 제자리에서 멀어지면 포기합니다)
  const fleeing = pilot.goal === 'haul' || pilot.traveling;
  pilot.traveling = false;
  if (!fleeing && defendSelf(world)) return;

  switch (pilot.goal) {
    case 'gather':
      doGather(world, pilot);
      break;
    case 'haul':
      if (travel(world, 'town', pilot)) pilot.goal = 'work';
      break;
    case 'work':
      doWork(world, pilot);
      break;
    case 'hunt':
      doHunt(world, pilot);
      break;
  }
}

/**
 * 지금 마을에 가야 하는가.
 *
 * ★ "마을이 지금 고쳐줄 수 있는 것"만 여기서 true 가 되어야 합니다.
 *   예전에는 '검이 닳았다'만 보고 마을로 보냈는데, 돈도 주괴도 없으면
 *   마을에서 할 수 있는 일이 없어서 work → gather → haul → work 를
 *   한 시간 내내 맴돌았습니다. (봇이 마을에서 85%를 보낸 원인)
 */
function needsTown(world: World): boolean {
  const me = world.me;
  const stats = derive(me);

  // 짐이 찼다 — 녹이거나 팔면 가벼워집니다. 마을은 언제나 답이 됩니다.
  if (stats.load > stats.carry * 0.88) return true;
  // 곡괭이가 없다 — 살 수 있을 때만 마을이 답입니다.
  //   ★ 살 돈이 없는데도 마을로 보내면, 벌러 나가려다 말고 되돌아오기를 반복합니다.
  if (!hasPickaxe(me) && liquidGold(world) >= itemDef('pickaxe').price) return true;
  // 무기가 없거나 다 닳았다 — 고치거나, 만들거나, 살 수 있을 때만
  if (weaponSpent(world) && canFixWeapon(world)) return true;
  return false;
}

/**
 * 가방에 든 '쓸 만한' 여벌 무기.
 * ★ '부러지지만 않았으면 여벌'로 쳤더니, 5% 남은 검 한 자루를 여벌이라 여겨
 *   새 검을 사지 않고 마을에서 무한히 맴돌았습니다.
 */
function usableSpare(me: World['me']): ItemStack | null {
  return (
    me.backpack
      .filter((s) => itemDef(s.defId).slot === 'weapon' && (wearRatio(s) ?? 0) >= WEAPON_TIRED)
      .sort((a, b) => stackScore(b) - stackScore(a))[0] ?? null
  );
}

/** 지금 든 것보다 나은 여벌 무기 */
function betterSpare(world: World): ItemStack | null {
  const me = world.me;
  const worn = me.equipped.weapon;
  const spare = usableSpare(me);
  if (!spare) return null;
  if (worn && stackScore(worn) >= stackScore(spare)) return null;
  return spare;
}

function hasPickaxe(me: World['me']): boolean {
  return me.backpack.some((s) => itemDef(s.defId).tool === 'pickaxe' && (s.durability ?? 0) > 0);
}

/**
 * 무기를 손봐야 하는가.
 * ★ 0.15(부러지기 직전)가 아니라 0.35 입니다.
 *   수리는 0.4 아래에서만 되므로, 그 전에 돌아와야 '고쳐 쓰는' 순환이 돕니다.
 *   부러질 때까지 휘두르면 맨손으로 마을까지 걸어오게 됩니다.
 */
const WEAPON_TIRED = 0.35;

function weaponSpent(world: World): boolean {
  const weapon = world.me.equipped.weapon;
  return !weapon || (wearRatio(weapon) ?? 1) < WEAPON_TIRED;
}

/** 마을에서 무기를 되살릴 방법이 있는가 (고치기 · 만들기 · 사기) */
function canFixWeapon(world: World): boolean {
  const me = world.me;

  const weapon = me.equipped.weapon;
  if (weapon) {
    const quote = repairQuote(weapon);
    if (!quote.problem && countOf(me, quote.ingotId) >= quote.ingots) return true;
  }
  // 가방에 지금 것보다 나은 무기가 굴러다니는가
  //   ★ '성한 여벌이 있다'만 보면 안 됩니다. 34% 남은 철검을 든 채로
  //     100% 녹슨 검을 여벌이라 여기면, 마을에 돌아가도 바꿔 들 이유가 없어서
  //     '고칠 수 있다 → 마을 → 할 일 없음 → 고칠 수 있다' 를 무한히 돕니다.
  if (betterSpare(world)) return true;
  // 새로 만들 수 있는가
  if (buildableWeapon(world)) return true;
  // 그냥 살 수 있는가
  return me.gold + sellableGold(world) >= itemDef('rusty-sword').price;
}

/** 지금 만들 수 있는 무기 제작법 (가장 좋은 것) */
function buildableWeapon(world: World): string | null {
  const me = world.me;
  const list = RECIPE_ORDER.filter((id) => {
    const recipe = recipeDef(id);
    if (itemDef(recipe.makes).slot !== 'weapon') return false;
    if (craftChance(world, id) < 0.25) return false;
    return recipe.needs.every((n) => countOf(me, n.defId) >= n.count);
  }).sort((a, b) => recipeDef(b).difficulty - recipeDef(a).difficulty);
  return list[0] ?? null;
}

/** 지금 마을에서 만들 수 있는 최대 금액 (가진 돈 + 팔 수 있는 것 전부) */
function liquidGold(world: World): number {
  const me = world.me;
  const stock = ['iron-ingot', 'copper-ingot', 'iron-ore', 'copper-ore'].reduce(
    (sum, id) => sum + countOf(me, id) * itemDef(id).sell,
    0,
  );
  return me.gold + sellableGold(world) + stock;
}

/** 팔아치울 수 있는 잡동사니의 값어치 */
function sellableGold(world: World): number {
  return junkStacks(world).reduce((sum, s) => sum + itemDef(s.defId).sell * s.count, 0);
}

/**
 * 팔 것 — 쓰지 않는 무기·갑옷과, 쟁여둔 주괴 일부.
 * ★ 광석은 팔지 않습니다. 광석을 팔아 돈을 버는 순간 대장간에 갈 이유가 사라집니다.
 */
function junkStacks(world: World) {
  const me = world.me;
  // 무기는 쓸 만한 여벌 한 자루만 남깁니다 (그 한 자루가 맨손을 막습니다)
  const keep = usableSpare(me);
  const wornScore = (slot: 'weapon' | 'armor' | 'helmet') => {
    const worn = me.equipped[slot];
    return worn ? stackScore(worn) : -1;
  };
  return me.backpack.filter((s) => {
    const def = itemDef(s.defId);
    if (!def.slot) return false;
    if (keep && s.uid === keep.uid) return false;
    if ((s.durability ?? 1) <= 0) return true;
    // 입은 것과 값이 같으면(=여벌) 팝니다. 만든 단검을 열두 자루씩 지고 다니지 않도록.
    return stackScore(s) <= wornScore(def.slot as 'weapon' | 'armor' | 'helmet');
  });
}

function gearScore(defId: string): number {
  const def = itemDef(defId);
  return (def.minDamage ?? 0) + (def.maxDamage ?? 0) + (def.defense ?? 0) * 2;
}

/**
 * 닳은 정도까지 넣은 값.
 * ★ 이걸 빼먹었더니 14% 남은 녹슨 검과 새 녹슨 검의 값이 같아서,
 *   봇이 검을 사고 → 안 갈아입고 → 되팔기를 반복하며 돈을 다 태웠습니다.
 */
function stackScore(stack: ItemStack): number {
  const ratio = wearRatio(stack) ?? 1;
  return gearScore(stack.defId) * (0.3 + 0.7 * ratio);
}

/** 달라붙은 적이 있으면 그것부터 잡습니다. 잡는 중이면 true */
function defendSelf(world: World): boolean {
  const me = world.me;

  // ★ 맨손으로는 싸우지 않습니다. 맞으면서라도 걸어서 벗어납니다.
  //   (맨손 공격 1~4 로 늑대와 붙었더니 한 시간의 88%가 그 싸움이었습니다)
  if (!me.equipped.weapon && me.hp / derive(me).maxHp > 0.3) {
    me.targetId = null;
    return false;
  }

  const current = world.monsters.find((m) => m.id === me.targetId && m.state !== 'dead');
  if (current) {
    const distance = Math.hypot(current.pos.x - me.pos.x, current.pos.y - me.pos.y);
    if (distance < 200) return true; // 이미 붙어 싸우는 중
  }

  const attacker = world.monsters.find((m) => {
    if (m.state === 'dead' || m.aggroUntil <= world.time) return false;
    return Math.hypot(m.pos.x - me.pos.x, m.pos.y - me.pos.y) < 100;
  });
  if (!attacker) return false;

  me.targetId = attacker.id;
  me.moveTarget = null;
  return true;
}

/* --------------------------------------------------------------- 캐기 */

function doGather(world: World, pilot: Pilot): void {
  const me = world.me;
  const stats = derive(me);

  // 짐이 차면 마을로 (이미 마을이라면 마을 일부터 — 안 그러면 제자리를 맴돕니다)
  if (stats.load > stats.carry * 0.88) {
    pilot.goal = world.mapId === 'town' ? 'work' : 'haul';
    return;
  }
  // 곡괭이가 없으면 사러 갑니다
  if (!me.backpack.some((s) => itemDef(s.defId).tool === 'pickaxe' && (s.durability ?? 0) > 0)) {
    pilot.goal = 'haul';
    return;
  }

  // 여기서 더 배울 것이 없으면 더 깊은 곳으로 내려갑니다
  const deeper = betterMineMap(world);
  if (deeper) {
    travel(world, deeper, pilot);
    return;
  }

  const target = mineTarget(world);
  if (!target) {
    // 이 지역에는 캘 것이 없습니다 — 더 깊은 곳으로
    if (world.mapId !== 'mine') {
      travel(world, 'mine', pilot);
      return;
    }
    pilot.goal = 'hunt';
    return;
  }

  if (me.action) return; // 이미 캐는 중

  const distance = Math.hypot(target.pos.x - me.pos.x, target.pos.y - me.pos.y);
  if (distance > GATHER.reach) {
    me.targetId = null;
    me.moveTarget = { x: target.pos.x, y: target.pos.y + 18 };
    return;
  }
  startMining(world, target.id, true);
}

/** 이 지역의 광맥 중 지금 가장 많이 배울 수 있는 확률 */
function bestVeinChance(mapId: MapId, skill: number): number {
  const list = mapDef(mapId).veins.map((v) => gainChance(skill, veinDef(v.veinId).difficulty));
  return list.length > 0 ? Math.max(...list) : 0;
}

/**
 * 지금 실력에 맞는 광맥이 있는 지역.
 * ★ '캘 수 있는가'가 아니라 '배울 수 있는가'로 고릅니다.
 *   철광맥(난이도 20)은 채광 40 이 넘어도 캐지기는 하지만 더는 늘지 않습니다.
 *   그때가 깊은 곳으로 내려갈 때입니다.
 */
function betterMineMap(world: World): MapId | null {
  // 깊은 광맥은 사나운 것들 옆에 있습니다. 검이 성할 때만 내려갑니다.
  if (weaponSpent(world)) return null;
  const skill = world.me.skills.mining;
  const here = bestVeinChance(world.mapId, skill);
  let best: MapId | null = null;
  let bestChance = here * 1.6; // 늑대밭을 가로지를 값어치가 있을 만큼 확실히 나을 때만
  // ★ 지역 목록을 여기서 다시 적지 않습니다. 지역을 늘리면 저절로 후보가 됩니다.
  for (const mapId of MAP_ORDER) {
    const chance = bestVeinChance(mapId, skill);
    if (chance > bestChance) {
      best = mapId;
      bestChance = chance;
    }
  }
  return best;
}

/** 이 지역에서 캘 광맥 — 가장 많이 배울 수 있는 것들 중 가장 가까운 것 */
function mineTarget(world: World) {
  const me = world.me;
  const alive = world.veins.filter((v) => v.remaining > 0);
  if (alive.length === 0) return null;

  const chanceOf = (defId: string) => gainChance(me.skills.mining, veinDef(defId).difficulty);
  const best = Math.max(...alive.map((v) => chanceOf(v.defId)));
  const pool = best > 0 ? alive.filter((v) => chanceOf(v.defId) >= best * 0.8) : alive;

  let picked = null;
  let bestDistance = Infinity;
  for (const vein of pool) {
    const distance = Math.hypot(vein.pos.x - me.pos.x, vein.pos.y - me.pos.y);
    if (distance < bestDistance) {
      picked = vein;
      bestDistance = distance;
    }
  }
  return picked;
}

/* --------------------------------------------------------------- 마을 일 */

function doWork(world: World, pilot: Pilot): void {
  const me = world.me;

  if (world.mapId !== 'town') {
    travel(world, 'town', pilot);
    return;
  }

  // 화로 앞으로
  const forge = mapDef('town').forge!;
  if (!nearForge(world)) {
    me.moveTarget = { x: tileCenter(forge.tx), y: tileCenter(forge.ty) + 24 };
    return;
  }
  if (me.action) return;

  // 1) 광석을 전부 녹인다 (짐이 가벼워지는 것이 절반의 목적입니다)
  if (countOf(me, 'copper-ore') >= 2 && startCraft(world, 'smelt-copper', false)) return;
  if (countOf(me, 'iron-ore') >= 2 && startCraft(world, 'smelt-iron', false)) return;

  // 2) 닳은 장비를 고친다 (고칠 수 있을 때까지만)
  for (const worn of [me.equipped.weapon, me.equipped.armor, me.equipped.helmet]) {
    if (!worn) continue;
    const ratio = wearRatio(worn);
    if (ratio === null || ratio > 0.4) continue;
    const quote = repairQuote(worn);
    if (quote.problem || countOf(me, quote.ingotId) < quote.ingots) continue;
    if (startRepair(world, worn.uid)) return;
  }

  // 3) 손에 쥘 것이 없으면 그것부터 — 만들고, 없으면 사고
  if (weaponSpent(world)) {
    const recipe = buildableWeapon(world);
    if (recipe && startCraft(world, recipe, false)) return;
    equipBest(world);
    if (weaponSpent(world) && !betterSpare(world)) {
      raiseGold(world, itemDef('rusty-sword').price);
      if (me.gold >= itemDef('rusty-sword').price) buyItem(world, 'rusty-sword', 1);
      equipBest(world);
    }
  }

  // 4) 다음 목표 물건을 만든다.
  //    ★ '지금 만들 수 있는 것 중 가장 어려운 것'을 만들면 안 됩니다.
  //      그러면 주괴 3개가 모일 때마다 단검을 찍어내느라 철검(6개)에 영영 닿지 못합니다.
  //      쇠는 모아두고, 목표 물건이 나올 만큼 모이면 그때 두드립니다.
  const target = targetRecipe(world);
  if (target) {
    if (affordable(world, target) && worthMaking(world, target)) {
      if (startCraft(world, target, false)) return;
    } else {
      // 목표를 만들고도 남을 만큼 쇠가 넉넉하면, 남는 것으로 손을 푼다
      const spare = lesserRecipe(world, target);
      if (spare && startCraft(world, spare, false)) return;
    }
  }

  // 5) 더 좋은 장비를 입고, 밀려난 것은 판다
  equipBest(world);
  for (const junk of junkStacks(world)) sellItem(world, junk.uid, junk.count);

  // 6) 물약과 연장을 채운다
  if (!hasPickaxe(me)) {
    raiseGold(world, itemDef('pickaxe').price, true);
    buyItem(world, 'pickaxe', 1);
  }
  if (!me.backpack.some((s) => itemDef(s.defId).tool === 'hammer' && (s.durability ?? 0) > 0)) {
    // 망치가 없으면 광석은 그냥 무거운 돌입니다 — 팔아서라도 삽니다
    raiseGold(world, itemDef('hammer').price, true);
    buyItem(world, 'hammer', 1);
  }
  if (countOf(me, 'potion-heal') < 5 && me.gold > 400) buyItem(world, 'potion-heal', 5);
  // 여벌 검 한 자루 — 밖에서 부러졌을 때 맨손이 되지 않도록.
  //   ★ 맨손이 되는 순간 이 봇은 아무것도 못 합니다. 검값보다 훨씬 비싼 사고입니다.
  if (!usableSpare(me) && me.gold > itemDef('rusty-sword').price * 2) {
    buyItem(world, 'rusty-sword', 1);
  }

  // 6-b) 그래도 짐이 무거우면 덜어냅니다.
  //    ★ 마을에서 짐을 못 덜면 '무거워서 마을로' → '마을에서 할 일 없음' →
  //      '무거워서 마을로' 를 영원히 반복합니다. 나가려면 가벼워져야 합니다.
  shedLoad(world);

  // 7) 할 일이 끝났으면 나간다.
  //    ★ 마을에서 더 할 수 있는 것이 없는데도 눌러앉지 않도록,
  //      여기서는 needsTown() 을 다시 보지 않고 무조건 밖으로 내보냅니다.
  //    ★ 쇠가 떨어졌으면 사냥보다 채광이 먼저입니다 —
  //      쇠가 없으면 다음 검도, 수리도, 대장기술도 없습니다.
  //      (이 줄이 없을 때 봇은 녹슨 검만 사서 쓰고 버리며 한 시간을 보냈습니다)
  const weapon = me.equipped.weapon;
  const healthy = !weaponSpent(world);
  const stocked = countOf(me, 'iron-ingot') >= INGOT_RESERVE && hasPickaxe(me);
  // ★ 만들려던 물건에 쇠가 모자라면 사냥이 아니라 광산입니다.
  //   (이 줄이 없으면 봇은 주괴 4개만 쥐면 사냥을 나가버려서,
  //    철검 한 자루에 필요한 10개가 영영 모이지 않았습니다)
  const saving = target !== null && !affordable(world, target);
  // 곡괭이를 살 돈조차 없으면 캘 수가 없습니다 — 나가서 벌어옵니다
  if (!hasPickaxe(me)) {
    pilot.goal = 'hunt';
    pilot.hunting = 'forest';
    pilot.outUntil = world.time + 60;
    return;
  }
  pilot.outUntil = world.time + 20;
  const wantsFight =
    pilot.focus === 'fight'
      ? stocked || countOf(me, 'iron-ore') > 0
      : pilot.focus === 'mine'
        ? false
        : healthy && stocked && !saving && me.skills.swordsmanship < 90;
  pilot.goal = wantsFight && healthy ? 'hunt' : 'gather';
  // ★ 광산은 마을에서 두 칸입니다. 좋은 검을 들었을 때만 갑니다.
  //   (녹슨 검으로 광산에 보냈더니 돌아오는 데만 3분씩 걸렸습니다)
  const armed = weapon && itemDef(weapon.defId).id !== 'rusty-sword';
  pilot.hunting = armed && me.skills.swordsmanship > 50 ? 'mine' : 'forest';
}

/* --------------------------------------------------------------- 무엇을 만들까 */

/** 지금 실력으로 두드려볼 만한 것 중 가장 좋은 것 — 여기에 쇠를 모읍니다 */
function targetRecipe(world: World): string | null {
  const me = world.me;
  const list = RECIPE_ORDER.filter((id) => {
    const recipe = recipeDef(id);
    if (recipe.id.startsWith('smelt')) return false;
    if (gainChance(me.skills.blacksmithing, recipe.difficulty) <= 0) return false;
    // ★ 사람은 확률이 낮아도 재료가 있으면 두드려 봅니다. 실패로 잃는 쇠가
    //   그 자체로 값입니다. 이 문턱을 높게 잡았더니 '대장기술 1점'이
    //   첫 철검 시각을 13분에서 26분으로 흔들 만큼 지표가 예민해졌습니다.
    return craftChance(world, id) >= 0.18;
  }).sort((a, b) => recipeDef(b).difficulty - recipeDef(a).difficulty);
  return list[0] ?? null;
}

function affordable(world: World, recipeId: string): boolean {
  return recipeDef(recipeId).needs.every((n) => countOf(world.me, n.defId) >= n.count);
}

/**
 * 이미 같은 것을 성하게 들고 있다면, 쇠가 곱절로 남을 때만 또 만듭니다.
 * ★ 이게 없으면 주괴 6개가 모일 때마다 철검을 새로 찍어내고 쓰던 검을 팔아버립니다.
 *   그러면 '고쳐 쓰다 결국 못 쓰게 된다'는 순환이 아예 돌지 않습니다.
 */
function worthMaking(world: World, recipeId: string): boolean {
  const me = world.me;
  const recipe = recipeDef(recipeId);
  const slot = itemDef(recipe.makes).slot;
  if (!slot) return true;

  const worn = me.equipped[slot];
  const sameAndHealthy = worn && worn.defId === recipe.makes && (wearRatio(worn) ?? 0) > 0.5;
  if (!sameAndHealthy) return true;

  // 남는 쇠로 손을 푸는 것은 좋습니다 — 다만 쓰던 검을 밀어낼 만큼은 아닙니다
  return recipe.needs.every((n) => countOf(me, n.defId) >= n.count * 2);
}

/** 목표 물건 몫을 남기고도 만들 수 있는 더 쉬운 것 */
function lesserRecipe(world: World, target: string): string | null {
  const me = world.me;
  const need = new Map(recipeDef(target).needs.map((n) => [n.defId, n.count]));
  const list = RECIPE_ORDER.filter((id) => {
    const recipe = recipeDef(id);
    if (recipe.id.startsWith('smelt') || id === target) return false;
    if (gainChance(me.skills.blacksmithing, recipe.difficulty) <= 0) return false;
    if (craftChance(world, id) < 0.25) return false;
    return recipe.needs.every((n) => countOf(me, n.defId) >= n.count + (need.get(n.defId) ?? 0));
  }).sort((a, b) => recipeDef(b).difficulty - recipeDef(a).difficulty);
  return list[0] ?? null;
}

/** 짐이 상한에 닿아 있으면 처치 곤란한 것부터 팔아 덜어냅니다 */
function shedLoad(world: World): void {
  const me = world.me;
  for (const id of ['iron-ore', 'copper-ore', 'iron-ingot', 'copper-ingot']) {
    while (derive(me).load > derive(me).carry * 0.8 && countOf(me, id) > 0) {
      const stack = me.backpack.find((s) => s.defId === id);
      if (!stack) break;
      sellItem(world, stack.uid, 1);
    }
  }
}

/**
 * 잡동사니를 팔아 목표 금액을 만듭니다.
 * desperate 를 주면 쟁여둔 쇠와 광석까지 팝니다 —
 * ★ 곡괭이를 못 사는 순간 이 캐릭터는 아무것도 할 수 없게 되므로,
 *   그때만은 모아둔 것을 헐어서라도 연장을 삽니다.
 *   (곡괭이값 3골드가 모자라 마을에서 한 시간을 맴돈 적이 있습니다)
 */
function raiseGold(world: World, target: number, desperate = false): void {
  const me = world.me;
  for (const junk of junkStacks(world)) {
    if (me.gold >= target) return;
    sellItem(world, junk.uid, junk.count);
  }

  const floor = desperate ? 0 : 3;
  const goods = desperate
    ? ['iron-ingot', 'copper-ingot', 'iron-ore', 'copper-ore']
    : ['iron-ingot', 'copper-ingot'];
  for (const id of goods) {
    while (me.gold < target && countOf(me, id) > floor) {
      const stack = me.backpack.find((s) => s.defId === id);
      if (!stack) break;
      sellItem(world, stack.uid, 1);
    }
  }
}

/** 가진 것 중 가장 좋은 무기와 갑옷을 입습니다 (닳은 정도까지 봅니다) */
function equipBest(world: World): void {
  const me = world.me;

  for (const slot of ['weapon', 'armor', 'helmet'] as const) {
    const candidates = me.backpack
      .filter((s) => itemDef(s.defId).slot === slot && (s.durability ?? 1) > 0)
      .sort((a, b) => stackScore(b) - stackScore(a));

    const best = candidates[0];
    if (!best) continue;
    const worn = me.equipped[slot];
    if (worn && stackScore(worn) >= stackScore(best)) continue;

    // 너무 무거워 발이 묶이면 입지 않습니다
    const stats = derive(me);
    if (stats.load + itemDef(best.defId).weight > stats.carry) continue;
    equip(world, best.uid);
  }
}

/* --------------------------------------------------------------- 사냥 */

function doHunt(world: World, pilot: Pilot): void {
  const me = world.me;
  const stats = derive(me);

  // 검이 지치면 부러지기 전에 돌아갑니다 — 고쳐 쓸 수 있을 때 돌아가야 순환이 돕니다
  const noPotion = countOf(me, 'potion-heal') === 0 && me.hp / stats.maxHp < 0.4;
  if (weaponSpent(world) || noPotion || stats.load > stats.carry * 0.9) {
    pilot.goal = 'haul';
    return;
  }
  if (world.mapId !== pilot.hunting) {
    travel(world, pilot.hunting, pilot);
    return;
  }

  // 이미 노리는 것이 있으면 그대로 둡니다 (엔진이 알아서 때립니다)
  const current = world.monsters.find((m) => m.id === me.targetId && m.state !== 'dead');
  if (current) return;

  // 배울 것이 있으면서, 감당할 수 있는 상대를 고릅니다.
  //   ★ 위쪽 한계가 없던 동안 봇은 검술 30 으로 동굴 거미(65)에게 달려들어
  //     세 시간에 백 번씩 죽었습니다.
  const candidates = world.monsters.filter((m) => {
    if (m.state === 'dead') return false;
    const difficulty = monsterDef(m.defId).difficulty;
    if (difficulty > me.skills.swordsmanship + 20) return false;
    return gainChance(me.skills.swordsmanship, difficulty) > 0;
  });
  const pick =
    candidates.sort(
      (a, b) =>
        Math.hypot(a.pos.x - me.pos.x, a.pos.y - me.pos.y) -
        Math.hypot(b.pos.x - me.pos.x, b.pos.y - me.pos.y),
    )[0] ?? null;

  if (pick) me.targetId = pick.id;
  else pilot.goal = 'gather';
}
