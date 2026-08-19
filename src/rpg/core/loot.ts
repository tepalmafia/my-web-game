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
import { addItem, canCarry } from './inventory';
import { chance, nextRandom, randInt } from './rng';
import type { Monster, World } from '../types';

export function dropLoot(world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);

  const gold = randInt(world, def.goldMin, def.goldMax);
  if (gold > 0) {
    world.me.gold += gold;
    floater(world, monster.pos, `+${gold} 골드`, 'info');
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

/** 바닥의 물건을 밟으면 줍습니다 (무게가 허락할 때만) */
export function pickUpNearby(world: World): void {
  const me = world.me;

  for (let i = world.ground.length - 1; i >= 0; i--) {
    const item = world.ground[i]!;
    const distance = Math.hypot(item.pos.x - me.pos.x, item.pos.y - me.pos.y);
    if (distance > LOOT.pickupRange) continue;

    if (!canCarry(me, item.defId, item.count)) continue; // 무거워서 못 듭니다 — 그대로 둡니다
    if (!addItem(world, item.defId, item.count)) continue;

    log(world, `${itemDef(item.defId).name}${item.count > 1 ? ` ${item.count}개` : ''} 획득`, 'normal');
    world.ground.splice(i, 1);
  }
}
