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
import { addItem, canCarry, hasRoom } from './inventory';
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
      life: LOOT.lifetime,
    });
  }
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
