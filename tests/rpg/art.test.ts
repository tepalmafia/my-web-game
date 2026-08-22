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

import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { GATHER, TILE } from '../../src/rpg/balance';
import { ITEMS } from '../../src/rpg/content/items';
import { MAPS, mapDef } from '../../src/rpg/content/maps';
import { TOWN_STAGES } from '../../src/rpg/content/town';
import { monsterDef } from '../../src/rpg/content/monsters';
import { darken, lighten } from '../../src/rpg/ui/art/palette';
import { SPRITES, SPRITE_TONES, SPRITE_WALK, packColor } from '../../src/rpg/ui/art/sprites';
import { nearForge } from '../../src/rpg/core/action';
import { swingAtMonster } from '../../src/rpg/core/combat';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { FORGE_GROWN } from '../../src/rpg/ui/art/effects';
import { enterMap, tileCenter } from '../../src/rpg/core/world';
import { DEATH_SECONDS, WEAPON_LOOK, deathProgress, drawMonster } from '../../src/rpg/ui/art/actors';
import { KIND_ICON } from '../../src/rpg/ui/Panels';
import {
  drawForge,
  drawForgeLabel,
  drawForgeRing,
  drawThreatMarks,
  drawThreatRings,
  drawVeinRings,
  ITEM_TINT,
  label,
  NPC_ROLE,
  setLabelBlockout,
} from '../../src/rpg/ui/art/effects';
import { MATERIAL } from '../../src/rpg/ui/art/palette';
import type { Monster, World } from '../../src/rpg/types';

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
  /** stroke() 를 부른 순간의 선 색 — 무엇을 어떤 색으로 그렸는지 보려고 */
  const strokes: string[] = [];
  /** rotate() 에 넘긴 각 — 쓰러지는 몸이 실제로 기우는지 보려고 */
  const rotates: number[] = [];
  const record = (name: string) => (...args: unknown[]) => {
    calls.push(name);
    if (name === 'fillText' || name === 'strokeText') texts.push(String(args[0]));
    if (name === 'stroke') strokes.push(String(ctx.strokeStyle));
    if (name === 'rotate') rotates.push(Number(args[0]));
  };
  const ctx = {
    calls,
    texts,
    strokes,
    rotates,
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
    quadraticCurveTo: record('quadraticCurveTo'),
    bezierCurveTo: record('bezierCurveTo'),
    clip: record('clip'),
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
  return ctx as unknown as CanvasRenderingContext2D & {
    calls: string[];
    texts: string[];
    strokes: string[];
    rotates: number[];
  };
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

/* ===========================================================================
 *  쫓아오는지 보이는가
 * ======================================================================== */

/**
 *  ★ core 에는 상태가 다섯 가지(idle·chase·attack·return·dead) 있는데
 *    화면은 'dead' 하나만 보고 있었습니다. 늑대가 나를 쫓는지 아닌지 알 길이 없었고,
 *    도망칠지 싸울지가 이 게임의 유일한 순간 판단인데 그 판단의 근거가 화면에 없었습니다.
 */
/** 숲이 실제로 낳은 몬스터 하나를 빌려 자리와 상태만 바꿔 씁니다 (손으로 만들지 않습니다) */
function monsterAt(world: World, defId: string, x: number, y: number, state: Monster['state']): Monster {
  const source = SPAWNED.find((m) => m.defId === defId);
  if (!source) throw new Error(`숲에 ${defId} 가 없습니다`);
  const monster: Monster = { ...source, id: world.nextId++, pos: { x, y }, home: { x, y }, state };
  world.monsters.push(monster);
  return monster;
}

function forestWorld(): World {
  const world = createWorld('시험', 'miner');
  const def = mapDef('forest');
  enterMap(world, 'forest', def.entryTx, def.entryTy);
  return world;
}

/** 숲이 낳은 몬스터들 — 본보기로 씁니다 */
const SPAWNED = forestWorld().monsters;

function inForest(): World {
  const world = forestWorld();
  world.monsters.length = 0;
  return world;
}

describe('몬스터가 나를 쫓는지', () => {
  it('먼저 덤비는 놈과 아닌 놈의 고리 색이 다르다', () => {
    // 들개는 aggroRange 0(먼저 안 덤빔), 늑대는 240
    expect(monsterDef('stray-dog').aggroRange).toBe(0);
    expect(monsterDef('wolf').aggroRange).toBeGreaterThan(0);

    const world = inForest();
    const { x, y } = world.me.pos;
    monsterAt(world, 'stray-dog', x + 40, y, 'idle');
    const dog = fakeCtx();
    drawThreatRings(dog, world);

    world.monsters.length = 0;
    monsterAt(world, 'wolf', x + 40, y, 'idle');
    const wolf = fakeCtx();
    drawThreatRings(wolf, world);

    expect(dog.strokes.length, '들개에게 고리가 없습니다').toBe(1);
    expect(wolf.strokes.length, '늑대에게 고리가 없습니다').toBe(1);
    expect(dog.strokes[0], '사냥감과 위험한 놈의 색이 같습니다').not.toBe(wolf.strokes[0]);
  });

  it('쫓아오면 고리가 달라진다', () => {
    const world = inForest();
    const { x, y } = world.me.pos;

    monsterAt(world, 'wolf', x + 40, y, 'idle');
    const calm = fakeCtx();
    drawThreatRings(calm, world);

    world.monsters.length = 0;
    monsterAt(world, 'wolf', x + 40, y, 'chase');
    const angry = fakeCtx();
    drawThreatRings(angry, world);

    expect(calm.strokes[0]).not.toBe(angry.strokes[0]);
  });

  it('쫓아올 때만 머리 위에 표시와 이름이 뜬다', () => {
    const world = inForest();
    const { x, y } = world.me.pos;

    for (const state of ['idle', 'return'] as const) {
      world.monsters.length = 0;
      monsterAt(world, 'wolf', x + 40, y, state);
      const quiet = fakeCtx();
      drawThreatMarks(quiet, world);
      expect(quiet.texts, `${state} 인데 표시가 떴습니다`).toEqual([]);
    }

    for (const state of ['chase', 'attack'] as const) {
      world.monsters.length = 0;
      monsterAt(world, 'wolf', x + 40, y, state);
      const loud = fakeCtx();
      drawThreatMarks(loud, world);
      expect(loud.texts.join(' '), `${state} 인데 표시가 없습니다`).toContain('늑대');
    }
  });

  it('죽은 것과 멀리 있는 것에는 아무것도 붙지 않는다', () => {
    const world = inForest();
    const { x, y } = world.me.pos;
    monsterAt(world, 'wolf', x + 40, y, 'dead');
    monsterAt(world, 'wolf', x + 900, y, 'chase');

    const ctx = fakeCtx();
    drawThreatRings(ctx, world);
    drawThreatMarks(ctx, world);
    expect(ctx.strokes).toEqual([]);
    expect(ctx.texts).toEqual([]);
  });
});

describe('광맥의 사거리 원', () => {
  it('가까운 광맥에는 원이 붙고, 먼 광맥에는 붙지 않는다', () => {
    const world = inForest();
    expect(world.veins.length).toBeGreaterThan(0);
    const vein = world.veins[0]!;

    world.me.pos = { x: vein.pos.x, y: vein.pos.y + 30 };
    const near = fakeCtx();
    drawVeinRings(near, world);
    expect(near.strokes.length).toBeGreaterThan(0);

    world.me.pos = { x: vein.pos.x + 4000, y: vein.pos.y + 4000 };
    const far = fakeCtx();
    drawVeinRings(far, world);
    expect(far.strokes).toEqual([]);
  });

  it('원 안에 들어가면 색이 달라진다 — core 가 재는 거리와 같은 값이다', () => {
    const world = inForest();
    const vein = world.veins[0]!;

    world.veins.length = 1;
    world.me.pos = { x: vein.pos.x, y: vein.pos.y + GATHER.reach - 2 };
    const inside = fakeCtx();
    drawVeinRings(inside, world);

    world.me.pos = { x: vein.pos.x, y: vein.pos.y + GATHER.reach + 2 };
    const outside = fakeCtx();
    drawVeinRings(outside, world);

    expect(inside.strokes[0]).not.toBe(outside.strokes[0]);
  });

  it('바닥난 광맥에는 원이 붙지 않는다', () => {
    const world = inForest();
    const vein = world.veins[0]!;
    world.veins.length = 1; // 옆 광맥의 원이 섞이지 않도록
    world.me.pos = { x: vein.pos.x, y: vein.pos.y + 20 };
    vein.remaining = 0;

    const ctx = fakeCtx();
    drawVeinRings(ctx, world);
    expect(ctx.strokes).toEqual([]);
  });
});

describe('작은 지도에 가리는 이름표', () => {
  it('가림 상자 안의 이름표는 그리지 않는다', () => {
    setLabelBlockout(null);
    const open = fakeCtx();
    label(open, '늑대', 500, 500, '#fff', 11);
    expect(open.texts).toContain('늑대');

    setLabelBlockout({ x0: 450, y0: 450, x1: 560, y1: 560 });
    const hidden = fakeCtx();
    label(hidden, '늑대', 500, 500, '#fff', 11);
    expect(hidden.texts, '가려질 이름표가 그대로 그려졌습니다').toEqual([]);

    // 상자 밖은 그대로 그립니다
    const outside = fakeCtx();
    label(outside, '늑대', 500, 900, '#fff', 11);
    expect(outside.texts).toContain('늑대');

    setLabelBlockout(null);
  });
});

/* ===========================================================================
 *  표와 실제 것들을 맞춰본다 (MATERIAL 과 같은 양방향 검사)
 * ======================================================================== */

/**
 *  ★ 이 네 표는 모두 "없으면 조용히 기본값" 으로 떨어집니다.
 *    MATERIAL 이 옛 아이템 id 를 들고 있으면서 한 번도 조회에 성공하지 못했던 것과 같은 고장입니다.
 *
 *  ★ ITEM_TINT · KIND_ICON · NPC_ROLE 은 이번에 Record<string,…> 에서
 *    Record<ItemKind,…> · Record<NpcKind,…> 로 바꿨습니다 — 빠뜨리면 컴파일이 막습니다.
 *    그래도 컴파일이 못 잡는 것이 남습니다: 값이 서로 겹치면 구분이 안 됩니다.
 *    WEAPON_LOOK 만은 키가 아이템 id(그냥 string)라 컴파일이 지켜주지 못하므로
 *    여기 검사가 유일한 그물입니다.
 */

const WEAPONS = Object.values(ITEMS).filter((def) => def.kind === 'weapon');

describe('WEAPON_LOOK ↔ 무기', () => {
  it('무기에는 빠짐없이 생김새가 있다', () => {
    const missing = WEAPONS.filter((def) => !WEAPON_LOOK[def.id]).map((def) => `${def.id}(${def.name})`);
    expect(missing, `실루엣이 없는 무기: ${missing.join(', ')}`).toEqual([]);
  });

  it('없는 물건의 생김새가 남아 있지 않다', () => {
    const ids = new Set(Object.keys(ITEMS));
    const dead = Object.keys(WEAPON_LOOK).filter((id) => !ids.has(id));
    expect(dead, `없는 물건의 실루엣: ${dead.join(', ')}`).toEqual([]);
  });

  it('표에 적힌 것은 전부 무기다', () => {
    const notWeapon = Object.keys(WEAPON_LOOK).filter((id) => ITEMS[id] && ITEMS[id]!.kind !== 'weapon');
    expect(notWeapon, `무기가 아닌데 실루엣이 있습니다: ${notWeapon.join(', ')}`).toEqual([]);
  });

  it('무기마다 실루엣이 다르다 — 같으면 바꿔 든 것을 알 수 없다', () => {
    const shapes = WEAPONS.map((def) => {
      const look = WEAPON_LOOK[def.id]!;
      return `${look.grip}/${look.guard}/${look.width}/${look.tip}/${look.reach}`;
    });
    expect(new Set(shapes).size, `실루엣이 겹칩니다: ${shapes.join(' · ')}`).toBe(WEAPONS.length);
  });
});

describe('ITEM_TINT ↔ 물건 종류', () => {
  it('실제로 쓰이는 종류가 빠짐없이 있다', () => {
    const used = new Set(Object.values(ITEMS).map((def) => def.kind));
    const missing = [...used].filter((kind) => !ITEM_TINT[kind]);
    expect(missing, `바닥에 떨어지면 색이 없는 종류: ${missing.join(', ')}`).toEqual([]);
  });

  it('쓰이지 않는 종류가 남아 있지 않다', () => {
    const used = new Set(Object.values(ITEMS).map((def) => def.kind));
    const dead = Object.keys(ITEM_TINT).filter((kind) => !used.has(kind as never));
    expect(dead, `아무 물건도 쓰지 않는 종류: ${dead.join(', ')}`).toEqual([]);
  });

  it('갑옷과 투구를 뺀 종류끼리는 색이 다르다', () => {
    // 갑옷·투구는 일부러 같은 색입니다 (둘 다 '입는 쇠붙이')
    const tints = Object.entries(ITEM_TINT).filter(([kind]) => kind !== 'helmet').map(([, color]) => color);
    expect(new Set(tints).size, `색이 겹칩니다: ${tints.join(' ')}`).toBe(tints.length);
  });
});

describe('KIND_ICON ↔ 물건 종류', () => {
  it('실제로 쓰이는 종류가 빠짐없이 있다', () => {
    const used = new Set(Object.values(ITEMS).map((def) => def.kind));
    const missing = [...used].filter((kind) => !KIND_ICON[kind]);
    expect(missing, `가방에서 글자가 안 붙는 종류: ${missing.join(', ')}`).toEqual([]);
  });

  it('쓰이지 않는 종류가 남아 있지 않다', () => {
    const used = new Set(Object.values(ITEMS).map((def) => def.kind));
    const dead = Object.keys(KIND_ICON).filter((kind) => !used.has(kind as never));
    expect(dead, `아무 물건도 쓰지 않는 종류: ${dead.join(', ')}`).toEqual([]);
  });

  it('종류마다 글자가 다르고, 한 글자다', () => {
    const icons = Object.values(KIND_ICON);
    expect(new Set(icons).size, `글자가 겹칩니다: ${icons.join(' ')}`).toBe(icons.length);
    expect(icons.filter((icon) => [...icon].length !== 1), '한 글자가 아닌 것이 있습니다').toEqual([]);
  });
});

describe('NPC_ROLE ↔ 마을 사람', () => {
  it('지도에 서 있는 사람의 역할이 빠짐없이 있다', () => {
    const standing = new Set(Object.values(MAPS).flatMap((def) => def.npcs.map((npc) => npc.kind)));
    const missing = [...standing].filter((kind) => !NPC_ROLE[kind]);
    expect(missing, `역할이 없는 사람: ${missing.join(', ')}`).toEqual([]);
  });

  it('지도에 없는 역할이 남아 있지 않다', () => {
    const standing = new Set(Object.values(MAPS).flatMap((def) => def.npcs.map((npc) => npc.kind)));
    const dead = Object.keys(NPC_ROLE).filter((kind) => !standing.has(kind as never));
    expect(dead, `아무도 맡지 않은 역할: ${dead.join(', ')}`).toEqual([]);
  });

  it('역할 이름이 서로 다르다', () => {
    const roles = Object.values(NPC_ROLE);
    expect(new Set(roles).size, `역할 이름이 겹칩니다: ${roles.join(' ')}`).toBe(roles.length);
  });
});

/* ===========================================================================
 *  맞은 몬스터의 번쩍임
 * ======================================================================== */

/**
 *  ★ core 의 monster.hitFlash 는 0.12초짜리라 눈에 안 걸렸습니다.
 *    규칙 값을 늘리는 대신 그림 쪽에서 시작 시각을 기억해 조금 더 길게 보여줍니다.
 *    여기서 지킬 것은 "core 값은 그대로" 와 "0.12초보다 오래 보인다" 둘입니다.
 */
describe('맞은 몬스터가 번쩍인다', () => {
  const flashCalls = (ctx: { strokes: string[] }) => ctx.strokes.filter((c) => c === '#fff2e0').length;

  it('맞지 않은 몬스터는 번쩍이지 않는다', () => {
    const world = inForest();
    const monster = monsterAt(world, 'wolf', 400, 400, 'idle');
    monster.hitFlash = 0;

    const ctx = fakeCtx();
    drawMonster(ctx, world, monster);
    expect(flashCalls(ctx)).toBe(0);
  });

  it('맞은 순간에는 테두리가 한 겹 돈다', () => {
    const world = inForest();
    const monster = monsterAt(world, 'wolf', 400, 400, 'idle');
    monster.hitFlash = 0.12; // combat.ts 가 세우는 값 그대로

    const ctx = fakeCtx();
    drawMonster(ctx, world, monster);
    expect(flashCalls(ctx), '번쩍임이 없습니다').toBeGreaterThan(0);
  });

  it('core 가 정한 0.12초보다 오래 보인다 — 그런데 core 값은 그대로다', () => {
    const world = inForest();
    const monster = monsterAt(world, 'wolf', 400, 400, 'idle');
    world.time = 100;
    monster.hitFlash = 0.12;

    // 첫 프레임에 번쩍이 시작됩니다
    drawMonster(fakeCtx(), world, monster);

    // core 는 0.12초 만에 hitFlash 를 0 으로 내립니다
    monster.hitFlash = 0;
    world.time = 100.2; // 0.2초 뒤 — 예전이라면 이미 꺼졌을 때
    const later = fakeCtx();
    drawMonster(later, world, monster);
    expect(later.strokes.length, '0.12초 만에 꺼졌습니다').toBeGreaterThan(0);

    // 그래도 영영 켜져 있지는 않습니다
    world.time = 100.4;
    const gone = fakeCtx();
    drawMonster(gone, world, monster);
    expect(flashCalls(gone), '번쩍임이 안 꺼집니다').toBe(0);
  });

  it('맞은 놈만 번쩍인다', () => {
    const world = inForest();
    world.time = 50;
    const hurt = monsterAt(world, 'wolf', 400, 400, 'idle');
    const calm = monsterAt(world, 'wolf', 460, 400, 'idle');
    hurt.hitFlash = 0.12;
    calm.hitFlash = 0;

    const a = fakeCtx();
    drawMonster(a, world, hurt);
    const b = fakeCtx();
    drawMonster(b, world, calm);

    expect(flashCalls(a)).toBeGreaterThan(0);
    expect(flashCalls(b), '안 맞은 놈이 번쩍입니다').toBe(0);
  });
});

/* ===========================================================================
 *  화로가 대장장이를 뚫고 올라가지 않는다
 * ======================================================================== */

describe('화로 크기', () => {
  it('아무리 자라도 굴뚝이 두린의 발끝을 넘지 않는다', () => {
    const town = mapDef('town');
    const forge = town.forge!;
    const durin = town.npcs!.find((n) => n.kind === 'smith')!;

    // 화로 중심에서 두린이 서 있는 자리까지의 거리
    const room = (forge.ty - durin.ty) * TILE;
    // 굴뚝은 화로 중심에서 36px 위에서 시작합니다 (drawForge 의 fillRect y - 34..-36)
    const CHIMNEY = 36;

    const biggest = Math.max(...FORGE_GROWN);
    expect(
      CHIMNEY * biggest,
      `화로가 ${biggest}배까지 자라면 굴뚝이 두린(${durin.tx},${durin.ty})을 뚫습니다`,
    ).toBeLessThan(room);
  });

  it('단계마다 실제로 커진다 — 중간에 멈추지 않는다', () => {
    for (let i = 1; i < FORGE_GROWN.length; i++) {
      expect(FORGE_GROWN[i]!, `${i}단계`).toBeGreaterThan(FORGE_GROWN[i - 1]!);
    }
    // 마을 성장 단계(2개 + 0단계)보다 짧으면 뒤쪽 단계에서 화로가 안 자랍니다
    expect(FORGE_GROWN.length).toBeGreaterThanOrEqual(TOWN_STAGES.length + 1);
  });
});

/* ===========================================================================
 *  죽으면 쓰러진다
 *
 *  ★ 예전에는 마지막 일격과 동시에 팝 하고 사라졌습니다. 죽인 손맛이
 *    거기서 빠졌습니다. core 는 그대로입니다 — 죽는 즉시 'dead' 로 두고
 *    respawnIn 을 세기 시작할 뿐이고, 그림이 그 셈에서 경과를 되읽습니다.
 * ======================================================================== */

/** 죽은 지 given 초 지난 몬스터 */
function dyingFor(world: World, seconds: number, facing = 0): Monster {
  const monster = monsterAt(world, 'wolf', 400, 400, 'dead');
  monster.facing = facing;
  monster.respawnIn = monsterDef('wolf').respawn - seconds;
  return monster;
}

describe('죽으면 쓰러진다', () => {
  it('살아 있으면 쓰러지지 않는다', () => {
    const world = inForest();
    const monster = monsterAt(world, 'wolf', 400, 400, 'idle');
    expect(deathProgress(monster)).toBeNull();
  });

  it('죽은 직후부터 0.4초까지만 쓰러지는 중이다', () => {
    const world = inForest();
    expect(deathProgress(dyingFor(world, 0))).toBe(0);
    expect(deathProgress(dyingFor(world, DEATH_SECONDS / 2))).toBeCloseTo(0.5, 5);
    expect(deathProgress(dyingFor(world, DEATH_SECONDS)), '0.4초가 지나도 남아 있습니다').toBeNull();
    expect(deathProgress(dyingFor(world, 10))).toBeNull();
  });

  it('★ 되살아남이 0.4초보다 훨씬 길다 — 겹치면 시체가 되살아나며 눕는다', () => {
    for (const id of ['stray-dog', 'wolf', 'cave-bat', 'river-crab', 'cave-spider']) {
      expect(monsterDef(id).respawn, `${id}`).toBeGreaterThan(DEATH_SECONDS * 10);
    }
  });

  it('시간이 갈수록 더 눕는다', () => {
    const world = inForest();
    const tilt = (t: number) => {
      const ctx = fakeCtx();
      drawMonster(ctx, world, dyingFor(world, t));
      return Math.abs(ctx.rotates[0] ?? 0);
    };
    const early = tilt(0.05);
    const mid = tilt(0.2);
    const late = tilt(0.35);

    expect(early).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
    // 다 넘어가면 거의 눕습니다 (90도 근처)
    expect(late).toBeGreaterThan(1.3);
  });

  it('맞은 쪽 반대로 눕는다 — 등 뒤로 넘어간다', () => {
    const world = inForest();
    const angle = (facing: number) => {
      const ctx = fakeCtx();
      drawMonster(ctx, world, dyingFor(world, 0.3, facing));
      return ctx.rotates[0] ?? 0;
    };
    // 오른쪽(나)을 보고 죽으면 왼쪽으로, 왼쪽을 보고 죽으면 오른쪽으로
    expect(angle(0)).toBeLessThan(0);
    expect(angle(Math.PI)).toBeGreaterThan(0);
  });

  it('★ 진짜로 죽여도 0.4초 동안 그려진다 — 규칙이 도는 채로', () => {
    // deathProgress 만 따로 보면 respawnIn 을 손으로 세운 것이라 실제와 다를 수 있습니다.
    // 여기서는 core 로 정말 죽이고, 엔진을 돌리며 매 틱 되읽습니다.
    const world = inForest();
    const monster = monsterAt(world, 'wolf', 400, 400, 'idle');
    monster.hp = 1;
    world.me.pos = { x: 400, y: 400 };
    world.me.skills.swordsmanship = 100;

    for (let guard = 0; guard < 200 && monster.state !== 'dead'; guard++) {
      swingAtMonster(world, monster);
      step(world, 1 / 60);
    }
    expect(monster.state, '늑대가 죽지 않았습니다').toBe('dead');

    const seen: number[] = [];
    for (let i = 0; i < 60; i++) {
      const at = deathProgress(monster);
      if (at !== null) seen.push(at);
      step(world, 1 / 60);
    }

    // 0.4초 = 24틱쯤 그려집니다
    expect(seen.length, `쓰러지는 프레임이 ${seen.length}장뿐입니다`).toBeGreaterThan(18);
    expect(seen.length).toBeLessThanOrEqual(25);
    // 점점 더 눕습니다
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThan(seen[i - 1]!);
    // 그리고 끝납니다 — 시체가 남지 않습니다
    expect(deathProgress(monster)).toBeNull();
  });

  it('★ 죽은 뒤 번쩍임이 얼어붙지 않는다', () => {
    // core 는 죽은 몬스터의 hitFlash 를 더 깎지 않습니다. 그대로 두면
    // 마지막 일격의 값이 얼어붙어 매 프레임 다시 켜지고, 시체가 영원히 하얗게 탑니다.
    const world = inForest();
    const monster = monsterAt(world, 'wolf', 400, 400, 'chase');
    monster.hitFlash = 0.12;
    drawMonster(fakeCtx(), world, monster); // 맞은 순간을 그림이 기억합니다

    monster.state = 'dead';
    monster.respawnIn = monsterDef('wolf').respawn - 0.3;
    world.time += 1; // 번쩍임(0.26초)이 진작 식었어야 할 만큼 지났습니다

    const ctx = fakeCtx();
    drawMonster(ctx, world, monster);
    expect(ctx.strokes.filter((c) => c === '#fff2e0').length, '시체가 계속 번쩍입니다').toBe(0);
  });
});

/**
 *  ★ 이 묶음이 생긴 이유: 그림 한 장을 여럿이 나눠 쓰면서 **색만 코드가 입힙니다.**
 *    그 연결이 표 두 개(SPRITES · SPRITE_TONES)의 키가 같다는 것에만 기대고 있는데,
 *    어긋나도 아무 일이 안 일어납니다 — 그냥 안 물들고 회색 그대로 나옵니다.
 *    들개·늑대·얼어붙은 것이 같은 짐승으로 보이던 것이 정확히 그 고장이었습니다.
 */
describe('그림에 색 입히기', () => {
  it('톤 표의 키가 전부 그림 표에 있다', () => {
    for (const key of Object.keys(SPRITE_TONES)) {
      expect(SPRITES[key], `SPRITE_TONES 에 '${key}' 가 있는데 SPRITES 에는 없습니다`).toBeTruthy();
    }
  });

  it('구워진 톤이 실제로 shades() 가 만드는 값이다', () => {
    //  ★ 그림은 늑대색으로 구웠습니다. 그 값이 아니면 1:1 대응이 깨지고,
    //    깨져도 화면은 조용합니다 — 안 맞는 색은 그냥 안 바뀝니다.
    const wolf = monsterDef('wolf');
    const [light, base, dark] = SPRITE_TONES['shape/beast']!;
    expect(base).toBe(wolf.color);
    expect(light).toBe(hexOf(lighten(wolf.color, 0.3)));
    expect(dark).toBe(hexOf(darken(wolf.color, 0.42)));
  });

  it('모양을 나눠 쓰는 짐승들이 서로 다른 색을 받는다', () => {
    //  셋 다 beast 라 그림이 같습니다. 색이 갈리지 않으면 크기로만 구분됩니다
    const colors = ['stray-dog', 'wolf', 'frozen-thing'].map((id) => monsterDef(id).color);
    expect(new Set(colors).size).toBe(3);
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

/**
 *  ★ 이 묶음이 생긴 이유: 걷기는 그림 여러 장인데 `drawSprite` 는 **가로만 받고
 *    세로를 그림 비율로** 냅니다. 그래서 프레임마다 크기가 다르면 짐승이 걷는 것이
 *    아니라 **커졌다 작아졌다** 합니다. 눈으로는 「좀 이상한데」로 끝나기 쉬워서
 *    파일에서 직접 재 둡니다.
 */
describe('걷기 프레임', () => {
  /** PNG 머리에서 크기만 읽습니다 — 이것 때문에 해독기를 부를 것까지는 없습니다 */
  const sizeOf = (file: string) => {
    const buf = readFileSync(`public/props/${file}`);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  };

  it('걷기 표의 키가 전부 그림 표에 있다', () => {
    for (const key of Object.keys(SPRITE_WALK)) {
      expect(SPRITES[key], `SPRITE_WALK 에 '${key}' 가 있는데 SPRITES 에는 없습니다`).toBeTruthy();
    }
  });

  it('한 키의 프레임들이 같은 크기다', () => {
    for (const [key, files] of Object.entries(SPRITE_WALK)) {
      expect(files.length, `${key} 의 프레임이 모자랍니다`).toBeGreaterThanOrEqual(2);
      const sizes = files.map(sizeOf);
      for (const s of sizes) {
        expect(s, `${key} 의 프레임 크기가 서로 다릅니다: ${JSON.stringify(sizes)}`).toEqual(sizes[0]);
      }
    }
  });

  it('프레임 파일이 실제로 있다', () => {
    for (const files of Object.values(SPRITE_WALK)) {
      for (const f of files) expect(existsSync(`public/props/${f}`), `없는 파일: ${f}`).toBe(true);
    }
  });
});

/**
 *  ★ 재현 케이스입니다 (CLAUDE.md 7장). 실제로 났던 고장을 그대로 남깁니다 —
 *    lighten/darken 이 'rgb(r,g,b)' 를 돌려주는데 '#rrggbb' 인 줄 알고 읽어서
 *    NaN → 0 이 되었고, **짐승이 전부 새까맣게** 그려졌습니다.
 *    화면도 콘솔도 아무 말을 안 했습니다.
 */
describe('색 문자열 읽기', () => {
  it("lighten/darken 이 돌려주는 rgb() 꼴을 읽는다", () => {
    const wolf = monsterDef('wolf').color;
    expect(packColor(lighten(wolf, 0.3))).toBe(packColor(SPRITE_TONES['shape/beast']![0]));
    expect(packColor(darken(wolf, 0.42))).toBe(packColor(SPRITE_TONES['shape/beast']![2]));
  });

  it("'#rrggbb' 꼴도 같은 값으로 읽는다", () => {
    expect(packColor('#7d8590')).toBe(packColor('rgb(125,133,144)'));
  });

  it('못 읽는 색은 조용히 검정으로 떨어지지 않고 던진다', () => {
    expect(() => packColor('없는색')).toThrow();
    expect(() => packColor('#zzzzzz')).toThrow();
  });
});

/** 'rgb(r,g,b)' → '#rrggbb'. lighten/darken 이 rgb() 문자열을 돌려줍니다 */
function hexOf(rgb: string): string {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return '#' + [r, g, b].map((v) => v!.toString(16).padStart(2, '0')).join('');
}
