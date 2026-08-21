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

import { GAIN, PLAYER_RADIUS, TILE } from '../../src/rpg/balance';
import { MAPS, MAP_ORDER, mapDef } from '../../src/rpg/content/maps';
import { ITEMS, itemDef } from '../../src/rpg/content/items';
import { MONSTERS } from '../../src/rpg/content/monsters';
import { VEINS } from '../../src/rpg/content/veins';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { FLOOR, LIQUID, buildMap, enterMap, findPath, tileCenter } from '../../src/rpg/core/world';
import { nextHop } from '../../tools/autopilot';
import type { MapDef } from '../../src/rpg/types';

/** engine/checkPortals 가 쓰는 바로 그 값 */
const PORTAL_GRAB = TILE * 0.7;
/** 도착 칸이 문에서 떨어져 있어야 하는 거리 */
const SAFE_GAP = TILE * 3;

const ALL: MapDef[] = Object.values(MAPS);

/**
 *  ★ 조건이 걸린 문은 아직 갈 곳이 없어도 됩니다.
 *    아래층은 나중에 생기고(전체설계 8절 C), 그전까지 이 문은 열리지 않습니다.
 *    아래 검사들은 "걸어 들어갈 수 있는 문" 만 봅니다.
 */
const isOpen = (portal: MapDef['portals'][number]) => !portal.needs;
const openPortals = (def: MapDef) => def.portals.filter(isOpen);

describe('문 대조', () => {
  it('문이 가리키는 지역이 실제로 있다', () => {
    for (const def of ALL) {
      for (const portal of openPortals(def)) {
        expect(() => mapDef(portal.to), `${def.id} → ${portal.to}`).not.toThrow();
      }
    }
  });

  it('★ 갈 곳이 없는 문은 반드시 조건이 걸려 있다', () => {
    //  아래층이 아직 없어서 갈 곳 없는 문이 하나 있습니다. 그건 봉인돼 있어야 합니다.
    //  ★ 이 검사가 없으면 언젠가 조건을 지우는 순간, 없는 지역으로 걸어 들어가
    //    게임이 멈춥니다. 그것도 조용한 실패입니다.
    for (const def of ALL) {
      for (const portal of def.portals) {
        if (MAPS[portal.to]) continue;
        expect(
          portal.needs,
          `${def.id} 의 문이 없는 지역 ${portal.to} 로 가는데 조건이 없습니다`,
        ).toBeDefined();
      }
    }
  });

  it('★ 조건이 걸린 문은 왜 못 가는지 말한다 — 다만 무엇이 부족한지는 말하지 않는다', () => {
    for (const def of ALL) {
      for (const portal of def.portals) {
        if (!portal.needs) continue;
        expect(portal.needs.closed.length, `${def.id} 의 ${portal.label}`).toBeGreaterThan(0);
        expect(portal.label.length, '이름 없는 문은 궁금할 수 없습니다').toBeGreaterThan(0);
      }
    }
  });

  it('문은 양쪽에 있다 — 한쪽만 난 문은 없다', () => {
    const oneWay: string[] = [];
    for (const def of ALL) {
      for (const portal of openPortals(def)) {
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

        if (!isOpen(portal)) continue;
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
      for (const portal of openPortals(def)) {
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
      for (const portal of openPortals(def)) {
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
  it('지역 목록과 순서가 정해져 있다', () => {
    expect(MAP_ORDER).toEqual(['town', 'forest', 'mine', 'mine-deep', 'river']);
  });

  it('싸울 곳마다 가장 좋은 광맥이 서로 다르다', () => {
    const hardest = (id: string) =>
      Math.max(...mapDef(id).veins.map((v) => VEINS[v.veinId]!.difficulty));
    // 숲(철) < 강가(구리) < 광산(깊은 구리) — 셋이 같으면 갈림길이 아닙니다
    expect(hardest('forest')).toBeLessThan(hardest('river'));
    expect(hardest('river')).toBeLessThan(hardest('mine'));
  });

  /*
   *  ★ 이것이 C1' 이 고친 것이고, ★고치지 않은 것이기도 합니다.
   *
   *    버려진 광산은 다른 두 밭의 광맥을 전부 갖고 있습니다. 그것이 설계입니다 —
   *    "광산 가장 좋은 광석" (이 파일 머리). 그러니 '밭마다 전용 광맥' 은 여기서
   *    지킬 수 있는 규칙이 아닙니다. 실제로 지킬 수 있는 것은 ★천장이 서로 다른 것입니다.
   *
   *    고치기 전에는 숲의 천장이 65 여서 채광 10~45 내내 숲과 광산의 초당 성장이
   *    소수점까지 같았습니다(22.41). 30~45 에서는 강가까지 셋이 동점이었습니다.
   *    답이 여럿이면 선택이지만 답이 ★같으면 선택이 아닙니다.
   *
   *    숲에서 깊은 철광맥(45)을 빼서 천장이 65 → 40 이 됐습니다.
   *    봇 실측(씨앗 여덟 · 20분): 숲을 떠나는 씨앗이 0/8 → 6/8, 그리고 채광 30 을
   *    찍는 자리가 숲에서 광산으로 옮겨갔습니다. ★떠날 때가 생기는 것이 이 배치의 값입니다.
   */
  it('밭마다 채광 천장이 다르다 — 숲 40 · 강가 80 · 광산 100', () => {
    const ceiling = (id: string) =>
      Math.max(...mapDef(id).veins.map((v) => VEINS[v.veinId]!.difficulty)) + GAIN.easyCutoff;
    expect(ceiling('forest'), '숲이 졸업되지 않습니다').toBe(40);
    expect(ceiling('river')).toBe(80);
    expect(ceiling('mine')).toBe(100);

    // 셋이 서로 달라야 합니다. 같으면 "어디서 캘까" 의 답이 하나입니다
    const fields = ['forest', 'river', 'mine'];
    expect(new Set(fields.map(ceiling)).size).toBe(fields.length);
  });

  it('초록 숲에는 깊은 철광맥이 없다 — 늑대 구역까지 캐러 갈 것이 없다', () => {
    const forest = mapDef('forest').veins.map((v) => v.veinId);
    expect(forest).toEqual(['iron-shallow']);
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
  /**
   *  ★ 봇은 조건이 걸린 문을 못 지납니다 (autopilot 의 nextHop 이 걸러냅니다).
   *    그래서 그 문 너머에만 있는 지역은 봇에게 길이 없는 것이 맞습니다 —
   *    없다고 답하는 것이 고장이 아니라, 있다고 답하면 문 앞에 영원히 서 있게 됩니다.
   */
  const walkable = new Set<string>(['town']);
  for (let pass = 0; pass < MAP_ORDER.length; pass++) {
    for (const id of MAP_ORDER) {
      if (!walkable.has(id)) continue;
      for (const portal of openPortals(mapDef(id))) walkable.add(portal.to);
    }
  }

  it('조건 없는 문으로 이어진 지역끼리는 어디서 어디로든 길을 찾는다', () => {
    for (const from of walkable) {
      for (const to of walkable) {
        if (from === to) {
          expect(nextHop(from, to)).toBeNull();
          continue;
        }
        expect(nextHop(from, to), `${from} → ${to} 길이 없습니다`).not.toBeNull();
      }
    }
  });

  it('★ 조건이 걸린 문 너머는 봇에게 길이 없다 — 문 앞에 서 있지 않게', () => {
    const gated = MAP_ORDER.filter((id) => !walkable.has(id));
    expect(gated, '조건 뒤에 있는 지역이 하나도 없습니다').toContain('mine-deep');
    for (const id of gated) {
      expect(nextHop('town', id), `봇이 ${id} 로 가는 길을 짰습니다`).toBeNull();
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

/* ===========================================================================
 *  마을이 자라도 마을이 막히지 않는다
 *  ---------------------------------------------------------------------------
 *  ★ 대장간은 단계마다 커집니다. 벽 덩어리가 커지는 것이라, 한 칸만 잘못 잡으면
 *    두린에게 말을 걸 수 없게 되거나 문으로 가는 길이 끊깁니다.
 *    그것도 조용한 실패입니다 — 화면에는 그냥 마을이 커 보일 뿐입니다.
 * ======================================================================== */

describe('마을이 자랄 때', () => {
  const STAGES = [0, 1, 2, 3, 4];
  const town = mapDef('town');

  /** 입구에서 걸어서 닿을 수 있는 칸들 */
  function reachableFrom(map: ReturnType<typeof buildMap>, tx: number, ty: number): Uint8Array {
    const seen = new Uint8Array(town.width * town.height);
    const queue = [ty * town.width + tx];
    seen[queue[0]!] = 1;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head]!;
      const x = i % town.width;
      const y = Math.floor(i / town.width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= town.width || ny >= town.height) continue;
        const ni = ny * town.width + nx;
        if (seen[ni] || map.tiles[ni] !== FLOOR) continue;
        seen[ni] = 1;
        queue.push(ni);
      }
    }
    return seen;
  }

  it('어느 단계에서도 두린·상인·화로·문에 걸어갈 수 있다', () => {
    for (const stage of STAGES) {
      const map = buildMap(town, stage);
      const seen = reachableFrom(map, town.entryTx, town.entryTy);

      const musts: Array<{ tx: number; ty: number; what: string }> = [
        { tx: town.forge!.tx, ty: town.forge!.ty, what: '화로' },
        ...town.npcs!.map((n) => ({ tx: n.tx, ty: n.ty, what: n.name })),
        ...town.portals.map((p) => ({ tx: p.tx, ty: p.ty, what: `${p.label} 문` })),
      ];

      for (const must of musts) {
        // 그 칸에 서지 못해도, 옆 칸에서 말을 걸거나 문에 닿을 수 있으면 됩니다
        const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const x = must.tx + dx!;
          const y = must.ty + dy!;
          if (x < 0 || y < 0 || x >= town.width || y >= town.height) return false;
          return seen[y * town.width + x] === 1;
        });
        expect(near, `${stage}단계: ${must.what} 에 못 갑니다`).toBe(true);
      }
    }
  });

  it('대장간이 단계마다 실제로 커진다 — 3·4단계에서 멈추지 않는다', () => {
    let previous = -1;
    for (const stage of STAGES) {
      const map = buildMap(town, stage);
      const walls = map.tiles.reduce<number>((sum, t) => sum + (t === FLOOR ? 0 : 1), 0);
      expect(walls, `${stage}단계가 ${stage - 1}단계보다 크지 않습니다`).toBeGreaterThan(previous);
      previous = walls;
    }
  });

  it('대장간이 두린과 화로를 덮지 않는다', () => {
    // ★ 아래로 넓히다 y9 를 먹으면 두린이 벽 안에 갇힙니다
    for (const stage of STAGES) {
      const map = buildMap(town, stage);
      for (const spot of [{ ...town.forge! }, ...town.npcs!]) {
        expect(
          map.tiles[spot.ty * town.width + spot.tx],
          `${stage}단계: (${spot.tx},${spot.ty}) 가 벽에 먹혔습니다`,
        ).toBe(FLOOR);
      }
    }
  });
});

/* ===========================================================================
 *  못 가는 문
 *  ---------------------------------------------------------------------------
 *  ★ 갈 수 있는 데가 전부 갈 수 있으면 궁금할 것이 없습니다.
 *    막힌 문 하나가 "저기 뭐가 있지" 를 심습니다 (전체설계 3.3).
 * ======================================================================== */

describe('못 가는 문', () => {
  const sealed = ALL.flatMap((def) =>
    def.portals.filter((p) => p.needs).map((p) => ({ def, portal: p })),
  );

  it('막힌 문이 실제로 하나는 있다', () => {
    expect(sealed.length, '막힌 문이 하나도 없습니다').toBeGreaterThan(0);
  });

  it('문 자리에 실제로 설 수 있다 — 못 가는 것과 못 닿는 것은 다르다', () => {
    for (const { def, portal } of sealed) {
      const world = createWorld('시험', 'miner');
      enterMap(world, def.id, def.entryTx, def.entryTy);
      expect(
        world.map.tiles[portal.ty * def.width + portal.tx],
        `${def.id} 의 ${portal.label} 이 벽 안에 있습니다`,
      ).toBe(FLOOR);
    }
  });

  it('★ 밟아도 넘어가지 않는다', () => {
    for (const { def, portal } of sealed) {
      const world = createWorld('시험', 'miner');
      enterMap(world, def.id, def.entryTx, def.entryTy);
      world.me.pos = { x: tileCenter(portal.tx), y: tileCenter(portal.ty) };
      world.log.length = 0;

      // engine 이 문을 보는 그 순간을 그대로 돌립니다
      for (let i = 0; i < 5; i++) step(world, 1 / 30);

      expect(world.mapId, `${portal.label} 로 넘어가 버렸습니다`).toBe(def.id);
    }
  });

  it('★ 조용히 막지 않는다 — 다만 무엇이 부족한지는 말하지 않는다', () => {
    const { def, portal } = sealed[0]!;
    const world = createWorld('시험', 'miner');
    enterMap(world, def.id, def.entryTx, def.entryTy);
    world.me.pos = { x: tileCenter(portal.tx), y: tileCenter(portal.ty) };
    world.log.length = 0;
    step(world, 1 / 30);

    const said = [world.toast?.text ?? '', ...world.log.map((l) => l.text)].join(' ');
    expect(said, '아무 말도 없이 막았습니다').toContain(portal.needs!.closed);

    // 재료 이름·개수를 흘리면 궁금할 이유가 사라집니다
    for (const item of Object.values(ITEMS)) {
      expect(said, `${item.name} 을(를) 흘립니다`).not.toContain(item.name);
    }
  });

  it('같은 말을 매 프레임 되풀이하지 않는다', () => {
    const { def, portal } = sealed[0]!;
    const world = createWorld('시험', 'miner');
    enterMap(world, def.id, def.entryTx, def.entryTy);
    world.me.pos = { x: tileCenter(portal.tx), y: tileCenter(portal.ty) };
    world.log.length = 0;

    for (let i = 0; i < 60; i++) step(world, 1 / 30);   // 2초 동안 문 앞에 서 있기
    const said = world.log.filter((l) => l.text.includes(portal.needs!.closed)).length;
    expect(said, `2초 서 있었더니 ${said}번 말했습니다`).toBe(1);
  });

  it('봇은 막힌 문으로 길을 짜지 않는다', () => {
    for (const { def, portal } of sealed) {
      expect(
        nextHop(def.id, portal.to),
        `봇이 ${portal.label} 을(를) 지나가려 합니다 — 문 앞에서 멈춰 섭니다`,
      ).toBeNull();
    }
  });
});

/* ===========================================================================
 *  놓여 있던 것 (이야기-기획안 2.3)
 * ======================================================================== */

describe('원래 놓여 있던 것', () => {
  const withRelics = ALL.filter((def) => (def.relics ?? []).length > 0);

  it('놓여 있는 것이 실제로 하나는 있다', () => {
    expect(withRelics.length, '어느 지역에도 놓여 있는 것이 없습니다').toBeGreaterThan(0);
  });

  it('★ 자리가 벽 속이 아니다 — 바위에 떨어지면 아무 말 없이 못 줍는다', () => {
    for (const def of withRelics) {
      const world = createWorld('시험', 'miner');
      enterMap(world, def.id, def.entryTx, def.entryTy);
      for (const relic of def.relics!) {
        expect(
          world.map.tiles[relic.ty * def.width + relic.tx],
          `${def.id} 의 ${relic.defId} 가 벽 안에 있습니다`,
        ).toBe(FLOOR);
      }
    }
  });

  it('★ 입구에서 걸어서 닿는다', () => {
    for (const def of withRelics) {
      const world = createWorld('시험', 'miner');
      enterMap(world, def.id, def.entryTx, def.entryTy);
      for (const relic of def.relics!) {
        const path = findPath(
          world.map,
          { x: tileCenter(def.entryTx), y: tileCenter(def.entryTy) },
          { x: tileCenter(relic.tx), y: tileCenter(relic.ty) },
          PLAYER_RADIUS,
        );
        expect(path, `${def.id} 의 ${relic.defId} 까지 갈 수가 없습니다`).not.toBeNull();
      }
    }
  });

  it('가리키는 물건이 실제로 있다', () => {
    for (const def of withRelics) {
      for (const relic of def.relics!) {
        expect(() => itemDef(relic.defId), `${relic.defId}`).not.toThrow();
      }
    }
  });
});
