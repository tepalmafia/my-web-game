/**
 *  지역과 문.
 *
 *  ★ 문은 나가는 쪽 지도에만 적혀 있습니다. 양쪽에 손으로 두 번 적어야 하고,
 *    한쪽만 적거나 없는 지역을 가리켜도 밟기 전까지는 아무도 모릅니다.
 *
 *  ★ engine 의 checkPortals 는 매 프레임 돌면서 문에서 TILE*0.7(22.4px) 안에 있으면
 *    곧바로 보냅니다. 도착한 칸이 그 지도의 어떤 문 가까이면 ★ 두 지역을 무한히 오갑니다 —
 *    플레이어가 움직일 틈이 없습니다. 그래서 도착 칸은 넉넉히 3칸을 띄웁니다.
 */

import { describe, expect, it } from 'vitest';

import { TILE } from '../../src/rpg/balance';
import { MAPS, MAP_ORDER, mapDef } from '../../src/rpg/content/maps';
import { MONSTERS } from '../../src/rpg/content/monsters';
import { VEINS } from '../../src/rpg/content/veins';
import { createWorld } from '../../src/rpg/core/create';
import { FLOOR, LIQUID, enterMap, tileCenter } from '../../src/rpg/core/world';
import { nextHop } from '../../tools/autopilot';
import type { MapDef } from '../../src/rpg/types';

/** engine/checkPortals 가 쓰는 바로 그 값 */
const PORTAL_GRAB = TILE * 0.7;
/** 도착 칸이 문에서 떨어져 있어야 하는 거리 */
const SAFE_GAP = TILE * 3;

const ALL: MapDef[] = Object.values(MAPS);

describe('문 대조', () => {
  it('문이 가리키는 지역이 실제로 있다', () => {
    for (const def of ALL) {
      for (const portal of def.portals) {
        expect(() => mapDef(portal.to), `${def.id} → ${portal.to}`).not.toThrow();
      }
    }
  });

  it('문은 양쪽에 있다 — 한쪽만 난 문은 없다', () => {
    const oneWay: string[] = [];
    for (const def of ALL) {
      for (const portal of def.portals) {
        const back = mapDef(portal.to).portals.some((p) => p.to === def.id);
        if (!back) oneWay.push(`${def.id} → ${portal.to}`);
      }
    }
    expect(oneWay, `돌아오는 문이 없습니다: ${oneWay.join(', ')}`).toEqual([]);
  });

  it('같은 지도에 같은 곳으로 가는 문이 둘 있지 않다', () => {
    for (const def of ALL) {
      const targets = def.portals.map((p) => p.to);
      expect(new Set(targets).size, `${def.id} 에 겹치는 문`).toBe(targets.length);
    }
  });

  it('문과 도착 칸이 지도 안에 있다', () => {
    for (const def of ALL) {
      for (const portal of def.portals) {
        expect(portal.tx).toBeGreaterThan(0);
        expect(portal.ty).toBeGreaterThan(0);
        expect(portal.tx).toBeLessThan(def.width - 1);
        expect(portal.ty).toBeLessThan(def.height - 1);

        const target = mapDef(portal.to);
        expect(portal.toTx, `${def.id} → ${portal.to} 도착 칸`).toBeGreaterThan(0);
        expect(portal.toTy).toBeGreaterThan(0);
        expect(portal.toTx).toBeLessThan(target.width - 1);
        expect(portal.toTy).toBeLessThan(target.height - 1);
      }
    }
  });
});

describe('★ 무한 왕복이 생길 수 없다', () => {
  it('도착 칸은 그 지도의 모든 문에서 3칸 넘게 떨어져 있다', () => {
    const tooClose: string[] = [];
    for (const def of ALL) {
      for (const portal of def.portals) {
        const target = mapDef(portal.to);
        for (const other of target.portals) {
          const distance = Math.hypot(
            tileCenter(portal.toTx) - tileCenter(other.tx),
            tileCenter(portal.toTy) - tileCenter(other.ty),
          );
          if (distance < SAFE_GAP) {
            tooClose.push(
              `${def.id} → ${portal.to} 도착(${portal.toTx},${portal.toTy}) 이 ` +
                `${portal.to} 의 문(${other.tx},${other.ty}) 에서 ${Math.round(distance)}px`,
            );
          }
        }
      }
    }
    expect(tooClose, tooClose.join(' / ')).toEqual([]);
  });

  it('어느 도착 칸도 문에 곧바로 걸리지 않는다 — engine 이 쓰는 값 그대로', () => {
    for (const def of ALL) {
      for (const portal of def.portals) {
        for (const other of mapDef(portal.to).portals) {
          const distance = Math.hypot(
            tileCenter(portal.toTx) - tileCenter(other.tx),
            tileCenter(portal.toTy) - tileCenter(other.ty),
          );
          expect(distance, `${def.id} → ${portal.to}`).toBeGreaterThan(PORTAL_GRAB);
        }
      }
    }
  });
});

describe('도착한 자리에 실제로 설 수 있다', () => {
  it('모든 도착 칸이 바닥이고, 입구에서 걸어갈 수 있다', () => {
    for (const def of ALL) {
      const world = createWorld('시험', 'miner');
      enterMap(world, def.id, def.entryTx, def.entryTy);
      const map = world.map;

      for (const other of ALL) {
        for (const portal of other.portals) {
          if (portal.to !== def.id) continue;
          const tile = map.tiles[portal.toTy * def.width + portal.toTx];
          expect(tile, `${other.id} → ${def.id} 도착 칸 (${portal.toTx},${portal.toTy})`).toBe(FLOOR);
        }
      }
    }
  });
});

describe('마을에서 나가는 길', () => {
  it('마을에서 숲·광산·강 셋으로 갈린다', () => {
    const from = mapDef('town').portals.map((p) => p.to).sort();
    expect(from).toEqual(['forest', 'mine', 'river']);
  });

  it('★ 마을 직통 문은 광산의 기존 입구로 내려놓는다 — 깊이 기울기가 그 한 점에서 재어진다', () => {
    const mine = mapDef('mine');
    const direct = mapDef('town').portals.find((p) => p.to === 'mine')!;
    expect(direct.toTx).toBe(mine.entryTx);
    expect(direct.toTy).toBe(mine.entryTy);

    // 숲에서 오는 문도 같은 자리라야 두 길의 위험이 같습니다
    const viaForest = mapDef('forest').portals.find((p) => p.to === 'mine')!;
    expect(viaForest.toTx).toBe(mine.entryTx);
    expect(viaForest.toTy).toBe(mine.entryTy);
  });

  it('숲과 광산 사이 길은 그대로 남아 있다', () => {
    expect(mapDef('forest').portals.some((p) => p.to === 'mine')).toBe(true);
    expect(mapDef('mine').portals.some((p) => p.to === 'forest')).toBe(true);
  });
});

describe('강가', () => {
  it('물길이 실제로 지도를 가로지른다', () => {
    const def = mapDef('river');
    expect(def.river, '강 설정이 없습니다').toBeTruthy();

    const world = createWorld('시험', 'miner');
    enterMap(world, 'river', def.entryTx, def.entryTy);

    // 물길이 지나는 줄마다 물이 있어야 합니다 (여울 세 줄만 빼고)
    const ford = def.river!.fordY;
    let wetRows = 0;
    for (let ty = 1; ty < def.height - 1; ty++) {
      if (Math.abs(ty - ford) <= 1) continue;
      const wet = [...Array(def.width).keys()].some(
        (tx) => world.map.tiles[ty * def.width + tx] === LIQUID,
      );
      if (wet) wetRows++;
    }
    expect(wetRows, '물길이 끊겨 있습니다').toBeGreaterThan(def.height - 8);
  });

  it('★ 여울로만 건넌다 — 여울 줄에는 물이 없다', () => {
    const def = mapDef('river');
    const world = createWorld('시험', 'miner');
    enterMap(world, 'river', def.entryTx, def.entryTy);

    const ford = def.river!.fordY;
    for (let ty = ford - 1; ty <= ford + 1; ty++) {
      const cx = Math.round(def.river!.x + Math.sin(ty / 5.5) * def.river!.wobble);
      for (let tx = cx - 1; tx <= cx + 1; tx++) {
        expect(world.map.tiles[ty * def.width + tx], `여울 (${tx},${ty})`).toBe(FLOOR);
      }
    }
  });

  it('건너편 구리까지 실제로 걸어갈 수 있다', () => {
    const world = createWorld('시험', 'miner');
    const def = mapDef('river');
    enterMap(world, 'river', def.entryTx, def.entryTy);

    const copper = world.veins.filter((v) => v.defId === 'copper-shallow');
    expect(copper.length, '구리 광맥이 없습니다').toBeGreaterThan(0);
    // populate 는 걸을 수 있는 칸에만 놓습니다. 여울이 있으므로 건너편도 이어져 있습니다.
    for (const vein of copper) {
      const tx = Math.floor(vein.pos.x / TILE);
      const ty = Math.floor(vein.pos.y / TILE);
      expect(world.map.tiles[ty * def.width + tx]).toBe(FLOOR);
    }
  });

  it('강가에는 구리로 가는 두 번째 길이 있고, 광산의 가장 깊은 것은 없다', () => {
    const river = mapDef('river').veins.map((v) => v.veinId);
    expect(river).toContain('copper-shallow');
    // 깊은 구리(난이도 80)는 광산만의 것이라야 광산에 갈 이유가 남습니다
    expect(river).not.toContain('copper-deep');
    expect(mapDef('mine').veins.map((v) => v.veinId)).toContain('copper-deep');
  });

  it('강가 몬스터는 늑대와 거미 사이를 메운다', () => {
    const crab = MONSTERS['river-crab'];
    expect(crab, '강가 몬스터가 없습니다').toBeTruthy();
    expect(crab!.difficulty).toBeGreaterThan(MONSTERS['wolf']!.difficulty);
    expect(crab!.difficulty).toBeLessThan(MONSTERS['cave-spider']!.difficulty);
  });
});

describe('지역마다 갈 이유가 다르다', () => {
  it('네 지역이 있고 순서가 정해져 있다', () => {
    expect(MAP_ORDER).toEqual(['town', 'forest', 'mine', 'river']);
  });

  it('싸울 곳마다 가장 좋은 광맥이 서로 다르다', () => {
    const hardest = (id: string) =>
      Math.max(...mapDef(id).veins.map((v) => VEINS[v.veinId]!.difficulty));
    // 숲(철) < 강가(구리) < 광산(깊은 구리) — 셋이 같으면 갈림길이 아닙니다
    expect(hardest('forest')).toBeLessThan(hardest('river'));
    expect(hardest('river')).toBeLessThan(hardest('mine'));
  });
});

/* ===========================================================================
 *  봇이 길을 찾는가
 * ======================================================================== */

/**
 *  ★ 예전 봇은 ['town','forest','mine'] 한 줄을 박아두고 앞뒤로만 갔습니다.
 *    길이 셋으로 갈리자 그 가정이 무너집니다 — 직통을 두고 숲으로 돌아가고,
 *    그 줄에 없는 강은 travel() 이 "도착했다"로 조용히 돌려줬습니다.
 *    이제 문 그래프를 그대로 훑습니다.
 */
describe('봇 길찾기', () => {
  it('어느 지역에서 어느 지역으로든 길을 찾는다', () => {
    for (const from of MAP_ORDER) {
      for (const to of MAP_ORDER) {
        if (from === to) {
          expect(nextHop(from, to)).toBeNull();
          continue;
        }
        expect(nextHop(from, to), `${from} → ${to} 길이 없습니다`).not.toBeNull();
      }
    }
  });

  it('첫 걸음은 실제로 그 지도에 있는 문이다', () => {
    for (const from of MAP_ORDER) {
      for (const to of MAP_ORDER) {
        const hop = nextHop(from, to);
        if (hop === null) continue;
        expect(
          mapDef(from).portals.some((p) => p.to === hop),
          `${from} 에 ${hop} 로 가는 문이 없습니다`,
        ).toBe(true);
      }
    }
  });

  it('★ 마을에서 광산으로 갈 때 직통을 쓴다 — 숲으로 돌아가지 않는다', () => {
    expect(nextHop('town', 'mine')).toBe('mine');
  });

  it('★ 강으로도 길을 찾는다 — 예전 한 줄 가정에서는 못 찾던 곳', () => {
    expect(nextHop('town', 'river')).toBe('river');
    expect(nextHop('forest', 'river')).toBe('town');
    expect(nextHop('mine', 'river')).toBe('town');
  });

  it('숲과 광산은 여전히 서로 바로 간다', () => {
    expect(nextHop('forest', 'mine')).toBe('mine');
    expect(nextHop('mine', 'forest')).toBe('forest');
  });
});
