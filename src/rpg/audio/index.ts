/**
 * ===========================================================================
 *  feedback 이벤트 → 소리
 * ===========================================================================
 *
 *  ★ core/ 는 이 파일의 존재를 모릅니다. 여기서 core/feedback 을 구독합니다.
 *    방향은 언제나 audio → core 입니다.
 *
 *  ★ 무엇이 무슨 소리인가는 이벤트에 실려 오는 **원인(cause)** 하나로 정해집니다.
 *    화면에 어떻게 보이는지(kind)도, 뭐라고 적혔는지(text)도 보지 않습니다.
 *      · kind 는 표시용입니다 — 'miss' 한 칸에 헛친 검·피한 공격·허탕 친 곡괭이·
 *        망친 제작이 전부 들어 있어서, 그걸로 가르면 겹칩니다.
 *      · text 로 가르면 문구를 못 바꾸게 되고 다국어에서 무너집니다.
 *    그래서 이 파일에는 판별에 쓰는 한국어 문구가 한 줄도 없습니다 (테스트가 지킵니다).
 */

import { onFeedback, type FeedbackCause, type FeedbackEvent } from '../core/feedback';
import { duck, silence, unlock } from './bus';
import { metal, noise, sweep, thump } from './synth';
import { BLOCK, CRAFT_FAIL, FINE, MINE, MISS, ORE, SWORD_CRIT, SWORD_HIT, TAKEN } from './sfx';

/* ===========================================================================
 *  소리 내기
 * ======================================================================== */

/** §4.1 · §4.2 검이 맞았다 */
export function playSwordHit(crit: boolean): void {
  const jitter = SWORD_HIT.jitter;

  noise({ key: 'hit:click', ...SWORD_HIT.click, jitter });
  thump({ key: 'hit:weight', ...SWORD_HIT.weight, jitter });
  noise({ key: 'hit:texture', ...SWORD_HIT.texture, jitter });

  if (!crit) return;

  thump({ key: 'crit:sub', ...SWORD_CRIT.sub, jitter: SWORD_CRIT.jitter });
  metal({ key: 'crit:tail', ...SWORD_CRIT.tail, jitter: SWORD_CRIT.jitter });
  duck(SWORD_CRIT.duck.decibels, SWORD_CRIT.duck.holdMs);
}

/** §4.3 막았다 — 무게 층이 없어야 '몸에 안 들어왔다'가 됩니다 */
export function playBlock(): void {
  noise({ key: 'block:edge', ...BLOCK.edge, jitter: BLOCK.jitter });
  metal({ key: 'block:ring', ...BLOCK.ring, jitter: BLOCK.jitter });
}

/** §4.4 헛쳤다 — 저역이 없어야 맞았을 때의 무게가 삽니다 */
export function playMiss(): void {
  sweep({ key: 'miss:air', ...MISS.air, jitter: MISS.jitter });
}

/** §4.5 내가 맞았다 */
export function playTaken(): void {
  thump({ key: 'taken:body', ...TAKEN.body, jitter: TAKEN.jitter });
  noise({ key: 'taken:dull', ...TAKEN.dull, jitter: TAKEN.jitter });
  duck(TAKEN.duck.decibels, TAKEN.duck.holdMs);
}

/** §4.6 곡괭이가 바위를 때렸다 — 변형 넷을 돌려 씁니다 */
let pick = 0;

export function playMineSwing(): void {
  const variant = MINE.variants[pick % MINE.variants.length]!;
  pick += 1;
  noise({ key: 'mine:tick', ...variant.tick, jitter: MINE.jitter });
  thump({ key: 'mine:hit', ...variant.hit, jitter: MINE.jitter });
}

/** §4.6 광석이 손에 들어왔다 */
export function playOre(): void {
  metal({ key: 'mine:ore', ...ORE.chime, jitter: ORE.jitter });
}

/** §4.7 제작 실패 — 큰 소리가 아니라 정적입니다 */
export function playCraftFail(): void {
  silence(CRAFT_FAIL.silenceMs);
  thump({ key: 'fail:drop', ...CRAFT_FAIL.drop, jitter: CRAFT_FAIL.jitter, force: true });
  noise({ key: 'fail:air', ...CRAFT_FAIL.air, jitter: CRAFT_FAIL.jitter, force: true });
}

/** §4.8 우수품이 나왔다 — 실패가 하강이면 성공은 상승 */
export function playFine(): void {
  metal({ key: 'fine:rise', ...FINE.rise, jitter: FINE.jitter });
  thump({ key: 'fine:lift', ...FINE.lift, jitter: FINE.jitter });
}

/* ===========================================================================
 *  원인 → 소리
 * ======================================================================== */

/**
 * 어떤 원인에 어떤 소리를 낼 것인가.
 * 여기 없는 원인(골드·회복·실력 오름)은 아직 소리가 없습니다 — 그냥 조용합니다.
 */
const SOUNDS: Partial<Record<FeedbackCause, () => void>> = {
  'sword-hit': () => playSwordHit(false),
  'sword-crit': () => playSwordHit(true),
  'sword-miss': playMiss,
  dodge: playBlock,
  taken: playTaken,

  // 곡괭이질 한 번은 셋 중 하나로 끝납니다 — 캐냈거나, 허탕이거나, 더 들 수 없거나.
  // 셋 다 곡괭이가 바위를 때린 것이므로 같은 소리를 내고, 캐낸 것에만 보상음을 얹습니다.
  ore: () => {
    playMineSwing();
    playOre();
  },
  'mine-fail': playMineSwing,
  'pack-full': playMineSwing,

  'craft-fail': playCraftFail,
  'craft-fine': playFine,
};

/** 이 원인에 낼 소리 (없으면 null) */
export function soundFor(cause: FeedbackCause | undefined): (() => void) | null {
  return cause ? SOUNDS[cause] ?? null : null;
}

function hear(event: FeedbackEvent): void {
  if (event.at !== 'floater' && event.at !== 'toast') return;
  soundFor(event.cause)?.();
}

/* --------------------------------------------------------------- 이어 붙이기 */

/**
 * 소리를 켭니다. 돌려받은 함수를 부르면 완전히 뗍니다.
 *
 * ★ iOS 는 사람이 화면을 만지기 전에는 소리를 내주지 않습니다.
 *   그래서 첫 입력 한 번을 기다렸다가 그때 AudioContext 를 깨웁니다.
 */
export function attachAudio(): () => void {
  const stopListening = onFeedback(hear);

  const target = globalThis as unknown as {
    addEventListener?: typeof window.addEventListener;
    removeEventListener?: typeof window.removeEventListener;
  };
  const gestures = ['pointerdown', 'touchstart', 'keydown'] as const;

  const wake = () => {
    unlock();
    for (const name of gestures) target.removeEventListener?.(name, wake);
  };
  for (const name of gestures) {
    target.addEventListener?.(name, wake, { passive: true } as AddEventListenerOptions);
  }

  return () => {
    stopListening();
    for (const name of gestures) target.removeEventListener?.(name, wake);
  };
}
