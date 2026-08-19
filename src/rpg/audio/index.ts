/**
 * ===========================================================================
 *  feedback 이벤트 → 소리
 * ===========================================================================
 *
 *  ★ core/ 는 이 파일의 존재를 모릅니다. 여기서 core/feedback 을 구독합니다.
 *    방향은 언제나 audio → core 입니다.
 *
 *  ★ 무엇이 무슨 소리인가 — core/ 를 한 줄도 고치지 않고 가려내야 해서,
 *    같은 kind 안에서는 **문구**로 가릅니다. floater 'miss' 하나에
 *    빗나감 · 회피 · 채굴 실패 · 제작 실패 네 가지가 들어 있기 때문입니다.
 *    문구가 바뀌면 소리가 조용히 죽으므로, tests/rpg/audio.test.ts 가
 *    그 문구들을 붙잡아 둡니다. 거기가 깨지면 여기도 같이 고치세요.
 */

import { onFeedback, type FeedbackEvent } from '../core/feedback';
import { duck, silence, unlock } from './bus';
import { metal, noise, sweep, thump } from './synth';
import { BLOCK, CRAFT_FAIL, FINE, MINE, MISS, ORE, SWORD_CRIT, SWORD_HIT, TAKEN } from './sfx';

/* ===========================================================================
 *  core/ 가 쓰는 문구 — 이 글자들로 소리를 가릅니다
 * ======================================================================== */

export const CUES = {
  /** combat.ts — 내 검이 헛나감 */
  miss: '빗나감',
  /** combat.ts — 몬스터의 공격을 피함 */
  dodge: '회피',
  /** action.ts — 곡괭이질·제작이 허탕 */
  failed: '실패',
  /** action.ts — 제작 실패 (floater 보다 먼저 나옵니다) */
  craftFailed: '만들기에 실패했습니다',
  /** action.ts — 우수품이 나옴 */
  fine: '우수한 물건',
  /** action.ts — 캔 것이 손에 들어옴 (`+2 철광석`) */
  ore: '광석',
} as const;

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
 *  이벤트 가려듣기
 * ======================================================================== */

/** 무슨 소리를 낼 것인가 */
export type Cue =
  | 'sword'
  | 'sword-crit'
  | 'block'
  | 'miss'
  | 'taken'
  | 'mine'
  | 'mine-ore'
  | 'craft-fail'
  | 'fine';

/**
 * 제작 실패는 `log(…만들기에 실패했습니다)` 다음에 `floater('실패')` 가 옵니다.
 * 그 floater 를 곡괭이질로 잘못 듣지 않도록 잠깐 창을 열어 둡니다.
 */
const CRAFT_FAIL_WINDOW = 0.35; // 초 (세계 시간)

/**
 * 순수한 판별 — 상태는 인자로 받습니다.
 * ★ 여기가 이 층에서 가장 깨지기 쉬운 곳(문구 의존)이라 따로 떼어
 *   테스트가 표 전체를 확인할 수 있게 했습니다.
 *
 * @param sinceCraftFail 마지막 제작 실패로부터 흐른 시간(초)
 */
export function decide(event: FeedbackEvent, sinceCraftFail: number): Cue | null {
  if (event.at === 'log') {
    return event.text.includes(CUES.craftFailed) ? 'craft-fail' : null;
  }
  if (event.at === 'toast') {
    return event.tone === 'epic' && event.text.includes(CUES.fine) ? 'fine' : null;
  }
  if (event.at !== 'floater') return null;

  switch (event.kind) {
    case 'damage':
      return 'sword';
    case 'crit':
      return 'sword-crit';
    case 'taken':
      return 'taken';
    case 'miss':
      if (event.text === CUES.miss) return 'miss';
      if (event.text === CUES.dodge) return 'block';
      // 제작 실패의 '실패' 는 방금 정적으로 처리했으므로 곡괭이 소리를 내지 않습니다
      if (event.text === CUES.failed) return sinceCraftFail > CRAFT_FAIL_WINDOW ? 'mine' : null;
      return null;
    case 'info':
      // 캔 것이 손에 들어온 순간 — 곡괭이 소리 위에 보상 소리를 얹습니다
      return event.text.includes(CUES.ore) ? 'mine-ore' : null;
    default:
      return null;
  }
}

/** 판별한 것을 실제로 냅니다 */
export function play(cue: Cue): void {
  switch (cue) {
    case 'sword': return playSwordHit(false);
    case 'sword-crit': return playSwordHit(true);
    case 'block': return playBlock();
    case 'miss': return playMiss();
    case 'taken': return playTaken();
    case 'mine': return playMineSwing();
    case 'mine-ore': {
      playMineSwing();
      playOre();
      return;
    }
    case 'craft-fail': return playCraftFail();
    case 'fine': return playFine();
  }
}

let craftFailAt = -CRAFT_FAIL_WINDOW * 10;

function hear(event: FeedbackEvent, world: { time: number }): void {
  const cue = decide(event, world.time - craftFailAt);
  if (!cue) return;
  if (cue === 'craft-fail') craftFailAt = world.time;
  play(cue);
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
