/**
 *  칭호 — 세계가 나를 알아보는 방법 (목적지-기획안 2.2).
 *
 *  ★ 첫 칭호는 싸고 빠릅니다 (전체설계 4.3). 대단해 보이면 뒤의 것이 시시해집니다.
 *  ★ 지금은 하나뿐이라 "고르는 것" 이 없습니다. 구조만 세웁니다 —
 *    고르는 것이 선택이 되는 것은 칭호가 여럿이 되는 F 부터입니다.
 */

import { describe, expect, it } from 'vitest';

import { mapDef } from '../../src/rpg/content/maps';
import { TITLES, TITLE_ORDER, titleDef } from '../../src/rpg/content/titles';
import { wear } from '../../src/rpg/core/commands';
import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { TITLE_RULES, checkTitles, displayName, wornTitle } from '../../src/rpg/core/titles';
import { enterMap, openRegions } from '../../src/rpg/core/world';
import type { World } from '../../src/rpg/types';

function fresh(): World {
  return createWorld('아무개', 'miner');
}

/** 걸어서 닿는 지역을 한 번씩 밟습니다 — 2층은 조건 뒤라 여기 없습니다 */
function walkEverywhere(world: World): void {
  for (const id of openRegions()) {
    const def = mapDef(id);
    enterMap(world, id, def.entryTx, def.entryTy);
  }
}

/** 2층까지 내려갑니다 */
function goBelow(world: World): void {
  const def = mapDef('mine-deep');
  enterMap(world, 'mine-deep', def.entryTx, def.entryTy);
}

describe('표 자체', () => {
  /*
   *  ★ core/titles.ts 가 switch 였고 `default: return false` 가 있었습니다.
   *    표에 칭호를 더하고 조건을 잊으면 **화면에는 있는데 영영 안 붙는 칭호**가
   *    됩니다 — 조용한 실패입니다 (CLAUDE.md 6장). 표로 바꿔서 여기서 맞춰봅니다.
   */
  it('★ 칭호마다 조건이 있다 — 표에만 있고 조건이 없는 것이 없다', () => {
    const noRule = TITLE_ORDER.filter((id) => !(id in TITLE_RULES));
    expect(noRule, `조건이 없는 칭호: ${noRule.join(' · ')}`).toEqual([]);
  });

  it('★ 조건만 있고 표에 없는 것도 없다 — 반대쪽도 어긋날 수 있다', () => {
    const noDef = Object.keys(TITLE_RULES).filter((id) => !TITLE_ORDER.includes(id));
    expect(noDef, `표에 없는 조건: ${noDef.join(' · ')}`).toEqual([]);
  });

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

/* ===========================================================================
 *  두 번째 칭호 — 여기서 처음으로 '고르는 것' 이 생깁니다
 * ======================================================================== */

describe('아래를 본 사람', () => {
  it('2층에 안 내려가면 안 준다', () => {
    const world = fresh();
    walkEverywhere(world);
    step(world, 1 / 20);

    expect(world.me.titles).not.toContain('went-below');
  });

  it('★ 2층에 내려가면 준다', () => {
    const world = fresh();
    goBelow(world);
    step(world, 1 / 20);

    expect(world.me.titles).toContain('went-below');
  });

  it('★ 「길 아는 사람」은 2층을 안 센다 — 세면 둘이 같은 말이 된다', () => {
    const world = fresh();
    goBelow(world);
    step(world, 1 / 20);

    expect(world.me.titles).not.toContain('walked-all');
  });

  it('★ 둘을 다 얻어도 자동으로 갈아 끼우지 않는다 — 고르는 것은 사람이다', () => {
    const world = fresh();
    walkEverywhere(world);
    step(world, 1 / 20);
    expect(world.me.wearing).toBe('walked-all');

    goBelow(world);
    step(world, 1 / 20);

    expect(world.me.titles).toHaveLength(2);
    expect(world.me.wearing, '나중 것이 멋대로 달렸습니다').toBe('walked-all');
  });

  it('고르면 이름이 바뀐다', () => {
    const world = fresh();
    walkEverywhere(world);
    goBelow(world);
    step(world, 1 / 20);

    expect(wear(world, 'went-below')).toBe(true);
    expect(displayName(world.me)).toBe('아래를 본 사람 아무개');
  });
});
