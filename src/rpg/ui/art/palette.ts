/**
 * ===========================================================================
 *  아트 디렉션 — 색과 빛
 * ===========================================================================
 *
 *  그림 파일을 하나도 쓰지 않고 도형만으로 그리기 때문에, 그림을 "잘 그리는" 것보다
 *  ★ 모든 것이 같은 규칙 아래 있는 것이 훨씬 중요합니다.
 *
 *  이 게임의 규칙은 두 가지입니다.
 *
 *   1) 빛은 언제나 왼쪽 위에서 옵니다.
 *      캐릭터든 바위든 나무든, 왼쪽 위가 밝고 오른쪽 아래에 그림자가 깔립니다.
 *      이것 하나만 지켜도 서로 다른 도형들이 한 세계에 있는 것처럼 보입니다.
 *
 *   2) 지역마다 색의 '성격'이 있습니다.
 *      초원은 초록과 금빛, 협곡은 마른 흙의 붉은 기, 광산은 차가운 청록,
 *      요새는 진흙과 불빛, 용의 둥지는 재와 용암.
 *      같은 몬스터라도 그 지역의 공기색(ambient)이 옅게 덮여 한 화면으로 묶입니다.
 *
 *  색을 바꾸고 싶으면 이 파일만 고치면 됩니다. 그리는 코드는 색을 직접 알지 못합니다.
 */

import type { MapTheme } from '../../types';

/** 빛이 오는 방향 (왼쪽 위). 모든 입체감의 기준입니다 */
export const LIGHT = { x: -0.55, y: -0.84 };

/** 지역 하나의 색 묶음 */
export interface ZoneArt {
  /** 바닥 세 가지 색조 — 넓은 얼룩으로 섞입니다 */
  ground: [string, string, string];
  /** 바닥에 뿌리는 잔결 (자갈·풀뿌리) */
  detail: string;
  /** 벽의 앞면 · 윗면 · 그림자 */
  wall: string;
  wallTop: string;
  wallEdge: string;
  /** 나무·바위의 밝은 면 · 중간 · 어두운 면 */
  propLight: string;
  prop: string;
  propDark: string;
  /** 물·용암 */
  liquid: string;
  liquidLight: string;
  liquidGlow: string;
  /** 화면 전체에 옅게 까는 공기색과 그 진하기 */
  ambient: string;
  ambientAlpha: number;
  /** 가장자리를 어둡게 하는 색 */
  fog: string;
  /** 이 지역에 떠다니는 것 */
  motes: {
    kind: 'pollen' | 'firefly' | 'dust' | 'spore' | 'ember' | 'ash';
    color: string;
    count: number;
  };
  /** 빛을 내는 구조물 (횃불·수정·용암 분출구) */
  beacon?: {
    kind: 'torch' | 'crystal' | 'campfire' | 'vent';
    color: string;
    radius: number;
    /** 장애물 중 몇 개나 빛나는가 (0~1) */
    share: number;
  };
  /** 마을 흙길 */
  road: string;
  roadEdge: string;
}

export const ZONE_ART: Record<MapTheme, ZoneArt> = {
  /* --------------------------------------------------------------- 마을 */
  town: {
    ground: ['#3f5a39', '#476245', '#36502f'],
    detail: '#2b4027',
    wall: '#4a3a2b',
    wallTop: '#8d4f3a',
    wallEdge: '#241a12',
    propLight: '#4e7440',
    prop: '#2f5233',
    propDark: '#1d3722',
    liquid: '#22506b',
    liquidLight: '#4193bd',
    liquidGlow: '#7dd3fc',
    ambient: '#ffd9a0',
    ambientAlpha: 0.04,
    fog: 'rgba(12,18,12,0.34)',
    motes: { kind: 'pollen', color: '#ffe9a8', count: 26 },
    road: '#6d5539',
    roadEdge: '#54402a',
  },

  /* --------------------------------------------------------------- 초원 */
  field: {
    ground: ['#33512f', '#3c5c36', '#2a4528'],
    detail: '#23401e',
    wall: '#3a3025',
    wallTop: '#57432f',
    wallEdge: '#1d160f',
    propLight: '#456e39',
    prop: '#2b4a2c',
    propDark: '#19311e',
    liquid: '#1f4560',
    liquidLight: '#4aa2c8',
    liquidGlow: '#7dd3fc',
    ambient: '#d8ecb4',
    ambientAlpha: 0.035,
    fog: 'rgba(8,14,10,0.36)',
    motes: { kind: 'firefly', color: '#e8ff9a', count: 22 },
    road: '#5c4a30',
    roadEdge: '#443522',
  },

  /* --------------------------------------------------------------- 협곡 */
  canyon: {
    ground: ['#6a4a31', '#79573b', '#523724'],
    detail: '#3e2a1a',
    wall: '#4a3020',
    wallTop: '#7c5535',
    wallEdge: '#26160d',
    propLight: '#a98a66',
    prop: '#87694a',
    propDark: '#553f2c',
    liquid: '#4a3820',
    liquidLight: '#6f5533',
    liquidGlow: '#c9a227',
    ambient: '#ffb870',
    ambientAlpha: 0.05,
    fog: 'rgba(24,14,7,0.38)',
    motes: { kind: 'dust', color: '#e8c89a', count: 30 },
    road: '#7a5b3a',
    roadEdge: '#5c4229',
  },

  /* --------------------------------------------------------------- 광산 */
  cave: {
    ground: ['#2a2732', '#322e3d', '#201e27'],
    detail: '#191720',
    wall: '#17151d',
    wallTop: '#3b3547',
    wallEdge: '#0b0a0f',
    propLight: '#544c60',
    prop: '#3a3442',
    propDark: '#221d2a',
    liquid: '#14303f',
    liquidLight: '#2c8ba8',
    liquidGlow: '#5ee0ff',
    ambient: '#6ea8c8',
    ambientAlpha: 0.06,
    fog: 'rgba(3,5,9,0.55)',
    motes: { kind: 'spore', color: '#9fe8ff', count: 24 },
    beacon: { kind: 'crystal', color: '#5ee0ff', radius: 118, share: 0.16 },
    road: '#3a3442',
    roadEdge: '#221d2a',
  },

  /* --------------------------------------------------------------- 요새 */
  fortress: {
    ground: ['#49412f', '#554a39', '#393124'],
    detail: '#292318',
    wall: '#4a3722',
    wallTop: '#6d5131',
    wallEdge: '#211709',
    propLight: '#8a6a45',
    prop: '#6a4e30',
    propDark: '#3d2c1a',
    liquid: '#2f3a1f',
    liquidLight: '#556b30',
    liquidGlow: '#a3e635',
    ambient: '#ffcf8a',
    ambientAlpha: 0.045,
    fog: 'rgba(16,11,6,0.44)',
    motes: { kind: 'ember', color: '#ffb04a', count: 20 },
    beacon: { kind: 'campfire', color: '#ff9a3c', radius: 132, share: 0.1 },
    road: '#6b5436',
    roadEdge: '#4c3b25',
  },

  /* --------------------------------------------------------------- 둥지 */
  volcano: {
    ground: ['#2e211f', '#382725', '#231a18'],
    detail: '#1a1211',
    wall: '#1e1412',
    wallTop: '#4d2c24',
    wallEdge: '#0d0908',
    propLight: '#5c3b31',
    prop: '#3a2622',
    propDark: '#1e1310',
    liquid: '#b8331a',
    liquidLight: '#ff8c2a',
    liquidGlow: '#ff5a1a',
    ambient: '#ff7a3c',
    ambientAlpha: 0.07,
    fog: 'rgba(18,5,3,0.46)',
    motes: { kind: 'ash', color: '#d8c2b8', count: 34 },
    beacon: { kind: 'vent', color: '#ff6a2a', radius: 126, share: 0.12 },
    road: '#3a2622',
    roadEdge: '#1e1310',
  },
};

/* ===========================================================================
 *  색 다루기 — 도형마다 밝은 면과 어두운 면을 만들기 위한 최소한의 도구
 * ======================================================================== */

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * '#rrggbb' 또는 'rgb(r,g,b)' → [r, g, b]
 *
 * ※ 두 형태를 모두 받는 것이 중요합니다. mix() 가 'rgb(...)' 를 돌려주는데
 *   lighten() 이 '#' 만 받던 시절, 섞은 색을 다시 밝히면 값이 깨져서
 *   강철 검이 노랗게 나오는 일이 있었습니다.
 */
export function rgbOf(color: string): [number, number, number] {
  if (color.startsWith('rgb')) {
    const parts = color.replace(/[^0-9,.]/g, '').split(',');
    return [Number(parts[0]) || 0, Number(parts[1]) || 0, Number(parts[2]) || 0];
  }
  const value = color.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** 색을 밝게 (amount 0~1) */
export function lighten(hex: string, amount: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgb(${clamp255(r + (255 - r) * amount)},${clamp255(g + (255 - g) * amount)},${clamp255(b + (255 - b) * amount)})`;
}

/** 색을 어둡게 (amount 0~1) */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgb(${clamp255(r * (1 - amount))},${clamp255(g * (1 - amount))},${clamp255(b * (1 - amount))})`;
}

/** 색에 투명도를 붙입니다 */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** 두 색을 섞습니다 (t = 0 이면 앞, 1 이면 뒤) */
export function mix(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = rgbOf(hexA);
  const [r2, g2, b2] = rgbOf(hexB);
  return `rgb(${clamp255(r1 + (r2 - r1) * t)},${clamp255(g1 + (g2 - g1) * t)},${clamp255(b1 + (b2 - b1) * t)})`;
}

/* ===========================================================================
 *  장비 등급 색 — 캐릭터에 그대로 칠해집니다
 * ======================================================================== */

export const GEAR_TINT: Record<string, string> = {
  common: '#8c8f96',
  rare: '#4f86d6',
  epic: '#a06fd6',
  legend: '#d8a12a',
};

/** 전설 장비만 은은하게 빛납니다 */
export const GEAR_GLOW: Record<string, number> = {
  common: 0,
  rare: 0.15,
  epic: 0.3,
  legend: 0.6,
};

/* ===========================================================================
 *  장비의 재질
 *  ---------------------------------------------------------------------------
 *  등급 색(파랑·보라·금빛)으로 갑옷 전체를 칠하면 장난감처럼 보입니다.
 *  그래서 몸통은 천·가죽·사슬·판금 같은 실제 재질 색으로 칠하고,
 *  등급 색은 어깨·허리·투구 장식에만 얹습니다.
 * ======================================================================== */

export const MATERIAL: Record<string, string> = {
  'armor-cloth': '#b9a98c',
  'armor-leather': '#7a5433',
  'armor-scale': '#6d7480',
  'armor-plate': '#9aa6b4',
  'armor-shadow': '#4a4358',
  'armor-dragon': '#8c3b2c',
  'helm-cap': '#7a5433',
  'helm-iron': '#7c848f',
  'helm-knight': '#9aa6b4',
  'helm-mithril': '#b9c6d4',
};

/** 무기 날의 재질 */
export const BLADE: Record<string, string> = {
  sword: '#c3cbd6',
  bow: '#8a6a45',
  staff: '#6b5334',
};
