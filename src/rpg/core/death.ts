/**
 *  죽음.
 *
 *  Phase 1 은 골드 일부만 잃습니다. 경험치가 없으니 되돌릴 것도 없습니다.
 *  시체가 현장에 남고 물건을 흘리는 것은 Phase 6 의 일입니다.
 */

import { DEATH } from '../balance';
import { mapDef } from '../content/maps';
import { log, shake, vfx } from './feedback';
import { derive } from './stats';
import { enterMap } from './world';
import type { World } from '../types';

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

  // 내가 쓰러지면 몬스터는 흥미를 잃습니다
  for (const monster of world.monsters) monster.aggroUntil = 0;

  shake(world, 0.6);
  vfx(world, 'impact', me.pos, { life: 0.7, color: '#c2352f', radius: 46 });
  log(world, `쓰러졌습니다 — 골드 ${lost.toLocaleString()} 손실`, 'bad');
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
