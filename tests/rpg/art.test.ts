/**
 *  그림이 표를 제대로 찾아가는지.
 *
 *  ★ 이 파일이 생긴 이유: palette.ts 의 MATERIAL 표가 옛 게임의 아이템 id
 *    ('armor-plate' 같은)를 그대로 들고 있어서 **조회가 한 번도 성공하지
 *    못했습니다.** 코드는 `MATERIAL[id] ?? 기본색` 이라 조용히 기본색으로
 *    떨어졌고, 가죽 조끼든 구리 사슬갑옷이든 전부 같은 회색으로 보였습니다.
 *
 *    "없으면 기본값" 은 안전하지만, 그래서 **틀린 걸 아무도 모릅니다.**
 *    그런 표는 이렇게 밖에서 맞춰봐 주는 수밖에 없습니다.
 */

import { describe, expect, it } from 'vitest';

import { ITEMS } from '../../src/rpg/content/items';
import { MAPS, mapDef } from '../../src/rpg/content/maps';
import { nearForge } from '../../src/rpg/core/action';
import { createWorld } from '../../src/rpg/core/create';
import { enterMap, tileCenter } from '../../src/rpg/core/world';
import { drawForge, drawForgeLabel, drawForgeRing } from '../../src/rpg/ui/art/effects';
import { MATERIAL } from '../../src/rpg/ui/art/palette';

const WEARABLE = Object.values(ITEMS).filter((def) => def.slot === 'armor' || def.slot === 'helmet');

describe('장비의 재질 색', () => {
  it('입는 것에는 빠짐없이 색이 정해져 있다', () => {
    const missing = WEARABLE.filter((def) => !MATERIAL[def.id]).map((def) => `${def.id}(${def.name})`);
    expect(missing, `색이 없는 장비: ${missing.join(', ')}`).toEqual([]);
  });

  it('표에 없는 물건이 남아 있지 않다', () => {
    // 아이템을 지우면 표에도 죽은 항목이 남습니다. 다음 사람이 그걸 믿습니다.
    const ids = new Set(Object.keys(ITEMS));
    const dead = Object.keys(MATERIAL).filter((id) => !ids.has(id));
    expect(dead, `없는 물건의 색이 남아 있습니다: ${dead.join(', ')}`).toEqual([]);
  });

  it('표에 적힌 것은 전부 입는 물건이다', () => {
    const notWearable = Object.keys(MATERIAL).filter((id) => {
      const def = ITEMS[id];
      return def && def.slot !== 'armor' && def.slot !== 'helmet';
    });
    expect(notWearable, `입는 물건이 아닌데 색이 있습니다: ${notWearable.join(', ')}`).toEqual([]);
  });

  it('재료가 다르면 색이 다르다', () => {
    // 가죽 · 철 · 구리가 한눈에 갈려야 만든 보람이 보입니다
    const leather = MATERIAL['leather-vest']!;
    const iron = MATERIAL['iron-mail']!;
    const copper = MATERIAL['copper-mail']!;
    expect(new Set([leather, iron, copper]).size, '재료가 다른데 색이 같습니다').toBe(3);
  });

  it('같은 재료끼리는 서로 가깝다', () => {
    // 가죽 조끼와 가죽 모자가 전혀 다른 색이면 같은 재료로 보이지 않습니다
    const distance = (a: string, b: string) => {
      const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const [ar, ag, ab] = parse(a) as [number, number, number];
      const [br, bg, bb] = parse(b) as [number, number, number];
      return Math.hypot(ar - br, ag - bg, ab - bb);
    };
    expect(distance(MATERIAL['leather-vest']!, MATERIAL['leather-cap']!)).toBeLessThan(60);
    expect(distance(MATERIAL['iron-mail']!, MATERIAL['iron-helm']!)).toBeLessThan(60);
  });
});

/* ===========================================================================
 *  판정만 있고 그리지 않던 것 — 화로
 * ======================================================================== */

/**
 *  ★ 광맥에 이어 두 번째입니다. core/action.ts 의 nearForge 는 거리를 재고 있었는데
 *    화면에는 화로가 없었습니다. "화로 앞에 서야 만들 수 있습니다" 를 읽고도
 *    어디로 가야 하는지 알 수 없었습니다.
 *
 *  캔버스를 흉내 낸 것에 그리게 하고, 정말로 무언가를 그렸는지만 봅니다.
 *  모양은 검사하지 않습니다 — 지워졌는지만 잡으면 됩니다.
 */
function fakeCtx() {
  const calls: string[] = [];
  const texts: string[] = [];
  const record = (name: string) => (...args: unknown[]) => {
    calls.push(name);
    if (name === 'fillText' || name === 'strokeText') texts.push(String(args[0]));
  };
  const ctx = {
    calls,
    texts,
    canvas: {},
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'round',
    lineDashOffset: 0,
    font: '',
    textAlign: 'center',
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    ellipse: record('ellipse'),
    rect: record('rect'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    setLineDash: record('setLineDash'),
    fillText: record('fillText'),
    strokeText: record('strokeText'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[]; texts: string[] };
}

describe('화로', () => {
  it('화로가 있는 지역에서는 화로를 그린다', () => {
    for (const def of Object.values(MAPS)) {
      if (!def.forge) continue;
      const world = createWorld('시험', 'miner');
      enterMap(world, def.id, def.entryTx, def.entryTy);
      const ctx = fakeCtx();
      drawForge(ctx, world, def.forge.tx, def.forge.ty);
      expect(ctx.calls.length, `${def.name} 의 화로가 그려지지 않았습니다`).toBeGreaterThan(0);
    }
  });

  it('만들 수 있는 자리를 바닥에 원으로 보여준다', () => {
    const def = mapDef('town');
    const world = createWorld('시험', 'miner');
    enterMap(world, 'town', def.entryTx, def.entryTy);
    const ctx = fakeCtx();
    drawForgeRing(ctx, world, def.forge!.tx, def.forge!.ty);
    expect(ctx.calls).toContain('stroke');
  });

  it('가까이 가면 이름표가 붙고, 멀면 붙지 않는다', () => {
    const def = mapDef('town');
    const forge = def.forge!;
    const world = createWorld('시험', 'miner');
    enterMap(world, 'town', def.entryTx, def.entryTy);

    world.me.pos = { x: tileCenter(forge.tx), y: tileCenter(forge.ty) + 20 };
    const near = fakeCtx();
    drawForgeLabel(near, world);
    expect(near.texts.join(' ')).toContain('화로');

    world.me.pos = { x: tileCenter(forge.tx) + 900, y: tileCenter(forge.ty) + 900 };
    const far = fakeCtx();
    drawForgeLabel(far, world);
    expect(far.texts).toEqual([]);
  });

  it('원 안에 들어가면 문구가 바뀐다 — 판정과 글자가 같은 것을 본다', () => {
    const def = mapDef('town');
    const forge = def.forge!;
    const world = createWorld('시험', 'miner');
    enterMap(world, 'town', def.entryTx, def.entryTy);

    // 원 안 (nearForge 가 참)
    world.me.pos = { x: tileCenter(forge.tx), y: tileCenter(forge.ty) + 10 };
    expect(nearForge(world)).toBe(true);
    const inside = fakeCtx();
    drawForgeLabel(inside, world);
    expect(inside.texts.join(' ')).toContain('여기서 만듭니다');

    // 원 밖이지만 이름표는 보이는 거리 (nearForge 가 거짓)
    world.me.pos = { x: tileCenter(forge.tx), y: tileCenter(forge.ty) + 120 };
    expect(nearForge(world)).toBe(false);
    const outside = fakeCtx();
    drawForgeLabel(outside, world);
    expect(outside.texts.join(' ')).toContain('화로');
    expect(outside.texts.join(' ')).not.toContain('여기서 만듭니다');
  });
});
