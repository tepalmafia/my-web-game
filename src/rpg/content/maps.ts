/**
 *  지역 여섯 곳.
 *
 *  마을에서 시작해 오른쪽으로 한 줄로 이어집니다.
 *      실버우드 마을 → 초원 → 고블린 협곡 → 버려진 광산 → 오크 요새 → 용의 둥지
 *
 *  지형(나무·바위·물)은 여기 적지 않습니다. seed 값으로 그때그때 만들어내며,
 *  같은 seed 면 언제나 똑같은 지형이 나옵니다 (core/world.ts).
 */

import type { MapDef, MapId } from '../types';

const MAP_LIST: MapDef[] = [
  {
    id: 'town',
    name: '실버우드 마을',
    subtitle: '몬스터가 들어올 수 없는 유일한 곳',
    theme: 'town',
    width: 30,
    height: 24,
    safe: true,
    seed: 1001,
    clutter: 0.05,
    entryTx: 15,
    entryTy: 13,
    spawns: [],
    npcs: [
      { tx: 10, ty: 8, kind: 'shop', name: '상인 마르카', color: '#fbbf24' },
      { tx: 20, ty: 8, kind: 'enhance', name: '대장장이 두린', color: '#f97316' },
      { tx: 15, ty: 6, kind: 'teleport', name: '마법사 리엔', color: '#a78bfa' },
      { tx: 15, ty: 17, kind: 'guide', name: '촌장 아이렌', color: '#38bdf8' },
    ],
    portals: [
      { tx: 15, ty: 21, to: 'field', toTx: 4, toTy: 18, label: '초원', recommendLevel: 1 },
    ],
  },
  {
    id: 'field',
    name: '실버우드 초원',
    subtitle: '풀숲에서 무언가 부스럭거립니다',
    theme: 'field',
    width: 46,
    height: 36,
    safe: false,
    seed: 2002,
    clutter: 0.14,
    entryTx: 4,
    entryTy: 18,
    spawns: [
      { monsterId: 'rat', count: 10 },
      { monsterId: 'slime', count: 9 },
      { monsterId: 'wolf', count: 8 },
    ],
    npcs: [],
    portals: [
      { tx: 2, ty: 18, to: 'town', toTx: 15, toTy: 19, label: '마을', recommendLevel: 1 },
      { tx: 43, ty: 18, to: 'canyon', toTx: 4, toTy: 19, label: '고블린 협곡', recommendLevel: 8 },
    ],
  },
  {
    id: 'canyon',
    name: '고블린 협곡',
    subtitle: '바위 틈마다 초록 눈이 반짝입니다',
    theme: 'canyon',
    width: 48,
    height: 38,
    safe: false,
    seed: 3003,
    clutter: 0.18,
    entryTx: 4,
    entryTy: 19,
    spawns: [
      { monsterId: 'goblin', count: 12 },
      { monsterId: 'goblin-archer', count: 8 },
      { monsterId: 'goblin-chief', count: 1 },
    ],
    npcs: [],
    portals: [
      { tx: 2, ty: 19, to: 'field', toTx: 41, toTy: 18, label: '초원', recommendLevel: 1 },
      { tx: 45, ty: 19, to: 'mine', toTx: 4, toTy: 20, label: '버려진 광산', recommendLevel: 15 },
    ],
  },
  {
    id: 'mine',
    name: '버려진 광산',
    subtitle: '갱도 안쪽에서 곡괭이 소리가 들립니다',
    theme: 'cave',
    width: 46,
    height: 40,
    safe: false,
    seed: 4004,
    clutter: 0.22,
    entryTx: 4,
    entryTy: 20,
    spawns: [
      { monsterId: 'bat', count: 10 },
      { monsterId: 'miner', count: 11 },
      { monsterId: 'golem', count: 7 },
      { monsterId: 'overseer', count: 1 },
    ],
    npcs: [],
    portals: [
      { tx: 2, ty: 20, to: 'canyon', toTx: 43, toTy: 19, label: '고블린 협곡', recommendLevel: 8 },
      { tx: 43, ty: 20, to: 'fortress', toTx: 4, toTy: 20, label: '오크 요새', recommendLevel: 23 },
    ],
  },
  {
    id: 'fortress',
    name: '오크 요새',
    subtitle: '북소리가 멎지 않습니다',
    theme: 'fortress',
    width: 50,
    height: 40,
    safe: false,
    seed: 5005,
    clutter: 0.18,
    entryTx: 4,
    entryTy: 20,
    spawns: [
      { monsterId: 'orc', count: 13 },
      { monsterId: 'orc-shaman', count: 8 },
      { monsterId: 'orc-chief', count: 1 },
    ],
    npcs: [],
    portals: [
      { tx: 2, ty: 20, to: 'mine', toTx: 41, toTy: 20, label: '버려진 광산', recommendLevel: 15 },
      { tx: 47, ty: 20, to: 'nest', toTx: 4, toTy: 19, label: '용의 둥지', recommendLevel: 31 },
    ],
  },
  {
    id: 'nest',
    name: '용의 둥지',
    subtitle: '재가 눈처럼 내립니다',
    theme: 'volcano',
    width: 46,
    height: 38,
    safe: false,
    seed: 6006,
    clutter: 0.16,
    entryTx: 4,
    entryTy: 19,
    spawns: [
      { monsterId: 'drake', count: 9 },
      { monsterId: 'flame', count: 8 },
      { monsterId: 'carnas', count: 1 },
    ],
    npcs: [],
    portals: [
      { tx: 2, ty: 19, to: 'fortress', toTx: 45, toTy: 20, label: '오크 요새', recommendLevel: 23 },
    ],
  },
];

export const MAPS: Record<MapId, MapDef> = Object.fromEntries(MAP_LIST.map((m) => [m.id, m]));

export function mapDef(id: MapId): MapDef {
  const def = MAPS[id];
  if (!def) throw new Error(`알 수 없는 지역: ${id}`);
  return def;
}

/** 순간이동 목록에 뜨는 순서 */
export const MAP_ORDER: MapId[] = ['town', 'field', 'canyon', 'mine', 'fortress', 'nest'];

/** 각 지역의 권장 레벨 (순간이동 요금과 경고 문구에 씁니다) */
export const MAP_LEVEL: Record<MapId, number> = {
  town: 1,
  field: 1,
  canyon: 8,
  mine: 15,
  fortress: 23,
  nest: 31,
};
