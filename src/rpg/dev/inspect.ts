/**
 * ===========================================================================
 *  검증용 읽기 창구 — `window.aden.inspect`
 * ===========================================================================
 *
 *  ★ 왜 만드나. 화면을 재려면 사람과 몬스터가 **화면 어디에 있는지**를 알아야 하는데,
 *    그것을 색이나 그림자로 되짚다가 세 번 틀렸습니다 —
 *    살색은 안개 합성에 물들어 정확히 안 맞았고, 그림자는 반지름 식이
 *    `r*0.42` 인 것을 `r*0.45` 로 잘못 봤습니다.
 *    **화면 픽셀에서 위치를 역추적하지 마라.** 세계가 이미 알고 있는 값을 받으면 됩니다.
 *
 *  ★ 읽기 전용입니다. 돌려주는 것은 전부 **그 순간의 숫자를 복사한 것**이고
 *    살아 있는 객체를 안 내줍니다. 받은 것을 고쳐도 세계는 안 바뀝니다.
 *
 *  ★ **프로덕션 빌드에 안 들어갑니다.** 부르는 자리를 `import.meta.env.DEV` 로
 *    감쌌고, vite 가 빌드 때 그 값을 `false` 로 박아 가지째 지웁니다.
 *    실제로 지워지는지는 `dist` 를 뒤져 확인했습니다.
 *
 *  ★ 화면 좌표는 **렌더러가 쓰는 것과 같은 함수**(`computeView`)로 냅니다.
 *    여기서 식을 다시 쓰면 그리는 자리와 재는 자리가 갈라집니다.
 */

import { TILE } from '../balance';
import { computeView, snapView } from '../ui/view';
import type { World } from '../types';

/** 한 점의 화면 좌표 — 캔버스 CSS 픽셀 기준 */
export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Inspection {
  /** 지금 어느 지역인가 */
  mapId: string;
  /** 세계 시각(초) */
  time: number;
  player: {
    x: number;
    y: number;
    moving: boolean;
    anim: number;
    dead: boolean;
    screen: ScreenPoint;
  };
  camera: {
    /** 따라가는 목표 (world.camera) */
    x: number;
    y: number;
    /** 지도 끝에서 잘린 뒤의 실제 값 */
    clampedX: number;
    clampedY: number;
    zoom: number;
    dpr: number;
    /** 월드 한 칸이 화면에서 몇 픽셀인가 — 격자를 맞출 때 쓰는 값 */
    step: number;
  };
  /** 캔버스 CSS 크기 */
  canvas: { width: number; height: number };
  monsters: Array<{
    id: string;
    x: number;
    y: number;
    anim: number;
    moving: boolean;
    /** 쓰러지는 중이면 그 몬스터의 상태 */
    dying: boolean;
    hp: number;
    screen: ScreenPoint;
  }>;
}

/**
 *  캔버스를 찾습니다. 화면이 없으면(시험 환경) null 입니다.
 *
 *  ★ 크기를 DOM 에서 읽는 이유: `computeView` 가 캔버스의 **CSS 크기**를 받는데,
 *    그 값은 `GameScreen` 이 매 프레임 재는 것이라 세계에 안 들어 있습니다.
 */
function canvasSize(): { width: number; height: number } | null {
  const doc = (globalThis as { document?: Document }).document;
  const el = doc?.querySelector('canvas');
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? { width: rect.width, height: rect.height } : null;
}

/** `GameScreen` 이 `setTransform` 에 넣는 것과 같은 값입니다 */
function devicePixels(): number {
  const w = globalThis as { devicePixelRatio?: number };
  return Math.min(2, w.devicePixelRatio || 1);
}

/**
 *  지금 이 순간의 화면 상태를 숫자로 돌려줍니다.
 *
 *  ★ 화면이 없으면 null 입니다 — 조용히 0 을 돌려주면 그것을 참값으로 쓰게 됩니다.
 */
export function inspect(world: World): Inspection | null {
  const size = canvasSize();
  if (!size) return null;

  const dpr = devicePixels();
  //  ★ 그리는 쪽과 같은 순서입니다: computeView 로 잘라내고 snapView 로 격자에 맞춥니다.
  //    스냅을 빼면 재는 자리가 그리는 자리보다 최대 반 픽셀 어긋납니다.
  const view = snapView(computeView(world, size.width, size.height), dpr);
  const toScreen = (x: number, y: number): ScreenPoint => ({
    x: (x - view.camX) * view.zoom + view.width / 2,
    y: (y - view.camY) * view.zoom + view.height / 2,
  });

  const me = world.me;
  return {
    mapId: world.mapId,
    time: world.time,
    player: {
      x: me.pos.x,
      y: me.pos.y,
      moving: world.meMoving,
      anim: world.meAnim,
      dead: me.dead,
      screen: toScreen(me.pos.x, me.pos.y),
    },
    camera: {
      x: world.camera.x,
      y: world.camera.y,
      clampedX: view.camX,
      clampedY: view.camY,
      zoom: view.zoom,
      dpr,
      step: view.zoom * dpr,
    },
    canvas: { width: size.width, height: size.height },
    monsters: world.monsters.map((m) => ({
      id: m.defId,
      x: m.pos.x,
      y: m.pos.y,
      anim: m.anim,
      moving: m.moving,
      dying: m.state === 'dead',
      hp: m.hp,
      screen: toScreen(m.pos.x, m.pos.y),
    })),
  };
}

/**
 *  월드 좌표 하나를 화면 좌표로. 재는 쪽이 직접 환산해야 할 때 씁니다.
 *
 *  ★ `inspect()` 가 쓰는 것과 같은 변환입니다 — 두 벌을 두면 갈라집니다.
 */
export function worldToScreen(world: World, x: number, y: number): ScreenPoint | null {
  const shot = inspect(world);
  if (!shot) return null;
  const { clampedX, clampedY, zoom } = shot.camera;
  return {
    x: (x - clampedX) * zoom + shot.canvas.width / 2,
    y: (y - clampedY) * zoom + shot.canvas.height / 2,
  };
}

/** 한 칸의 픽셀 크기 — 재는 쪽이 타일 단위로 셈할 때 씁니다 */
export const TILE_SIZE = TILE;
