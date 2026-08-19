/**
 * ===========================================================================
 *  feedback 이벤트 → 소리
 * ===========================================================================
 *
 *  ★ core/ 는 이 파일의 존재를 모릅니다. 여기서 core/feedback 을 구독합니다.
 *    방향은 언제나 audio → core 입니다.
 *
 *  지금 내는 소리는 §4.1 검 타격과 §4.2 크리티컬 둘뿐입니다.
 *  막힘·빗나감·피격·채굴·제작은 아직입니다.
 *
 *  ★ 무엇이 검 타격인가:
 *    `floater(kind: 'damage' | 'crit')` 는 combat.ts 에서 플레이어의 검이 몬스터에
 *    맞았을 때 **딱 한 곳에서만** 나옵니다. 그래서 이 이벤트 하나로 충분하고,
 *    core/ 에 새 필드를 달 필요가 없었습니다.
 */

import { onFeedback, type FeedbackEvent } from '../core/feedback';
import { duck, unlock } from './bus';
import { metal, noise, thump } from './synth';
import { SWORD_CRIT, SWORD_HIT } from './sfx';

/* --------------------------------------------------------------- 소리 내기 */

/**
 * 검이 맞았을 때. 세 층(딸깍·무게·질감)을 같은 시각에 시작합니다.
 * 크리티컬이면 서브와 잔향을 얹고 주변을 잠깐 눌러줍니다.
 */
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

/* --------------------------------------------------------------- 이어 붙이기 */

function hear(event: FeedbackEvent): void {
  if (event.at !== 'floater') return;
  if (event.kind === 'damage') playSwordHit(false);
  else if (event.kind === 'crit') playSwordHit(true);
}

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
