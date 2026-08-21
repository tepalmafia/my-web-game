/**
 *  물건 목록.
 *
 *  ★ 등급도 강화 수치도 없습니다. 물건의 값어치는 '무엇으로 만들었는가'와
 *    '얼마나 잘 만들었는가(품질)', 그리고 '얼마나 닳았는가'로만 정해집니다.
 *
 *  weight(스톤)가 이 게임에서 가장 자주 부딪히는 숫자입니다.
 *  ★ 무거운 것은 '광석'뿐입니다. 광석 10 스톤, 녹인 주괴 1 스톤 —
 *    그래서 캘 때는 발이 무겁고, 녹이고 나면 가벼워집니다.
 *    장비를 무겁게 만들면 이 대비가 묻혀버려서, 장비는 전부 가볍게 두었습니다.
 */

import type { ItemDef } from '../types';

const LIST: ItemDef[] = [
  /* --------------------------------------------------------------- 연장 */
  {
    id: 'pickaxe', name: '곡괭이', kind: 'tool', tool: 'pickaxe',
    weight: 10, durability: 60, price: 60, sell: 12,
    desc: '광맥을 캘 때 필요합니다. 쓸수록 닳고, 닳으면 부러집니다.',
  },
  {
    //  ★ 발도르가 남긴 것 (이야기-기획안 2.3). 2층 바닥에 하나 놓여 있습니다.
    //    쓸 수 있는 곡괭이지만 거의 다 닳았습니다 — 값은 쓰임이 아니라
    //    두린에게 보여주는 데 있습니다. 들고 나오려면 10 스톤을 내야 합니다.
    id: 'baldor-pickaxe', name: '낡은 곡괭이', kind: 'tool', tool: 'pickaxe',
    weight: 10, durability: 14, price: 0, sell: 0,
    desc: '자루에 이름이 새겨져 있습니다 — 발도르. 누구인지는 적혀 있지 않습니다.',
  },
  {
    //  ★ 처음으로 **만들 수 있는 연장**입니다 (제작법 make-iron-pickaxe, 난이도 30).
    //
    //  ★ 왜 연장인가: 연장은 죽어도 안 떨어지는 유일한 종류입니다 (death.ts).
    //    그리고 지금까지 광부의 길이 자기 곡괭이를 못 만들었습니다 — 상점에서 사기만 했습니다.
    //
    //  ★ 진짜 선택은 무게가 아닙니다. **철 주괴는 두린에게 팔면 마을이 자라고,
    //    곡괭이로 태우면 안 자랍니다.** 60 골드로 사는 길이 그대로 남아 있는 이유입니다.
    //
    //  ★ 내구 150 은 상점 곡괭이(60)의 2.5 배입니다. 재료 5 주괴는 팔면 30 골드고,
    //    대장 30 에서 성공률 45% 라 기대 소모는 11 주괴(66 골드) — 사는 것과 엇비슷합니다.
    //    싸지 않습니다. 대신 벼림을 고를 수 있습니다.
    id: 'iron-pickaxe', name: '철 곡괭이', kind: 'tool', tool: 'pickaxe',
    weight: 12, durability: 150, price: 0, sell: 30,
    desc: '내가 벼린 곡괭이. 상점 것보다 오래 갑니다. 대신 조금 무겁습니다.',
  },
  {
    id: 'hammer', name: '대장장이 망치', kind: 'tool', tool: 'hammer',
    weight: 8, durability: 120, price: 120, sell: 25,
    desc: '화로 앞에서 물건을 만들고 고칠 때 씁니다.',
  },

  /* --------------------------------------------------------------- 자원 */
  {
    id: 'iron-ore', name: '철광석', kind: 'resource', weight: 10, stackable: true,
    price: 0, sell: 4, desc: '무겁습니다. 화로에 녹여야 쓸 수 있습니다.',
  },
  {
    id: 'copper-ore', name: '구리광석', kind: 'resource', weight: 11, stackable: true,
    price: 0, sell: 13, desc: '광산 깊은 곳에서만 나옵니다. 철보다 단단한 물건이 됩니다.',
  },
  {
    id: 'iron-ingot', name: '철 주괴', kind: 'resource', weight: 1, stackable: true,
    price: 0, sell: 6, desc: '광석을 녹이면 하나가 나옵니다. 가볍고, 무엇으로든 됩니다.',
  },
  {
    id: 'copper-ingot', name: '구리 주괴', kind: 'resource', weight: 1, stackable: true,
    price: 0, sell: 16, desc: '녹이는 것부터가 쉽지 않습니다.',
  },
  {
    id: 'dark-iron-ingot', name: '검은쇠 주괴', kind: 'resource', weight: 1, stackable: true,
    price: 0, sell: 42, desc: '녹이고 나면 손바닥만 합니다. 그래도 철보다 무겁습니다.',
  },
  {
    id: 'frost-iron-ingot', name: '서릿쇠 주괴', kind: 'resource', weight: 1, stackable: true,
    price: 0, sell: 60, desc: '쥐면 손이 시립니다. 녹인 뒤에도 그렇습니다.',
  },
  {
    //  ★ 3층 재료. 2층처럼 무겁지 않습니다 — 3층의 성격은 무게가 아니라
    //    **연장**입니다 (veins.ts 의 frost-iron.toolWear). 축을 겹치지 않게 둡니다.
    //    18 은 철광석(10)보다 무겁고 검은쇠(25)보다 가볍습니다.
    id: 'frost-iron-ore', name: '서릿쇠 광석', kind: 'resource', weight: 18, stackable: true,
    price: 0, sell: 48, desc: '돌째로 얼어 있습니다. 곡괭이가 먼저 상합니다.',
  },
  {
    //  ★ 2층의 성격이 이 숫자 하나에 걸려 있습니다 (전체설계 7.2).
    //    25 스톤이면 힘 20 의 여유(92)로 세 덩이가 한계입니다. 철광석이라면
    //    아홉 덩이를 담던 자리라, 광맥 앞에서 매번 "무엇을 버릴까" 가 생깁니다.
    //    깊이를 길이가 아니라 무게로 만드는 것이 이 한 줄입니다.
    id: 'dark-iron-ore', name: '검은쇠 광석', kind: 'resource', weight: 25, stackable: true,
    price: 0, sell: 34, desc: '한 덩이가 팔뚝만 합니다. 세 덩이면 등이 휩니다.',
  },

  /* --------------------------------------------------------------- 무기 */
  {
    id: 'rusty-sword', name: '녹슨 검', kind: 'weapon', slot: 'weapon',
    minDamage: 3, maxDamage: 6, swing: 1.3, weight: 9, durability: 40,
    price: 45, sell: 8, desc: '상점 구석에 굴러다니던 것. 오래 쓸 물건은 아닙니다.',
  },
  {
    id: 'iron-dagger', name: '철 단검', kind: 'weapon', slot: 'weapon',
    minDamage: 5, maxDamage: 9, swing: 1.0, weight: 6, durability: 70,
    price: 0, sell: 40, desc: '가볍고 빠릅니다. 처음 만들어보기 좋은 물건입니다.',
  },
  {
    id: 'iron-sword', name: '철검', kind: 'weapon', slot: 'weapon',
    minDamage: 9, maxDamage: 16, swing: 1.3, weight: 11, durability: 100,
    price: 0, sell: 95, desc: '대장장이의 첫 제대로 된 작품.',
  },
  {
    id: 'iron-longsword', name: '철 장검', kind: 'weapon', slot: 'weapon',
    minDamage: 13, maxDamage: 22, swing: 1.5, weight: 16, durability: 110,
    price: 0, sell: 150, desc: '무겁습니다. 들고 다니는 것만으로 짐이 됩니다.',
  },
  {
    id: 'copper-sword', name: '구리검', kind: 'weapon', slot: 'weapon',
    minDamage: 18, maxDamage: 29, swing: 1.35, weight: 13, durability: 150,
    price: 0, sell: 340, desc: '구리는 잘 부러지지 않습니다. 만들기가 어려울 뿐입니다.',
  },

  /* --------------------------------------------------------------- 갑옷 */
  {
    id: 'leather-vest', name: '가죽 조끼', kind: 'armor', slot: 'armor',
    defense: 6, weight: 9, durability: 60, price: 90, sell: 18,
    desc: '없는 것보다는 낫습니다.',
  },
  {
    id: 'iron-mail', name: '철 사슬갑옷', kind: 'armor', slot: 'armor',
    defense: 16, weight: 30, durability: 130, price: 0, sell: 180,
    desc: '무겁습니다. 이걸 입고 광석까지 지고 오기는 어렵습니다.',
  },
  {
    //  ★ 3단계 갈림길. 구리검(29)의 다음 자리입니다.
    id: 'dark-iron-sword', name: '검은쇠 검', kind: 'weapon', slot: 'weapon',
    weight: 15, durability: 210, minDamage: 25, maxDamage: 40, swing: 1.4,
    price: 0, sell: 620,
    desc: '빛을 거의 되쏘지 않습니다. 무겁고, 그만큼 깊이 들어갑니다.',
  },
  {
    //  ★ 3단계 갈림길의 다른 쪽. 합산 기여가 검(40)과 비슷해야 합니다 (7.3 불변식).
    id: 'dark-iron-plate', name: '검은쇠 판금', kind: 'armor', slot: 'armor',
    weight: 42, durability: 240, defense: 37,
    price: 0, sell: 900,
    desc: '입으면 소리가 납니다. 그 소리가 나쁘지만은 않습니다.',
  },
  {
    id: 'copper-mail', name: '구리 사슬갑옷', kind: 'armor', slot: 'armor',
    defense: 26, weight: 34, durability: 180, price: 0, sell: 600,
    desc: '거미의 이빨도 잘 뚫지 못합니다.',
  },

  /* --------------------------------------------------------------- 투구 */
  {
    id: 'leather-cap', name: '가죽 모자', kind: 'helmet', slot: 'helmet',
    defense: 3, weight: 4, durability: 40, price: 40, sell: 8,
    desc: '햇빛은 확실히 막아줍니다.',
  },
  {
    id: 'iron-helm', name: '철 투구', kind: 'helmet', slot: 'helmet',
    defense: 8, weight: 11, durability: 90, price: 0, sell: 90,
    desc: '머리를 지키는 대신 시야가 좁아집니다.',
  },

  /* --------------------------------------------------------------- 물약 */
  {
    id: 'potion-heal', name: '체력 물약', kind: 'potion', healHp: 60,
    weight: 2, stackable: true, price: 45, sell: 10, desc: '체력 60 회복.',
  },
  {
    id: 'potion-heal-big', name: '고급 체력 물약', kind: 'potion', healHp: 160,
    weight: 3, stackable: true, price: 150, sell: 34, desc: '체력 160 회복.',
  },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(LIST.map((i) => [i.id, i]));

export function itemDef(defId: string): ItemDef {
  const def = ITEMS[defId];
  if (!def) throw new Error(`알 수 없는 물건: ${defId}`);
  return def;
}

/**
 *  상점이 파는 것.
 *  ★ 만든 무기와 갑옷은 팔지 않습니다 — 그걸 팔면 대장장이가 필요 없어집니다.
 *    연장과 물약, 그리고 첫 검 한 자루까지가 상점의 몫입니다.
 */
/**
 *  상점이 처음부터 취급하는 것.
 *
 *  ★ 고급 체력 물약은 여기 없습니다 — 마을이 자라야 들어옵니다(content/town.ts).
 *    지금 취급하는 것은 openStock(town) 이 알려줍니다.
 */
export const SHOP_STOCK: string[] = [
  'pickaxe', 'hammer', 'potion-heal',
  'rusty-sword', 'leather-vest', 'leather-cap',
];
