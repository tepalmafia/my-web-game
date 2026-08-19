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
import { VIEW_LIMITS, computeView, screenToWorld } from '../../src/rpg/ui/view';
import type { View } from '../../src/rpg/ui/view';
import type { World } from '../../src/rpg/types';

/** 실제 기기들 */
const SIZES: Array<[string, number, number]> = [
  ['폰 세로 (아래 창 접힘)', 390, 736],
  ['폰 세로 (아래 창 펼침)', 390, 388],
  ['폰 가로', 844, 250],
  ['작은 노트북', 1024, 768],
  ['노트북', 1060, 820],
  ['큰 모니터', 1100, 820],
  ['아주 넓은 모니터', 1100, 820],
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

  it('확대는 하한 아래로 내려가지 않는다', () => {
    const world = at('forest');
    for (const [w, h] of [[100, 100], [390, 736], [3840, 2160], [10000, 10000]]) {
      const view = computeView(world, w!, h!);
      expect(view.zoom).toBeGreaterThanOrEqual(VIEW_LIMITS.minZoom);
    }
  });

  /* ---------------------------------------------------------- 시야 최대치 */

  /**
   *  ★ 예전 min 식은 "적어도 이만큼은 보이게" 였습니다. 화면이 커질수록 보이는 세상이
   *    계속 넓어져, 2560 에서는 1090×720 — 폰의 2.4배가 보였습니다.
   *    max 식은 "이보다 넓게는 안 보여준다" 입니다. 여기서 그걸 못 박습니다.
   */
  const EVERY_SIZE: Array<[string, number, number]> = [
    ...SIZES,
    ['2560 캔버스 (덮개 없이)', 2180, 1440],
    ['4K 캔버스 (덮개 없이)', 3460, 2160],
    ['말도 안 되게 넓은 창', 10000, 400],
  ];

  it('보이는 폭이 800 을 절대 넘지 않는다', () => {
    for (const mapId of ['town', 'forest', 'mine'] as const) {
      const world = at(mapId);
      for (const [name, w, h] of EVERY_SIZE) {
        const view = computeView(world, w, h);
        expect(w / view.zoom, `${mapId} ${name}`).toBeLessThanOrEqual(VIEW_LIMITS.width + 0.001);
      }
    }
  });

  it('가로로 누운 화면에서는 800×640 을 넘지 않는다', () => {
    // 폰 세로처럼 길쭉한 화면은 아래 하한(0.85)이 지켜주므로 높이가 더 보입니다.
    // 가로로 누운 화면 — 즉 데스크톱 — 에서는 처음 약속한 800×640 이 그대로 지켜집니다.
    const world = at('town');
    for (const [name, w, h] of EVERY_SIZE) {
      if (w < h) continue;
      const view = computeView(world, w, h);
      expect(w / view.zoom, `${name} 폭`).toBeLessThanOrEqual(800.001);
      expect(h / view.zoom, `${name} 높이`).toBeLessThanOrEqual(640.001);
    }
  });

  it('★ 마을에서 카메라가 가로로 절대 고정되지 않는다', () => {
    // 지도가 화면보다 좁으면 카메라가 한가운데에 못 박히고 캐릭터만 구석으로 밀립니다.
    // 마을은 960px 폭이고 보이는 폭은 800 을 넘을 수 없으므로, 이 일은 일어날 수 없습니다.
    const world = at('town');
    const mapW = world.map.def.width * TILE;
    expect(mapW).toBe(960);

    for (const [name, w, h] of EVERY_SIZE) {
      const view = computeView(world, w, h);
      expect(w / view.zoom, `${name}: 마을이 화면보다 좁습니다`).toBeLessThan(mapW);

      // 실제로 서쪽 끝으로 걸어가면 카메라가 따라옵니다
      world.camera.x = 80;
      const west = computeView(world, w, h);
      expect(west.camX, `${name}: 카메라가 안 따라옵니다`).toBeLessThan(mapW / 2);
      world.camera.x = mapW - 80;
      const east = computeView(world, w, h);
      expect(east.camX, `${name}: 카메라가 안 따라옵니다`).toBeGreaterThan(mapW / 2);
    }
  });

  it('★ 폰 세로는 한 픽셀도 안 바뀐다', () => {
    // 390×844 화면에서 아래 창을 접었을 때(캔버스 390×736)와 펼쳤을 때(390×388)
    const world = at('forest');
    for (const [w, h, zoom, vw, vh] of [
      [390, 736, 0.85, 459, 866],
      [390, 388, 0.85, 459, 456],
    ] as const) {
      const view = computeView(world, w, h);
      expect(view.zoom, `${w}x${h} 확대율`).toBeCloseTo(zoom, 6);
      expect(Math.round(w / view.zoom), `${w}x${h} 보이는 폭`).toBe(vw);
      expect(Math.round(h / view.zoom), `${w}x${h} 보이는 높이`).toBe(vh);
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
