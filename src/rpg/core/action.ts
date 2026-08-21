/**
 * ===========================================================================
 *  시간이 걸리는 일 — 캐기 · 만들기 · 고치기
 * ===========================================================================
 *
 *  이 게임의 한 바퀴가 전부 이 파일에서 돕니다.
 *
 *      광맥을 캔다 → 무거워진다 → 마을로 돌아온다 → 녹인다 → 만든다
 *      → 들고 나가 싸운다 → 닳는다 → 고치거나 다시 만든다 → 광석이 또 필요하다
 *
 *  세 가지 모두 "한 번 시도 = 한 번 성장 판정"입니다. 실패해도 배웁니다.
 *  다만 지금 실력보다 한참 쉬운 일에서는 아무것도 배우지 못합니다(core/skillgain.ts).
 */

import { CRAFT, DURABILITY, GATHER } from '../balance';
import { itemDef } from '../content/items';
import { recipeDef } from '../content/recipes';
import { temperDef } from '../content/tempers';
import { openRecipes } from '../content/town';
import { veinDef } from '../content/veins';
import { floater, log, toast } from './feedback';
import { addItem, consume, countOf } from './inventory';
import { chance, randInt } from './rng';
import { hasTool, repairQuote, toolOf, useTool } from './durability';
import { trySkillGain } from './skillgain';
import { itemName, toolTemperMul } from './stats';
import type { Quality, Vein, World } from '../types';
import type { TemperId } from '../balance';

/* ===========================================================================
 *  성공 확률
 * ======================================================================== */

/**
 *  ★ 연장의 벼림이 여기 걸립니다 (toolMul). 상·하한 **전에** 곱합니다 —
 *    나중에 곱하면 0.95 를 넘겨버려 상한이 상한이 아니게 됩니다.
 */
function successChance(
  skill: number,
  difficulty: number,
  table: typeof GATHER | typeof CRAFT,
  toolMul = 1,
): number {
  const raw = (table.baseSuccess + (skill - difficulty) * table.successPerPoint) * toolMul;
  return Math.max(table.minSuccess, Math.min(table.maxSuccess, raw));
}

/** 실력이 난이도보다 한참 높으면 우수품이 나오기 시작합니다 */
function fineChance(skill: number, difficulty: number): number {
  const margin = skill - difficulty - CRAFT.fineFrom;
  if (margin <= 0) return 0;
  return Math.min(CRAFT.fineMax, (margin / 50) * CRAFT.fineMax);
}

/**
 *  이 제작법의 지금 성공 확률 (화면에 보여주기 위해).
 *  ★ 든 망치의 벼림까지 셉니다. 화면과 실제가 다르면 그것이 조용한 실패입니다.
 */
export function craftChance(world: World, recipeId: string): number {
  const recipe = recipeDef(recipeId);
  const mul = toolTemperMul(toolOf(world.me, 'hammer'));
  return successChance(world.me.skills.blacksmithing, recipe.difficulty, CRAFT, mul);
}

/** 우수품이 나올 확률 */
export function craftFineChance(world: World, recipeId: string): number {
  return fineChance(world.me.skills.blacksmithing, recipeDef(recipeId).difficulty);
}

/**
 *  실패하면 무엇을 얼마나 잃는가 — ★전부입니다.
 *
 *  ★ 돌려받는 몫은 없습니다. 이 게임의 감정 축이 제작인데 절반이 돌아오면
 *    아프지 않습니다 (전체설계 9절).
 *  ★ 그래도 이 함수는 남깁니다. 화면이 "재료 = 잃는 것" 을 스스로 셈하면,
 *    언젠가 규칙이 바뀔 때 화면만 옛말을 하게 됩니다.
 */
export function craftLoss(recipeId: string): Array<{ defId: string; lost: number }> {
  return recipeDef(recipeId).needs.map((need) => ({
    defId: need.defId,
    lost: need.count,
  }));
}

/** 이 광맥의 지금 성공 확률 */
export function mineChance(world: World, veinDefId: string): number {
  const mul = toolTemperMul(toolOf(world.me, 'pickaxe'));
  return successChance(world.me.skills.mining, veinDef(veinDefId).difficulty, GATHER, mul);
}

/* ===========================================================================
 *  화로와 광맥 찾기
 * ======================================================================== */

export function veinAt(world: World, id: number): Vein | undefined {
  return world.veins.find((v) => v.id === id);
}

/** 화로 앞에 서 있는가 (제작과 수리는 여기서만) */
export function nearForge(world: World): boolean {
  const forge = world.map.def.forge;
  if (!forge) return false;
  const fx = forge.tx * 32 + 16;
  const fy = forge.ty * 32 + 16;
  return Math.hypot(fx - world.me.pos.x, fy - world.me.pos.y) <= CRAFT.reach;
}

/* ===========================================================================
 *  시작과 취소
 * ======================================================================== */

export function cancelAction(world: World, reason?: string): void {
  if (!world.me.action) return;
  world.me.action = null;
  if (reason) log(world, reason, 'normal');
}

/** 채굴 시작. 못 하면 이유를 알려주고 아무 일도 하지 않습니다 */
export function startMining(world: World, veinId: number, repeat = true): boolean {
  const me = world.me;
  const vein = veinAt(world, veinId);

  if (!vein) return false;
  if (vein.remaining <= 0) {
    toast(world, '이 광맥은 바닥났습니다.', 'bad');
    return false;
  }
  if (!hasTool(me, 'pickaxe')) {
    toast(world, '곡괭이가 없습니다.', 'bad');
    return false;
  }
  if (Math.hypot(vein.pos.x - me.pos.x, vein.pos.y - me.pos.y) > GATHER.reach) {
    // 멀면 일단 걸어갑니다 — 도착하면 화면 쪽에서 다시 부릅니다
    me.moveTarget = { x: vein.pos.x, y: vein.pos.y + 20 };
    return false;
  }

  me.moveTarget = null;
  me.action = {
    kind: 'mine',
    targetId: String(veinId),
    remaining: GATHER.swingSeconds,
    total: GATHER.swingSeconds,
    repeat,
  };
  return true;
}

/**
 *  이 제작법이 벼림을 고를 수 있는가.
 *
 *  ★ 제련은 못 고릅니다. 주괴는 재료지 물건이 아니고, 겹치는 물건이라
 *    개별 값을 달 자리가 없습니다 (ItemStack 이 더미 단위입니다).
 *  ★ 착용하는 것과 **연장**이 대상입니다. 연장에서는 벼림의 damage 가
 *    성공률로 읽힙니다 (balance.ts 의 TOOL_TEMPER).
 */
export function canTemper(recipeId: string): boolean {
  const made = itemDef(recipeDef(recipeId).makes);
  return made.slot !== undefined || made.tool !== undefined;
}

export function startCraft(
  world: World,
  recipeId: string,
  repeat = false,
  temper?: TemperId,
): boolean {
  const me = world.me;
  const recipe = recipeDef(recipeId);

  // ★ 마을이 자라야 열리는 제작법이 있습니다. 화면을 안 거치는 길(반복 제작·시험용 도구)이
  //   있으므로 규칙 쪽에서 막습니다. 막았으면 왜 막았는지 말합니다.
  if (!openRecipes(me.town).has(recipeId)) {
    toast(world, '아직 만들 줄 모릅니다.', 'bad');
    log(world, `${recipe.name} — 대장간이 더 자라야 합니다`, 'bad');
    return false;
  }
  if (recipe.needsForge && !nearForge(world)) {
    toast(world, '화로 앞에서만 만들 수 있습니다.', 'bad');
    return false;
  }
  if (!hasTool(me, 'hammer')) {
    toast(world, '대장장이 망치가 없습니다.', 'bad');
    return false;
  }
  for (const need of recipe.needs) {
    if (countOf(me, need.defId) < need.count) {
      toast(world, `${itemDef(need.defId).name} ${need.count}개가 필요합니다.`, 'bad');
      return false;
    }
  }

  me.moveTarget = null;
  me.action = {
    kind: 'craft',
    targetId: recipeId,
    remaining: recipe.seconds,
    total: recipe.seconds,
    repeat,
    // 고를 수 없는 것에 실려온 값은 버립니다 — 조용히 붙어 있으면 안 됩니다
    temper: canTemper(recipeId) ? temper : undefined,
  };
  return true;
}

export function startRepair(world: World, uid: number): boolean {
  const me = world.me;
  if (!nearForge(world)) {
    toast(world, '화로 앞에서만 고칠 수 있습니다.', 'bad');
    return false;
  }
  if (!hasTool(me, 'hammer')) {
    toast(world, '대장장이 망치가 없습니다.', 'bad');
    return false;
  }

  // 입은 것이든 가방에 있는 것이든 고칠 수 있습니다
  const stack = [me.equipped.weapon, me.equipped.armor, me.equipped.helmet, ...me.backpack].find(
    (s) => s?.uid === uid,
  );
  if (!stack) return false;

  const quote = repairQuote(stack);
  if (quote.problem) {
    toast(world, quote.problem, 'bad');
    return false;
  }
  if (countOf(me, quote.ingotId) < quote.ingots) {
    toast(world, `${itemDef(quote.ingotId).name} ${quote.ingots}개가 필요합니다.`, 'bad');
    return false;
  }

  me.moveTarget = null;
  me.action = { kind: 'repair', targetId: String(uid), remaining: 2.5, total: 2.5, repeat: false };
  return true;
}

/* ===========================================================================
 *  매 순간 흐르는 일
 * ======================================================================== */

export function tickAction(world: World, dt: number): void {
  const me = world.me;
  if (!me.action || me.dead) return;

  me.action.remaining -= dt;
  if (me.action.remaining > 0) return;

  const action = me.action;
  me.action = null;

  if (action.kind === 'mine') finishMining(world, Number(action.targetId), action.repeat);
  else if (action.kind === 'craft') finishCraft(world, action.targetId, action.repeat, action.temper);
  else finishRepair(world, Number(action.targetId));
}

/* --------------------------------------------------------------- 캐기 */

function finishMining(world: World, veinId: number, repeat: boolean): void {
  const me = world.me;
  const vein = veinAt(world, veinId);
  if (!vein) return;

  const def = veinDef(vein.defId);

  //  ★ 광맥마다 곡괭이를 먹는 양이 다릅니다 (3층은 3). 표가 정하고 여기는 셈만 합니다.
  const pick = useTool(world, 'pickaxe', def.toolWear ?? DURABILITY.toolPerUse);
  if (!pick) {
    toast(world, '곡괭이가 부러졌습니다.', 'bad');
    return;
  }
  if (Math.hypot(vein.pos.x - me.pos.x, vein.pos.y - me.pos.y) > GATHER.reach) return;

  // 성공하든 실패하든 배웁니다
  trySkillGain(world, 'mining', def.difficulty);

  // ★ 이 휘두름을 한 곡괭이의 벼림이 성공률에 걸립니다
  const ok = chance(
    world,
    successChance(me.skills.mining, def.difficulty, GATHER, toolTemperMul(pick)),
  );
  if (ok) {
    const amount = randInt(world, def.amountMin, def.amountMax);
    // ★ 넣어보고 나서 셉니다. 못 넣었는데 광맥만 줄어들면 광석이 허공으로 갑니다.
    if (!addItem(world, def.yields, amount)) {
      toast(world, '더 들 수 없습니다. 마을로 돌아가세요.', 'bad');
      floater(world, { x: me.pos.x, y: me.pos.y - 30 }, '짐이 가득 참', 'info', 'pack-full');
      return;
    }
    me.tally[def.yields] = (me.tally[def.yields] ?? 0) + amount;
    floater(world, vein.pos, `+${amount} ${itemDef(def.yields).name}`, 'info', 'ore');
    vein.remaining -= 1;

    if (vein.remaining <= 0) {
      vein.respawnIn = def.respawn;
      log(world, `${def.name}이(가) 바닥났습니다`, 'normal');
      return;
    }
  } else {
    floater(world, vein.pos, '실패', 'miss', 'mine-fail');
  }

  if (repeat) startMining(world, veinId, true);
}

/* --------------------------------------------------------------- 만들기 */

function finishCraft(world: World, recipeId: string, repeat: boolean, temper?: TemperId): void {
  const me = world.me;
  const recipe = recipeDef(recipeId);

  if (recipe.needsForge && !nearForge(world)) return;
  const hammer = useTool(world, 'hammer');
  if (!hammer) {
    toast(world, '망치가 부러졌습니다.', 'bad');
    return;
  }

  //  재료는 시도할 때 들어갑니다. ★ 실패해도 돌려주지 않습니다 (아래 참조) —
  //    가방이 꽉 차서 물건을 못 받은 경우에만 통째로 돌아옵니다.
  for (const need of recipe.needs) {
    if (countOf(me, need.defId) < need.count) {
      toast(world, '재료가 모자랍니다.', 'bad');
      return;
    }
  }
  for (const need of recipe.needs) consume(me, need.defId, need.count);

  trySkillGain(world, 'blacksmithing', recipe.difficulty);

  if (
    !chance(
      world,
      successChance(me.skills.blacksmithing, recipe.difficulty, CRAFT, toolTemperMul(hammer)),
    )
  ) {
    //  ★ 돌려주지 않습니다. 재료는 위에서 이미 consume 되었고 그대로 사라집니다.
    const burnt = craftLoss(recipeId)
      .map((l) => `${itemDef(l.defId).name} ${l.lost}개`)
      .join(' · ');
    //  ★ 고른 벼림도 함께 날아갑니다. 이름을 대야 그것이 분명해집니다 —
    //    "철검 실패" 와 "날 선 철검 실패" 는 잃은 것이 다릅니다.
    const what = temper ? `${temperDef(temper).prefix} ${recipe.name}` : recipe.name;
    log(world, `${what} 만들기에 실패했습니다 — ${burnt}를 전부 잃었습니다`, 'bad');
    // ★ 기록은 화면 맨 아래라 놓칩니다. 실패는 가운데에도 띄웁니다.
    toast(world, `${what} 실패\n${burnt}를 전부 잃었습니다`, 'bad');
    floater(world, { x: me.pos.x, y: me.pos.y - 30 }, '실패', 'miss', 'craft-fail');
    if (repeat) startCraft(world, recipeId, true, temper);
    return;
  }

  const quality: Quality = chance(world, fineChance(me.skills.blacksmithing, recipe.difficulty))
    ? 'fine'
    : 'normal';

  // ★ 여기서 addItem 의 답을 듣지 않던 것이 제일 나쁜 버그였습니다.
  //   가방 칸이 없으면 물건은 안 들어오는데 재료는 사라지고, 기록에는
  //   '완성' 이라고 적혔습니다. 못 넣으면 **재료를 전부 돌려줍니다.**
  if (!addItem(world, recipe.makes, recipe.makesCount, { quality, temper })) {
    for (const need of recipe.needs) {
      if (!addItem(world, need.defId, need.count)) {
        log(world, `${itemDef(need.defId).name} 을(를) 돌려받지 못했습니다`, 'bad');
      }
    }
    toast(world, '가방이 가득 찼습니다.\n만들지 못했습니다.', 'bad');
    log(world, `${recipe.name} — 가방이 차서 만들지 못했습니다 (재료는 돌려받았습니다)`, 'bad');
    return;
  }
  me.tally[recipe.makes] = (me.tally[recipe.makes] ?? 0) + recipe.makesCount;

  const made = [
    quality === 'fine' ? '우수한' : '',
    temper ? temperDef(temper).prefix : '',
    itemDef(recipe.makes).name,
  ].filter(Boolean).join(' ');
  log(world, `${made} 완성`, quality === 'fine' ? 'epic' : 'good');
  if (quality === 'fine') {
    toast(world, `우수한 물건\n${itemDef(recipe.makes).name}`, 'epic', 'craft-fine');
  }

  if (repeat) startCraft(world, recipeId, true, temper);
}

/* --------------------------------------------------------------- 고치기 */

function finishRepair(world: World, uid: number): void {
  const me = world.me;
  const stack = [me.equipped.weapon, me.equipped.armor, me.equipped.helmet, ...me.backpack].find(
    (s) => s?.uid === uid,
  );
  if (!stack) return;

  if (!useTool(world, 'hammer')) return;

  const quote = repairQuote(stack);
  if (quote.problem) return;
  if (!consume(me, quote.ingotId, quote.ingots)) return;

  trySkillGain(world, 'blacksmithing', DURABILITY.repairDifficulty);

  stack.maxDurability = quote.newMax;
  stack.durability = quote.newMax;
  log(
    world,
    `${itemName(stack)} 수리 — 최대 내구도가 ${quote.newMax} 로 줄었습니다`,
    quote.newMax < 30 ? 'bad' : 'normal',
  );
}
