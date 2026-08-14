/**
 * ===========================================================================
 *  사건 목록 — 게임 중간에 끼어드는 바깥 세상의 소식
 * ===========================================================================
 *
 *  사건 창이 뜨면 시간이 멈추고, 플레이어는 선택지 중 하나를 골라야 합니다.
 *  좋은 사건이란 "어느 쪽을 골라도 뭔가를 잃는" 사건입니다.
 *  그래서 여기 있는 선택지는 대부분 아래 셋 중 하나의 저울질입니다.
 *
 *      · 돈 vs 속도       (지금 큰돈을 쓰고 훈련을 지킬 것인가)
 *      · 안전 vs 속도     (검증을 건너뛰고 앞서 나갈 것인가)
 *      · 지금 손해 vs 나중 이득
 *
 *  ─ 새 사건을 추가하고 싶다면
 *      아래 블록 하나를 통째로 복사해서 문구와 숫자만 고치면 됩니다.
 *      코드는 한 줄도 고칠 필요가 없습니다.
 *
 *  ─ 숫자를 고를 때의 기준 (balance.ts 와 자릿수를 맞춥니다)
 *      · 돈    : 수백만 ~ 수천만 달러   (시작 자금이 5,000만 달러)
 *      · GPU   : 수백 ~ 수천 장         (GPU 한 장이 3만 달러)
 *      · 전력  : 한 자리 ~ 수십 MW      (1MW 로 GPU 833장이 돌아감)
 *      · 진행도: 0.01 ~ 0.05            (0.05 면 후반 기준 1분 이상의 훈련)
 *
 *  ─ earliestAt 이란
 *      "이 시각(초) 전에는 절대 안 나온다"는 뜻입니다.
 *      시작하자마자 어려운 사건이 튀어나오면 손쓸 방법이 없기 때문에
 *      무거운 사건일수록 늦게 열어둡니다.
 *
 *  ★ 주의: 모든 사건은 "아무 조건 없이 고를 수 있는 선택지"를 최소 하나 가져야 합니다.
 *    두 선택지 모두 조건이 걸려 있으면 아무 버튼도 못 누르는 상황이 생깁니다.
 */

import type { GameEvent } from '../types';

/** 게임에 등장하는 사건 전체 목록 */
export const EVENT_POOL: GameEvent[] = [
  /* ── 공급망 ─────────────────────────────────────────────── */
  {
    id: 'event-gpu-allocation',
    kind: 'supply',
    title: 'GPU 물량 배정에서 밀렸다',
    description:
      '파운드리가 이번 분기 생산분을 대형 고객들에게 먼저 배정했습니다. 우리 주문은 뒤로 밀렸습니다. ' +
      '한 중개상이 웃돈을 얹으면 확보해둔 물량을 지금 바로 넘기겠다고 연락해왔습니다.',
    earliestAt: 120,
    once: false,
    choices: [
      {
        label: '웃돈을 주고 300장을 확보한다',
        hint: '큰돈이 한 번에 나가지만 훈련 일정은 지킵니다',
        requires: { money: 12_000_000 },
        player: { money: -12_000_000, gpus: 300 },
        logText: '중개상에게 웃돈을 주고 GPU 300장을 확보했습니다.',
        logTone: 'info',
      },
      {
        label: '이번 분기는 건너뛴다',
        hint: '돈은 아끼지만 한동안 GPU 값이 크게 뜁니다',
        market: { gpuPrice: 1.8, durationSeconds: 120 },
        logText: '물량 확보를 포기했습니다. 당분간 GPU 값이 1.8배로 뜁니다.',
        logTone: 'warn',
      },
    ],
  },
  {
    id: 'event-nextgen-accelerator',
    kind: 'supply',
    title: '차세대 가속기 공개',
    description:
      '경쟁 제조사가 새 세대 가속기를 공개했습니다. 성능 차이는 분명하지만 물량이 풀리려면 시간이 걸립니다. ' +
      '그 사이 현행 세대는 재고 정리에 들어갑니다.',
    earliestAt: 420,
    once: true,
    choices: [
      {
        label: '선주문하고 클러스터를 개조한다',
        hint: '큰돈이 나가는 대신 훈련이 단번에 앞으로 갑니다',
        requires: { money: 25_000_000 },
        player: { money: -25_000_000, researchProgress: 0.03 },
        logText: '차세대 가속기로 클러스터를 개조해 훈련이 크게 앞당겨졌습니다.',
        logTone: 'good',
      },
      {
        label: '재고 정리에 들어간 현행 세대를 노린다',
        hint: '한동안 GPU를 30% 싸게 살 수 있습니다',
        market: { gpuPrice: 0.7, durationSeconds: 180 },
        logText: '현행 세대 재고를 노립니다. 당분간 GPU 값이 30% 싸집니다.',
        logTone: 'good',
      },
    ],
  },

  /* ── 전력 ───────────────────────────────────────────────── */
  {
    id: 'event-grid-overload',
    kind: 'power',
    title: '지역 송전망 과부하',
    description:
      '무더위로 지역 전체 수요가 몰리면서 우리 단지에 걸린 송전망이 한계에 닿았습니다. ' +
      '전력회사는 자체 발전 설비를 마련하든지 계약 용량을 반납하든지 택하라고 통보했습니다.',
    earliestAt: 240,
    once: false,
    choices: [
      {
        label: '비상 발전기를 임대해 그대로 돌린다',
        hint: '돈은 나가지만 GPU를 한 장도 세우지 않습니다',
        requires: { money: 6_000_000 },
        player: { money: -6_000_000 },
        logText: '비상 발전기를 임대해 훈련을 멈추지 않았습니다.',
        logTone: 'info',
      },
      {
        label: '계약 전력 3MW를 반납한다',
        hint: '전기 요금은 줄지만 GPU 일부가 놀게 됩니다',
        player: { powerContracted: -3 },
        logText: '계약 전력 3MW를 반납했습니다. GPU 일부가 놀게 됩니다.',
        logTone: 'warn',
      },
    ],
  },
  {
    id: 'event-tariff-hike',
    kind: 'power',
    title: '전력 요금 인상 통보',
    description:
      '전력회사가 다음 분기 요금 인상을 통보했습니다. 다만 지금 한 번에 선납하면 ' +
      '인상분을 면제하고 오히려 할인가를 적용해주겠다고 제안합니다.',
    earliestAt: 330,
    once: false,
    choices: [
      {
        label: '선납해서 할인가를 확보한다',
        hint: '지금 돈이 나가지만 한동안 전기 요금이 싸집니다',
        requires: { money: 9_000_000 },
        player: { money: -9_000_000 },
        market: { powerPrice: 0.9, durationSeconds: 240 },
        logText: '요금을 선납해 한동안 전기 요금을 10% 깎았습니다.',
        logTone: 'good',
      },
      {
        label: '선납하지 않고 인상분을 감수한다',
        hint: '지금은 안 쓰지만 한동안 전기 요금이 1.6배가 됩니다',
        market: { powerPrice: 1.6, durationSeconds: 240 },
        logText: '전기 요금이 한동안 1.6배로 오릅니다.',
        logTone: 'warn',
      },
    ],
  },

  /* ── 규제 ───────────────────────────────────────────────── */
  {
    id: 'event-export-control',
    kind: 'regulation',
    title: '고성능 가속기 수출 통제 발효',
    description:
      '정부가 고성능 가속기의 반출입을 통제하기 시작했습니다. 규정을 지키려면 설계를 다시 손봐야 하고, ' +
      '우회 경로를 쓰면 물량은 들어오지만 내부 검증 절차를 건너뛰게 됩니다.',
    earliestAt: 480,
    once: true,
    choices: [
      {
        label: '규정에 맞춰 설계를 다시 한다',
        hint: '우리가 밀리지만 경쟁사도 같이 밀립니다',
        player: { researchProgress: -0.02 },
        rivals: { target: 'all', momentum: 0.85 },
        logText: '통제 규정에 맞춰 설계를 고쳤습니다. 업계 전체가 함께 느려집니다.',
        logTone: 'info',
      },
      {
        label: '우회 조달 경로로 400장을 들여온다',
        hint: '지금은 이득이지만 검증이 헐거워져 사고 위험이 올라갑니다',
        player: { gpus: 400, safety: -0.1 },
        logText: '우회 경로로 GPU 400장을 들여왔습니다. 내부 검증 절차가 헐거워졌습니다.',
        logTone: 'warn',
      },
    ],
  },
  {
    id: 'event-senate-hearing',
    kind: 'regulation',
    title: '의회 청문회 소환',
    description:
      '의회가 프런티어 모델을 만드는 연구소 대표들을 불러세웠습니다. ' +
      '직접 나가면 며칠을 통째로 쓰게 되고, 대리인만 보내면 시간은 아끼지만 곱지 않은 시선이 남습니다.',
    earliestAt: 660,
    once: true,
    choices: [
      {
        label: '대표가 직접 출석해 성실히 답한다',
        hint: '며칠을 잃는 대신 검증 체계를 정비합니다',
        player: { researchProgress: -0.015, safety: 0.05 },
        logText: '청문회에 직접 출석했습니다. 훈련은 며칠 밀렸지만 검증 체계를 정비했습니다.',
        logTone: 'info',
      },
      {
        label: '법무 대리인만 보내고 훈련을 계속한다',
        hint: '일정은 지키지만 돈이 나가고 감시가 심해집니다',
        player: { money: -5_000_000, safety: -0.05 },
        logText: '대리인만 보냈습니다. 훈련은 멈추지 않았지만 감시가 심해졌습니다.',
        logTone: 'warn',
      },
    ],
  },

  /* ── 인재 ───────────────────────────────────────────────── */
  {
    id: 'event-poaching',
    kind: 'talent',
    title: '경쟁사의 스카웃 공세',
    description:
      '경쟁 연구소가 우리 핵심 연구원들에게 두 배에 가까운 조건을 제시했습니다. ' +
      '붙잡으려면 보상 체계를 다시 짜야 하고, 놓치면 그들은 곧장 상대편 훈련에 투입됩니다.',
    earliestAt: 300,
    once: false,
    choices: [
      {
        label: '보상을 올려 붙잡는다',
        hint: '지금 큰돈이 나가지만 인력을 그대로 지킵니다',
        requires: { money: 7_000_000 },
        player: { money: -7_000_000 },
        logText: '보상 체계를 다시 짜서 핵심 연구원들을 붙잡았습니다.',
        logTone: 'info',
      },
      {
        label: '보내주고 남은 인원으로 간다',
        hint: '인건비는 줄지만 경쟁사 한 곳이 빨라집니다',
        player: { researchers: -2 },
        rivals: { target: 'random', momentum: 1.15 },
        logText: '연구원 2명이 경쟁사로 떠났습니다.',
        logTone: 'bad',
      },
    ],
  },

  /* ── 안전 ───────────────────────────────────────────────── */
  {
    id: 'event-internal-warning',
    kind: 'safety',
    title: '내부 안전팀의 경고',
    description:
      '내부 평가팀이 최근 체크포인트에서 설명되지 않는 행동을 발견했다고 보고했습니다. ' +
      '전면 점검을 하려면 훈련을 세워야 하고, 기록만 남기고 넘어가면 일정은 지킬 수 있습니다.',
    earliestAt: 360,
    once: false,
    choices: [
      {
        label: '훈련을 세우고 전면 점검한다',
        hint: '진행이 밀리는 대신 사고 확률이 내려갑니다',
        player: { researchProgress: -0.02, safety: 0.1 },
        logText: '훈련을 세우고 전면 점검했습니다. 검증 수준이 올라갔습니다.',
        logTone: 'info',
      },
      {
        label: '기록만 남기고 계속 돌린다',
        hint: '일정은 지키지만 사고 확률이 올라갑니다',
        player: { safety: -0.08 },
        logText: '경고를 기록만 남기고 훈련을 계속합니다.',
        logTone: 'warn',
      },
    ],
  },

  /* ── 기회 ───────────────────────────────────────────────── */
  {
    id: 'event-sovereign-fund',
    kind: 'opportunity',
    title: '국부펀드의 대형 투자 제안',
    description:
      '해외 국부펀드가 한 번에 8,000만 달러를 넣겠다고 제안했습니다. 대신 지분을 상당히 요구합니다. ' +
      '거절하면 그 돈은 곧장 다른 연구소로 갈 것입니다.',
    earliestAt: 450,
    once: true,
    choices: [
      {
        label: '제안을 받아들인다',
        hint: '자금이 크게 들어오지만 지분 12%를 내줍니다',
        player: { money: 80_000_000, equityRetained: -0.12 },
        logText: '국부펀드 투자를 받아 8,000만 달러를 확보했습니다. 지분 12%를 넘겼습니다.',
        logTone: 'good',
      },
      {
        label: '지분을 지키고 거절한다',
        hint: '지분은 지키지만 그 자금이 경쟁사로 갑니다',
        rivals: { target: 'random', momentum: 1.2 },
        logText: '투자를 거절했습니다. 그 자금은 경쟁사 한 곳으로 흘러갔습니다.',
        logTone: 'warn',
      },
    ],
  },
  {
    id: 'event-joint-training',
    kind: 'opportunity',
    title: '공동 훈련 컨소시엄 제안',
    description:
      '대학 연합이 공동 훈련 컨소시엄을 제안했습니다. 우리 클러스터 일부를 내주는 대신 ' +
      '그들이 몇 년간 쌓은 데이터와 방법론을 통째로 넘겨받습니다.',
    earliestAt: 540,
    once: true,
    choices: [
      {
        label: 'GPU 500장을 내주고 참여한다',
        hint: '설비는 줄지만 훈련이 크게 앞으로 갑니다',
        requires: { gpus: 500 },
        player: { gpus: -500, researchProgress: 0.05 },
        logText: '컨소시엄에 참여해 데이터와 방법론을 넘겨받았습니다.',
        logTone: 'good',
      },
      {
        label: '단독 노선을 유지한다',
        hint: '설비는 지키지만 연합이 경쟁사들과 손을 잡습니다',
        rivals: { target: 'all', researchProgress: 0.012 },
        logText: '컨소시엄 참여를 거절했습니다. 연합은 경쟁사들과 손을 잡았습니다.',
        logTone: 'warn',
      },
    ],
  },
];
