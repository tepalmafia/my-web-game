/**
 *  화면과 월드 사이의 변환.
 *  그리는 쪽과 클릭을 받는 쪽이 반드시 같은 값을 써야 해서 따로 빼두었습니다.
 */

import { TILE } from '../balance';
import type { World } from '../types';

export interface View {
  zoom: number;
  camX: number;
  camY: number;
  width: number;
  height: number;
}

/**
 *  한 화면에 보여줄 월드의 최대치.
 *
 *  ★ 예전 식은 min(w/780, h/560) 이었습니다. min 은 "적어도 780×560 은 보이게" 라는
 *    뜻이라, 한 축이 기준에 맞고 ★다른 축은 화면이 커질수록 계속 늘어났습니다.
 *    확대 상한을 1.55 → 2.0 으로 올려봐야 더 큰 모니터에서 다시 걸릴 뿐이었습니다.
 *    max 로 바꾸면 뜻이 정반대가 됩니다 — "이보다 넓게는 안 보여준다".
 *
 *  ★ 폭 800 이 실제로 일하는 값입니다. 가장 좁은 지도(마을 960)보다 좁으므로,
 *    어떤 화면에서도 마을이 화면보다 넓고 따라서 카메라가 가운데에 못 박히지 않습니다.
 *
 *  ★ 높이 900 은 안전망입니다. 폰 세로는 아래 창을 접으면 캔버스가 아주 길쭉해서
 *    (390×736) 여기에 640 같은 값을 두면 폰 화면이 확 좁아집니다. 폰은 아래 하한이
 *    지켜주고, 900 은 그보다 더 길쭉한 화면에서만 일합니다.
 */
const VIEW_MAX = { width: 800, height: 900 };

/** 이보다 작게 그리면 폰에서 글자와 사람이 안 보입니다 */
const MIN_ZOOM = 0.85;

export function computeView(world: World, width: number, height: number): View {
  const zoom = Math.max(MIN_ZOOM, width / VIEW_MAX.width, height / VIEW_MAX.height);
  const mapW = world.map.def.width * TILE;
  const mapH = world.map.def.height * TILE;
  const halfW = width / (2 * zoom);
  const halfH = height / (2 * zoom);

  let camX = world.camera.x;
  let camY = world.camera.y;

  camX = mapW <= halfW * 2 ? mapW / 2 : Math.max(halfW, Math.min(mapW - halfW, camX));
  camY = mapH <= halfH * 2 ? mapH / 2 : Math.max(halfH, Math.min(mapH - halfH, camY));

  return { zoom, camX, camY, width, height };
}

/** 검증용 — 그리는 쪽과 검사가 같은 값을 봐야 합니다 */
export const VIEW_LIMITS = { ...VIEW_MAX, minZoom: MIN_ZOOM };

/** 화면 좌표(캔버스 안 픽셀) → 월드 좌표 */
export function screenToWorld(view: View, sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - view.width / 2) / view.zoom + view.camX,
    y: (sy - view.height / 2) / view.zoom + view.camY,
  };
}
