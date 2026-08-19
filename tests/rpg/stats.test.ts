/**
 *  능력치 계산.
 *
 *  화면에 뜨는 공격력·AC 는 전부 여기서 나옵니다.
 *  이 값이 틀리면 밸런스를 아무리 만져도 소용이 없습니다.
 */

import { describe, expect, it } from 'vitest';

import { COMBAT, ENHANCE_BONUS } from '../../src/rpg/balance';
import { CLASSES } from '../../src/rpg/content/classes';
import { itemDef } from '../../src/rpg/content/items';
import { createWorld } from '../../src/rpg/core/create';
import { addItem, equip, findStack, unequip } from '../../src/rpg/core/inventory';
import { armorAc, derive, equipProblem, itemName, mitigation, weaponDamage } from '../../src/rpg/core/stats';
import type { ItemStack, World } from '../../src/rpg/types';

/** 가방에 넣자마자 그 실물을 돌려줍니다 */
function give(world: World, defId: string, plus = 0): ItemStack {
  addItem(world, defId, 1, plus);
  const stack = world.player.inventory.find((s) => s.defId === defId && s.plus === plus);
  if (!stack) throw new Error(`${defId} 를 넣지 못했습니다`);
  return stack;
}

describe('맨몸 능력치', () => {
  it('레벨이 오르면 체력과 공격력이 직업 성장치만큼 오른다', () => {
    const world = createWorld('시험', 'knight');
    unequip(world, 'weapon');
    unequip(world, 'armor');

    const first = derive(world.player);
    world.player.level = 11;
    const later = derive(world.player);
    const cls = CLASSES.knight;

    expect(later.maxHp - first.maxHp).toBe(cls.hpPerLevel * 10);
    expect(later.minDamage - first.minDamage).toBeCloseTo(cls.damagePerLevel * 10, 5);
  });
});

describe('강화 수치가 장비에 주는 효과', () => {
  it('무기는 +1 마다 피해가 9% 늘고 고정값도 붙는다', () => {
    const def = itemDef('sword-long');
    const plain = weaponDamage(def, 0);
    const plus5 = weaponDamage(def, 5);

    const expected = (def.minDamage! + ENHANCE_BONUS.weaponFlat * 5) * (1 + ENHANCE_BONUS.weaponDamageMul * 5);
    expect(plus5.min).toBeCloseTo(expected, 5);
    expect(plus5.min).toBeGreaterThan(plain.min);
  });

  it('방어구는 +1 마다 AC 가 1 내려간다 (낮을수록 좋다)', () => {
    const def = itemDef('armor-leather');
    expect(armorAc(def, 0)).toBe(def.ac);
    expect(armorAc(def, 4)).toBe(def.ac! - 4);
  });

  it('착용하면 그 효과가 실제 능력치에 반영된다', () => {
    const world = createWorld('시험', 'knight');
    world.player.level = 25; // 판금 갑옷은 21레벨부터입니다
    // 시작 갑옷(천 갑옷)을 벗겨두지 않으면 갈아입는 차이까지 섞입니다
    unequip(world, 'armor');

    const before = derive(world.player);
    equip(world, give(world, 'armor-plate', 3).uid);
    const after = derive(world.player);

    expect(after.ac).toBe(before.ac + itemDef('armor-plate').ac! - 3);
    expect(after.maxHp).toBe(before.maxHp + itemDef('armor-plate').bonusHp!);
    expect(after.defense).toBeGreaterThan(before.defense);
  });

  it('반지의 부가 능력치가 더해진다', () => {
    const world = createWorld('시험', 'elf');
    world.player.level = 32;

    const before = derive(world.player);
    equip(world, give(world, 'ring-dragon').uid);
    const after = derive(world.player);
    const ring = itemDef('ring-dragon');

    expect(after.maxHp).toBe(before.maxHp + ring.bonusHp!);
    expect(after.minDamage).toBeCloseTo(before.minDamage + ring.bonusDamage!, 5);
    expect(after.crit).toBeCloseTo(before.crit + ring.bonusCrit!, 5);
  });
});

describe('착용 제한', () => {
  it('레벨이 모자라면 못 낀다', () => {
    const world = createWorld('시험', 'knight');
    expect(equipProblem(world.player, itemDef('sword-claymore'))).toMatch(/레벨/);
  });

  it('다른 계열의 무기는 못 든다', () => {
    const world = createWorld('시험', 'knight');
    world.player.level = 40;
    expect(equipProblem(world.player, itemDef('bow-long'))).toMatch(/들 수 없습니다/);
    expect(equipProblem(world.player, itemDef('sword-long'))).toBeNull();
  });

  it('못 끼는 장비는 착용해도 그대로 가방에 남는다', () => {
    const world = createWorld('시험', 'wizard');
    const stack = give(world, 'sword-claymore');
    equip(world, stack.uid);

    expect(findStack(world.player, stack.uid)).toBeDefined();
    expect(world.player.equipped.weapon!.defId).toBe('staff-wood');
  });

  it('방어구와 반지는 직업을 가리지 않는다', () => {
    const world = createWorld('시험', 'wizard');
    world.player.level = 34;
    expect(equipProblem(world.player, itemDef('armor-dragon'))).toBeNull();
    expect(equipProblem(world.player, itemDef('ring-dragon'))).toBeNull();
  });
});

describe('마법사의 화력은 지팡이 마력에서 나온다', () => {
  it('지팡이를 바꾸면 마법사만 공격력이 크게 뛴다', () => {
    const wizard = createWorld('마법사', 'wizard');
    const knight = createWorld('기사', 'knight');
    wizard.player.level = 20;
    knight.player.level = 20;

    const wizardBefore = derive(wizard.player).maxDamage;
    equip(wizard, give(wizard, 'staff-arch').uid);
    const wizardAfter = derive(wizard.player).maxDamage;

    const knightBefore = derive(knight.player).maxDamage;
    equip(knight, give(knight, 'sword-claymore').uid);
    const knightAfter = derive(knight.player).maxDamage;

    // 지팡이의 무기 피해(17)는 대검(47)보다 훨씬 낮지만, 마력 덕분에 화력은 뒤지지 않습니다
    expect(wizardAfter - wizardBefore).toBeGreaterThan(knightAfter - knightBefore);
  });
});

describe('버프', () => {
  it('공격 속도 버프는 때리는 간격을 줄이고, 피해 버프는 피해를 늘린다', () => {
    const world = createWorld('시험', 'knight');
    const before = derive(world.player);

    world.player.buffs.push({
      id: 'k2', name: '광폭화', until: world.time + 10, color: '#f97316',
      effects: { attackSpeedMul: 1.5, damageMul: 1.2 },
    });
    const after = derive(world.player);

    expect(after.attackInterval).toBeCloseTo(before.attackInterval / 1.5, 5);
    expect(after.maxDamage).toBeCloseTo(before.maxDamage * 1.2, 5);
  });
});

describe('방어력이 피해를 깎는 정도', () => {
  it('아무리 단단해도 상한을 넘지 않는다', () => {
    expect(mitigation(0)).toBe(0);
    expect(mitigation(10_000)).toBe(COMBAT.maxMitigation);
    expect(mitigation(34)).toBeCloseTo(0.5, 2);
  });

  it('방어력이 오를수록 감소율도 오른다', () => {
    let previous = -1;
    for (const defense of [0, 5, 20, 50, 120]) {
      const value = mitigation(defense);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });
});

describe('이름 표기', () => {
  it('강화한 장비 앞에는 + 수치가 붙는다', () => {
    const world = createWorld('시험', 'knight');
    expect(itemName(give(world, 'sword-long', 0))).toBe('롱소드');
    expect(itemName(give(world, 'sword-long', 7))).toBe('+7 롱소드');
  });
});
