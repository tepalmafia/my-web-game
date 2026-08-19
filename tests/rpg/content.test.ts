/**
 *  자료 검사 — 표에 오타가 없는지 봅니다.
 *
 *  이 게임의 아이템·몬스터·지역은 전부 사람이 손으로 적은 표입니다.
 *  'scroll-enhace' 처럼 한 글자만 틀려도 그 몬스터를 잡는 순간 게임이 멈춥니다.
 *  화면에서는 그 몬스터를 만나야만 알 수 있으니, 여기서 미리 전부 훑습니다.
 */

import { describe, expect, it } from 'vitest';

import { MAX_LEVEL } from '../../src/rpg/balance';
import { CLASSES, CLASS_ORDER } from '../../src/rpg/content/classes';
import { GRADE_COLOR, GRADE_LABEL, ITEMS, SHOP_STOCK } from '../../src/rpg/content/items';
import { MAPS, MAP_LEVEL, MAP_ORDER } from '../../src/rpg/content/maps';
import { MONSTERS } from '../../src/rpg/content/monsters';
import { QUESTS } from '../../src/rpg/content/quests';
import { SKILLS, skillsOf } from '../../src/rpg/content/skills';
import { buildMap, tileBlocked } from '../../src/rpg/core/world';

describe('아이템 표', () => {
  it('id 와 표의 열쇠가 같다', () => {
    for (const [key, def] of Object.entries(ITEMS)) {
      expect(def.id).toBe(key);
    }
  });

  it('장비에는 칸과 필요 레벨이 있고, 무기에는 계열과 피해가 있다', () => {
    for (const def of Object.values(ITEMS)) {
      if (def.kind === 'potion' || def.kind === 'scroll' || def.kind === 'misc') continue;

      expect(def.slot, `${def.id} 에 착용 칸이 없습니다`).toBe(def.kind);
      expect(def.reqLevel, `${def.id} 에 필요 레벨이 없습니다`).toBeGreaterThan(0);
      expect(def.reqLevel!).toBeLessThanOrEqual(MAX_LEVEL);

      if (def.slot === 'weapon') {
        expect(def.family, `${def.id} 에 무기 계열이 없습니다`).toBeTruthy();
        expect(def.maxDamage!).toBeGreaterThan(def.minDamage!);
      }
    }
  });

  it('되파는 값이 사는 값보다 싸다 — 아니면 무한히 돈을 찍을 수 있다', () => {
    for (const def of Object.values(ITEMS)) {
      if (def.price <= 0) continue;
      expect(def.sell, `${def.id} 을(를) 사서 되팔면 이득입니다`).toBeLessThan(def.price);
    }
  });

  it('상점 목록이 전부 실재하고 값이 매겨져 있다', () => {
    for (const id of SHOP_STOCK) {
      expect(ITEMS[id], `상점에 없는 아이템 ${id}`).toBeDefined();
      expect(ITEMS[id]!.price).toBeGreaterThan(0);
    }
    expect(new Set(SHOP_STOCK).size, '상점에 같은 물건이 두 번 있습니다').toBe(SHOP_STOCK.length);
  });

  it('직업마다 1레벨에 살 수 있는 무기가 있다', () => {
    for (const classId of CLASS_ORDER) {
      const family = CLASSES[classId].weaponFamily;
      const starter = SHOP_STOCK.map((id) => ITEMS[id]!).filter(
        (def) => def.family === family && (def.reqLevel ?? 1) <= 1 && def.price > 0,
      );
      expect(starter.length, `${CLASSES[classId].name}가 처음 살 무기가 없습니다`).toBeGreaterThan(0);
    }
  });

  it('등급마다 색과 이름이 있다', () => {
    for (const def of Object.values(ITEMS)) {
      expect(GRADE_COLOR[def.grade], `${def.grade} 색 없음`).toBeTruthy();
      expect(GRADE_LABEL[def.grade], `${def.grade} 이름 없음`).toBeTruthy();
    }
  });
});

describe('몬스터 표', () => {
  it('전리품이 전부 실재하는 아이템이다', () => {
    for (const monster of Object.values(MONSTERS)) {
      for (const drop of monster.drops) {
        expect(ITEMS[drop.defId], `${monster.id} 의 전리품 ${drop.defId} 가 없습니다`).toBeDefined();
        expect(drop.chance).toBeGreaterThan(0);
        expect(drop.chance).toBeLessThanOrEqual(1);
        if (drop.min !== undefined) expect(drop.max!).toBeGreaterThanOrEqual(drop.min);
      }
    }
  });

  it('숫자가 말이 된다 (체력·경험치·골드·사거리)', () => {
    for (const monster of Object.values(MONSTERS)) {
      expect(monster.hp, `${monster.id}`).toBeGreaterThan(0);
      expect(monster.exp, `${monster.id}`).toBeGreaterThan(0);
      expect(monster.maxDamage, `${monster.id}`).toBeGreaterThanOrEqual(monster.minDamage);
      expect(monster.goldMax, `${monster.id}`).toBeGreaterThanOrEqual(monster.goldMin);
      expect(monster.attackRange, `${monster.id}`).toBeGreaterThan(0);
      expect(monster.respawn, `${monster.id}`).toBeGreaterThan(0);
      // 원거리라고 적었으면 실제로 멀리서 때려야 합니다
      if (monster.ranged) expect(monster.attackRange, `${monster.id}`).toBeGreaterThan(100);
    }
  });

  it('보스는 잡몹보다 세고 오래 기다려야 한다', () => {
    for (const monster of Object.values(MONSTERS)) {
      if (!monster.boss) continue;
      expect(monster.hp, `${monster.id}`).toBeGreaterThan(1000);
      expect(monster.respawn, `${monster.id}`).toBeGreaterThanOrEqual(60);
      expect(monster.drops.length, `${monster.id} 에게 전리품이 없습니다`).toBeGreaterThan(0);
    }
  });
});

describe('지역 표', () => {
  it('배치되는 몬스터가 전부 실재한다', () => {
    for (const map of Object.values(MAPS)) {
      for (const spawn of map.spawns) {
        expect(MONSTERS[spawn.monsterId], `${map.id} 의 ${spawn.monsterId} 가 없습니다`).toBeDefined();
        expect(spawn.count).toBeGreaterThan(0);
      }
    }
  });

  it('문이 실재하는 지역의 걸어갈 수 있는 자리로 이어진다', () => {
    for (const map of Object.values(MAPS)) {
      for (const portal of map.portals) {
        const target = MAPS[portal.to];
        expect(target, `${map.id} 의 문이 없는 지역 ${portal.to} 로 갑니다`).toBeDefined();

        // 도착 지점이 벽 속이면 그대로 갇힙니다
        const built = buildMap(target!);
        expect(
          tileBlocked(built, portal.toTx, portal.toTy),
          `${map.id} → ${portal.to} 도착 지점 (${portal.toTx}, ${portal.toTy}) 이 막혀 있습니다`,
        ).toBe(false);
      }
    }
  });

  it('마을은 안전지대이고 몬스터가 없다', () => {
    expect(MAPS.town!.safe).toBe(true);
    expect(MAPS.town!.spawns).toHaveLength(0);
    expect(MAPS.town!.npcs.length).toBeGreaterThan(0);
  });

  it('순간이동 목록과 권장 레벨이 지역 수와 맞는다', () => {
    expect(MAP_ORDER.length).toBe(Object.keys(MAPS).length);
    for (const id of MAP_ORDER) {
      expect(MAPS[id], `${id} 지역이 없습니다`).toBeDefined();
      expect(MAP_LEVEL[id], `${id} 권장 레벨이 없습니다`).toBeGreaterThan(0);
    }
  });
});

describe('의뢰 표', () => {
  it('잡으라는 몬스터와 보상 아이템이 전부 실재한다', () => {
    for (const quest of QUESTS) {
      expect(MONSTERS[quest.monsterId], `${quest.id} 의 ${quest.monsterId} 가 없습니다`).toBeDefined();
      expect(quest.count).toBeGreaterThan(0);
      for (const reward of quest.rewardItems) {
        expect(ITEMS[reward.defId], `${quest.id} 의 보상 ${reward.defId} 가 없습니다`).toBeDefined();
        expect(reward.count).toBeGreaterThan(0);
      }
    }
  });

  it('뒤로 갈수록 어려운 몬스터를 시킨다', () => {
    const levels = QUESTS.map((quest) => MONSTERS[quest.monsterId]!.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!, `${QUESTS[i]!.id} 가 앞 의뢰보다 쉬운 몬스터입니다`).toBeGreaterThanOrEqual(levels[i - 1]!);
    }
  });

  it('의뢰 번호가 겹치지 않는다', () => {
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
  });
});

describe('스킬 표', () => {
  it('직업마다 세 개씩, 열리는 레벨이 순서대로다', () => {
    for (const classId of CLASS_ORDER) {
      const skills = skillsOf(classId);
      expect(skills.length, `${CLASSES[classId].name}의 스킬 수`).toBe(3);
      for (let i = 1; i < skills.length; i++) {
        expect(skills[i]!.reqLevel).toBeGreaterThan(skills[i - 1]!.reqLevel);
      }
      expect(skills[0]!.reqLevel, '첫 스킬은 처음부터 쓸 수 있어야 합니다').toBe(1);
    }
  });

  it('마나와 재사용 시간이 있고, 종류에 맞는 값이 채워져 있다', () => {
    for (const skill of SKILLS) {
      expect(skill.mpCost, skill.id).toBeGreaterThan(0);
      expect(skill.cooldown, skill.id).toBeGreaterThan(0);
      if (skill.kind === 'aoe') expect(skill.radius, `${skill.id} 에 범위가 없습니다`).toBeGreaterThan(0);
      if (skill.kind === 'heal') expect(skill.healRatio, `${skill.id} 에 회복량이 없습니다`).toBeGreaterThan(0);
      if (skill.kind === 'buff') {
        expect(skill.duration, `${skill.id} 에 지속 시간이 없습니다`).toBeGreaterThan(0);
        expect(skill.buff, `${skill.id} 에 효과가 없습니다`).toBeTruthy();
      }
      if (skill.kind === 'multi') expect(skill.hits!, `${skill.id}`).toBeGreaterThan(1);
    }
  });
});
