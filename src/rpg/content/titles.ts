/**
 *  칭호 — 표입니다.
 *
 *  ★ 세계가 나를 알아보는 방법 하나입니다 (목적지-기획안 2.2).
 *    도달은 네 종류입니다 — 장소 · 물건 · 실력 · 행위 (2.1).
 *
 *  ★ 얻는 조건은 여기 적지 않습니다. 조건을 재는 것은 계산이라 core/titles.ts 에 있습니다.
 *    여기에는 "무엇이 있는가" 만 있습니다.
 *
 *  ★ 문체 (이야기-기획안 4절) — 짧고 무뚝뚝하게, 판타지 용어 없이.
 *    사람이 실제로 그렇게 부를 법한 말이어야 합니다.
 *
 *  ★ 첫 칭호는 싸고 빠릅니다 (전체설계 4.3). 대단해 보이면 뒤의 것이 시시해집니다.
 */

import type { TitleId } from '../types';

export interface TitleDef {
  id: TitleId;
  /** 이름 옆에 붙는 말 */
  name: string;
  /** 무엇을 해서 얻었는가 — 얻은 뒤에만 보입니다 */
  earned: string;
  kind: '장소' | '물건' | '실력' | '행위';
}

const LIST: TitleDef[] = [
  {
    id: 'walked-all',
    name: '길 아는 사람',
    earned: '마을과 숲과 강과 광산을 다 밟았습니다.',
    kind: '장소',
  },
];

export const TITLES: Record<string, TitleDef> = Object.fromEntries(LIST.map((t) => [t.id, t]));
export const TITLE_ORDER: TitleId[] = LIST.map((t) => t.id);

export function titleDef(id: TitleId): TitleDef {
  const def = TITLES[id];
  if (!def) throw new Error(`알 수 없는 칭호: ${id}`);
  return def;
}
