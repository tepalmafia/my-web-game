/**
 *  소리와 타격감이 게임의 발목을 잡지 않는지.
 *
 *  ★ 두 가지를 못 박습니다.
 *    1. core/ 는 audio/ 를 부르지 않는다 — 부르는 순간 헤드리스 봇이 죽습니다.
 *    2. audio/ 와 히트스톱을 통째로 꺼둔 채로도 게임과 봇이 정상으로 돈다.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { clearFeedbackListeners, floater, hasFeedbackListeners } from '../../src/rpg/core/feedback';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { swingAtMonster } from '../../src/rpg/core/combat';
import { enterMap } from '../../src/rpg/core/world';
import { mapDef } from '../../src/rpg/content/maps';
import { attachAudio } from '../../src/rpg/audio';
import { supported } from '../../src/rpg/audio/bus';
import {
  MAX_FREEZE_SECONDS,
  attachImpact,
  frozen,
  kick,
  resetImpact,
  tickImpact,
} from '../../src/rpg/ui/impact';
import { autopilot, newPilot } from '../../tools/autopilot';
import type { World } from '../../src/rpg/types';

/**
 * 소스를 글자 그대로 읽어옵니다 (vite 의 ?raw).
 * 노드의 fs 를 쓰지 않으므로 의존성이 늘지 않습니다.
 */
const CORE = import.meta.glob('../../src/rpg/core/**/*.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
const CONTENT = import.meta.glob('../../src/rpg/content/**/*.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
const TOOLS = import.meta.glob('../../tools/**/*.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
const IMPACT = import.meta.glob('../../src/rpg/ui/impact.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

/** import 줄에서 가리키는 곳만 봅니다 (주석에 적힌 'audio/' 는 세지 않습니다) */
function importsOf(source: string): string[] {
  const targets: string[] = [];
  for (const match of source.matchAll(/from\s+'([^']+)'/g)) targets.push(match[1]!);
  for (const match of source.matchAll(/import\s*\(\s*'([^']+)'\s*\)/g)) targets.push(match[1]!);
  return targets;
}

function expectNoAudio(files: Record<string, string>): void {
  for (const [path, source] of Object.entries(files)) {
    for (const target of importsOf(source)) {
      expect(target, `${path} 가 ${target} 을 부릅니다`).not.toMatch(/audio/);
    }
  }
}

afterEach(() => {
  clearFeedbackListeners();
  resetImpact();
});

describe('경계', () => {
  it('core/ 는 audio/ 를 부르지 않는다', () => {
    expect(Object.keys(CORE).length, '읽어온 파일이 없습니다').toBeGreaterThan(5);
    expectNoAudio(CORE);
  });

  it('content/ 도 audio/ 를 부르지 않는다', () => {
    expect(Object.keys(CONTENT).length).toBeGreaterThan(3);
    expectNoAudio(CONTENT);
  });

  it('봇(tools/)도 audio/ 를 부르지 않는다', () => {
    expect(Object.keys(TOOLS).length).toBeGreaterThan(1);
    expectNoAudio(TOOLS);
  });

  it('히트스톱은 소리와 묶여 있지 않다', () => {
    // 음소거든 audio/ 를 통째로 꺼두든 멈춤과 흔들림은 그대로 나와야 합니다
    expect(Object.keys(IMPACT)).toHaveLength(1);
    expectNoAudio(IMPACT);
  });
});

describe('꺼둔 채로도 돈다', () => {
  it('아무도 구독하지 않으면 구독자 수가 0 인 채로 봇이 돈다', () => {
    expect(hasFeedbackListeners()).toBe(false);

    const world: World = createWorld('봇', 'smith');
    world.seed = 4242;
    const pilot = newPilot();
    for (let i = 0; i < 60 * 20 * 3; i++) {
      autopilot(world, pilot);
      step(world, 1 / 20);
    }

    expect(hasFeedbackListeners(), '봇이 도는 중에 구독자가 생겼습니다').toBe(false);
    expect(world.me.tally['iron-ore'] ?? 0).toBeGreaterThan(0);
  });

  it('소리를 켜도(브라우저가 아니라 소리는 안 나도) 게임은 그대로 돈다', () => {
    // 노드에는 AudioContext 가 없습니다 — 그래도 붙이고 떼는 것이 터지지 않아야 합니다
    expect(supported()).toBe(false);
    const detach = attachAudio();

    const world = createWorld('시험', 'guard');
    world.seed = 7;
    enterMap(world, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);
    const monster = world.monsters.find((m) => m.state !== 'dead')!;
    monster.pos = { x: world.me.pos.x + 20, y: world.me.pos.y };

    expect(() => {
      for (let i = 0; i < 40; i++) swingAtMonster(world, monster);
    }).not.toThrow();

    detach();
    expect(hasFeedbackListeners()).toBe(false);
  });
});

describe('히트스톱', () => {
  it('맞으면 잠깐 멈추고, 시간이 지나면 풀린다', () => {
    const detach = attachImpact();
    const world = createWorld('시험', 'miner');

    expect(frozen()).toBe(false);
    floater(world, { x: 0, y: 0 }, '7', 'damage');
    expect(frozen(), '때렸는데 멈추지 않습니다').toBe(true);

    tickImpact(0.031);
    expect(frozen(), '30ms 가 지났는데 아직 멈춰 있습니다').toBe(false);
    detach();
  });

  it('연타해도 멈춤이 쌓이지 않는다', () => {
    // ★ 이게 없으면 난타전에서 게임이 통째로 느려집니다
    const detach = attachImpact();
    const world = createWorld('시험', 'miner');

    for (let i = 0; i < 200; i++) floater(world, { x: 0, y: 0 }, '19', 'crit');

    tickImpact(MAX_FREEZE_SECONDS + 0.001);
    expect(frozen(), `200번 때렸더니 ${MAX_FREEZE_SECONDS * 1000}ms 를 넘겨 멈춰 있습니다`).toBe(false);
    detach();
  });

  it('크리티컬이 일반 타격보다 크게 흔든다', () => {
    const detach = attachImpact();
    const world = createWorld('시험', 'miner');

    floater(world, { x: 0, y: 0 }, '7', 'damage');
    tickImpact(0.001);
    const normal = Math.hypot(kick().x, kick().y);

    resetImpact();
    floater(world, { x: 0, y: 0 }, '19', 'crit');
    tickImpact(0.001);
    const crit = Math.hypot(kick().x, kick().y);

    expect(crit).toBeGreaterThan(normal);
    expect(crit).toBeLessThanOrEqual(5);
    detach();
  });

  it('떼면 멈춤도 흔들림도 남지 않는다', () => {
    const detach = attachImpact();
    const world = createWorld('시험', 'miner');
    floater(world, { x: 0, y: 0 }, '19', 'crit');
    detach();

    expect(frozen()).toBe(false);
    expect(kick()).toEqual({ x: 0, y: 0 });

    floater(world, { x: 0, y: 0 }, '19', 'crit');
    expect(frozen(), '뗐는데도 멈춥니다').toBe(false);
  });
});
