/**
 * ===========================================================================
 *  맞은 쪽의 몸 반응
 * ===========================================================================
 *
 *  숫자가 뜨고 소리가 나고 화면이 잠깐 멈추는데, 정작 ★ 맞은 몸은 가만히 있었습니다.
 *  때린 쪽(히트스톱·카메라 킥)은 impact.ts 가, 맞은 쪽은 여기가 맡습니다.
 *
 *  ★ 실제 위치는 한 톨도 건드리지 않습니다. 그리는 좌표만 밉니다 —
 *    밀림이 사거리에 끼어들면 "맞았더니 공격이 빗나갔다"가 생깁니다.
 *
 *  ★ 멈춤은 넣지 않습니다. 이미 impact.ts 의 히트스톱이 있고, 맞을 때마다 또 멈추면
 *    늑대에게 둘러싸였을 때 게임이 통째로 끈적해집니다.
 *
 *  ★ 세계의 난수를 쓰지 않습니다 (봇 실측이 흔들리면 안 됩니다).
 */

import { onFeedback, type FeedbackEvent } from '../core/feedback';
import type { World } from '../types';

/** 몸이 뒤로 밀렸다 제자리로 돌아오기까지 (초) */
const FLINCH_SECONDS = 0.2;
/** 가장 많이 밀리는 거리 (그리기 픽셀) */
const FLINCH_PIXELS = 4.5;
/** 흰 번쩍이 남아 있는 시간 (초) */
const FLASH_SECONDS = 0.16;

let left = 0;
let dirX = 0;
let dirY = 0;

/**
 *  맞았습니다.
 *
 *  미는 방향은 "때린 쪽의 반대" 입니다. 이벤트에는 누가 때렸는지가 없으므로
 *  ★ 가장 가까이 붙어 있는 살아있는 몬스터를 때린 쪽으로 봅니다 —
 *    규칙을 판단하는 것이 아니라 이미 있는 자리들을 재는 것뿐입니다.
 *    아무도 없으면(함정·독 같은 것이 생긴다면) 그냥 아래로 움찔합니다.
 */
function hit(world: World): void {
  const me = world.me;
  let near: { x: number; y: number } | null = null;
  let best = Infinity;
  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    const distance = Math.hypot(monster.pos.x - me.pos.x, monster.pos.y - me.pos.y);
    if (distance < best) {
      best = distance;
      near = monster.pos;
    }
  }

  if (near && best > 0.001) {
    dirX = (me.pos.x - near.x) / best;
    dirY = (me.pos.y - near.y) / best;
  } else {
    dirX = 0;
    dirY = 1;
  }
  left = FLINCH_SECONDS;
}

function hear(event: FeedbackEvent, world: World): void {
  // ★ 문구가 아니라 원인으로 가릅니다 (cause: 'taken' 은 damagePlayer 만 냅니다)
  if (event.at === 'floater' && event.cause === 'taken') hit(world);
}

export function attachFlinch(): () => void {
  const stop = onFeedback(hear);
  return () => {
    stop();
    resetFlinch();
  };
}

/** 실제 시간으로 흐릅니다 (히트스톱으로 멈춰 있는 동안에도 풀려야 합니다) */
export function tickFlinch(dt: number): void {
  if (left > 0) left = Math.max(0, left - dt);
}

/** 지금 몸을 이만큼 밀어서 그립니다 (그리기 좌표) */
export function flinchOffset(): { x: number; y: number } {
  if (left <= 0) return { x: 0, y: 0 };
  // 튕겨나갔다 돌아옵니다 — 처음이 가장 멀고 끝에서 0
  const strength = left / FLINCH_SECONDS;
  const eased = strength * strength;
  return { x: dirX * FLINCH_PIXELS * eased, y: dirY * FLINCH_PIXELS * eased };
}

/** 지금 얼마나 하얗게 번쩍이는가 (0~1) */
export function flinchFlash(): number {
  const elapsed = FLINCH_SECONDS - left;
  if (left <= 0 || elapsed > FLASH_SECONDS) return 0;
  return 1 - elapsed / FLASH_SECONDS;
}

export function resetFlinch(): void {
  left = 0;
  dirX = 0;
  dirY = 0;
}

/** 검증용 */
export const FLINCH = { seconds: FLINCH_SECONDS, pixels: FLINCH_PIXELS, flashSeconds: FLASH_SECONDS };
