/**
 *  어떤 일에 어떤 소리를 낼 것인가.
 *
 *  ★ 이 층에서 가장 깨지기 쉬운 곳입니다.
 *    core/ 를 한 줄도 고치지 않고 소리를 가르려니, floater 의 **문구**로 가려야 합니다.
 *    ('miss' 하나에 빗나감 · 회피 · 채굴 실패 · 제작 실패 네 가지가 들어 있습니다)
 *
 *    그래서 여기서 두 가지를 지킵니다.
 *      1. 판별표가 통째로 맞는가
 *      2. core/ 가 **정말 그 문구를 쓰고 있는가** — 문구를 바꾸면 여기가 깨집니다.
 *         깨지면 audio/index.ts 의 CUES 도 같이 고치세요. 안 그러면 소리가 조용히 죽습니다.
 */

import { describe, expect, it } from 'vitest';

import { CUES, decide, type Cue } from '../../src/rpg/audio';
import { BLOCK, CRAFT_FAIL, MINE, MISS, ORE, TAKEN } from '../../src/rpg/audio/sfx';
import type { FeedbackEvent } from '../../src/rpg/core/feedback';
import type { Floater } from '../../src/rpg/types';

const COMBAT = import.meta.glob('../../src/rpg/core/combat.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
const ACTION = import.meta.glob('../../src/rpg/core/action.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

const source = (files: Record<string, string>) => Object.values(files)[0] ?? '';
const OLD = 999; // 제작 실패가 한참 전이었다는 뜻

const floater = (kind: Floater['kind'], text: string): FeedbackEvent => ({
  at: 'floater',
  kind,
  text,
  pos: { x: 0, y: 0 },
});

describe('판별표', () => {
  const table: Array<[string, FeedbackEvent, Cue | null]> = [
    ['검이 맞음', floater('damage', '12'), 'sword'],
    ['크리티컬', floater('crit', '31'), 'sword-crit'],
    ['내가 맞음', floater('taken', '9'), 'taken'],
    ['내 검이 헛나감', floater('miss', CUES.miss), 'miss'],
    ['몬스터 공격을 피함', floater('miss', CUES.dodge), 'block'],
    ['곡괭이질 허탕', floater('miss', CUES.failed), 'mine'],
    ['광석이 나옴', floater('info', '+2 철광석'), 'mine-ore'],
    ['구리광석이 나옴', floater('info', '+1 구리광석'), 'mine-ore'],
    ['골드는 소리 없음', floater('info', '+12 골드'), null],
    ['짐이 가득 참은 소리 없음', floater('info', '짐이 가득 참'), null],
    ['회복은 소리 없음', floater('heal', '+60'), null],
    ['실력이 늚은 소리 없음', floater('gain', '채광 31.2'), null],
    ['제작 실패', { at: 'log', tone: 'bad', text: '철검 만들기에 실패했습니다' }, 'craft-fail'],
    ['보통 기록은 소리 없음', { at: 'log', tone: 'normal', text: '초록 숲 진입' }, null],
    ['우수품', { at: 'toast', tone: 'epic', text: '우수한 물건\n철검' }, 'fine'],
    ['스킬 100 은 소리 없음', { at: 'toast', tone: 'epic', text: '채광 100' }, null],
    ['흔들림은 소리 없음', { at: 'shake', seconds: 0.2 }, null],
  ];

  for (const [name, event, expected] of table) {
    it(`${name} → ${expected ?? '없음'}`, () => {
      expect(decide(event, OLD)).toBe(expected);
    });
  }

  it('제작 실패 직후의 "실패" 는 곡괭이 소리로 새어나가지 않는다', () => {
    // 실패는 log 다음에 같은 순간 floater('실패') 가 따라옵니다
    expect(decide(floater('miss', CUES.failed), 0.01)).toBeNull();
    // 시간이 지난 뒤의 '실패' 는 곡괭이질입니다
    expect(decide(floater('miss', CUES.failed), 1)).toBe('mine');
  });
});

describe('core 가 쓰는 문구', () => {
  it('전투 문구가 그대로 있다', () => {
    expect(source(COMBAT), `'${CUES.miss}' 가 없어졌습니다`).toContain(`'${CUES.miss}'`);
    expect(source(COMBAT), `'${CUES.dodge}' 가 없어졌습니다`).toContain(`'${CUES.dodge}'`);
  });

  it('캐기·만들기 문구가 그대로 있다', () => {
    const text = source(ACTION);
    expect(text, `'${CUES.failed}' 가 없어졌습니다`).toContain(`'${CUES.failed}'`);
    expect(text, `'${CUES.craftFailed}' 가 없어졌습니다`).toContain(CUES.craftFailed);
    expect(text, `'${CUES.fine}' 가 없어졌습니다`).toContain(CUES.fine);
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
    const centers = MINE.variants.map((v) => v.tick.bp);
    expect(new Set(centers).size, '변형이 서로 같습니다').toBe(4);
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
