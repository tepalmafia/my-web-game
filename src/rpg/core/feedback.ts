/**
 *  플레이어에게 "방금 무슨 일이 있었는지" 알려주는 것들.
 *  기록 한 줄, 머리 위로 떠오르는 숫자, 칼자국 같은 효과, 화면 가운데 큰 글씨.
 *
 *  게임 규칙과는 상관이 없어서 한곳에 모아뒀습니다.
 */

import { VIEW } from '../balance';
import type { Floater, LogLine, Vec2, Vfx, World } from '../types';

export function log(world: World, text: string, tone: LogLine['tone'] = 'normal'): void {
  world.log.push({ id: world.nextId++, text, tone });
  if (world.log.length > VIEW.logLines) world.log.splice(0, world.log.length - VIEW.logLines);
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
}

export function toast(world: World, text: string, tone: 'good' | 'bad' | 'epic' = 'good'): void {
  world.toast = { text, tone, life: 2.6 };
}

export function shake(world: World, seconds: number): void {
  world.shake = Math.max(world.shake, seconds);
}
