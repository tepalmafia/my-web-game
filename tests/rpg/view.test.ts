/**
 *  화면 ↔ 월드 변환.
 *
 *  ★ 그리는 쪽(draw.ts)과 클릭 받는 쪽(GameScreen.tsx)이 반드시 같은 값을 써야 합니다.
 *    zoom 상한을 건드릴 일이 생기므로, 상수를 바꿔도 어긋나지 않는지 여기서 못 박습니다.
 *
 *  draw() 가 캔버스에 거는 변환은 정확히 이것입니다.
 *      translate(w/2, h/2) → scale(zoom) → translate(-camX, -camY)
 *  그러므로 월드 한 점이 찍히는 화면 좌표는
 *      sx = (x - camX) * zoom + w/2
 *  이고, screenToWorld 는 이것의 역이어야 합니다.
 */

import { describe, expect, it } from 'vitest';

import { TILE } from '../../src/rpg/balance';
import { mapDef } from '../../src/rpg/content/maps';
import { createWorld } from '../../src/rpg/core/create';
import { enterMap } from '../../src/rpg/core/world';
import { computeView, screenToWorld } from '../../src/rpg/ui/view';
import type { View } from '../../src/rpg/ui/view';
import type { World } from '../../src/rpg/types';

/** 실제 기기들 */
const SIZES: Array<[string, number, number]> = [
  ['폰 세로', 390, 540],
  ['폰 가로', 844, 390],
  ['작은 노트북', 1024, 768],
  ['노트북', 1060, 900],
  ['큰 모니터', 1540, 1080],
  ['아주 좁은 창', 320, 300],
];

/** draw() 가 거는 변환 그대로 — 월드 → 화면 */
function worldToScreen(view: { zoom: number; camX: number; camY: number; width: number; height: number }, x: number, y: number) {
  return {
    sx: (x - view.camX) * view.zoom + view.width / 2,
    sy: (y - view.camY) * view.zoom + view.height / 2,
  };
}

function at(mapId: 'town' | 'forest' | 'mine'): World {
  const world = createWorld('시험', 'miner');
  const def = mapDef(mapId);
  enterMap(world, mapId, def.entryTx, def.entryTy);
  return world;
}

describe('화면과 월드 사이', () => {
  it('클릭한 자리가 그려진 자리와 같다 — 모든 화면 크기에서', () => {
    for (const mapId of ['town', 'forest', 'mine'] as const) {
      const world = at(mapId);
      for (const [name, w, h] of SIZES) {
        const view = computeView(world, w, h);
        // 화면 구석구석을 눌러본다
        for (const sx of [0, w * 0.5, w - 1]) {
          for (const sy of [0, h * 0.5, h - 1]) {
            const point = screenToWorld(view, sx, sy);
            const back = worldToScreen(view, point.x, point.y);
            expect(back.sx, `${mapId} ${name}`).toBeCloseTo(sx, 6);
            expect(back.sy, `${mapId} ${name}`).toBeCloseTo(sy, 6);
          }
        }
      }
    }
  });

  it('화면 한가운데를 누르면 카메라가 보고 있는 자리가 나온다', () => {
    const world = at('forest');
    for (const [name, w, h] of SIZES) {
      const view = computeView(world, w, h);
      const point = screenToWorld(view, w / 2, h / 2);
      expect(point.x, name).toBeCloseTo(view.camX, 6);
      expect(point.y, name).toBeCloseTo(view.camY, 6);
    }
  });

  it('확대는 0.85 와 2.0 사이에 머문다', () => {
    const world = at('forest');
    for (const [w, h] of [[100, 100], [390, 540], [3840, 2160], [10000, 10000]]) {
      const view = computeView(world, w!, h!);
      expect(view.zoom).toBeGreaterThanOrEqual(0.85);
      expect(view.zoom).toBeLessThanOrEqual(2.0);
    }
  });

  it('카메라는 지도 밖을 보지 않는다', () => {
    for (const mapId of ['town', 'forest', 'mine'] as const) {
      const world = at(mapId);
      const mapW = world.map.def.width * TILE;
      const mapH = world.map.def.height * TILE;
      // 카메라를 지도 밖으로 억지로 밀어본다
      for (const [cx, cy] of [[-9999, -9999], [9999, 9999]]) {
        world.camera.x = cx!;
        world.camera.y = cy!;
        for (const [name, w, h] of SIZES) {
          const view = computeView(world, w, h);
          const halfW = w / (2 * view.zoom);
          const halfH = h / (2 * view.zoom);
          // 지도가 화면보다 넓으면 가장자리에서 멈추고, 좁으면 한가운데에 선다
          if (mapW > halfW * 2) {
            expect(view.camX, `${mapId} ${name}`).toBeGreaterThanOrEqual(halfW - 0.001);
            expect(view.camX, `${mapId} ${name}`).toBeLessThanOrEqual(mapW - halfW + 0.001);
          } else {
            expect(view.camX, `${mapId} ${name}`).toBeCloseTo(mapW / 2, 6);
          }
          if (mapH > halfH * 2) {
            expect(view.camY, `${mapId} ${name}`).toBeGreaterThanOrEqual(halfH - 0.001);
            expect(view.camY, `${mapId} ${name}`).toBeLessThanOrEqual(mapH - halfH + 0.001);
          } else {
            expect(view.camY, `${mapId} ${name}`).toBeCloseTo(mapH / 2, 6);
          }
        }
      }
    }
  });

  it('마을에서도 카메라가 캐릭터를 따라온다 — 큰 모니터에서 구석에 밀리지 않도록', () => {
    // 1920×1080 창의 캔버스 폭(오른쪽 창 380 을 뺀 값)
    const world = at('town');
    const view = computeView(world, 1540, 1080);
    const mapW = world.map.def.width * TILE;
    expect(mapW).toBe(960);
    // 보이는 폭이 지도보다 좁아야 카메라가 따라옵니다
    expect(1540 / view.zoom).toBeLessThan(mapW);
  });

  it('View 는 그리는 쪽이 쓰는 값을 전부 담는다', () => {
    const world = at('town');
    const view: View = computeView(world, 800, 600);
    expect(Object.keys(view).sort()).toEqual(['camX', 'camY', 'height', 'width', 'zoom']);
  });
});
