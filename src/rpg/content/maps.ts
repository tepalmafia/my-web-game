/**
 *  지역 넷.
 *
 *      마을 ┬ 초록 숲 ── 버려진 광산
 *           ├ 버려진 광산   (직통 — 광석을 지고 숲을 되짚지 않아도 됩니다)
 *           └ 강가
 *
 *  ★ 마을에서 나가는 길이 하나뿐이면 "오늘 뭘 해볼까"의 답이 늘 같습니다.
 *    셋으로 갈리되, 갈 이유가 서로 달라야 갈림길이 됩니다.
 *      숲   가깝고 만만하다. 철과 검술
 *      광산 가장 좋은 광석. 대신 깊이와 거미
 *      강가 구리로 가는 두 번째 길. 깊이 대신 다른 위험(큰게)
 *
 *  ★ 문을 늘릴 때 지켜야 하는 것이 둘 있습니다 (tests/rpg/maps.test.ts 가 지킵니다).
 *    1) 문은 양쪽에 적습니다. 한쪽만 적으면 아무도 모릅니다.
 *    2) 도착 칸은 그 지도의 모든 문에서 3칸 넘게 떨어뜨립니다 —
 *       engine 의 checkPortals 는 22.4px 안에 들어오면 곧바로 다시 보내므로,
 *       가까우면 두 지역을 무한히 오갑니다.
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
      // ★ 광산 직통. 광석은 무겁고 짐칸은 작아서, 숲을 되짚어 나오는 왕복이
      //   광산의 값어치를 깎고 있었습니다. 도착 칸은 광산의 기존 입구 그대로입니다 —
      //   minDepth 기울기가 그 한 점에서만 재어지므로 다른 데로 내려놓으면 거미 옆입니다.
      { tx: 27, ty: 19, to: 'mine', toTx: 4, toTy: 20, label: '버려진 광산' },
      { tx: 3, ty: 19, to: 'river', toTx: 5, toTy: 15, label: '강가' },
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
      { tx: 2, ty: 18, to: 'town', toTx: 15, toTy: 18, label: '마을' },
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
      { tx: 1, ty: 20, to: 'forest', toTx: 40, toTy: 18, label: '초록 숲' },
      { tx: 4, ty: 24, to: 'town', toTx: 24, toTy: 19, label: '마을' },
      //  ★ 아래로 내려가는 문. 아직 아무도 못 엽니다.
      //    광산 맨 안쪽(입구에서 36칸)이라 구리를 캐러 들어가면 자연히 만납니다.
      //    보이기는 해야 합니다 — 숨기면 궁금할 수 없습니다 (전체설계 3.4).
      //    무엇이 부족한지는 말하지 않습니다.
      //  ★ 갈 곳(mine-deep)은 아직 없는 지역입니다. 봉인된 문만 그럴 수 있고,
      //    tests/rpg/maps.test.ts 가 그것을 지킵니다.
      {
        tx: 40, ty: 20,
        to: 'mine-deep', toTx: 4, toTy: 20,
        label: '내려가는 길',
        needs: { sealed: true, closed: '굳게 닫혀 있습니다.' },
      },
    ],
  },
  {
    id: 'river',
    name: '강가',
    subtitle: '물길이 갈라놓은 자리. 건너편에 구리가 비칩니다',
    theme: 'river',
    width: 40, height: 30,
    safe: false,
    seed: 3003,
    clutter: 0.1,
    entryTx: 5, entryTy: 15,
    spawns: [
      // ★ 큰게는 입구가 아니라 ★물길을 지킵니다. minDepth 6 으로 두었더니 들어서자마자
      //   서넛이 몰려 시작 장비로는 발도 못 붙였습니다 — 서쪽 기슭은 일할 수 있어야 하고,
      //   값은 건널 때 치르는 것이 이 지역의 뜻입니다.
      { monsterId: 'river-crab', count: 6, minDepth: 12 },
    ],
    veins: [
      // 건너지 않아도 캘 것은 있습니다 — 다만 좋은 것은 물 건너입니다
      { veinId: 'iron-deep', count: 4, minDepth: 8 },
      // ★ 구리로 가는 두 번째 길. 광산 30칸 안쪽(거미)까지 가지 않아도 되지만,
      //   대신 물을 건너고 큰게를 상대해야 합니다.
      { veinId: 'copper-shallow', count: 5, minDepth: 18 },
    ],
    npcs: [],
    river: { x: 20, wobble: 3, width: 3, fordY: 20 },
    portals: [
      { tx: 2, ty: 15, to: 'town', toTx: 6, toTy: 19, label: '마을' },
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
