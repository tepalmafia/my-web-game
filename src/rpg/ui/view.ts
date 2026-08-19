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

export function computeView(world: World, width: number, height: number): View {
  const zoom = Math.max(0.85, Math.min(1.55, Math.min(width / 780, height / 560)));
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

/** 화면 좌표(캔버스 안 픽셀) → 월드 좌표 */
export function screenToWorld(view: View, sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - view.width / 2) / view.zoom + view.camX,
    y: (sy - view.height / 2) / view.zoom + view.camY,
  };
}
