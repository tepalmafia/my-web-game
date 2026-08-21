/**
 *  지역 다섯.
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
      //  ★ 늑대가 12 인 이유. 깊은 철광맥(26)을 뺀 뒤 늑대 구역(20)에 갈 이유가
      //    같이 없어져, 이 게임의 **유일한 강제 전투**가 사라졌습니다.
      //    광맥을 깊게 미는 것으로도 재봤는데 그쪽이 더 나빴습니다 —
      //    왕복 수익이 깎여 곡괭이(60골드)를 못 사고 봇이 마을에서 맴돌았습니다.
      //  ★ 봇 실측(miner · 씨앗 열 · 2시간): 죽는 씨앗 2/10 → 6/10,
      //    채광은 67.6 → 67.4 로 안 깎입니다. 깊은 철광맥이 있던 때가 8/10 이었습니다.
      //  ★ "가깝고 만만하다" 는 **얕은 절반**이 지킵니다. 들개(15)가 여전히 6 부터입니다.
      { monsterId: 'wolf', count: 5, minDepth: 12 },
    ],
    //  ★ 철광맥(20) 하나뿐입니다. 깊은 철광맥(45)을 여기서 뺐습니다.
    //
    //  ★ 왜 뺐나: 세 밭이 같은 광맥을 나눠 가져서 **채광은 어디를 가든 똑같았습니다.**
    //    재보니 채광 10~45 구간에서 숲·광산이 소수점까지 동점이었고(초당 성장 22.41),
    //    30~45 에서는 강가까지 셋이 동점이었습니다. 답이 여럿이면 선택이지만
    //    답이 **같으면** 선택이 아닙니다.
    //
    //  ★ 그래서 숲의 채광 천장이 65 → 40 이 됩니다. 채광 30 쯤에 숲을 졸업합니다 —
    //    이 배치의 값은 광석이 아니라 **떠날 때가 생기는 것**입니다.
    //    숲은 시작 지역이고 검술의 첫 사다리(들개 15 · 늑대 30)입니다.
    //
    //  ★ 광산·강가는 안 건드립니다. 강가가 구리를 나눠 갖는 것은 의도입니다 —
    //    "구리로 가는 두 번째 길" 이라 이 파일 머리에 적혀 있습니다.
    veins: [{ veinId: 'iron-shallow', count: 7, minDepth: 5 }],
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
        //  ★ A0 때는 봉인이었습니다 — 아직 아무도 못 열었으니 말할 것도 없었습니다.
        //    이제 진짜 조건이 생겼으므로 왜 안 되는지 숫자로 말합니다 (전체설계 4.3).
        //    한 칸을 지정하지 않고 합산으로 겁니다 — 긴 칼을 고른 사람은 무기로,
        //    갑옷을 고른 사람은 갑옷으로 채웁니다 (7.3 불변식).
        needs: { gear: 35, closed: '아래에서 찬 바람이 올라옵니다. 이대로는 못 내려갑니다.' },
      },
    ],
  },
  {
    //  ★ 광산 2층. 성격은 "길다" 가 아니라 **무겁다** 입니다 (전체설계 7.2).
    //    검은쇠 광석 한 덩이가 25 스톤이라, 광맥 앞에서 매번
    //    "철광석을 버리고 이걸 담을까" 가 생깁니다.
    //
    //  ★ 1층과 크기를 비슷하게 둡니다. 넓히면 findPath(BFS)가 맵 넓이에 비례해
    //    비싸지는데, 그 대가로 얻는 것은 걷는 시간뿐입니다.
    id: 'mine-deep',
    name: '광산 2층',
    subtitle: '한 덩이가 팔뚝만 합니다. 다 가져갈 수는 없습니다',
    theme: 'cave',
    width: 42, height: 38,
    safe: false,
    seed: 5005,
    clutter: 0.26,
    entryTx: 4, entryTy: 20,
    spawns: [
      { monsterId: 'cave-spider', count: 5, minDepth: 8 },
      { monsterId: 'deep-lurker', count: 5, minDepth: 18 },
    ],
    veins: [
      //  앞쪽에도 구리가 조금 납니다 — 빈손으로 돌아가는 판을 만들지 않으려는 것입니다
      { veinId: 'copper-deep', count: 4, minDepth: 6 },
      { veinId: 'dark-iron', count: 6, minDepth: 16 },
    ],
    npcs: [],
    //  ★ 발도르가 여기까지 왔다가 못 돌아갔습니다. 아무도 설명하지 않습니다 —
    //    자루에 이름이 새겨져 있을 뿐입니다 (이야기-기획안 2.3).
    //    입구에서 좀 떨어진 자리라, 들어와서 둘러봐야 만납니다.
    relics: [{ defId: 'baldor-pickaxe', tx: 14, ty: 26 }],
    portals: [
      //  ★ 도착 칸을 내려가는 문(40,20)에서 떼어 놓습니다. 겹치면 올라오자마자
      //    그 문을 다시 밟아 무한 왕복이 됩니다 — maps.test.ts 가 그것을 지킵니다.
      { tx: 4, ty: 16, to: 'mine', toTx: 36, toTy: 20, label: '위층' },
      //  ★ 3층으로. 문턱 43 의 근거는 2층 문(35)과 같은 셈법입니다 —
      //    갈림길 여덟 × 벼림 셋을 다 재면 최악의 천장이 46.8 이고,
      //    2층 때 35 가 그때 천장(37.4)의 93.6% 였습니다. 46.8 의 같은 비율이 43.8 이라
      //    43 으로 둡니다. 여유 3.8. 그리고 43 > 39.2 라 2층 장비만으로는 못 엽니다.
      //  ★ 함정이 되는 벼림은 이번에도 「단단하게」입니다 — gearScore 가 갑옷의
      //    defense 에도 temperMul.damage(0.85)를 곱하기 때문입니다.
      {
        tx: 38, ty: 20,
        to: 'mine-third', toTx: 4, toTy: 20,
        label: '더 내려가는 길',
        needs: { gear: 43, closed: '벽에 서리가 앉아 있습니다. 이대로는 못 견딥니다.' },
      },
    ],
  },
  {
    //  ★ 광산 3층. 성격은 **연장이 남아나지 않는다** 입니다 (전체설계 7.2).
    //    서릿쇠 광맥이 한 번 휘두를 때 곡괭이를 3 씩 먹습니다 —
    //    철 곡괭이(150)가 오십 번, 상점 곡괭이(60)는 스무 번이면 부러집니다.
    //
    //  ★ 2층이 무게였으니 여기는 무게가 아닙니다. 같은 축을 두 번 쓰면
    //    층이 숫자 하나만 다른 같은 방이 됩니다.
    //
    //  ★ 앞쪽에 검은쇠가 조금 납니다 — 곡괭이가 다 닳아도 빈손으로 돌아가지
    //    않도록. 2층이 구리로 하던 것과 같습니다.
    id: 'mine-third',
    name: '광산 3층',
    subtitle: '돌이 얼어 있습니다. 곡괭이가 먼저 상합니다',
    theme: 'cave',
    width: 42, height: 38,
    safe: false,
    seed: 6006,
    clutter: 0.24,
    entryTx: 4, entryTy: 20,
    spawns: [
      { monsterId: 'deep-lurker', count: 4, minDepth: 8 },
      { monsterId: 'frozen-thing', count: 5, minDepth: 16 },
    ],
    veins: [
      { veinId: 'dark-iron', count: 3, minDepth: 6 },
      { veinId: 'frost-iron', count: 6, minDepth: 14 },
    ],
    npcs: [],
    portals: [
      //  ★ 도착 칸(33,20)을 2층의 두 문(4,16)·(38,20)에서 떼어 놓습니다.
      { tx: 4, ty: 16, to: 'mine-deep', toTx: 33, toTy: 20, label: '위층' },
      {
        //  ★ 되돌아갈 수 없는 문. 여기로 들어가면 이 문으로는 못 나옵니다.
        //    나가는 길은 최심부 반대편 끝에 있습니다 — 돌아설 수는 없고
        //    앞으로 나아가야 나옵니다 (전체설계 7.2 최심부).
        tx: 38, ty: 18, to: 'mine-abyss', toTx: 4, toTy: 17, label: '갈라진 틈',
        needs: {
          gear: 65,
          oneWay: true,
          closed: '아래에서 열기가 올라옵니다.',
        },
      },
    ],
  },
  {
    /*
     *  최심부 — 되돌아갈 수 없다.
     *
     *  ★ 층마다 다른 문제를 하나씩 줍니다 (전체설계 7.2).
     *    2층은 무겁다, 3층은 연장이 상한다, 여기는 **돌아설 수 없다** 입니다.
     *
     *  ★ 들어온 문으로는 못 나옵니다. 나가는 길은 반대편 끝(36,17)에 있어서
     *    지역을 가로질러야 합니다. 가둬 놓는 것이 아니라 무르지 못하게 하는 것입니다.
     *
     *  ★ 몬스터는 새로 만들지 않았습니다. 여기의 문제는 센 놈이 아니라
     *    돌아설 수 없다는 것이고, 같은 놈도 물러설 데가 없으면 다른 놈입니다.
     */
    id: 'mine-abyss',
    name: '최심부',
    subtitle: '들어온 틈은 등 뒤에서 닫혔습니다. 길은 앞쪽뿐입니다',
    theme: 'cave',
    width: 40, height: 34,
    safe: false,
    seed: 7007,
    clutter: 0.28,
    entryTx: 4, entryTy: 17,
    spawns: [
      { monsterId: 'frozen-thing', count: 5, minDepth: 6 },
      { monsterId: 'deep-lurker', count: 6, minDepth: 12 },
    ],
    veins: [
      { veinId: 'frost-iron', count: 2, minDepth: 5 },
      { veinId: 'ember-iron', count: 6, minDepth: 12 },
    ],
    npcs: [],
    portals: [
      //  ★ 나가는 길. 들어온 자리(4,17)의 반대편 끝입니다.
      { tx: 36, ty: 17, to: 'mine-third', toTx: 33, toTy: 18, label: '위로 뚫린 굴' },
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
