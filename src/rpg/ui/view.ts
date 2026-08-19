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
  // ★ 상한 2.0. 예전 1.55 로는 큰 모니터에서 보이는 범위가 계속 넓어져,
  //   마을(960×768)이 화면보다 좁아지는 순간 카메라가 한가운데에 못 박히고
  //   캐릭터만 화면 구석으로 밀려났습니다. 2.0 이면 마을도 화면보다 넓습니다.
  const zoom = Math.max(0.85, Math.min(2.0, Math.min(width / 780, height / 560)));
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
