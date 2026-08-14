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
 *  ★ 이 파일에는 '숫자'만 있습니다. 화면에 나가는 글은 i18n 폴더에 있습니다.
 *    두 언어로 목록을 통째로 복사해두면, 밸런스를 고칠 때 한쪽만 고치고
 *    다른 쪽을 잊는 사고가 반드시 납니다. 숫자는 여기 한 곳에만 둡니다.
 *
 *  ─ 새 사건을 추가하려면
 *      1) 아래 EVENT_IDS 에 이름표를 하나 추가하고
 *      2) MECHANICS 에 숫자를 적고
 *      3) i18n/en.ts 와 i18n/ko.ts 에 문구를 적습니다
 *      셋 중 하나라도 빠지면 타입 검사에서 걸리므로 조용히 누락될 수 없습니다.
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

import { s } from '../i18n';
import type {
  EventKind,
  GameEvent,
  LogTone,
  MarketDelta,
  PlayerDelta,
  Requirement,
  RivalDelta,
  Seconds,
} from '../types';

/** 사건 이름표 목록. 문구 사전도 이 목록과 같은 항목을 가져야 합니다 */
export const EVENT_IDS = [
  'event-gpu-allocation',
  'event-nextgen-accelerator',
  'event-grid-overload',
  'event-tariff-hike',
  'event-export-control',
  'event-senate-hearing',
  'event-poaching',
  'event-internal-warning',
  'event-sovereign-fund',
  'event-joint-training',
] as const;

/** 사건 하나를 가리키는 이름표 */
export type EventKey = (typeof EVENT_IDS)[number];

/** 선택지 하나의 '숫자 부분' (글은 사전에 있습니다) */
interface ChoiceMechanics {
  requires?: Requirement;
  player?: PlayerDelta;
  market?: MarketDelta;
  rivals?: RivalDelta;
  logTone: LogTone;
}

/** 사건 하나의 '숫자 부분' */
interface EventMechanics {
  kind: EventKind;
  earliestAt: Seconds;
  once: boolean;
  choices: ChoiceMechanics[];
}

/** 사건별 숫자. 밸런스를 고칠 때 보는 곳은 여기 하나뿐입니다 */
const MECHANICS: Record<EventKey, EventMechanics> = {
  /* ── 공급망 ─────────────────────────────────────────────── */
  'event-gpu-allocation': {
    kind: 'supply',
    earliestAt: 120,
    once: false,
    choices: [
      {
        requires: { money: 12_000_000 },
        player: { money: -12_000_000, gpus: 300 },
        logTone: 'info',
      },
      { market: { gpuPrice: 1.8, durationSeconds: 120 }, logTone: 'warn' },
    ],
  },
  'event-nextgen-accelerator': {
    kind: 'supply',
    earliestAt: 420,
    once: true,
    choices: [
      {
        requires: { money: 25_000_000 },
        player: { money: -25_000_000, researchProgress: 0.03 },
        logTone: 'good',
      },
      { market: { gpuPrice: 0.7, durationSeconds: 180 }, logTone: 'good' },
    ],
  },

  /* ── 전력 ───────────────────────────────────────────────── */
  'event-grid-overload': {
    kind: 'power',
    earliestAt: 240,
    once: false,
    choices: [
      { requires: { money: 6_000_000 }, player: { money: -6_000_000 }, logTone: 'info' },
      { player: { powerContracted: -3 }, logTone: 'warn' },
    ],
  },
  'event-tariff-hike': {
    kind: 'power',
    earliestAt: 330,
    once: false,
    choices: [
      {
        requires: { money: 9_000_000 },
        player: { money: -9_000_000 },
        market: { powerPrice: 0.9, durationSeconds: 240 },
        logTone: 'good',
      },
      { market: { powerPrice: 1.6, durationSeconds: 240 }, logTone: 'warn' },
    ],
  },

  /* ── 규제 ───────────────────────────────────────────────── */
  'event-export-control': {
    kind: 'regulation',
    earliestAt: 480,
    once: true,
    choices: [
      {
        player: { researchProgress: -0.02 },
        rivals: { target: 'all', momentum: 0.85 },
        logTone: 'info',
      },
      { player: { gpus: 400, safety: -0.1 }, logTone: 'warn' },
    ],
  },
  'event-senate-hearing': {
    kind: 'regulation',
    earliestAt: 660,
    once: true,
    choices: [
      { player: { researchProgress: -0.015, safety: 0.05 }, logTone: 'info' },
      { player: { money: -5_000_000, safety: -0.05 }, logTone: 'warn' },
    ],
  },

  /* ── 인재 ───────────────────────────────────────────────── */
  'event-poaching': {
    kind: 'talent',
    earliestAt: 300,
    once: false,
    choices: [
      { requires: { money: 7_000_000 }, player: { money: -7_000_000 }, logTone: 'info' },
      {
        player: { researchers: -2 },
        rivals: { target: 'random', momentum: 1.15 },
        logTone: 'bad',
      },
    ],
  },

  /* ── 안전 ───────────────────────────────────────────────── */
  'event-internal-warning': {
    kind: 'safety',
    earliestAt: 360,
    once: false,
    choices: [
      { player: { researchProgress: -0.02, safety: 0.1 }, logTone: 'info' },
      { player: { safety: -0.08 }, logTone: 'warn' },
    ],
  },

  /* ── 기회 ───────────────────────────────────────────────── */
  'event-sovereign-fund': {
    kind: 'opportunity',
    earliestAt: 450,
    once: true,
    choices: [
      { player: { money: 80_000_000, equityRetained: -0.12 }, logTone: 'good' },
      { rivals: { target: 'random', momentum: 1.2 }, logTone: 'warn' },
    ],
  },
  'event-joint-training': {
    kind: 'opportunity',
    earliestAt: 540,
    once: true,
    choices: [
      {
        requires: { gpus: 500 },
        player: { gpus: -500, researchProgress: 0.05 },
        logTone: 'good',
      },
      { rivals: { target: 'all', researchProgress: 0.012 }, logTone: 'warn' },
    ],
  },
};

/**
 * 지금 언어로 된 사건 목록을 만듭니다.
 *
 * 숫자(MECHANICS)와 글(사전)을 여기서 합칩니다.
 * 사건을 고를 때마다 부르므로, 언어를 바꾸면 그 뒤에 나오는 사건부터 새 언어로 나옵니다.
 */
export function eventPool(): GameEvent[] {
  const text = s().events;

  return EVENT_IDS.map((id) => {
    const mechanics = MECHANICS[id];
    const copy = text[id];

    return {
      id,
      kind: mechanics.kind,
      title: copy.title,
      description: copy.description,
      earliestAt: mechanics.earliestAt,
      once: mechanics.once,
      choices: mechanics.choices.map((choice, index) => {
        // 선택지 개수는 숫자 쪽이 기준입니다. 사전에 글이 모자라면 타입 검사에서 걸립니다
        const words = copy.choices[index]!;
        return {
          label: words.label,
          ...(words.hint === undefined ? {} : { hint: words.hint }),
          ...(choice.requires === undefined ? {} : { requires: choice.requires }),
          ...(choice.player === undefined ? {} : { player: choice.player }),
          ...(choice.market === undefined ? {} : { market: choice.market }),
          ...(choice.rivals === undefined ? {} : { rivals: choice.rivals }),
          logText: words.logText,
          logTone: choice.logTone,
        };
      }),
    };
  });
}
