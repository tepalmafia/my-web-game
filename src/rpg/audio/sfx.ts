/**
 *  소리의 정의표 — 숫자만 있습니다. 계산은 한 줄도 없습니다.
 *
 *  설계 문서 §4 를 그대로 옮겨 적은 표입니다. 소리를 다듬을 때는 여기 숫자만 만집니다.
 *  dur 은 ms, gain 은 0~1 의 상대 크기, at 은 시작을 늦추는 ms.
 */

/**
 *  §4.1 검 타격 (일반) — 세 층을 **같은 시각에** 시작합니다.
 *  어긋나면 한 번 때린 것이 두 번으로 들립니다.
 */
export const SWORD_HIT = {
  /** 피치를 매번 ±6% 흔듭니다. 없으면 열 번째부터 기계음처럼 들립니다 */
  jitter: 0.06,
  /** 어택. 타격감의 절반이 이 딸깍 하나에 있습니다 */
  click: { hp: 2000, dur: 15, gain: 0.5 },
  /** 무게. 폰 스피커가 200Hz 아래를 못 내므로 240→95Hz 에 겁니다 */
  weight: { from: 240, to: 95, wave: 'triangle', dur: 70, gain: 0.8 },
  /** 질감 */
  texture: { bp: 850, q: 2, dur: 45, gain: 0.35 },
} as const;

/**
 *  §4.2 검 타격 (크리티컬) — 일반 세 층 위에 얹습니다.
 *  크기가 아니라 종류가 달라야 합니다: 저역이 더 낮고, 꼬리가 길고, 주변이 조용해집니다.
 */
export const SWORD_CRIT = {
  jitter: 0.06,
  /** 서브. 폰에서는 들리지 않고 이어폰에서만 옵니다 */
  sub: { from: 90, to: 38, wave: 'sine', dur: 200, gain: 0.9 },
  /** 잔향. 25ms 늦게 들어와야 '뒤따라 울리는' 것이 됩니다 */
  tail: { base: 3000, dur: 300, gain: 0.25, at: 25 },
  /** 주변을 눌러 크리티컬만 남깁니다 */
  duck: { decibels: 6, holdMs: 80 },
} as const;

/**
 *  §4.3 막힘 / 방어 성공 (이 게임에서는 '회피')
 *  ★ 무게 층(thump)을 넣지 않습니다. 막았으니 몸에 안 들어갔다는 뜻이어야 합니다.
 */
export const BLOCK = {
  jitter: 0.06,
  edge: { hp: 3000, dur: 8, gain: 0.6 },
  ring: { base: 1400, dur: 220, gain: 0.5 },
} as const;

/**
 *  §4.4 빗나감
 *  ★ 저역 금지. miss 에 무게가 없어야 hit 의 무게가 대비로 삽니다.
 */
export const MISS = {
  jitter: 0.06,
  air: { from: 1600, to: 450, q: 3, dur: 130, gain: 0.3 },
} as const;

/**
 *  §4.5 피격 (플레이어가 맞음)
 *  고역을 깎아 둔탁하게. 덕킹이 숨 막히는 느낌을 만듭니다.
 */
export const TAKEN = {
  jitter: 0.06,
  body: { from: 160, to: 55, wave: 'sine', dur: 160, gain: 0.9 },
  dull: { lp: 1200, dur: 90, gain: 0.4 },
  duck: { decibels: 4, holdMs: 80 },
} as const;

/**
 *  §4.6 채굴 — 수천 번 반복됩니다. 피로 방지가 전부입니다.
 *  변형 넷을 돌려 쓰고 피치를 ±8% 흔듭니다. 한 번이 200ms 를 넘지 않습니다.
 */
export const MINE = {
  jitter: 0.08,
  /** 네 가지를 번갈아 씁니다 — 같은 소리가 연달아 나지 않도록 */
  variants: [
    { tick: { bp: 2200, q: 4, dur: 25, gain: 0.4 }, hit: { from: 300, to: 140, wave: 'square', dur: 55, gain: 0.5 } },
    { tick: { bp: 2600, q: 4, dur: 22, gain: 0.36 }, hit: { from: 330, to: 155, wave: 'square', dur: 48, gain: 0.46 } },
    { tick: { bp: 1900, q: 5, dur: 28, gain: 0.42 }, hit: { from: 270, to: 125, wave: 'square', dur: 62, gain: 0.52 } },
    { tick: { bp: 2400, q: 3, dur: 20, gain: 0.34 }, hit: { from: 310, to: 165, wave: 'square', dur: 44, gain: 0.44 } },
  ],
} as const;

/** §4.6 광석이 나온 순간만 다른 소리 — 보상 신호 (상승) */
export const ORE = {
  jitter: 0.06,
  chime: { base: 350, to: 700, dur: 180, gain: 0.45 },
} as const;

/**
 *  §4.7 제작 실패 — 볼륨이 아니라 정적으로 만듭니다.
 *  0ms 울리던 것 즉시 정지 · 60ms 저음 · 그 뒤로는 아무것도 없음 · 800ms 에 풀림
 *  앞뒤의 침묵이 큰 소리보다 강합니다.
 */
export const CRAFT_FAIL = {
  jitter: 0.04,
  /** 이 시간 동안 다른 소리를 일절 받지 않습니다 */
  silenceMs: 800,
  drop: { from: 95, to: 28, wave: 'sine', dur: 500, gain: 1, at: 60 },
  air: { lp: 400, dur: 200, gain: 0.3, at: 60 },
} as const;

/**
 *  §4.8 우수품 제작 성공
 *  실패가 하강이면 성공은 상승. 방향만으로 뜻이 전해집니다.
 */
export const FINE = {
  jitter: 0.04,
  rise: { base: 800, to: 1600, dur: 400, gain: 0.6 },
  lift: { from: 200, to: 300, wave: 'sine', dur: 250, gain: 0.4 },
} as const;
