/**
 *  시험용 명령.
 *
 *  ★ 여기서 지킬 것은 "명령이 잘 돈다" 보다 앞에 있습니다 —
 *    이 파일이 게임 규칙을 한 글자도 바꾸지 않는다는 것.
 *    그래서 명령은 전부 core/ 가 이미 내보내는 함수와 필드 대입으로만 만들어져 있고,
 *    무게·칸 같은 규칙에 막히면 우회하지 않고 그대로 실패합니다.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { MAX_SKILL } from '../../src/rpg/balance';
import { mapDef } from '../../src/rpg/content/maps';
import { createWorld } from '../../src/rpg/core/create';
import { countOf } from '../../src/rpg/core/inventory';
import { attach } from '../../src/rpg/dev/DevTools';
import type { World } from '../../src/rpg/types';

type Api = {
  skill: (id: string, value: number) => string;
  give: (defId: string, count?: number) => string;
  go: (mapId: string) => string;
  dur: (ratio: number, only?: string) => string;
  fast: (seconds: number) => string;
  bot: (minutes: number, focus?: 'balanced' | 'mine' | 'fight') => string;
  help: () => string;
  items: string[];
};

let detach: (() => void) | null = null;

function open(): { world: World; aden: Api } {
  const world = createWorld('시험', 'miner');
  detach = attach(world, () => {});
  const aden = (globalThis as unknown as { aden: Api }).aden;
  return { world, aden };
}

afterEach(() => {
  detach?.();
  detach = null;
});

describe('시험용 명령', () => {
  it('붙이면 aden 이 생기고, 떼면 사라진다', () => {
    const { aden } = open();
    expect(aden).toBeTruthy();
    expect(aden.help()).toContain('aden.skill');
    detach?.();
    detach = null;
    expect((globalThis as unknown as { aden?: Api }).aden).toBeUndefined();
  });

  it('skill — 값을 세우고 0~100 밖으로는 안 나간다', () => {
    const { world, aden } = open();
    aden.skill('mining', 60);
    expect(world.me.skills.mining).toBe(60);

    aden.skill('blacksmithing', 999);
    expect(world.me.skills.blacksmithing).toBe(MAX_SKILL);

    aden.skill('defense', -5);
    expect(world.me.skills.defense).toBe(0);

    expect(() => aden.skill('없는스킬', 10)).toThrow();
  });

  it('give — 물건을 주고, 없는 물건은 알려준다', () => {
    const { world, aden } = open();
    aden.give('iron-ingot', 3);
    expect(countOf(world.me, 'iron-ingot')).toBe(3);

    expect(() => aden.give('그런거없음', 1)).toThrow(/그런 물건이 없습니다/);
  });

  it('★ give 는 무게 규칙을 우회하지 않는다 — 막히면 그대로 실패한다', () => {
    const { world, aden } = open();
    // 들 수 없는 양을 달라고 하면 규칙이 막고, 가방도 안 늘어납니다
    expect(() => aden.give('iron-ore', 9999)).toThrow(/무게나 칸/);
    expect(countOf(world.me, 'iron-ore')).toBe(0);
  });

  it('go — 지역을 옮긴다', () => {
    const { world, aden } = open();
    aden.go('mine');
    expect(world.mapId).toBe('mine');
    const def = mapDef('mine');
    expect(world.me.pos.x).toBeCloseTo(def.entryTx * 32 + 16, 6);

    expect(() => aden.go('없는지역')).toThrow();
  });

  it('dur — 내구도를 남은 비율로 맞춘다', () => {
    const { world, aden } = open();
    const weapon = world.me.equipped.weapon!;
    expect(weapon.maxDurability).toBeGreaterThan(0);

    aden.dur(0.02, 'weapon');
    expect(weapon.durability).toBeCloseTo(weapon.maxDurability! * 0.02, 6);

    aden.dur(1);
    expect(weapon.durability).toBe(weapon.maxDurability);
  });

  it('fast — 규칙을 안 건드리고 시간만 흘려보낸다', () => {
    const { world, aden } = open();
    const before = world.time;
    aden.fast(60);
    expect(world.time - before).toBeGreaterThan(59);
    expect(world.time - before).toBeLessThan(61);
  });

  it('bot — 봇이 실제로 놀아서 스킬이 오른다', () => {
    const { world, aden } = open();
    const before = world.me.skills.mining;
    aden.bot(20, 'mine');
    expect(world.time).toBeGreaterThan(20 * 60 - 1);
    expect(world.me.skills.mining, '봇이 아무것도 안 했습니다').toBeGreaterThan(before);
  });

  it('★ 같은 씨앗이면 봇 결과가 같다 — 세계의 난수를 건드리지 않는다', () => {
    const runs: number[] = [];
    for (let i = 0; i < 2; i++) {
      const world = createWorld('시험', 'miner');
      world.seed = 4242;
      const stop = attach(world, () => {});
      (globalThis as unknown as { aden: Api }).aden.bot(10, 'mine');
      runs.push(world.me.skills.mining);
      stop();
    }
    expect(runs[0]).toBe(runs[1]);
  });

  it('items 는 실제 물건 목록이다', () => {
    const { aden } = open();
    expect(aden.items).toContain('iron-ingot');
    expect(aden.items.length).toBeGreaterThan(5);
  });
});
