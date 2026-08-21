/**
 *  칭호를 얻었는가 — 계산.
 *
 *  ★ 조건은 전부 이미 있는 기록에서 잽니다. 새로 저장하는 것은
 *    얻은 칭호(titles)와 지금 단 것(wearing) 둘뿐입니다.
 *    셀 수 있는 값을 따로 저장하지 않습니다 (CLAUDE.md 4장 1번).
 *
 *  ★ 「길 아는 사람」은 discovered 를 읽습니다. 그 배열은 지금까지
 *    enterMap 이 채우기만 하고 아무도 안 읽었습니다 — 데이터가 있는데
 *    화면에 없었습니다 (6장). 여기서 처음 읽습니다.
 */

import { openRegions } from './world';
import { TITLE_ORDER, titleDef } from '../content/titles';
import { log, toast, vfx } from './feedback';
import type { Character, TitleId, World } from '../types';

/**
 *  칭호마다의 조건.
 *
 *  ★ switch 였습니다. `default: return false` 가 있어서, 표(content/titles.ts)에
 *    칭호를 더하고 여기를 잊으면 **조용히 영영 안 붙었습니다** — 화면에는 있는데
 *    아무리 해도 안 얻어지는 칭호가 됩니다 (CLAUDE.md 6장).
 *    표로 바꾸면 밖에서 맞춰볼 수 있습니다 — tests/rpg/titles.test.ts 가 지킵니다.
 */
export const TITLE_RULES: Record<TitleId, (me: Character) => boolean> = {
  //  ★ 조건이 걸린 문 너머는 빼고 셉니다. 안 그러면 이 칭호가
  //    "2층까지 내려간 사람" 이 되어 아래 것과 같은 말이 됩니다.
  'walked-all': (me) => [...openRegions()].every((mapId) => me.discovered.includes(mapId)),
  'went-below': (me) => me.discovered.includes('mine-deep'),
};

/** 이 칭호를 얻을 조건이 찼는가 */
function earned(me: Character, id: TitleId): boolean {
  const rule = TITLE_RULES[id];
  //  ★ 조용히 false 를 돌려주지 않습니다. 규칙이 없는 칭호는 표가 어긋난 것입니다.
  if (!rule) throw new Error(`조건이 없는 칭호입니다: ${id} (core/titles.ts 의 TITLE_RULES)`);
  return rule(me);
}

/** 지금 달고 있는 칭호. 없으면 null */
export function wornTitle(me: Character): TitleId | null {
  return me.wearing !== null && me.titles.includes(me.wearing) ? me.wearing : null;
}

/** 이름 옆에 붙는 말 — 화면에 그대로 씁니다 */
export function displayName(me: Character): string {
  const worn = wornTitle(me);
  return worn === null ? me.name : `${titleDef(worn).name} ${me.name}`;
}

/** 이 칭호를 답니다. 안 가진 칭호는 못 답니다 */
export function wearTitle(me: Character, id: TitleId | null): boolean {
  if (id !== null && !me.titles.includes(id)) return false;
  me.wearing = id;
  return true;
}

/**
 *  새로 얻은 칭호가 있으면 준다.
 *
 *  ★ 첫 칭호는 저절로 달립니다. 하나뿐인데 고르라고 하면 이상합니다 —
 *    고르는 것은 둘이 됐을 때부터입니다 (목적지-기획안 2.3).
 */
export function checkTitles(world: World): TitleId[] {
  const me = world.me;
  // 다 얻었으면 더 잴 것이 없습니다 — 매 틱 부르는 자리라 여기서 끊습니다
  if (me.titles.length >= TITLE_ORDER.length) return [];

  const fresh: TitleId[] = [];

  for (const id of TITLE_ORDER) {
    if (me.titles.includes(id) || !earned(me, id)) continue;
    me.titles.push(id);
    fresh.push(id);

    const def = titleDef(id);
    //  ★ 조사를 붙이지 않습니다. 칭호 이름의 끝 글자에 따라 '라/이라' 가 갈리는데,
    //    표는 앞으로도 늘어납니다 — 붙이는 순간 언젠가 틀립니다.
    log(world, `사람들이 이렇게 부르기 시작했습니다 — 「${def.name}」`, 'epic');
    toast(world, `「${def.name}」`, 'epic');
    vfx(world, 'levelup', me.pos, { life: 1.2, color: '#e0b23a', radius: 70 });

    if (me.wearing === null) me.wearing = id;
  }
  return fresh;
}
