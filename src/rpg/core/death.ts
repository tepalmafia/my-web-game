/**
 *  죽음.
 *
 *  ★ 골드 10% 를 잃고, ★가방을 그 자리에 떨굽니다.
 *    입은 것과 연장(곡괭이·망치)은 지킵니다 — 맨손으로 되살아나면
 *    되찾으러 갈 수단조차 없어서, 그건 무게가 아니라 막힘입니다.
 *
 *  ★ 시체는 하나뿐입니다. 두 번 죽으면 앞의 것이 사라지고, 반드시 말해줍니다.
 *  ★ 수명은 바닥에 놓아둔 것과 같습니다 (LOOT.placedLifetime).
 *    같은 규칙을 두 번 만들지 않습니다.
 */

import { DEATH, LOOT } from '../balance';
import { itemDef } from '../content/items';
import { mapDef } from '../content/maps';
import { log, shake, vfx } from './feedback';
import { addItem, canCarry } from './inventory';
import { derive } from './stats';
import { enterMap } from './world';
import type { ItemStack, World } from '../types';

export function die(world: World): void {
  const me = world.me;
  if (me.dead) return;

  me.dead = true;
  me.deadFor = 0;
  me.hp = 0;
  me.targetId = null;
  me.moveTarget = null;
  me.action = null;
  me.deaths += 1;

  const lost = Math.floor(me.gold * DEATH.goldLossRatio);
  me.gold -= lost;

  dropPack(world);

  // 내가 쓰러지면 몬스터는 흥미를 잃습니다
  for (const monster of world.monsters) monster.aggroUntil = 0;

  shake(world, 0.6);
  vfx(world, 'impact', me.pos, { life: 0.7, color: '#c2352f', radius: 46 });
  log(world, `쓰러졌습니다 — 골드 ${lost.toLocaleString()} 손실`, 'bad');
}

/**
 *  가방을 그 자리에 떨굽니다. 연장은 두고 갑니다.
 *
 *  ★ 떨굴 것이 없으면 시체를 만들지 않습니다 — 빈 시체를 되찾으러 가는 것은
 *    아무 선택도 아닙니다.
 */
function dropPack(world: World): void {
  const me = world.me;
  const dropped = me.backpack.filter((stack) => itemDef(stack.defId).kind !== 'tool');
  if (dropped.length === 0) return;

  // ★ 앞의 시체가 있으면 여기서 사라집니다. 조용히 사라지면 안 됩니다.
  if (me.corpse) {
    log(world, `${mapDef(me.corpse.mapId).name}에 두고 온 짐은 이제 사라졌습니다`, 'bad');
  }

  me.backpack = me.backpack.filter((stack) => itemDef(stack.defId).kind === 'tool');
  me.corpse = {
    mapId: world.mapId,
    pos: { x: me.pos.x, y: me.pos.y },
    items: dropped,
    until: world.time + LOOT.placedLifetime,
  };

  const count = dropped.reduce((sum, stack) => sum + stack.count, 0);
  log(world, `가방을 떨어뜨렸습니다 — ${mapDef(world.mapId).name}에 ${count}개`, 'bad');
}

/**
 *  시체를 눌러서 짐을 되찾습니다.
 *
 *  ★ 무거워서 다 못 들면 드는 만큼만 가져가고 나머지는 그대로 남습니다.
 *    "다 가져갈 수 없구나" 가 3.2 가 묻는 것입니다.
 */
export function takeCorpse(world: World, x: number, y: number): boolean {
  const me = world.me;
  const corpse = me.corpse;
  if (!corpse || corpse.mapId !== world.mapId) return false;
  if (Math.hypot(corpse.pos.x - x, corpse.pos.y - y) > CORPSE_REACH) return false;

  if (Math.hypot(corpse.pos.x - me.pos.x, corpse.pos.y - me.pos.y) > CORPSE_REACH * 2) {
    // 멀면 일단 걸어갑니다 — 도착해서 다시 누르면 됩니다
    me.moveTarget = { x: corpse.pos.x, y: corpse.pos.y };
    return false;
  }

  const left: ItemStack[] = [];
  let taken = 0;
  for (const stack of corpse.items) {
    if (canCarry(me, stack.defId, stack.count) && addItem(world, stack.defId, stack.count)) {
      taken += stack.count;
      continue;
    }
    left.push(stack);
  }

  if (taken > 0) log(world, `두고 온 짐 ${taken}개를 되찾았습니다`, 'good');
  if (left.length === 0) {
    me.corpse = null;
    return true;
  }

  corpse.items = left;
  const rest = left.reduce((sum, stack) => sum + stack.count, 0);
  log(world, `${rest}개는 무거워서 두고 갑니다`, 'bad');
  return taken > 0;
}

/** 시체를 누를 수 있는 거리 */
const CORPSE_REACH = 34;

/**
 *  시간이 다한 시체를 치웁니다. 매 프레임 불립니다.
 *  ★ 사라질 때 반드시 말합니다 — 조용히 없어지면 되찾으러 갔다가 헛걸음합니다.
 */
export function decayCorpse(world: World): void {
  const me = world.me;
  if (!me.corpse) return;
  if (world.time < me.corpse.until) return;

  const where = mapDef(me.corpse.mapId).name;
  me.corpse = null;
  log(world, `${where}에 두고 온 짐이 사라졌습니다`, 'bad');
}

export function revive(world: World): void {
  const me = world.me;
  if (!me.dead) return;

  const town = mapDef('town');
  enterMap(world, 'town', town.entryTx, town.entryTy);

  me.dead = false;
  me.deadFor = 0;
  me.hp = Math.round(derive(me).maxHp * DEATH.reviveHpRatio);
  log(world, '마을에서 눈을 떴습니다', 'normal');
}
