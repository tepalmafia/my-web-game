/**
 *  전투.
 *
 *  때리면 줄어들고, 죽으면 경험치와 전리품이 나오고, 보스는 시계가 돌기 시작합니다.
 *  명중은 확률이라 한 대만 보고는 알 수 없어서, 여러 번 때린 결과로 확인합니다.
 */

import { describe, expect, it } from 'vitest';

import { expPenalty } from '../../src/rpg/balance';
import { monsterDef } from '../../src/rpg/content/monsters';
import { currentTarget, distanceTo, monsterStrike, nearestMonster, strikeArea, strikeMonster, tickRespawn } from '../../src/rpg/core/combat';
import { createWorld } from '../../src/rpg/core/create';
import { addItem, equip } from '../../src/rpg/core/inventory';
import { derive } from '../../src/rpg/core/stats';
import { enterMap } from '../../src/rpg/core/world';
import type { Monster, World } from '../../src/rpg/types';

/** 확실히 죽을 때까지 때립니다 (명중은 확률이라 한 대로는 모자랄 수 있습니다) */
function killIt(world: World, monster: Monster): void {
  for (let i = 0; i < 60 && monster.state !== 'dead'; i++) {
    monster.hp = 1;
    strikeMonster(world, monster, 99);
  }
  if (monster.state !== 'dead') throw new Error('60번을 때렸는데 안 죽었습니다');
}

/** 사냥터에 들어가 첫 몬스터를 눈앞에 세워둔 판 */
function facing(defId: string, mapId = 'field', seed = 4242): { world: World; monster: Monster } {
  const world = createWorld('시험', 'knight');
  world.seed = seed;
  enterMap(world, mapId, 4, 18);

  const monster = world.monsters.find((m) => m.defId === defId);
  if (!monster) throw new Error(`${mapId} 에 ${defId} 가 없습니다`);

  monster.pos = { x: world.player.pos.x + 20, y: world.player.pos.y };
  return { world, monster };
}

describe('때리기', () => {
  it('여러 번 때리면 체력이 준다', () => {
    const { world, monster } = facing('slime');
    const before = monster.hp;

    for (let i = 0; i < 5; i++) strikeMonster(world, monster, 1);
    expect(monster.hp).toBeLessThan(before);
  });

  it('맞은 몬스터는 반드시 반격 태세로 돌아선다 — 뒤에서 때리고 도망갈 수 없다', () => {
    const { world, monster } = facing('slime');
    monster.state = 'idle';
    monster.aggroUntil = 0;

    strikeMonster(world, monster, 1);
    expect(monster.aggroUntil).toBeGreaterThan(world.time);
    expect(monster.state).not.toBe('idle');
  });

  it('센 스킬은 평타보다 아프다', () => {
    const plain = facing('golem', 'mine');
    const skill = facing('golem', 'mine');

    let plainDamage = 0;
    let skillDamage = 0;
    for (let i = 0; i < 40; i++) {
      const before1 = plain.monster.hp;
      strikeMonster(plain.world, plain.monster, 1);
      plainDamage += before1 - plain.monster.hp;
      plain.monster.hp = plain.monster.maxHp;

      const before2 = skill.monster.hp;
      strikeMonster(skill.world, skill.monster, 3);
      skillDamage += before2 - skill.monster.hp;
      skill.monster.hp = skill.monster.maxHp;
    }
    expect(skillDamage).toBeGreaterThan(plainDamage * 1.8);
  });

  it('단단한 몬스터일수록 같은 공격이 덜 들어간다', () => {
    const soft = facing('slime');
    const hard = facing('golem', 'mine');
    soft.world.player.level = 30;
    hard.world.player.level = 30;

    // 도중에 죽으면 그 뒤 공격이 무시되어 비교가 망가집니다. 죽지 않게 체력을 크게 잡습니다
    soft.monster.maxHp = 1e9;
    hard.monster.maxHp = 1e9;

    let softDamage = 0;
    let hardDamage = 0;
    for (let i = 0; i < 60; i++) {
      soft.monster.hp = 1e9;
      strikeMonster(soft.world, soft.monster, 1);
      softDamage += 1e9 - soft.monster.hp;

      hard.monster.hp = 1e9;
      strikeMonster(hard.world, hard.monster, 1);
      hardDamage += 1e9 - hard.monster.hp;
    }
    expect(monsterDef('golem').ac).toBeLessThan(monsterDef('slime').ac);
    expect(hardDamage).toBeLessThan(softDamage);
  });

  it('흡혈 반지를 끼면 때리면서 체력이 찬다', () => {
    const { world, monster } = facing('golem', 'mine');
    world.player.level = 25;
    addItem(world, 'ring-blood', 1);
    equip(world, world.player.inventory.find((s) => s.defId === 'ring-blood')!.uid);

    const stats = derive(world.player);
    world.player.hp = stats.maxHp * 0.5;
    const before = world.player.hp;

    for (let i = 0; i < 10; i++) {
      monster.hp = monster.maxHp; // 안 죽게 붙잡아 둡니다
      strikeMonster(world, monster, 1);
    }
    expect(world.player.hp).toBeGreaterThan(before);
  });
});

describe('죽였을 때', () => {
  it('경험치와 골드가 들어오고, 시체는 부활 시계를 단다', () => {
    const { world, monster } = facing('slime');
    const def = monsterDef('slime');
    const goldBefore = world.player.gold;

    killIt(world, monster);

    expect(monster.state).toBe('dead');
    expect(monster.respawnIn).toBeCloseTo(def.respawn, 5);
    expect(world.player.exp).toBeGreaterThan(0);
    expect(world.player.gold).toBeGreaterThanOrEqual(goldBefore);
    expect(world.player.kills.slime).toBe(1);
  });

  it('나보다 한참 약한 몬스터는 경험치를 거의 안 준다', () => {
    const low = facing('slime');
    const fair = facing('slime');
    low.world.player.level = 30;

    killIt(low.world, low.monster);
    killIt(fair.world, fair.monster);

    expect(low.world.player.exp).toBeLessThan(fair.world.player.exp);
    expect(expPenalty(30, monsterDef('slime').level)).toBeLessThan(0.2);
  });

  it('보스를 잡으면 부활 시각이 기록된다', () => {
    const { world, monster } = facing('goblin-chief', 'canyon');
    world.player.level = 40;

    killIt(world, monster);

    expect(monster.state).toBe('dead');
    expect(world.bossRespawnAt['goblin-chief']).toBeGreaterThan(world.time);
  });

  it('노리던 대상이 죽으면 조준이 풀린다', () => {
    const { world, monster } = facing('slime');
    world.player.targetId = monster.id;

    killIt(world, monster);

    expect(world.player.targetId).toBeNull();
    expect(currentTarget(world)).toBeNull();
  });

  it('시간이 지나면 제자리에서 되살아난다', () => {
    const { world, monster } = facing('slime');
    const def = monsterDef('slime');
    killIt(world, monster);
    monster.pos = { x: 0, y: 0 };

    tickRespawn(world, monster, def.respawn + 1);

    expect(monster.state).toBe('idle');
    expect(monster.hp).toBe(def.hp);
    expect(monster.pos).toEqual(monster.home);
  });
});

describe('광역기', () => {
  it('범위 안의 몬스터만 맞는다', () => {
    const world = createWorld('시험', 'wizard');
    world.seed = 31337;
    world.player.level = 30;
    enterMap(world, 'field', 4, 18);

    const near = world.monsters[0]!;
    const far = world.monsters[1]!;
    near.pos = { x: world.player.pos.x + 30, y: world.player.pos.y };
    far.pos = { x: world.player.pos.x + 600, y: world.player.pos.y };
    const nearBefore = near.hp;
    const farBefore = far.hp;

    strikeArea(world, 120, 2, '#fff');

    expect(near.hp).toBeLessThan(nearBefore);
    expect(far.hp).toBe(farBefore);
  });
});

describe('몬스터가 나를 때릴 때', () => {
  it('체력이 줄고, 0 이 되면 죽는다', () => {
    const { world, monster } = facing('wolf');
    world.player.hp = 5;

    for (let i = 0; i < 10 && !world.player.dead; i++) monsterStrike(world, monster);

    expect(world.player.dead).toBe(true);
    expect(world.player.hp).toBeLessThanOrEqual(0);
  });

  it('방어구를 갖춰 입으면 덜 아프다', () => {
    const bare = facing('wolf');
    const armored = facing('wolf');
    armored.world.player.level = 25;
    addItem(armored.world, 'armor-plate', 1);
    equip(armored.world, armored.world.player.inventory.find((s) => s.defId === 'armor-plate')!.uid);
    bare.world.player.level = 25;

    let bareTaken = 0;
    let armoredTaken = 0;
    for (let i = 0; i < 60; i++) {
      const b = bare.world.player.hp;
      monsterStrike(bare.world, bare.monster);
      bareTaken += b - bare.world.player.hp;
      bare.world.player.hp = derive(bare.world.player).maxHp;

      const a = armored.world.player.hp;
      monsterStrike(armored.world, armored.monster);
      armoredTaken += a - armored.world.player.hp;
      armored.world.player.hp = derive(armored.world.player).maxHp;
    }
    expect(armoredTaken).toBeLessThan(bareTaken);
  });
});

describe('대상 고르기', () => {
  it('가장 가까운 몬스터를 찾고, 보스는 건너뛸 수 있다', () => {
    const world = createWorld('시험', 'knight');
    world.seed = 5;
    enterMap(world, 'canyon', 4, 19);

    const boss = world.monsters.find((m) => m.defId === 'goblin-chief')!;
    boss.pos = { x: world.player.pos.x + 10, y: world.player.pos.y };

    expect(nearestMonster(world, 5000)!.id).toBe(boss.id);
    expect(nearestMonster(world, 5000, true)!.id).not.toBe(boss.id);
    expect(distanceTo(world, boss)).toBeCloseTo(10, 5);
  });

  it('죽은 몬스터는 고르지 않는다', () => {
    const { world, monster } = facing('slime');
    killIt(world, monster);

    const found = nearestMonster(world, 5000);
    expect(found?.id).not.toBe(monster.id);
  });
});
