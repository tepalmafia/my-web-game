/**
 *  전리품.
 *
 *  골드는 바로 들어오고 물건은 바닥에 떨어집니다.
 *  ★ 다만 무게가 넘치면 줍지 못합니다 — 무거운 것을 두고 갈지 정하는 것도 이 게임의 일부입니다.
 */

import { LOOT } from '../balance';
import { itemDef } from '../content/items';
import { monsterDef } from '../content/monsters';
import { floater, log } from './feedback';
import { addItem, canCarry, findStack, hasRoom, removeItem } from './inventory';
import { chance, nextRandom, randInt } from './rng';
import type { GroundItem, Monster, World } from '../types';

export function dropLoot(world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);

  const gold = randInt(world, def.goldMin, def.goldMax);
  if (gold > 0) {
    world.me.gold += gold;
    floater(world, monster.pos, `+${gold} 골드`, 'info', 'gold');
  }

  for (const entry of def.drops) {
    if (!chance(world, entry.chance)) continue;
    const count =
      entry.min !== undefined && entry.max !== undefined ? randInt(world, entry.min, entry.max) : 1;

    const angle = nextRandom(world) * Math.PI * 2;
    const distance = 6 + nextRandom(world) * 16;
    world.ground.push({
      id: world.nextId++,
      defId: entry.defId,
      count,
      pos: {
        x: monster.pos.x + Math.cos(angle) * distance,
        y: monster.pos.y + Math.sin(angle) * distance,
      },
      until: world.time + LOOT.lifetime,
    });
  }
}

/**
 *  가방에서 꺼내 바닥에 놓습니다.
 *
 *  ★ 이 게임에서 짐을 더는 길은 그동안 "마을에서 파는 것" 하나뿐이었습니다.
 *    그래서 무게가 축인데도 버리는 판단이 없었습니다 (전체설계 3.2).
 *
 *  ★ 안전한 곳(마을)에 놓은 것은 안 사라집니다. 망치를 화로 옆에 두고 나가는 것이
 *    이 축의 첫 번째 실제 선택인데, 45초 뒤에 없어지면 선택이 아니라 함정입니다.
 *  ★ 밖에 놓은 것은 LOOT.placedLifetime 뒤에 사라집니다. 그래서 "두고 갔다가
 *    돌아올까" 가 도박이 됩니다.
 */
export function placeItem(world: World, uid: number, count = 1): boolean {
  const me = world.me;
  const stack = findStack(me, uid);
  if (!stack) return false;

  const put = Math.min(count, stack.count);
  if (put <= 0) return false;

  const name = `${itemDef(stack.defId).name}${put > 1 ? ` ${put}개` : ''}`;
  const safe = world.map.def.safe === true;

  //  ★ 발밑에 그대로 놓습니다. 흩뿌리지 않습니다 — 일부러 놓은 것은
  //    어디에 뒀는지 기억할 수 있어야 합니다.
  world.ground.push({
    id: world.nextId++,
    defId: stack.defId,
    count: put,
    pos: { x: me.pos.x, y: me.pos.y + 6 },
    until: safe ? null : world.time + LOOT.placedLifetime,
    placed: true,
  });
  removeItem(me, uid, put);

  log(
    world,
    safe
      ? `${name}을(를) 내려놓았습니다 — 여기서는 없어지지 않습니다`
      : `${name}을(를) 내려놓았습니다 — 두고 가면 언젠가 사라집니다`,
    'normal',
  );
  return true;
}

/**
 *  눌러서 가져옵니다.
 *
 *  ★ 일부러 놓은 것은 밟아도 저절로 안 주워집니다(pickUpNearby). 그래야 놓고
 *    갈 수가 있습니다. 대신 가져갈 때는 이렇게 눌러서 가져갑니다.
 */
export function pickUpAt(world: World, x: number, y: number): boolean {
  const me = world.me;
  for (let i = world.ground.length - 1; i >= 0; i--) {
    const item = world.ground[i]!;
    if (Math.hypot(item.pos.x - x, item.pos.y - y) > LOOT.pickupRange) continue;
    if (Math.hypot(item.pos.x - me.pos.x, item.pos.y - me.pos.y) > LOOT.pickupRange * 2) {
      // 멀면 일단 걸어갑니다 — 도착해서 다시 누르면 됩니다
      me.moveTarget = { x: item.pos.x, y: item.pos.y };
      return false;
    }
    if (!canCarry(me, item.defId, item.count) || !addItem(world, item.defId, item.count)) {
      warnCannotCarry(world, item);
      return false;
    }
    log(world, `${itemDef(item.defId).name}${item.count > 1 ? ` ${item.count}개` : ''} 획득`, 'normal');
    world.ground.splice(i, 1);
    return true;
  }
  return false;
}

/**
 *  못 주웠다고 알리는 간격 (초).
 *
 *  ★ 줍기는 매 프레임 돌아갑니다. 그대로 알리면 초당 스무 번씩 같은 말이 뜹니다.
 *    물건 위에 서 있는 동안에는 한 번만 말하고, 자리를 옮겨 다시 밟으면 그때 또 말합니다.
 */
const WARN_INTERVAL = 8;

/**
 *  세계마다 마지막으로 알린 때.
 *
 *  ★ 저장되는 값이 아닙니다 — 화면에 같은 말을 연달아 띄우지 않으려는 것뿐입니다.
 *    세계를 키로 잡아, 새로 시작하거나 불러오면 저절로 처음부터입니다.
 */
const warnedAt = new WeakMap<World, number>();

/** 바닥의 물건을 밟으면 줍습니다 (무게와 칸이 허락할 때만) */
export function pickUpNearby(world: World): void {
  const me = world.me;

  for (let i = world.ground.length - 1; i >= 0; i--) {
    const item = world.ground[i]!;
    // ★ 일부러 놓은 것은 밟아도 안 줍습니다. 되집으면 놓을 수가 없습니다
    if (item.placed) continue;
    const distance = Math.hypot(item.pos.x - me.pos.x, item.pos.y - me.pos.y);
    if (distance > LOOT.pickupRange) continue;

    // ★ 예전에는 여기서 그냥 continue 했습니다. 전리품이 발밑에 있는데 주워지지 않고,
    //   화면에는 아무 말도 없었습니다 — 조용한 손해였습니다.
    if (!canCarry(me, item.defId, item.count)) {
      warnCannotCarry(world, item);
      continue;
    }
    if (!addItem(world, item.defId, item.count)) {
      warnCannotCarry(world, item);
      continue;
    }

    log(world, `${itemDef(item.defId).name}${item.count > 1 ? ` ${item.count}개` : ''} 획득`, 'normal');
    world.ground.splice(i, 1);
  }
}

/** 왜 못 주웠는지 알립니다 — 무게 때문인지 칸 때문인지 갈라서 */
function warnCannotCarry(world: World, item: GroundItem): void {
  const last = warnedAt.get(world);
  if (last !== undefined && world.time - last < WARN_INTERVAL) return;
  warnedAt.set(world, world.time);

  const me = world.me;
  const name = `${itemDef(item.defId).name}${item.count > 1 ? ` ${item.count}개` : ''}`;
  const roomLeft = hasRoom(me, item.defId);

  floater(world, item.pos, roomLeft ? '무거워서 못 듦' : '가방이 가득', 'miss', 'pack-full');
  log(
    world,
    roomLeft ? `${name} — 무거워서 들지 못했습니다` : `${name} — 가방에 빈 칸이 없습니다`,
    'bad',
  );
}
