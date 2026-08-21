/**
 *  칭호 — 세계가 나를 알아보는 방법 (목적지-기획안 2.2).
 *
 *  ★ 첫 칭호는 싸고 빠릅니다 (전체설계 4.3). 대단해 보이면 뒤의 것이 시시해집니다.
 *  ★ 지금은 하나뿐이라 "고르는 것" 이 없습니다. 구조만 세웁니다 —
 *    고르는 것이 선택이 되는 것은 칭호가 여럿이 되는 F 부터입니다.
 */

import { describe, expect, it } from 'vitest';

import { MAP_ORDER, mapDef } from '../../src/rpg/content/maps';
import { TITLES, TITLE_ORDER, titleDef } from '../../src/rpg/content/titles';
import { wear } from '../../src/rpg/core/commands';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { checkTitles, displayName, wornTitle } from '../../src/rpg/core/titles';
import { enterMap } from '../../src/rpg/core/world';
import type { World } from '../../src/rpg/types';

function fresh(): World {
  return createWorld('아무개', 'miner');
}

/** 모든 지역을 한 번씩 밟습니다 */
function walkEverywhere(world: World): void {
  for (const id of MAP_ORDER) {
    const def = mapDef(id);
    enterMap(world, id, def.entryTx, def.entryTy);
  }
}

describe('표 자체', () => {
  it('id 와 표의 키가 맞는다', () => {
    expect(Object.keys(TITLES).sort()).toEqual([...TITLE_ORDER].sort());
    for (const id of TITLE_ORDER) expect(titleDef(id).id).toBe(id);
  });

  it('이름과 얻은 사연이 빠짐없이 있다', () => {
    for (const id of TITLE_ORDER) {
      const def = titleDef(id);
      expect(def.name.length, `${id} 에 이름이 없습니다`).toBeGreaterThan(0);
      expect(def.earned.length, `${id} 에 무엇을 해서 얻었는지가 없습니다`).toBeGreaterThan(0);
    }
  });

  it('없는 칭호를 찾으면 조용히 넘어가지 않는다', () => {
    expect(() => titleDef('그런-것-없음')).toThrow();
  });
});

describe('길 아는 사람', () => {
  it('처음에는 아무 칭호도 없다', () => {
    const world = fresh();
    expect(world.me.titles).toEqual([]);
    expect(wornTitle(world.me)).toBeNull();
    expect(displayName(world.me)).toBe('아무개');
  });

  it('마을만 밟아서는 안 준다 — 첫 것이라도 공짜는 아니다', () => {
    const world = fresh();
    step(world, 1 / 20);
    expect(world.me.titles).toEqual([]);
  });

  it('★ 모든 지역을 밟으면 준다 — discovered 를 처음으로 읽는다', () => {
    const world = fresh();
    walkEverywhere(world);
    step(world, 1 / 20);

    expect(world.me.titles, '지역을 다 밟았는데 칭호가 없습니다').toContain('walked-all');
  });

  it('★ 칭호 이름 뒤에 조사를 붙이지 않는다 — 끝 글자마다 갈린다', () => {
    //  '사람' 뒤에는 '이라', '자' 뒤에는 '라' 입니다. 표가 늘면 언젠가 틀립니다.
    const world = fresh();
    walkEverywhere(world);
    world.log.length = 0;
    step(world, 1 / 20);

    const line = world.log.find((l) => l.text.includes('「'))!;
    expect(line, '칭호를 알리는 줄이 없습니다').toBeTruthy();
    expect(line.text.trimEnd().endsWith('」'), `조사가 붙었습니다: ${line.text}`).toBe(true);
  });

  it('★ 조용히 주지 않는다 — 화면에 나온다', () => {
    const world = fresh();
    walkEverywhere(world);
    world.log.length = 0;
    step(world, 1 / 20);

    expect(world.log.some((line) => line.text.includes(titleDef('walked-all').name))).toBe(true);
    expect(world.toast?.text).toContain(titleDef('walked-all').name);
  });

  it('첫 칭호는 저절로 달린다 — 하나뿐인데 고르라고 하면 이상하다', () => {
    const world = fresh();
    walkEverywhere(world);
    step(world, 1 / 20);

    expect(world.me.wearing).toBe('walked-all');
    expect(displayName(world.me)).toBe('길 아는 사람 아무개');
  });

  it('두 번 주지 않는다', () => {
    const world = fresh();
    walkEverywhere(world);
    for (let i = 0; i < 200; i++) step(world, 1 / 20);

    expect(world.me.titles.filter((id) => id === 'walked-all')).toHaveLength(1);
  });
});

describe('다는 것', () => {
  it('가지지 않은 칭호는 못 단다 — 조용히 실패하지 않는다', () => {
    const world = fresh();
    world.log.length = 0;

    expect(wear(world, 'walked-all')).toBe(false);
    expect(world.me.wearing).toBeNull();
    expect(world.log.some((line) => line.tone === 'bad')).toBe(true);
  });

  it('뗄 수 있다', () => {
    const world = fresh();
    walkEverywhere(world);
    step(world, 1 / 20);

    expect(wear(world, null)).toBe(true);
    expect(displayName(world.me)).toBe('아무개');
  });

  it('없는 칭호가 wearing 에 남아 있어도 이름이 깨지지 않는다', () => {
    // 표에서 칭호를 지운 옛 저장 같은 자리
    const world = fresh();
    world.me.wearing = '사라진-칭호';
    expect(wornTitle(world.me)).toBeNull();
    expect(displayName(world.me)).toBe('아무개');
  });

  it('checkTitles 는 다 얻은 뒤에는 아무것도 안 한다', () => {
    const world = fresh();
    walkEverywhere(world);
    step(world, 1 / 20);

    expect(checkTitles(world)).toEqual([]);
  });
});
