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
export const SHOP_STOCK: string[] = [
  'pickaxe', 'hammer', 'potion-heal', 'potion-heal-big',
  'rusty-sword', 'leather-vest', 'leather-cap',
];
