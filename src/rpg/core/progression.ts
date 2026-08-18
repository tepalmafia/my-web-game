/**
 *  경험치 · 레벨업 · 죽음.
 *
 *  이 게임에서 죽음은 벌금입니다. 지금 레벨에서 모은 경험치의 30% 와 골드의 8% 를 잃습니다.
 *  레벨이 내려가지는 않지만, 무리해서 위쪽 사냥터에 오래 있으면 제자리걸음을 하게 됩니다.
 *  부활 주문서를 미리 사두면 그 손해의 절반을 되돌릴 수 있습니다.
 */

import { DEATH, MAX_LEVEL, expToNextLevel } from '../balance';
import { mapDef } from '../content/maps';
import { floater, log, shake, toast, vfx } from './feedback';
import { derive } from './stats';
import { enterMap } from './world';
import type { World } from '../types';

/** 경험치를 얻고, 넘치면 레벨을 올립니다 */
export function gainExp(world: World, amount: number): void {
  const player = world.player;
  if (player.level >= MAX_LEVEL) return;

  player.exp += amount;

  while (player.level < MAX_LEVEL && player.exp >= expToNextLevel(player.level)) {
    player.exp -= expToNextLevel(player.level);
    player.level += 1;

    const stats = derive(player);
    player.hp = stats.maxHp;
    player.mp = stats.maxMp;

    log(world, `레벨 ${player.level} 이 되었습니다`, 'epic');
    toast(world, `LEVEL ${player.level}`, 'epic');
    vfx(world, 'levelup', player.pos, { life: 1.1, color: '#fde68a', radius: 70 });
  }
  if (player.level >= MAX_LEVEL) player.exp = 0;
}

/** 이번 레벨에서 얼마나 왔는가 (0~1) */
export function expRatio(world: World): number {
  const player = world.player;
  if (player.level >= MAX_LEVEL) return 1;
  return Math.min(1, player.exp / expToNextLevel(player.level));
}

/** 죽었습니다 */
export function die(world: World): void {
  const player = world.player;
  if (player.dead) return;

  player.dead = true;
  player.deadFor = 0;
  player.hp = 0;
  player.targetId = null;
  player.moveTarget = null;
  player.buffs = [];
  player.deaths += 1;

  // 내가 쓰러지면 몬스터는 흥미를 잃고 제자리로 돌아갑니다
  for (const monster of world.monsters) monster.aggroUntil = 0;

  const lostExp = Math.floor(player.exp * DEATH.expLossRatio);
  const lostGold = Math.floor(player.gold * DEATH.goldLossRatio);
  player.exp -= lostExp;
  player.gold -= lostGold;
  player.lostExp = lostExp;

  shake(world, 0.6);
  vfx(world, 'impact', player.pos, { life: 0.7, color: '#ef4444', radius: 46 });
  log(world, `쓰러졌습니다 — 경험치 ${lostExp.toLocaleString()}, 골드 ${lostGold.toLocaleString()} 손실`, 'bad');
}

/** 마을에서 다시 일어납니다 */
export function revive(world: World): void {
  const player = world.player;
  if (!player.dead) return;

  const town = mapDef('town');
  enterMap(world, 'town', town.entryTx, town.entryTy);

  const stats = derive(player);
  player.dead = false;
  player.deadFor = 0;
  player.hp = Math.round(stats.maxHp * DEATH.reviveHpRatio);
  player.mp = Math.round(stats.maxMp * DEATH.reviveHpRatio);
  log(world, '마을에서 눈을 떴습니다', 'normal');
}

/** 부활 주문서 — 잃었던 경험치의 절반을 되찾습니다 */
export function restoreExp(world: World): boolean {
  const player = world.player;
  if (player.lostExp <= 0) return false;

  const recovered = Math.floor(player.lostExp * DEATH.resurrectRecover);
  player.lostExp = 0;
  gainExp(world, recovered);
  floater(world, player.pos, `+${recovered.toLocaleString()} EXP`, 'exp');
  log(world, `경험치 ${recovered.toLocaleString()} 을(를) 되찾았습니다`, 'good');
  return true;
}
