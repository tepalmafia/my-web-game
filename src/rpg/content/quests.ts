/**
 *  퀘스트 — 한 번에 하나씩, 순서대로.
 *
 *  리니지에는 사실 퀘스트가 거의 없지만, 혼자 하는 게임에서는
 *  "다음에 어디로 가야 하는가"를 알려줄 무언가가 필요합니다.
 *  그 역할만 합니다. 조건을 채우면 그 자리에서 자동으로 완료됩니다.
 */

import type { QuestDef } from '../types';

export const QUESTS: QuestDef[] = [
  {
    id: 'q1', name: '첫 사냥', monsterId: 'rat', count: 6,
    desc: '촌장이 마을 앞 들쥐부터 정리해 달라고 합니다.',
    rewardExp: 70, rewardGold: 250, rewardItems: [{ defId: 'pot-hp-s', count: 5 }],
    hint: '마을 남쪽 문으로 나가면 초원입니다.',
  },
  {
    id: 'q2', name: '끈적한 것들', monsterId: 'slime', count: 10,
    desc: '슬라임이 우물가까지 내려오고 있습니다.',
    rewardExp: 190, rewardGold: 500, rewardItems: [{ defId: 'helm-cap', count: 1 }],
    hint: '초원 가운데쯤에 많습니다.',
  },
  {
    id: 'q3', name: '들개 무리', monsterId: 'wolf', count: 12,
    desc: '들개가 무리를 지어 다니기 시작했습니다.',
    rewardExp: 520, rewardGold: 1100, rewardItems: [{ defId: 'pot-hp', count: 6 }],
    hint: '들개는 먼저 덤빕니다. 체력을 보면서 잡으세요.',
  },
  {
    id: 'q4', name: '협곡의 초록 눈', monsterId: 'goblin', count: 15,
    desc: '초원 동쪽 협곡에 고블린이 자리를 잡았습니다.',
    rewardExp: 1600, rewardGold: 2600, rewardItems: [{ defId: 'scroll-enhance', count: 1 }],
    hint: '초원 오른쪽 끝의 문으로 협곡에 들어갑니다.',
  },
  {
    id: 'q5', name: '화살을 든 것들', monsterId: 'goblin-archer', count: 15,
    desc: '멀리서 쏘아대는 궁수가 성가십니다.',
    rewardExp: 3200, rewardGold: 4000, rewardItems: [{ defId: 'ring-hp', count: 1 }],
    hint: '궁수는 거리를 두려 합니다. 먼저 붙으세요.',
  },
  {
    id: 'q6', name: '두목의 목', monsterId: 'goblin-chief', count: 1,
    desc: '협곡 안쪽에 유난히 큰 고블린이 있습니다.',
    rewardExp: 7000, rewardGold: 9000, rewardItems: [{ defId: 'scroll-enhance', count: 2 }],
    hint: '바닥에 붉은 원이 그려지면 그 자리에서 벗어나세요.',
  },
  {
    id: 'q7', name: '갱도의 날갯짓', monsterId: 'bat', count: 20,
    desc: '광산 입구에 박쥐가 가득합니다.',
    rewardExp: 6000, rewardGold: 7000, rewardItems: [{ defId: 'pot-hp', count: 10 }],
    hint: '협곡 오른쪽 끝의 갱도가 버려진 광산입니다.',
  },
  {
    id: 'q8', name: '아직 일하는 자들', monsterId: 'miner', count: 20,
    desc: '죽어서도 곡괭이를 놓지 않은 광부들이 있습니다.',
    rewardExp: 8000, rewardGold: 11000, rewardItems: [{ defId: 'scroll-enhance', count: 2 }],
    hint: '마력석을 모아 상인에게 파세요. 강화 주문서 값이 됩니다.',
  },
  {
    id: 'q9', name: '움직이는 돌', monsterId: 'golem', count: 15,
    desc: '갱도 깊은 곳의 석상이 걸어다닙니다.',
    rewardExp: 12000, rewardGold: 18000, rewardItems: [{ defId: 'helm-iron', count: 1 }],
    hint: '골렘은 느립니다. 활과 지팡이라면 거리를 유지하세요.',
  },
  {
    id: 'q10', name: '감독관', monsterId: 'overseer', count: 1,
    desc: '광산 가장 깊은 곳에 감독관이 남아 있습니다.',
    rewardExp: 16000, rewardGold: 26000, rewardItems: [{ defId: 'scroll-enhance', count: 3 }],
    hint: '체력 물약을 넉넉히 채우고 들어가세요.',
  },
  {
    id: 'q11', name: '요새의 전사들', monsterId: 'orc', count: 25,
    desc: '광산 너머 오크들이 요새를 쌓았습니다.',
    rewardExp: 20000, rewardGold: 30000, rewardItems: [{ defId: 'pot-hp-l', count: 12 }],
    hint: '이제 판금 갑옷을 살 때가 됐습니다.',
  },
  {
    id: 'q12', name: '북을 멈춰라', monsterId: 'orc-shaman', count: 20,
    desc: '주술사의 북소리가 오크들을 부추기고 있습니다.',
    rewardExp: 26000, rewardGold: 40000, rewardItems: [{ defId: 'scroll-blessed', count: 1 }],
    hint: '축복받은 주문서는 실패해도 장비가 부서지지 않습니다.',
  },
  {
    id: 'q13', name: '대족장', monsterId: 'orc-chief', count: 1,
    desc: '요새 안쪽 옥좌에 대족장이 앉아 있습니다.',
    rewardExp: 34000, rewardGold: 45000, rewardItems: [{ defId: 'scroll-blessed', count: 1 }],
    hint: '광역기가 아픕니다. 붉은 원 밖으로.',
  },
  {
    id: 'q14', name: '재의 계곡', monsterId: 'drake', count: 20,
    desc: '요새 너머는 용의 둥지입니다.',
    rewardExp: 40000, rewardGold: 50000, rewardItems: [{ defId: 'pot-hp-l', count: 20 }],
    hint: '드레이크는 빠르고 아픕니다. 한 마리씩 끌어내세요.',
  },
  {
    id: 'q15', name: '꺼지지 않는 불', monsterId: 'flame', count: 20,
    desc: '정령들이 둥지의 열기를 지키고 있습니다.',
    rewardExp: 46000, rewardGold: 65000, rewardItems: [{ defId: 'scroll-blessed', count: 2 }],
    hint: '용의 비늘은 비싸게 팔립니다.',
  },
  {
    id: 'q16', name: '고룡 카르나스', monsterId: 'carnas', count: 1,
    desc: '이 땅의 마지막 용을 잡습니다.',
    rewardExp: 120000, rewardGold: 100000, rewardItems: [{ defId: 'scroll-blessed', count: 3 }],
    hint: '죽어도 4분 뒤 다시 나타납니다. 몇 번이고 도전하세요.',
  },
];
