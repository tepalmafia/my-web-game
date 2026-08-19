/**
 *  아이템 목록.
 *
 *  무기는 계열(sword / bow / staff)로 직업이 갈립니다.
 *  방어구·반지는 직업 제한 없이 레벨만 맞으면 누구나 낍니다.
 *
 *  price 가 0 이면 상점에서 팔지 않는다는 뜻입니다 — 사냥으로만 얻습니다.
 */

import type { ItemDef } from '../types';

const ITEM_LIST: ItemDef[] = [
  /* --------------------------------------------------------------- 검 (기사) */
  {
    id: 'sword-dagger', name: '낡은 단검', kind: 'weapon', slot: 'weapon', family: 'sword',
    grade: 'common', reqLevel: 1, minDamage: 4, maxDamage: 7, price: 150, sell: 30,
    enhanceable: true, desc: '이가 나갔지만 아직 벨 수는 있습니다.',
  },
  {
    id: 'sword-long', name: '롱소드', kind: 'weapon', slot: 'weapon', family: 'sword',
    grade: 'common', reqLevel: 7, minDamage: 10, maxDamage: 17, price: 1400, sell: 300,
    enhanceable: true, desc: '병사들이 가장 많이 쓰는 검.',
  },
  {
    id: 'sword-axe', name: '전투 도끼', kind: 'weapon', slot: 'weapon', family: 'sword',
    grade: 'common', reqLevel: 13, minDamage: 19, maxDamage: 30, price: 5600, sell: 1200,
    enhanceable: true, desc: '무겁게 내려찍습니다. 빗나가면 크게 빈틈이 생깁니다.',
  },
  {
    id: 'sword-claymore', name: '강철 클레이모어', kind: 'weapon', slot: 'weapon', family: 'sword',
    grade: 'rare', reqLevel: 20, minDamage: 31, maxDamage: 47, bonusCrit: 0.03, price: 21000, sell: 4500,
    enhanceable: true, desc: '양손으로 쥐어야 겨우 다룰 수 있는 대검.',
  },
  {
    id: 'sword-black', name: '흑기사의 대검', kind: 'weapon', slot: 'weapon', family: 'sword',
    grade: 'epic', reqLevel: 27, minDamage: 46, maxDamage: 68, bonusCrit: 0.05, price: 0, sell: 12000,
    enhanceable: true, desc: '주인이 죽은 뒤에도 계속 피를 원한다고 합니다.',
  },
  {
    id: 'sword-fang', name: '카르나스의 송곳니', kind: 'weapon', slot: 'weapon', family: 'sword',
    grade: 'legend', reqLevel: 34, minDamage: 74, maxDamage: 106, bonusCrit: 0.08, lifesteal: 0.05,
    price: 0, sell: 40000, enhanceable: true, desc: '고룡의 이빨을 그대로 갈아 만든 검. 벨 때마다 주인의 상처를 메웁니다.',
  },

  /* --------------------------------------------------------------- 활 (요정) */
  {
    id: 'bow-short', name: '사냥용 활', kind: 'weapon', slot: 'weapon', family: 'bow',
    grade: 'common', reqLevel: 1, minDamage: 3, maxDamage: 6, price: 150, sell: 30,
    enhanceable: true, desc: '토끼를 잡던 활입니다.',
  },
  {
    id: 'bow-long', name: '장궁', kind: 'weapon', slot: 'weapon', family: 'bow',
    grade: 'common', reqLevel: 7, minDamage: 8, maxDamage: 14, price: 1400, sell: 300,
    enhanceable: true, desc: '시위를 당기는 데 힘이 꽤 듭니다.',
  },
  {
    id: 'bow-composite', name: '합성궁', kind: 'weapon', slot: 'weapon', family: 'bow',
    grade: 'common', reqLevel: 13, minDamage: 16, maxDamage: 25, price: 5600, sell: 1200,
    enhanceable: true, desc: '뿔과 힘줄을 겹쳐 붙여 탄력을 높였습니다.',
  },
  {
    id: 'bow-silver', name: '은빛 장궁', kind: 'weapon', slot: 'weapon', family: 'bow',
    grade: 'rare', reqLevel: 20, minDamage: 26, maxDamage: 39, bonusCrit: 0.04, price: 21000, sell: 4500,
    enhanceable: true, desc: '어둠 속에서도 시위가 은은하게 빛납니다.',
  },
  {
    id: 'bow-shadow', name: '그림자 사냥꾼의 활', kind: 'weapon', slot: 'weapon', family: 'bow',
    grade: 'epic', reqLevel: 27, minDamage: 39, maxDamage: 57, bonusCrit: 0.07, price: 0, sell: 12000,
    enhanceable: true, desc: '화살이 날아가는 소리가 나지 않습니다.',
  },
  {
    id: 'bow-dragon', name: '용뼈 활', kind: 'weapon', slot: 'weapon', family: 'bow',
    grade: 'legend', reqLevel: 34, minDamage: 62, maxDamage: 90, bonusCrit: 0.11, price: 0, sell: 40000,
    enhanceable: true, desc: '고룡의 갈비뼈를 휘어 만들었습니다. 화살이 갑옷을 종잇장처럼 뚫습니다.',
  },

  /* ----------------------------------------------------------- 지팡이 (마법사) */
  {
    id: 'staff-wood', name: '나무 지팡이', kind: 'weapon', slot: 'weapon', family: 'staff',
    grade: 'common', reqLevel: 1, minDamage: 2, maxDamage: 4, magicPower: 7, price: 150, sell: 30,
    enhanceable: true, desc: '수련생이 처음 받는 지팡이.',
  },
  {
    id: 'staff-oak', name: '떡갈나무 지팡이', kind: 'weapon', slot: 'weapon', family: 'staff',
    grade: 'common', reqLevel: 7, minDamage: 4, maxDamage: 7, magicPower: 18, price: 1400, sell: 300,
    enhanceable: true, desc: '마력이 잘 흐르는 목재로 깎았습니다.',
  },
  {
    id: 'staff-crystal', name: '수정 지팡이', kind: 'weapon', slot: 'weapon', family: 'staff',
    grade: 'common', reqLevel: 13, minDamage: 7, maxDamage: 11, magicPower: 36, price: 5600, sell: 1200,
    enhanceable: true, desc: '끝에 박힌 수정이 주문을 증폭시킵니다.',
  },
  {
    id: 'staff-arch', name: '대마도사의 홀', kind: 'weapon', slot: 'weapon', family: 'staff',
    grade: 'rare', reqLevel: 20, minDamage: 11, maxDamage: 17, magicPower: 60, bonusMp: 40,
    price: 21000, sell: 4500, enhanceable: true, desc: '탑에서 몇 개 만들지 않은 물건입니다.',
  },
  {
    id: 'staff-soul', name: '영혼의 지팡이', kind: 'weapon', slot: 'weapon', family: 'staff',
    grade: 'epic', reqLevel: 27, minDamage: 16, maxDamage: 24, magicPower: 92, bonusMp: 70,
    price: 0, sell: 12000, enhanceable: true, desc: '쥐고 있으면 누군가 계속 속삭입니다.',
  },
  {
    id: 'staff-carnas', name: '카르나스의 뿔', kind: 'weapon', slot: 'weapon', family: 'staff',
    grade: 'legend', reqLevel: 34, minDamage: 26, maxDamage: 38, magicPower: 140, bonusMp: 120,
    price: 0, sell: 40000, enhanceable: true, desc: '고룡의 뿔. 주문 하나에 산등성이가 무너졌다고 합니다.',
  },

  /* --------------------------------------------------------------- 갑옷 */
  {
    id: 'armor-cloth', name: '천 갑옷', kind: 'armor', slot: 'armor', grade: 'common',
    reqLevel: 1, ac: -3, price: 200, sell: 40, enhanceable: true, desc: '없는 것보다는 낫습니다.',
  },
  {
    id: 'armor-leather', name: '가죽 갑옷', kind: 'armor', slot: 'armor', grade: 'common',
    reqLevel: 7, ac: -9, price: 1800, sell: 380, enhanceable: true, desc: '늑대 가죽을 여러 겹 덧댔습니다.',
  },
  {
    id: 'armor-scale', name: '사슬 갑옷', kind: 'armor', slot: 'armor', grade: 'common',
    reqLevel: 14, ac: -16, price: 7000, sell: 1500, enhanceable: true, desc: '고리를 촘촘히 엮어 베이는 공격에 강합니다.',
  },
  {
    id: 'armor-plate', name: '판금 갑옷', kind: 'armor', slot: 'armor', grade: 'rare',
    reqLevel: 21, ac: -24, bonusHp: 40, price: 26000, sell: 5500, enhanceable: true,
    desc: '무겁지만, 이걸 입고 죽는 사람은 드뭅니다.',
  },
  {
    id: 'armor-shadow', name: '그림자 사슬 갑옷', kind: 'armor', slot: 'armor', grade: 'epic',
    reqLevel: 28, ac: -32, bonusHp: 70, price: 0, sell: 14000, enhanceable: true,
    desc: '빛을 먹어 윤곽이 잘 보이지 않습니다.',
  },
  {
    id: 'armor-dragon', name: '용린 갑옷', kind: 'armor', slot: 'armor', grade: 'legend',
    reqLevel: 34, ac: -44, bonusHp: 140, price: 0, sell: 45000, enhanceable: true,
    desc: '고룡의 비늘을 그대로 이어 붙였습니다. 불에 그을리지 않습니다.',
  },

  /* --------------------------------------------------------------- 투구 */
  {
    id: 'helm-cap', name: '가죽 모자', kind: 'helmet', slot: 'helmet', grade: 'common',
    reqLevel: 1, ac: -2, price: 120, sell: 25, enhanceable: true, desc: '햇빛은 확실히 막아줍니다.',
  },
  {
    id: 'helm-iron', name: '강철 투구', kind: 'helmet', slot: 'helmet', grade: 'common',
    reqLevel: 9, ac: -7, price: 2600, sell: 550, enhanceable: true, desc: '시야가 좁아지는 대신 머리를 지킵니다.',
  },
  {
    id: 'helm-knight', name: '기사 투구', kind: 'helmet', slot: 'helmet', grade: 'rare',
    reqLevel: 18, ac: -13, bonusHp: 25, price: 12000, sell: 2600, enhanceable: true,
    desc: '얼굴을 완전히 가립니다.',
  },
  {
    id: 'helm-mithril', name: '미스릴 투구', kind: 'helmet', slot: 'helmet', grade: 'epic',
    reqLevel: 27, ac: -20, bonusHp: 55, price: 0, sell: 11000, enhanceable: true,
    desc: '깃털처럼 가벼운데 강철보다 단단합니다.',
  },

  /* --------------------------------------------------------------- 반지 */
  {
    id: 'ring-hp', name: '체력의 반지', kind: 'ring', slot: 'ring', grade: 'common',
    reqLevel: 5, bonusHp: 50, price: 2200, sell: 450, desc: '끼고 있으면 숨이 덜 찹니다.',
  },
  {
    id: 'ring-mp', name: '지혜의 반지', kind: 'ring', slot: 'ring', grade: 'common',
    reqLevel: 5, bonusMp: 70, price: 2200, sell: 450, desc: '머리가 맑아집니다.',
  },
  {
    id: 'ring-power', name: '힘의 반지', kind: 'ring', slot: 'ring', grade: 'rare',
    reqLevel: 12, bonusDamage: 6, price: 9000, sell: 1900, desc: '주먹에 힘이 들어갑니다.',
  },
  {
    id: 'ring-blood', name: '흡혈의 반지', kind: 'ring', slot: 'ring', grade: 'epic',
    reqLevel: 20, lifesteal: 0.07, bonusHp: 30, price: 0, sell: 9000,
    desc: '입힌 피해의 일부가 내 상처를 메웁니다. 오래 사냥할수록 값어치를 합니다.',
  },
  {
    id: 'ring-dragon', name: '용의 반지', kind: 'ring', slot: 'ring', grade: 'legend',
    reqLevel: 32, bonusHp: 110, bonusDamage: 11, bonusCrit: 0.06, price: 0, sell: 38000,
    desc: '고룡의 심장 근처에서 발견됩니다.',
  },

  /* --------------------------------------------------------------- 물약 */
  {
    id: 'pot-hp-s', name: '소형 체력 물약', kind: 'potion', grade: 'common', healHp: 90,
    stackable: true, price: 40, sell: 10, desc: '체력 90 회복.',
  },
  {
    id: 'pot-hp', name: '체력 물약', kind: 'potion', grade: 'common', healHp: 270,
    stackable: true, price: 140, sell: 35, desc: '체력 270 회복.',
  },
  {
    id: 'pot-hp-l', name: '고급 체력 물약', kind: 'potion', grade: 'rare', healHp: 750,
    stackable: true, price: 420, sell: 105, desc: '체력 750 회복. 후반 사냥터의 필수품입니다.',
  },
  {
    id: 'pot-mp-s', name: '마나 물약', kind: 'potion', grade: 'common', healMp: 90,
    stackable: true, price: 80, sell: 20, desc: '마나 90 회복.',
  },
  {
    id: 'pot-mp', name: '고급 마나 물약', kind: 'potion', grade: 'rare', healMp: 280,
    stackable: true, price: 260, sell: 65, desc: '마나 280 회복.',
  },

  /* --------------------------------------------------------------- 주문서 */
  {
    id: 'scroll-enhance', name: '마법 주문서', kind: 'scroll', grade: 'rare', scroll: 'enhance',
    stackable: true, price: 2200, sell: 550,
    desc: '장비를 한 단계 강화합니다. 실패하면 그 장비는 부서져 사라집니다.',
  },
  {
    id: 'scroll-blessed', name: '축복받은 마법 주문서', kind: 'scroll', grade: 'legend', scroll: 'blessedEnhance',
    stackable: true, price: 28000, sell: 7000,
    desc: '실패해도 장비가 부서지지 않고 +0 으로 돌아갑니다. 높은 강화는 이걸로만 노립니다.',
  },
  {
    id: 'scroll-return', name: '귀환 주문서', kind: 'scroll', grade: 'common', scroll: 'return',
    stackable: true, price: 300, sell: 75, desc: '어디서든 즉시 마을로 돌아갑니다.',
  },
  {
    id: 'scroll-resurrect', name: '부활 주문서', kind: 'scroll', grade: 'rare', scroll: 'resurrect',
    stackable: true, price: 1800, sell: 450,
    desc: '죽어서 잃은 경험치의 절반을 되찾습니다. 죽은 직후에만 씁니다.',
  },

  /* --------------------------------------------------------------- 재료 */
  {
    id: 'mat-pelt', name: '늑대 가죽', kind: 'misc', grade: 'common', stackable: true,
    price: 0, sell: 26, desc: '상인에게 팔면 값을 쳐줍니다.',
  },
  {
    id: 'mat-tooth', name: '고블린 이빨', kind: 'misc', grade: 'common', stackable: true,
    price: 0, sell: 55, desc: '상인에게 팔면 값을 쳐줍니다.',
  },
  {
    id: 'mat-ore', name: '마력석', kind: 'misc', grade: 'common', stackable: true,
    price: 0, sell: 150, desc: '광산 깊은 곳에서만 나옵니다.',
  },
  {
    id: 'mat-tusk', name: '오크 어금니', kind: 'misc', grade: 'common', stackable: true,
    price: 0, sell: 320, desc: '전사의 증표로 여겨집니다.',
  },
  {
    id: 'mat-scale', name: '용의 비늘', kind: 'misc', grade: 'rare', stackable: true,
    price: 0, sell: 1100, desc: '한 장만 팔아도 한동안 물약 걱정이 없습니다.',
  },
];

/** 아이템 id → 설계도. 게임 전체가 이 표를 통해 아이템을 찾습니다 */
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  ITEM_LIST.map((item) => [item.id, item]),
);

export function itemDef(defId: string): ItemDef {
  const def = ITEMS[defId];
  if (!def) throw new Error(`알 수 없는 아이템: ${defId}`);
  return def;
}

/** 상점에 진열되는 순서 */
export const SHOP_STOCK: string[] = [
  'pot-hp-s', 'pot-hp', 'pot-hp-l', 'pot-mp-s', 'pot-mp',
  'scroll-return', 'scroll-resurrect', 'scroll-enhance', 'scroll-blessed',
  'sword-dagger', 'sword-long', 'sword-axe', 'sword-claymore',
  'bow-short', 'bow-long', 'bow-composite', 'bow-silver',
  'staff-wood', 'staff-oak', 'staff-crystal', 'staff-arch',
  'armor-cloth', 'armor-leather', 'armor-scale', 'armor-plate',
  'helm-cap', 'helm-iron', 'helm-knight',
  'ring-hp', 'ring-mp', 'ring-power',
];

/** 등급별 색 (화면 여기저기에서 씁니다) */
export const GRADE_COLOR: Record<string, string> = {
  common: '#cbd5e1',
  rare: '#60a5fa',
  epic: '#c084fc',
  legend: '#fbbf24',
};

export const GRADE_LABEL: Record<string, string> = {
  common: '일반',
  rare: '희귀',
  epic: '영웅',
  legend: '전설',
};
