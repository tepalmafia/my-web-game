/**
 *  전투 — 레벨이 없는 세계에서 명중은 실력 대 실력입니다.
 */

import { describe, expect, it } from 'vitest';

import { COMBAT, DURABILITY } from '../../src/rpg/balance';
import { monsterDef } from '../../src/rpg/content/monsters';
import { mapDef } from '../../src/rpg/content/maps';
import { hitChance, monsterStrike, nearestMonster, swingAtMonster, tickRespawn } from '../../src/rpg/core/combat';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { addItem, equip } from '../../src/rpg/core/inventory';
import { enterMap } from '../../src/rpg/core/world';
import type { Monster, World } from '../../src/rpg/types';

function facing(defId: string, seed = 4242): { world: World; monster: Monster } {
  const world = createWorld('시험', 'guard');
  world.seed = seed;
  enterMap(world, defId === 'cave-spider' || defId === 'cave-bat' ? 'mine' : 'forest', 5, 18);

  const monster = world.monsters.find((m) => m.defId === defId)!;
  monster.pos = { x: world.me.pos.x + 20, y: world.me.pos.y };
  return { world, monster };
}

describe('명중', () => {
  it('실력이 같으면 절반쯤 맞는다', () => {
    expect(hitChance(50, 50)).toBeCloseTo(0.5, 2);
    expect(hitChance(0, 0)).toBeCloseTo(0.5, 2);
  });

  it('실력이 높을수록 잘 맞고, 아무리 벌어져도 상한을 넘지 않는다', () => {
    expect(hitChance(100, 20)).toBeGreaterThan(hitChance(50, 20));
    expect(hitChance(100, 0)).toBeLessThanOrEqual(COMBAT.maxHit);
    expect(hitChance(0, 100)).toBeGreaterThanOrEqual(COMBAT.minHit);
  });
});

describe('때리기', () => {
  it('여러 번 때리면 체력이 준다', () => {
    const { world, monster } = facing('stray-dog');
    const before = monster.hp;
    for (let i = 0; i < 8; i++) swingAtMonster(world, monster);
    expect(monster.hp).toBeLessThan(before);
  });

  it('휘두르면 검이 닳는다 — 빗나가도 닳습니다', () => {
    const { world, monster } = facing('stray-dog');
    const sword = world.me.equipped.weapon!;
    const before = sword.durability!;

    for (let i = 0; i < DURABILITY.hitsPerLoss; i++) swingAtMonster(world, monster);
    expect(sword.durability!).toBeCloseTo(before - 1, 5);
  });

  it('검이 다 닳으면 부러져 손에서 사라진다', () => {
    const { world, monster } = facing('stray-dog');
    world.me.equipped.weapon!.durability = 0.2;

    swingAtMonster(world, monster);
    expect(world.me.equipped.weapon).toBeNull();
  });

  it('때릴 때마다 검술이 는다', () => {
    const { world, monster } = facing('wolf', 777);
    world.me.skills.swordsmanship = 10;
    const before = world.me.skills.swordsmanship;

    for (let i = 0; i < 60; i++) {
      monster.hp = monster.maxHp;
      swingAtMonster(world, monster);
    }
    expect(world.me.skills.swordsmanship).toBeGreaterThan(before);
  });

  it('만만한 상대만 잡으면 더 늘지 않는다', () => {
    const { world, monster } = facing('stray-dog');
    world.me.skills.swordsmanship = 60; // 들개 난이도 15 → 배울 것 없음
    const before = world.me.skills.swordsmanship;

    for (let i = 0; i < 300; i++) {
      monster.hp = monster.maxHp;
      swingAtMonster(world, monster);
    }
    expect(world.me.skills.swordsmanship).toBe(before);
  });

  it('맞은 몬스터는 반드시 돌아선다', () => {
    const { world, monster } = facing('stray-dog');
    monster.state = 'idle';
    monster.aggroUntil = 0;

    swingAtMonster(world, monster);
    expect(monster.aggroUntil).toBeGreaterThan(world.time);
  });
});

describe('죽였을 때', () => {
  it('골드가 들어오고 부활 시계가 돈다', () => {
    const { world, monster } = facing('stray-dog');
    const gold = world.me.gold;

    for (let i = 0; i < 60 && monster.state !== 'dead'; i++) {
      monster.hp = 1;
      swingAtMonster(world, monster);
    }
    expect(monster.state).toBe('dead');
    expect(monster.respawnIn).toBe(monsterDef('stray-dog').respawn);
    expect(world.me.gold).toBeGreaterThanOrEqual(gold);
    expect(world.me.tally['stray-dog']).toBe(1);
  });

  it('시간이 지나면 제자리에서 되살아난다', () => {
    const { world, monster } = facing('stray-dog');
    for (let i = 0; i < 60 && monster.state !== 'dead'; i++) {
      monster.hp = 1;
      swingAtMonster(world, monster);
    }
    monster.pos = { x: 0, y: 0 };
    tickRespawn(monster, monsterDef('stray-dog').respawn + 1);

    expect(monster.state).toBe('idle');
    expect(monster.pos).toEqual(monster.home);
  });
});

describe('맞을 때', () => {
  it('체력이 줄고, 방어가 는다', () => {
    const { world, monster } = facing('wolf', 31337);
    world.me.skills.defense = 5;
    const hp = world.me.hp;
    const before = world.me.skills.defense;

    for (let i = 0; i < 40; i++) monsterStrike(world, monster);

    expect(world.me.hp).toBeLessThan(hp);
    expect(world.me.skills.defense).toBeGreaterThan(before);
  });

  it('갑옷을 입으면 덜 아프고, 갑옷이 닳는다', () => {
    const bare = facing('wolf', 5150);
    const armored = facing('wolf', 5150);
    armored.world.me.str = 60;
    addItem(armored.world, 'iron-mail', 1);
    equip(armored.world, armored.world.me.backpack.find((s) => s.defId === 'iron-mail')!.uid);
    const mail = armored.world.me.equipped.armor!;
    const beforeDur = mail.durability!;

    let bareTaken = 0;
    let armoredTaken = 0;
    for (let i = 0; i < 60; i++) {
      const b = bare.world.me.hp;
      monsterStrike(bare.world, bare.monster);
      bareTaken += b - bare.world.me.hp;
      bare.world.me.hp = 9999;

      const a = armored.world.me.hp;
      monsterStrike(armored.world, armored.monster);
      armoredTaken += a - armored.world.me.hp;
      armored.world.me.hp = 9999;
    }
    expect(armoredTaken).toBeLessThan(bareTaken);
    expect(mail.durability!).toBeLessThan(beforeDur);
  });
});

describe('대상 고르기', () => {
  it('가장 가까운 것을 찾고, 죽은 것은 고르지 않는다', () => {
    const world = createWorld('시험', 'guard');
    world.seed = 9;
    enterMap(world, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);

    const near = world.monsters[0]!;
    near.pos = { x: world.me.pos.x + 10, y: world.me.pos.y };
    expect(nearestMonster(world, 5000)!.id).toBe(near.id);

    near.state = 'dead';
    expect(nearestMonster(world, 5000)?.id).not.toBe(near.id);
  });
});

describe('죽음', () => {
  it('계속 맞으면 결국 쓰러진다', () => {
    // ★ 예전에는 damagePlayer 가 체력을 0 에서 붙잡아 두고, 그 사이 자연 회복이
    //   1 이상으로 끌어올려서 죽음 판정이 영영 걸리지 않았습니다.
    //   봇 실측에서 '사망 0회'가 계속 나오던 것이 이 고장이었습니다.
    const world = createWorld('시험', 'miner');
    world.seed = 4242;
    enterMap(world, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);

    const wolf = world.monsters.find((m) => m.defId === 'wolf')!;
    wolf.pos = { x: world.me.pos.x + 20, y: world.me.pos.y };
    wolf.home = { ...wolf.pos };
    wolf.aggroUntil = 1e9;

    for (let i = 0; i < 60 * 20 && !world.me.dead; i++) step(world, 1 / 20);

    expect(world.me.dead, '한 시간을 맞아도 죽지 않습니다').toBe(true);
    expect(world.me.deaths).toBe(1);
  });

  it('쓰러진 사람은 저절로 일어나지 않는다', () => {
    const world = createWorld('시험', 'miner');
    world.me.hp = 0;
    step(world, 1 / 20);
    expect(world.me.dead).toBe(true);

    for (let i = 0; i < 200; i++) step(world, 1 / 20);
    expect(world.me.dead, '가만히 두었더니 살아났습니다').toBe(true);
    expect(world.me.hp).toBe(0);
  });
});
