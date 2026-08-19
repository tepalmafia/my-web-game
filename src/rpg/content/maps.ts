/**
 *  지역 셋.
 *
 *      실버우드 마을 ── 초록 숲 ── 버려진 광산
 *
 *  ★ 문 앞에 권장 레벨이 없습니다. 들어갈지 말지는 스스로 판단합니다.
 *    다만 광산 깊은 곳에는 거미가 있고, 준비 없이 들어가면 죽습니다.
 *
 *  minDepth 는 "입구에서 이만큼 떨어진 곳부터 나타난다"는 뜻입니다(타일 단위).
 *  깊이가 곧 위험이고, 동시에 좋은 광맥이 있는 곳입니다.
 */

import type { MapDef, MapId } from '../types';

const LIST: MapDef[] = [
  {
    id: 'town',
    name: '실버우드 마을',
    subtitle: '화로와 상인이 있는 유일한 곳',
    theme: 'town',
    width: 30, height: 24,
    safe: true,
    seed: 1001,
    clutter: 0.05,
    entryTx: 15, entryTy: 13,
    spawns: [],
    veins: [],
    npcs: [
      { tx: 9, ty: 9, kind: 'shop', name: '상인 마르카', color: '#c9a227' },
      { tx: 21, ty: 9, kind: 'smith', name: '대장장이 두린', color: '#e0764a' },
    ],
    forge: { tx: 21, ty: 11 },
    portals: [
      { tx: 15, ty: 21, to: 'forest', toTx: 5, toTy: 18, label: '초록 숲' },
    ],
  },
  {
    id: 'forest',
    name: '초록 숲',
    subtitle: '들개가 어슬렁대고, 바위 틈에 철이 비칩니다',
    theme: 'forest',
    width: 46, height: 36,
    safe: false,
    seed: 2002,
    clutter: 0.15,
    entryTx: 5, entryTy: 18,
    spawns: [
      { monsterId: 'stray-dog', count: 9, minDepth: 6 },
      { monsterId: 'wolf', count: 5, minDepth: 20 },
    ],
    veins: [
      { veinId: 'iron-shallow', count: 7, minDepth: 5 },
      // 숲 안쪽 바위턱 — 늑대가 있는 자리입니다. 광산까지 가지 않고도
      // 다음 단계의 광맥을 만나되, 값은 치르게 하려는 배치입니다.
      { veinId: 'iron-deep', count: 3, minDepth: 26 },
    ],
    npcs: [],
    portals: [
      { tx: 2, ty: 18, to: 'town', toTx: 15, toTy: 19, label: '마을' },
      { tx: 43, ty: 18, to: 'mine', toTx: 4, toTy: 20, label: '버려진 광산' },
    ],
  },
  {
    id: 'mine',
    name: '버려진 광산',
    subtitle: '안으로 갈수록 광석이 좋아지고, 그만큼 조용해집니다',
    theme: 'cave',
    width: 44, height: 40,
    safe: false,
    seed: 4004,
    clutter: 0.22,
    entryTx: 4, entryTy: 20,
    spawns: [
      // ★ 광산의 앞쪽(철이 나는 곳)은 비교적 조용합니다.
      //   박쥐와 거미는 구리가 나는 안쪽에 있습니다 —
      //   "위험한 곳에서 캘 것인가"라는 물음이 구리에서만 생기도록.
      { monsterId: 'cave-bat', count: 6, minDepth: 22 },
      { monsterId: 'cave-spider', count: 4, minDepth: 30 },
    ],
    veins: [
      { veinId: 'iron-shallow', count: 4, minDepth: 4 },
      { veinId: 'iron-deep', count: 6, minDepth: 12 },
      { veinId: 'copper-shallow', count: 5, minDepth: 22 },
      { veinId: 'copper-deep', count: 3, minDepth: 30 },
    ],
    npcs: [],
    portals: [
      { tx: 2, ty: 20, to: 'forest', toTx: 41, toTy: 18, label: '초록 숲' },
    ],
  },
];

export const MAPS: Record<MapId, MapDef> = Object.fromEntries(LIST.map((m) => [m.id, m]));
export const MAP_ORDER: MapId[] = LIST.map((m) => m.id);

export function mapDef(id: MapId): MapDef {
  const def = MAPS[id];
  if (!def) throw new Error(`알 수 없는 지역: ${id}`);
  return def;
}
