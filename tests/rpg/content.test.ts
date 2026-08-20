/**
 *  자료 검사 — 표에 오타가 없는지.
 *
 *  아이템·몬스터·광맥·제작법은 사람이 손으로 적은 표입니다.
 *  한 글자만 틀려도 그 물건을 만들거나 캐는 순간 게임이 멈춥니다.
 */

import { describe, expect, it } from 'vitest';

import { MAX_SKILL, STATS, gainChance } from '../../src/rpg/balance';
import { ITEMS, SHOP_STOCK, itemDef } from '../../src/rpg/content/items';
import { MAPS } from '../../src/rpg/content/maps';
import { MONSTERS } from '../../src/rpg/content/monsters';
import { RECIPES } from '../../src/rpg/content/recipes';
import { SKILLS, SKILL_ORDER } from '../../src/rpg/content/skills';
import { VEINS } from '../../src/rpg/content/veins';
import { TEMPLATES, createWorld } from '../../src/rpg/core/create';
import { derive } from '../../src/rpg/core/stats';
import { buildMap, tileBlocked } from '../../src/rpg/core/world';

describe('아이템', () => {
  it('id 와 표의 열쇠가 같다', () => {
    for (const [key, def] of Object.entries(ITEMS)) expect(def.id).toBe(key);
  });

  it('모든 물건에 무게가 있다 — 무게가 이 게임의 핵심 제약입니다', () => {
    for (const def of Object.values(ITEMS)) {
      expect(def.weight, `${def.id} 에 무게가 없습니다`).toBeGreaterThan(0);
    }
  });

  it('장비에는 칸이 있고, 무기에는 피해와 속도가 있다', () => {
    for (const def of Object.values(ITEMS)) {
      if (def.kind === 'weapon' || def.kind === 'armor' || def.kind === 'helmet') {
        expect(def.slot, `${def.id} 에 착용 칸이 없습니다`).toBe(def.kind);
        expect(def.durability, `${def.id} 에 내구도가 없습니다`).toBeGreaterThan(0);
      }
      if (def.kind === 'weapon') {
        expect(def.maxDamage!).toBeGreaterThan(def.minDamage!);
        expect(def.swing!).toBeGreaterThan(0);
      }
      if (def.kind === 'tool') expect(def.tool).toBeTruthy();
    }
  });

  it('되파는 값이 사는 값보다 싸다 — 아니면 무한히 돈을 찍을 수 있다', () => {
    for (const def of Object.values(ITEMS)) {
      if (def.price <= 0) continue;
      expect(def.sell, `${def.id} 을(를) 사서 되팔면 이득입니다`).toBeLessThan(def.price);
    }
  });

  it('상점은 연장·물약·첫 장비만 판다 — 만든 무기를 팔면 대장장이가 필요 없어집니다', () => {
    for (const id of SHOP_STOCK) {
      const def = ITEMS[id];
      expect(def, `상점에 없는 물건 ${id}`).toBeDefined();
      expect(def!.price).toBeGreaterThan(0);
    }
    const soldWeapons = SHOP_STOCK.filter((id) => ITEMS[id]!.kind === 'weapon');
    expect(soldWeapons, '상점이 무기를 여러 자루 팝니다').toEqual(['rusty-sword']);

    // 제작으로만 나오는 물건은 상점에 없어야 합니다
    for (const recipe of Object.values(RECIPES)) {
      expect(SHOP_STOCK, `${recipe.makes} 를 상점에서도 팝니다`).not.toContain(recipe.makes);
    }
  });
});

describe('광맥과 제작법', () => {
  it('광맥이 내놓는 광석이 실재한다', () => {
    for (const vein of Object.values(VEINS)) {
      expect(ITEMS[vein.yields], `${vein.id} 의 산출물이 없습니다`).toBeDefined();
      expect(vein.amountMax).toBeGreaterThanOrEqual(vein.amountMin);
      expect(vein.capacity).toBeGreaterThan(0);
    }
  });

  it('제작법의 재료와 결과가 실재한다', () => {
    for (const recipe of Object.values(RECIPES)) {
      expect(ITEMS[recipe.makes], `${recipe.id} 의 결과물이 없습니다`).toBeDefined();
      for (const need of recipe.needs) {
        expect(ITEMS[need.defId], `${recipe.id} 의 재료 ${need.defId} 가 없습니다`).toBeDefined();
        expect(need.count).toBeGreaterThan(0);
      }
      expect(recipe.seconds).toBeGreaterThan(0);
    }
  });

  it('난이도 사다리가 100 까지 이어진다 — 중간에 끊기면 그 스킬은 거기서 멈춥니다', () => {
    const veinLadder = Object.values(VEINS).map((v) => v.difficulty).sort((a, b) => a - b);
    const recipeLadder = Object.values(RECIPES).map((r) => r.difficulty).sort((a, b) => a - b);

    for (const ladder of [veinLadder, recipeLadder]) {
      let skill = 0;
      // 지금 실력에서 배울 수 있는 가장 어려운 것을 계속 고른다고 가정합니다
      for (let guard = 0; guard < 200 && skill < MAX_SKILL; guard++) {
        const best = ladder.filter((d) => gainChance(skill, d) > 0).pop();
        if (best === undefined) break;
        skill = Math.min(MAX_SKILL, best + 20);
      }
      expect(skill, `난이도 ${ladder.join('·')} 로는 100 에 닿지 못합니다`).toBeGreaterThanOrEqual(MAX_SKILL);
    }
  });
});

describe('몬스터', () => {
  it('숫자가 말이 된다', () => {
    for (const m of Object.values(MONSTERS)) {
      expect(m.hp).toBeGreaterThan(0);
      expect(m.difficulty).toBeGreaterThan(0);
      expect(m.maxDamage).toBeGreaterThanOrEqual(m.minDamage);
      expect(m.goldMax).toBeGreaterThanOrEqual(m.goldMin);
      expect(m.respawn).toBeGreaterThan(0);
      for (const drop of m.drops) {
        expect(ITEMS[drop.defId], `${m.id} 의 전리품 ${drop.defId} 가 없습니다`).toBeDefined();
      }
    }
  });

  it('레벨 개념이 남아 있지 않다', () => {
    for (const m of Object.values(MONSTERS)) {
      expect((m as unknown as { level?: number }).level).toBeUndefined();
      expect((m as unknown as { exp?: number }).exp).toBeUndefined();
    }
  });
});

describe('지역', () => {
  it('배치되는 몬스터와 광맥이 실재한다', () => {
    for (const map of Object.values(MAPS)) {
      for (const spawn of map.spawns) {
        expect(MONSTERS[spawn.monsterId], `${map.id} 의 ${spawn.monsterId}`).toBeDefined();
      }
      for (const patch of map.veins) {
        expect(VEINS[patch.veinId], `${map.id} 의 ${patch.veinId}`).toBeDefined();
      }
    }
  });

  it('문이 실재하는 지역의 걸어갈 수 있는 자리로 이어진다', () => {
    for (const map of Object.values(MAPS)) {
      for (const portal of map.portals) {
        // 조건이 걸린 문은 아직 갈 곳이 없어도 됩니다 (tests/rpg/maps.test.ts 가 따로 지킵니다)
        if (portal.needs) continue;
        const target = MAPS[portal.to];
        expect(target, `${map.id} 의 문이 없는 지역 ${portal.to} 로 갑니다`).toBeDefined();
        expect(
          tileBlocked(buildMap(target!), portal.toTx, portal.toTy),
          `${map.id} → ${portal.to} 도착 지점이 막혀 있습니다`,
        ).toBe(false);
      }
    }
  });

  it('마을은 안전하고 화로가 있다', () => {
    expect(MAPS.town!.safe).toBe(true);
    expect(MAPS.town!.spawns).toHaveLength(0);
    expect(MAPS.town!.forge, '마을에 화로가 없습니다').toBeDefined();
  });

  it('문 앞에 권장 레벨이 없다 — 위험은 장소에서 옵니다', () => {
    for (const map of Object.values(MAPS)) {
      for (const portal of map.portals) {
        expect((portal as unknown as { recommendLevel?: number }).recommendLevel).toBeUndefined();
      }
    }
  });
});

describe('스킬과 시작 템플릿', () => {
  it('스킬은 넷뿐이고 모두 설명이 있다', () => {
    expect(SKILL_ORDER).toHaveLength(4);
    for (const id of SKILL_ORDER) {
      expect(SKILLS[id].name).toBeTruthy();
      expect(SKILLS[id].stats.length).toBeGreaterThan(0);
    }
  });

  it('시작 템플릿은 스킬 몇 점과 첫 장비만 준다', () => {
    for (const template of TEMPLATES) {
      const total = Object.values(template.skills).reduce((a, b) => a + b, 0);
      expect(total, `${template.id} 가 너무 많이 줍니다`).toBeLessThanOrEqual(45);
      for (const defId of [...template.items, ...template.equip]) {
        expect(ITEMS[defId], `${template.id} 의 ${defId} 가 없습니다`).toBeDefined();
      }
    }
  });

  it('시작 능력치 합이 상한보다 한참 낮다 — 자랄 여지가 있어야 합니다', () => {
    expect(STATS.start * 3).toBeLessThan(STATS.totalMax * 0.5);
  });
});

/* ===========================================================================
 *  밸런스가 무너지면 바로 표가 나는 자리들
 *  (전부 봇을 몇 시간씩 돌려보다 발견한 것들입니다)
 * ======================================================================== */

describe('짐의 무게', () => {
  it('광석은 무겁고 주괴는 가볍다', () => {
    // 이 대비가 '캘 때는 무겁고 녹이면 가벼워진다'는 순환을 만듭니다
    expect(itemDef('iron-ore').weight).toBeGreaterThan(itemDef('iron-ingot').weight * 4);
    expect(itemDef('copper-ore').weight).toBeGreaterThan(itemDef('copper-ingot').weight * 4);
  });

  it('시작 장비를 다 걸치고도 광석을 여러 덩이 질 수 있다', () => {
    // ★ 예전에 검 한 자루가 40 스톤이던 시절, 광부는 한 번에 광석 두 덩이밖에
    //   못 지고 왔습니다. 왕복만 하다 한 시간이 갔습니다.
    for (const template of TEMPLATES) {
      const world = createWorld('시험', template.id);
      const stats = derive(world.me);
      const room = stats.carry * 0.88 - stats.load;
      const ore = Math.floor(room / itemDef('iron-ore').weight);
      expect(ore, `${template.name}: 한 번에 광석 ${ore}덩이`).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('몬스터', () => {
  it('한 마리 잡는 사이에 다음 한 마리가 돌아오지는 않는다', () => {
    // ★ 되살아나는 시간이 13초이던 시절, 광맥 옆에서 곡괭이를 들 틈이 없었습니다
    for (const def of Object.values(MONSTERS)) {
      expect(def.respawn, `${def.name}`).toBeGreaterThanOrEqual(40);
    }
  });
});
