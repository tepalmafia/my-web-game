/**
 *  전리품.
 *
 *  골드는 잡는 즉시 들어오고, 물건은 바닥에 떨어집니다.
 *  떨어진 물건은 그 위를 지나가면 자동으로 주워집니다 (LOOT.pickupRange).
 */

import { LOOT } from '../balance';
import { GRADE_COLOR, itemDef } from '../content/items';
import { monsterDef } from '../content/monsters';
import { addItem } from './inventory';
import { floater, log, vfx } from './feedback';
import { chance, nextRandom, randInt } from './rng';
import type { Monster, World } from '../types';

/** 몬스터가 죽은 자리에 전리품을 뿌립니다 */
export function dropLoot(world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);

  const gold = randInt(world, def.goldMin, def.goldMax);
  if (gold > 0) {
    world.player.gold += gold;
    floater(world, monster.pos, `+${gold.toLocaleString()} 골드`, 'info');
  }

  for (const entry of def.drops) {
    if (!chance(world, entry.chance)) continue;
    const count = entry.min !== undefined && entry.max !== undefined
      ? randInt(world, entry.min, entry.max)
      : 1;

    const angle = nextRandom(world) * Math.PI * 2;
    const distance = 6 + nextRandom(world) * 18;

    world.ground.push({
      id: world.nextId++,
      defId: entry.defId,
      plus: 0,
      count,
      pos: {
        x: monster.pos.x + Math.cos(angle) * distance,
        y: monster.pos.y + Math.sin(angle) * distance,
      },
      life: LOOT.lifetime,
    });

    const itdef = itemDef(entry.defId);
    if (itdef.grade === 'epic' || itdef.grade === 'legend') {
      log(world, `${def.name}이(가) ${itdef.name}을(를) 떨어뜨렸습니다!`, 'epic');
      vfx(world, 'ring', monster.pos, { life: 1.2, color: GRADE_COLOR[itdef.grade]!, radius: 44 });
    }
  }
}

/** 바닥의 물건을 밟으면 줍습니다 */
export function pickUpNearby(world: World): void {
  const player = world.player;

  for (let i = world.ground.length - 1; i >= 0; i--) {
    const item = world.ground[i]!;
    const distance = Math.hypot(item.pos.x - player.pos.x, item.pos.y - player.pos.y);
    if (distance > LOOT.pickupRange) continue;

    if (!addItem(world, item.defId, item.count, item.plus)) {
      // 가방이 가득 차면 그대로 두고 알려만 줍니다
      if (world.time % 2 < 0.05) log(world, '가방이 가득 차서 줍지 못했습니다', 'bad');
      continue;
    }
    const def = itemDef(item.defId);
    const tone = def.grade === 'epic' || def.grade === 'legend' ? 'epic' : 'normal';
    log(world, `${def.name}${item.count > 1 ? ` ${item.count}개` : ''} 획득`, tone);
    world.ground.splice(i, 1);
  }
}
