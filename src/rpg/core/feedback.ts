/**
 *  플레이어에게 "방금 무슨 일이 있었는지" 알려주는 것들.
 *  기록 한 줄, 머리 위로 떠오르는 숫자, 칼자국 같은 효과, 화면 가운데 큰 글씨.
 *
 *  게임 규칙과는 상관이 없어서 한곳에 모아뒀습니다.
 */

import { VIEW } from '../balance';
import type { Floater, LogLine, Seconds, Vec2, Vfx, World } from '../types';

/* ===========================================================================
 *  바깥으로 나가는 통로
 * ===========================================================================
 *
 *  ★ core/ 는 소리도 화면 흔들림도 모릅니다. "방금 이런 일이 있었다"만 알립니다.
 *    audio/ 와 ui/ 가 여기를 구독합니다. 방향은 언제나 바깥 → core 입니다.
 *    core/ 가 audio/ 를 import 하는 순간 헤드리스 봇(tools/)이 죽습니다.
 *
 *  ★ 아무도 듣지 않는 판(봇·테스트)에서는 이벤트 객체조차 만들지 않습니다.
 *    발신하는 쪽마다 listeners.length 를 먼저 보고, 0 이면 거기서 끝냅니다.
 */

/** 방금 무슨 일이 있었는지 */
export type FeedbackEvent =
  | { at: 'log'; tone: LogLine['tone']; text: string }
  | { at: 'floater'; kind: Floater['kind']; text: string; pos: Vec2 }
  | { at: 'vfx'; kind: Vfx['kind']; pos: Vec2; color: string; radius?: number }
  | { at: 'toast'; tone: 'good' | 'bad' | 'epic'; text: string }
  | { at: 'shake'; seconds: Seconds };

export type FeedbackListener = (event: FeedbackEvent, world: World) => void;

const listeners: FeedbackListener[] = [];

/** 만들어진 이벤트 객체 수. 듣는 사람이 없으면 늘지 않아야 합니다 (테스트가 지킵니다) */
let built = 0;

/** 구독합니다. 돌려받은 함수를 부르면 해제됩니다. */
export function onFeedback(listener: FeedbackListener): () => void {
  listeners.push(listener);
  return () => offFeedback(listener);
}

export function offFeedback(listener: FeedbackListener): void {
  const index = listeners.indexOf(listener);
  if (index >= 0) listeners.splice(index, 1);
}

/** 전부 해제합니다 (테스트와 화면을 떠날 때) */
export function clearFeedbackListeners(): void {
  listeners.length = 0;
}

export function hasFeedbackListeners(): boolean {
  return listeners.length > 0;
}

/** 지금까지 만들어진 이벤트 객체 수 (검증용) */
export function feedbackEventsBuilt(): number {
  return built;
}

/** 듣는 사람 하나가 던져도 게임은 계속돼야 합니다 */
function emit(world: World, event: FeedbackEvent): void {
  built += 1;
  for (const listener of [...listeners]) {
    try {
      listener(event, world);
    } catch {
      // 소리가 게임을 죽이지 않습니다
    }
  }
}

export function log(world: World, text: string, tone: LogLine['tone'] = 'normal'): void {
  world.log.push({ id: world.nextId++, text, tone });
  if (world.log.length > VIEW.logLines) world.log.splice(0, world.log.length - VIEW.logLines);
  if (listeners.length > 0) emit(world, { at: 'log', tone, text });
}

export function floater(world: World, pos: Vec2, text: string, kind: Floater['kind']): void {
  const life = kind === 'gain' || kind === 'info' ? VIEW.floaterLife * 1.6 : VIEW.floaterLife;
  world.floaters.push({
    id: world.nextId++,
    text,
    pos: { x: pos.x + (world.floaters.length % 3) * 6 - 6, y: pos.y },
    life,
    maxLife: life,
    kind,
  });
  if (listeners.length > 0) emit(world, { at: 'floater', kind, text, pos });
}

export function vfx(
  world: World,
  kind: Vfx['kind'],
  pos: Vec2,
  options: { to?: Vec2; life?: number; color?: string; radius?: number } = {},
): void {
  const life = options.life ?? 0.25;
  world.vfx.push({
    id: world.nextId++,
    kind,
    pos: { x: pos.x, y: pos.y },
    to: options.to ? { x: options.to.x, y: options.to.y } : undefined,
    life,
    maxLife: life,
    color: options.color ?? '#ffffff',
    radius: options.radius,
  });
  if (listeners.length > 0) {
    emit(world, {
      at: 'vfx',
      kind,
      pos,
      color: options.color ?? '#ffffff',
      radius: options.radius,
    });
  }
}

export function toast(world: World, text: string, tone: 'good' | 'bad' | 'epic' = 'good'): void {
  world.toast = { text, tone, life: 2.6 };
  if (listeners.length > 0) emit(world, { at: 'toast', tone, text });
}

export function shake(world: World, seconds: number): void {
  world.shake = Math.max(world.shake, seconds);
  if (listeners.length > 0) emit(world, { at: 'shake', seconds });
}
