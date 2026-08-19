/**
 *  어떤 일에 어떤 소리를 낼 것인가.
 *
 *  ★ 판별은 **원인(cause)** 하나로만 합니다.
 *    예전에는 floater 의 문구('빗나감' '회피' '실패')로 갈랐습니다. 그러면
 *    문구를 못 바꾸게 되고, 다국어에서 무너지고, 제작 실패를 가리려고 둔
 *    타이밍 창은 프레임이 밀리면 조용히 틀립니다.
 *    그래서 core/ 가 원인을 직접 실어 보내도록 바꿨고, 여기서 그것을 지킵니다.
 *
 *  ★ audio/ 에 판별용 한국어 문구가 한 줄도 남지 않았는지도 여기서 봅니다.
 */

import { describe, expect, it } from 'vitest';

import { soundFor } from '../../src/rpg/audio';
import { BLOCK, CRAFT_FAIL, MINE, MISS, ORE, TAKEN } from '../../src/rpg/audio/sfx';
import type { FeedbackCause } from '../../src/rpg/core/feedback';

const AUDIO = import.meta.glob('../../src/rpg/audio/**/*.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

const CORE = import.meta.glob('../../src/rpg/core/**/*.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

/** 주석을 걷어낸 알맹이 (주석의 한글은 설명이라 봐줍니다) */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('원인 → 소리', () => {
  const table: Array<[FeedbackCause, boolean]> = [
    ['sword-hit', true],
    ['sword-crit', true],
    ['sword-miss', true],
    ['dodge', true],
    ['taken', true],
    ['ore', true],
    ['mine-fail', true],
    ['pack-full', true],
    ['craft-fail', true],
    ['craft-fine', true],
    // 아직 소리가 없는 것들 — 조용해야 합니다
    ['gold', false],
    ['heal', false],
    ['skill', false],
  ];

  for (const [cause, hasSound] of table) {
    it(`${cause} → ${hasSound ? '소리 있음' : '조용함'}`, () => {
      expect(soundFor(cause) !== null).toBe(hasSound);
    });
  }

  it('원인이 없으면 조용하다', () => {
    // cause 를 안 적은 발신점이 남아 있어도 게임은 그대로 돌아가야 합니다
    expect(soundFor(undefined)).toBeNull();
  });

  it('곡괭이질은 세 결말 모두 같은 소리를 낸다', () => {
    // 캐냈든 허탕이든 짐이 찼든, 곡괭이가 바위를 때린 것은 같습니다
    for (const cause of ['ore', 'mine-fail', 'pack-full'] as const) {
      expect(soundFor(cause)).not.toBeNull();
    }
  });
});

describe('audio 층은 문구를 읽지 않는다', () => {
  it('판별에 쓰는 한국어 글자가 코드에 없다', () => {
    expect(Object.keys(AUDIO).length, '읽어온 파일이 없습니다').toBeGreaterThan(3);
    for (const [path, source] of Object.entries(AUDIO)) {
      const hangul = code(source).match(/[가-힣]/g);
      expect(hangul, `${path} 의 코드에 한국어가 남아 있습니다: ${hangul?.join('')}`).toBeNull();
    }
  });

  it('core 가 원인을 실어 보내고 있다', () => {
    // 승인받은 12곳입니다. 하나라도 빠지면 그 소리가 조용히 죽습니다.
    const all = Object.values(CORE).join('\n');
    for (const cause of [
      'sword-hit', 'sword-crit', 'sword-miss', 'dodge', 'taken',
      'mine-fail', 'ore', 'pack-full', 'craft-fail', 'craft-fine',
      'gold', 'heal', 'skill',
    ] as const) {
      expect(all, `core/ 어디에서도 '${cause}' 를 보내지 않습니다`).toContain(`'${cause}'`);
    }
  });
});

describe('소리 사양 (설계 문서 §4)', () => {
  it('막힘에는 무게 층이 없다', () => {
    // 막았으니 몸에 안 들어갔다는 뜻이어야 합니다
    expect(Object.keys(BLOCK)).toEqual(['jitter', 'edge', 'ring']);
    expect(JSON.stringify(BLOCK)).not.toContain('wave');
  });

  it('빗나감에는 저역이 없다', () => {
    // miss 에 무게가 없어야 hit 의 무게가 대비로 삽니다
    expect(MISS.air.from).toBeGreaterThan(1000);
    expect(MISS.air.to).toBeGreaterThan(400);
  });

  it('피격은 고역을 깎고 마스터를 눌러 둔탁하게 만든다', () => {
    expect(TAKEN.dull.lp).toBeLessThanOrEqual(1200);
    expect(TAKEN.duck.decibels).toBe(4);
  });

  it('채굴은 변형 4종이고 한 번이 200ms 를 넘지 않는다', () => {
    // 수천 번 반복되는 소리입니다. 길거나 똑같으면 귀가 먼저 지칩니다
    expect(MINE.variants).toHaveLength(4);
    expect(MINE.jitter).toBeCloseTo(0.08);
    for (const variant of MINE.variants) {
      expect(variant.tick.dur + variant.hit.dur).toBeLessThanOrEqual(200);
    }
    expect(new Set(MINE.variants.map((v) => v.tick.bp)).size, '변형이 서로 같습니다').toBe(4);
  });

  it('광석은 올라가고 제작 실패는 내려간다', () => {
    // 방향만으로 좋은 일인지 나쁜 일인지 전해집니다
    expect(ORE.chime.to).toBeGreaterThan(ORE.chime.base);
    expect(CRAFT_FAIL.drop.to).toBeLessThan(CRAFT_FAIL.drop.from);
  });

  it('제작 실패는 소리가 아니라 정적으로 만든다', () => {
    expect(CRAFT_FAIL.silenceMs).toBe(800);
    expect(CRAFT_FAIL.drop.at, '정적이 시작되고 60ms 뒤에 울려야 합니다').toBe(60);
  });
});
