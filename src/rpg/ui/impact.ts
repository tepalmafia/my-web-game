/**
 * ===========================================================================
 *  히트스톱 — 때린 그 순간을 아주 잠깐 멈춥니다 (설계 문서 §6)
 * ===========================================================================
 *
 *  타격감은 소리만으로 나오지 않습니다. 소리와 **같은 프레임에** 화면이 멈추고
 *  카메라가 한 번 튀어야 "맞았다"가 됩니다. 한 프레임만 어긋나도 무너집니다.
 *
 *  ★ 소리와 묶여 있지 않습니다. 음소거든 audio/ 를 통째로 꺼두든,
 *    멈춤과 흔들림은 그대로 나옵니다. 둘은 같은 이벤트를 각자 듣습니다.
 *
 *  ★ world.shake 는 건드리지 않습니다. 그건 초 단위라 2px·5px 을 표현할 수 없고,
 *    피격·죽음의 흔들림은 지금대로 두어야 합니다. 이 킥은 그 위에 더해집니다.
 *
 *  ★ 세계의 난수(seeded RNG)를 쓰지 않습니다. 화면 흔들림이 봇 실측을 바꾸면 안 됩니다.
 */

import { onFeedback, type FeedbackEvent } from '../core/feedback';

/** 설계 문서 §6 */
const HIT = {
  normal: { freezeMs: 30, kickPx: 2, kickMs: 60 },
  crit: { freezeMs: 60, kickPx: 5, kickMs: 120 },
} as const;

/**
 * 멈춤의 상한.
 * ★ 연타로 멈춤이 겹쳐 쌓이면 게임이 통째로 느려집니다. 그래서 "지금부터
 *   최대 이만큼"으로만 잡습니다 — 늘리기만 하고, 이 선을 넘기지 않습니다.
 *   지금 가장 긴 멈춤이 크리티컬 60ms 이므로 상한도 60ms 입니다.
 */
const MAX_FREEZE_MS = 60;

let freezeLeft = 0; // 초
let kickLeft = 0; // 초
let kickSpan = 0; // 초
let kickPx = 0;
let offsetX = 0;
let offsetY = 0;

/** 한 번 맞았다 */
function strike(freezeMs: number, px: number, kickMs: number): void {
  freezeLeft = Math.min(Math.max(freezeLeft, freezeMs / 1000), MAX_FREEZE_MS / 1000);

  // 킥은 더 센 쪽이 이깁니다 (크리티컬이 일반 타격에 묻히지 않도록)
  if (px >= kickPx || kickLeft <= 0) {
    kickPx = px;
    kickSpan = kickMs / 1000;
    kickLeft = kickSpan;
  }
}

function hear(event: FeedbackEvent): void {
  if (event.at !== 'floater') return;
  if (event.kind === 'damage') strike(HIT.normal.freezeMs, HIT.normal.kickPx, HIT.normal.kickMs);
  else if (event.kind === 'crit') strike(HIT.crit.freezeMs, HIT.crit.kickPx, HIT.crit.kickMs);
}

/** 구독합니다. 돌려받은 함수를 부르면 뗍니다. */
export function attachImpact(): () => void {
  const stop = onFeedback(hear);
  return () => {
    stop();
    resetImpact();
  };
}

/**
 * 실제 시간으로 흐릅니다 — 멈춰 있는 동안에도 불러야 멈춤이 풀립니다.
 * 세계를 굴리기 전에 부르세요.
 */
export function tickImpact(dt: number): void {
  if (freezeLeft > 0) freezeLeft = Math.max(0, freezeLeft - dt);

  if (kickLeft <= 0) {
    offsetX = 0;
    offsetY = 0;
    return;
  }
  kickLeft = Math.max(0, kickLeft - dt);
  const strength = kickSpan > 0 ? kickLeft / kickSpan : 0;
  const angle = Math.random() * Math.PI * 2;
  offsetX = Math.cos(angle) * kickPx * strength;
  offsetY = Math.sin(angle) * kickPx * strength;
}

/** 지금 세계를 굴리면 안 되는가 */
export function frozen(): boolean {
  return freezeLeft > 0;
}

/** 화면을 이만큼 밀어서 그립니다 (픽셀) */
export function kick(): { x: number; y: number } {
  return { x: offsetX, y: offsetY };
}

export function resetImpact(): void {
  freezeLeft = 0;
  kickLeft = 0;
  kickSpan = 0;
  kickPx = 0;
  offsetX = 0;
  offsetY = 0;
}

/** 상한 값 (검증용) */
export const MAX_FREEZE_SECONDS = MAX_FREEZE_MS / 1000;
