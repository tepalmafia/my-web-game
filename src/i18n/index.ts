/**
 * ===========================================================================
 *  언어 — 화면에 나가는 모든 글의 출처
 * ===========================================================================
 *
 *  게임에 나오는 문장은 전부 이 폴더에 모여 있습니다.
 *  화면 파일이나 게임 로직 안에 글을 직접 적지 않는 이유는 하나입니다 —
 *  한 군데라도 빠뜨리면 영어로 하는 사람에게 한국어가 튀어나오기 때문입니다.
 *
 *  ─ 구조
 *      en.ts  기준이 되는 사전 (영어). 이 파일의 모양이 곧 '있어야 할 항목 목록'입니다.
 *      ko.ts  같은 모양의 한국어 사전. 항목이 하나라도 빠지면 타입 검사에서 걸립니다.
 *
 *    → 새 문구를 추가할 때 영어만 적고 한국어를 깜빡하면 빌드가 실패합니다.
 *      번역이 조용히 누락되는 일이 구조적으로 불가능합니다.
 *
 *  ─ 값이 함수인 항목
 *    숫자나 이름이 끼어드는 문장은 문자열 대신 함수로 둡니다.
 *        gpuShort: (n) => `Need ${n} more GPU slots`
 *    자리표시자를 문자열에 넣고 나중에 바꿔치우는 방식보다 안전합니다
 *    (인자 개수와 타입까지 타입 검사가 확인해 줍니다).
 *
 *  ─ 언어를 두 곳에서 들고 있는 이유
 *    화면은 React 상태로 언어를 알아야 다시 그려지고,
 *    게임 로직(reducer)은 React 밖이라 모듈 변수로 알아야 합니다.
 *    그래서 setLocale 이 둘 다 갱신하도록 App 이 묶어 줍니다.
 */

import { en } from './en';
import { ko } from './ko';

/** 지원하는 언어 */
export type Locale = 'en' | 'ko';

/** 사전 한 벌의 모양. 영어 사전이 기준입니다 */
export type Dict = typeof en;

const DICTS: Record<Locale, Dict> = { en, ko };

/** 브라우저에 선택을 기억해두는 열쇠 */
const STORAGE_KEY = 'agi-race-locale';

/** 기본 언어. 링크를 받는 사람이 대부분 한국어권 밖이라 영어를 기본으로 둡니다 */
const DEFAULT_LOCALE: Locale = 'en';

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'ko';
}

/**
 * 처음 켰을 때 어느 언어로 시작할지 정합니다.
 *   1) 전에 고른 적이 있으면 그 선택
 *   2) 없으면 브라우저 언어가 한국어일 때만 한국어
 *   3) 그 외에는 영어
 */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // 저장소를 막아둔 브라우저에서는 그냥 자동 판별으로 넘어갑니다
  }

  const browser = typeof navigator === 'undefined' ? '' : (navigator.language ?? '');
  return browser.toLowerCase().startsWith('ko') ? 'ko' : DEFAULT_LOCALE;
}

/** 지금 언어 (모듈 변수 — React 밖의 게임 로직도 읽어야 하므로) */
let current: Locale = DEFAULT_LOCALE;

/** 언어가 바뀌면 알려줄 곳들 (화면이 스스로 등록합니다) */
const listeners = new Set<() => void>();

/** 지금 언어를 알려줍니다 */
export function getLocale(): Locale {
  return current;
}

/**
 * 언어가 바뀔 때 연락받도록 등록합니다.
 * 돌려주는 함수를 부르면 등록이 해제됩니다. (React 의 useSyncExternalStore 규격)
 */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 언어를 바꾸고 선택을 기억합니다.
 * 등록된 화면들에게 알려서 그 자리에서 다시 그려지게 합니다.
 */
export function setLocale(locale: Locale): void {
  if (locale === current) return;

  current = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // 저장을 못 해도 이번 판은 정상 동작합니다
  }
  if (typeof document !== 'undefined') {
    // 스크린리더와 브라우저 번역 기능이 참고하는 표시입니다
    document.documentElement.lang = locale;
    document.title = s().meta.documentTitle;
  }

  for (const listener of listeners) listener();
}

/**
 * 처음 켤 때 한 번, 저장된 선택(또는 브라우저 언어)을 적용합니다.
 * setLocale 과 달리 '같은 언어면 아무것도 안 함'을 건너뛰고 표시까지 맞춰 둡니다.
 */
export function initLocale(): void {
  current = detectLocale();
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current;
    document.title = s().meta.documentTitle;
  }
}

/**
 * 지금 언어의 사전.
 *
 * 화면에서는 그릴 때마다 이 함수를 부릅니다.
 * (사전을 변수에 담아두면 언어를 바꿔도 옛 글이 남습니다)
 */
export function s(): Dict {
  return DICTS[current];
}

/**
 * 경쟁 연구소 이름을 지금 언어로 돌려줍니다.
 *
 * 이름은 판이 시작될 때 상태에 한 번 적히지만, 도중에 언어를 바꿀 수 있으므로
 * 화면에 그릴 때는 항상 이 함수를 거칩니다. (사전에 없는 id 면 적혀 있던 이름 그대로)
 */
export function rivalName(rival: { id: string; name: string }): string {
  return s().names.rivals[rival.id] ?? rival.name;
}

/** 언어 고르개에 쓸 목록 */
export const LOCALE_OPTIONS: { locale: Locale; label: string }[] = [
  { locale: 'en', label: 'English' },
  { locale: 'ko', label: '한국어' },
];
