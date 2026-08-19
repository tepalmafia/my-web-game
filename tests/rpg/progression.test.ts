/**
 *  성장과 죽음.
 *
 *  죽음은 이 게임의 벌금 제도입니다. 얼마를 잃고 무엇이 남는지가 정확해야
 *  "한 번 더 갈까, 마을로 돌아갈까"를 플레이어가 계산할 수 있습니다.
 */

import { describe, expect, it } from 'vitest';

import { DEATH, MAX_LEVEL, expPenalty, expToNextLevel } from '../../src/rpg/balance';
import { createWorld } from '../../src/rpg/core/create';
import { die, expRatio, gainExp, restoreExp, revive } from '../../src/rpg/core/progression';
import { derive } from '../../src/rpg/core/stats';
import { enterMap } from '../../src/rpg/core/world';

describe('경험치 곡선', () => {
  it('레벨이 오를수록 다음 레벨이 무거워진다', () => {
    for (let level = 1; level < MAX_LEVEL; level++) {
      expect(expToNextLevel(level + 1), `Lv.${level}`).toBeGreaterThan(expToNextLevel(level));
    }
  });

  it('후반이 초반보다 훨씬 무겁다 — 마지막 열 레벨이 순식간에 지나가면 안 된다', () => {
    expect(expToNextLevel(30)).toBeGreaterThan(expToNextLevel(10) * 8);
  });
});

describe('약한 몬스터를 잡을 때의 경험치 감소', () => {
  it('레벨 차이가 5 이내면 깎이지 않는다', () => {
    expect(expPenalty(10, 10)).toBe(1);
    expect(expPenalty(10, 5)).toBe(1);
  });

  it('그보다 벌어지면 급격히 깎이고, 0 이 되지는 않는다', () => {
    expect(expPenalty(20, 10)).toBeLessThan(0.5);
    expect(expPenalty(40, 1)).toBeGreaterThan(0);
    expect(expPenalty(40, 1)).toBeLessThan(0.2);
  });
});

describe('레벨업', () => {
  it('필요량을 넘기면 레벨이 오르고 남은 경험치는 이월된다', () => {
    const world = createWorld('시험', 'knight');
    const need = expToNextLevel(1);

    gainExp(world, need + 7);
    expect(world.player.level).toBe(2);
    expect(world.player.exp).toBe(7);
  });

  it('한꺼번에 많이 받으면 여러 레벨이 한 번에 오른다', () => {
    const world = createWorld('시험', 'elf');
    gainExp(world, expToNextLevel(1) + expToNextLevel(2) + expToNextLevel(3));
    expect(world.player.level).toBe(4);
  });

  it('레벨이 오르면 체력과 마나가 가득 찬다', () => {
    const world = createWorld('시험', 'wizard');
    world.player.hp = 1;
    world.player.mp = 0;

    gainExp(world, expToNextLevel(1));
    const stats = derive(world.player);
    expect(world.player.hp).toBe(stats.maxHp);
    expect(world.player.mp).toBe(stats.maxMp);
  });

  it('최고 레벨에서는 더 오르지 않는다', () => {
    const world = createWorld('시험', 'knight');
    world.player.level = MAX_LEVEL;
    gainExp(world, 9_999_999);

    expect(world.player.level).toBe(MAX_LEVEL);
    expect(expRatio(world)).toBe(1);
  });
});

describe('죽음', () => {
  it('지금 레벨에서 모은 경험치의 30% 와 골드의 8% 를 잃는다', () => {
    const world = createWorld('시험', 'knight');
    // 100 을 그냥 주면 레벨이 올라 남은 경험치가 달라집니다. 지금 레벨의 진행도만 놓습니다
    world.player.level = 20;
    world.player.exp = 100;
    world.player.gold = 1000;

    die(world);

    expect(world.player.lostExp).toBe(30);
    expect(world.player.exp).toBe(70);
    expect(world.player.gold).toBe(920);
    expect(world.player.dead).toBe(true);
    expect(world.player.deaths).toBe(1);
  });

  it('레벨은 내려가지 않는다', () => {
    const world = createWorld('시험', 'knight');
    gainExp(world, expToNextLevel(1) + 10);
    const level = world.player.level;

    die(world);
    expect(world.player.level).toBe(level);
    expect(world.player.exp).toBeGreaterThanOrEqual(0);
  });

  it('버프가 풀리고, 몬스터가 흥미를 잃는다', () => {
    const world = createWorld('시험', 'knight');
    enterMap(world, 'field', 4, 18);
    world.player.buffs.push({ id: 'k2', name: '광폭화', until: 999, color: '#fff', effects: {} });
    for (const monster of world.monsters) monster.aggroUntil = world.time + 100;

    die(world);

    expect(world.player.buffs).toHaveLength(0);
    expect(world.monsters.every((m) => m.aggroUntil === 0)).toBe(true);
  });

  it('이미 죽은 상태에서 또 죽지 않는다 (경험치를 두 번 잃으면 안 됩니다)', () => {
    const world = createWorld('시험', 'knight');
    gainExp(world, 100);

    die(world);
    const after = world.player.exp;
    die(world);

    expect(world.player.exp).toBe(after);
    expect(world.player.deaths).toBe(1);
  });
});

describe('부활', () => {
  it('마을에서 체력 40% 로 일어난다', () => {
    const world = createWorld('시험', 'knight');
    enterMap(world, 'field', 4, 18);
    die(world);
    revive(world);

    const stats = derive(world.player);
    expect(world.mapId).toBe('town');
    expect(world.player.dead).toBe(false);
    expect(world.player.hp).toBe(Math.round(stats.maxHp * DEATH.reviveHpRatio));
  });

  it('부활 주문서는 잃은 경험치의 절반을 되돌린다', () => {
    const world = createWorld('시험', 'knight');
    world.player.level = 20;
    world.player.exp = 100;
    die(world);

    expect(world.player.lostExp).toBe(30);
    expect(restoreExp(world)).toBe(true);
    expect(world.player.exp).toBe(70 + 15);
    // 두 번은 안 됩니다
    expect(restoreExp(world)).toBe(false);
  });
});
