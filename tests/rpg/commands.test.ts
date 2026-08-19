/**
 *  플레이어가 시키는 일 — 스킬, 물약, 순간이동, 화면 누르기.
 *
 *  "지금 쓸 수 있는가 / 얼마인가 / 왜 안 되는가"의 판단이 전부 여기 모여 있어서,
 *  화면을 거치지 않고도 그대로 확인할 수 있습니다.
 */

import { describe, expect, it } from 'vitest';

import { TILE } from '../../src/rpg/balance';
import { skillsOf } from '../../src/rpg/content/skills';
import { mapDef } from '../../src/rpg/content/maps';
import {
  clickWorld, drinkBestPotion, skillProblem, teleportCost, teleportTo, toggleAuto, useItem, useSkill,
} from '../../src/rpg/core/commands';
import { createWorld } from '../../src/rpg/core/create';
import { addItem, countOf } from '../../src/rpg/core/inventory';
import { derive } from '../../src/rpg/core/stats';
import { enterMap, tileCenter } from '../../src/rpg/core/world';
import type { World } from '../../src/rpg/types';

/** 몬스터 하나를 눈앞에 두고 조준까지 마친 판 */
function armed(classId: 'knight' | 'elf' | 'wizard' = 'knight'): World {
  const world = createWorld('시험', classId);
  world.seed = 8080;
  enterMap(world, 'field', mapDef('field').entryTx, mapDef('field').entryTy);

  const monster = world.monsters[0]!;
  monster.pos = { x: world.player.pos.x + 20, y: world.player.pos.y };
  monster.hp = monster.maxHp = 100_000; // 시험 중에 죽지 않게
  world.player.targetId = monster.id;
  return world;
}

describe('스킬', () => {
  it('마나를 쓰고 재사용 시간이 돈다', () => {
    const world = armed();
    const skill = skillsOf('knight')[0]!;
    const mpBefore = world.player.mp;

    expect(useSkill(world, 0)).toBe(true);
    expect(world.player.mp).toBe(mpBefore - skill.mpCost);
    expect(world.player.skillCooldowns[skill.id]).toBeCloseTo(skill.cooldown, 5);
  });

  it('재사용 시간이 남아 있으면 다시 못 쓴다', () => {
    const world = armed();
    useSkill(world, 0);
    const mp = world.player.mp;

    expect(useSkill(world, 0)).toBe(false);
    expect(world.player.mp, '실패했는데 마나가 나갔습니다').toBe(mp);
  });

  it('마나가 모자라면 안 나간다', () => {
    const world = armed();
    world.player.mp = 0;

    expect(skillProblem(world, skillsOf('knight')[0]!)).toBe('마나 부족');
    expect(useSkill(world, 0)).toBe(false);
  });

  it('레벨이 모자라면 잠겨 있다', () => {
    const world = armed();
    const late = skillsOf('knight')[2]!;

    expect(skillProblem(world, late)).toMatch(/레벨/);
    expect(useSkill(world, 2)).toBe(false);
  });

  it('대상이 없으면 단일 대상 스킬은 못 쓴다', () => {
    const world = armed();
    world.player.targetId = null;

    expect(skillProblem(world, skillsOf('knight')[0]!)).toBe('대상 없음');
  });

  it('너무 멀면 못 쓴다', () => {
    const world = armed();
    const monster = world.monsters.find((m) => m.id === world.player.targetId)!;
    monster.pos = { x: world.player.pos.x + 900, y: world.player.pos.y };

    expect(skillProblem(world, skillsOf('knight')[0]!)).toBe('너무 멉니다');
  });

  it('버프 스킬은 대상 없이도 걸리고, 능력치가 실제로 바뀐다', () => {
    const world = armed();
    world.player.level = 12;
    world.player.targetId = null;
    world.player.mp = 999;

    const before = derive(world.player).attackInterval;
    expect(useSkill(world, 1)).toBe(true);
    expect(world.player.buffs).toHaveLength(1);
    expect(derive(world.player).attackInterval).toBeLessThan(before);
  });

  it('회복 스킬은 체력을 채운다', () => {
    const world = armed('wizard');
    world.player.level = 12;
    world.player.mp = 999;
    world.player.hp = 10;

    expect(useSkill(world, 1)).toBe(true);
    expect(world.player.hp).toBeGreaterThan(10);
  });

  it('없는 번호를 누르면 조용히 아무 일도 없다', () => {
    const world = armed();
    expect(useSkill(world, 9)).toBe(false);
  });
});

describe('물약', () => {
  it('덜 남기는 쪽을 골라 마신다', () => {
    const world = createWorld('시험', 'knight');
    addItem(world, 'pot-hp-l', 5); // 750 회복 — 지금 상처에는 너무 큽니다
    const stats = derive(world.player);
    world.player.hp = stats.maxHp - 100;

    expect(drinkBestPotion(world, 'hp')).toBe(true);
    expect(countOf(world.player, 'pot-hp-l'), '큰 물약을 낭비했습니다').toBe(5);
    expect(countOf(world.player, 'pot-hp-s')).toBe(9);
  });

  it('가득 차 있으면 마시지 않는다', () => {
    const world = createWorld('시험', 'knight');
    expect(drinkBestPotion(world, 'hp')).toBe(false);
    expect(countOf(world.player, 'pot-hp-s')).toBe(10);
  });

  it('연달아 들이켤 수 없다', () => {
    const world = createWorld('시험', 'knight');
    world.player.hp = 1;

    expect(drinkBestPotion(world, 'hp')).toBe(true);
    expect(drinkBestPotion(world, 'hp'), '쿨타임을 무시했습니다').toBe(false);
  });
});

describe('주문서', () => {
  it('귀환 주문서는 마을로 보내고 한 장 없어진다', () => {
    const world = createWorld('시험', 'knight');
    enterMap(world, 'field', 4, 18);
    const scroll = world.player.inventory.find((s) => s.defId === 'scroll-return')!;

    expect(useItem(world, scroll.uid)).toBe(true);
    expect(world.mapId).toBe('town');
    expect(countOf(world.player, 'scroll-return')).toBe(1);
  });

  it('마을에서는 귀환 주문서를 낭비하지 않는다', () => {
    const world = createWorld('시험', 'knight');
    const scroll = world.player.inventory.find((s) => s.defId === 'scroll-return')!;

    expect(useItem(world, scroll.uid)).toBe(false);
    expect(countOf(world.player, 'scroll-return')).toBe(2);
  });

  it('되찾을 경험치가 없으면 부활 주문서는 쓰이지 않는다', () => {
    const world = createWorld('시험', 'knight');
    addItem(world, 'scroll-resurrect', 1);
    const scroll = world.player.inventory.find((s) => s.defId === 'scroll-resurrect')!;

    expect(useItem(world, scroll.uid)).toBe(false);
    expect(countOf(world.player, 'scroll-resurrect')).toBe(1);
  });
});

describe('순간이동', () => {
  it('가본 적 없는 곳에는 못 간다', () => {
    const world = createWorld('시험', 'knight');
    world.player.gold = 999_999;

    teleportTo(world, 'nest');
    expect(world.mapId).toBe('town');
  });

  it('골드가 모자라면 못 간다', () => {
    const world = createWorld('시험', 'knight');
    enterMap(world, 'field', 4, 18);
    enterMap(world, 'town', 15, 13);
    world.player.gold = 0;

    teleportTo(world, 'field');
    expect(world.mapId).toBe('town');
  });

  it('요금을 내면 간다 — 먼 곳일수록 비싸다', () => {
    const world = createWorld('시험', 'knight');
    enterMap(world, 'field', 4, 18);
    enterMap(world, 'canyon', 4, 19);
    enterMap(world, 'town', 15, 13);
    world.player.gold = 100_000;

    expect(teleportCost(world, 'canyon')).toBeGreaterThan(teleportCost(world, 'field'));

    const cost = teleportCost(world, 'canyon');
    teleportTo(world, 'canyon');

    expect(world.mapId).toBe('canyon');
    expect(world.player.gold).toBe(100_000 - cost);
  });
});

describe('화면 누르기', () => {
  it('몬스터를 누르면 그 몬스터를 노린다', () => {
    const world = createWorld('시험', 'knight');
    enterMap(world, 'field', 4, 18);
    const monster = world.monsters[0]!;

    clickWorld(world, monster.pos.x, monster.pos.y);

    expect(world.player.targetId).toBe(monster.id);
    expect(world.player.moveTarget).toBeNull();
  });

  it('빈 땅을 누르면 그리로 걸어간다', () => {
    const world = createWorld('시험', 'knight');
    enterMap(world, 'field', 4, 18);
    world.player.targetId = 12;

    const spot = { x: world.player.pos.x + TILE * 2, y: world.player.pos.y };
    clickWorld(world, spot.x, spot.y);

    expect(world.player.targetId).toBeNull();
    expect(world.player.moveTarget).toEqual(spot);
  });

  it('사람을 누르면 말을 걸러 다가간다', () => {
    const world = createWorld('시험', 'knight');
    const npc = mapDef('town').npcs.find((n) => n.kind === 'shop')!;

    clickWorld(world, tileCenter(npc.tx), tileCenter(npc.ty));

    expect(world.pendingNpc).toBe('shop');
    expect(world.player.moveTarget).not.toBeNull();
  });

  it('죽어 있으면 아무 반응도 하지 않는다', () => {
    const world = createWorld('시험', 'knight');
    world.player.dead = true;

    clickWorld(world, world.player.pos.x + 100, world.player.pos.y);
    expect(world.player.moveTarget).toBeNull();
  });
});

describe('자동 사냥 켜고 끄기', () => {
  it('끄면 가던 길도 멈춘다', () => {
    const world = createWorld('시험', 'knight');
    toggleAuto(world);
    expect(world.player.auto).toBe(true);

    world.player.moveTarget = { x: 100, y: 100 };
    toggleAuto(world);

    expect(world.player.auto).toBe(false);
    expect(world.player.moveTarget).toBeNull();
  });
});
