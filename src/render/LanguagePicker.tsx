/**
 * ===========================================================================
 *  언어 고르개 — 영어 / 한국어
 * ===========================================================================
 *
 *  언어는 React 상태가 아니라 i18n 모듈이 들고 있습니다.
 *  reducer 같은 React 밖의 코드도 같은 값을 읽어야 하기 때문입니다.
 *
 *  그래서 화면은 useSyncExternalStore 로 그 모듈을 '구독'합니다.
 *  언어가 바뀌면 구독한 화면이 전부 다시 그려집니다 —
 *  중간 부품마다 언어를 손으로 넘겨줄 필요가 없습니다.
 */

import { useSyncExternalStore } from 'react';
import { getLocale, LOCALE_OPTIONS, setLocale, subscribeLocale } from '../i18n';
import type { Locale } from '../i18n';

/**
 * 지금 언어를 알려주고, 언어가 바뀌면 이 부품을 다시 그립니다.
 * 최상위(App)에서 한 번만 부르면 그 아래 화면이 전부 함께 새 언어로 그려집니다.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

interface LanguagePickerProps {
  /** 시작 화면처럼 넓게 쓸 수 있는 자리인지 (작으면 아이콘처럼 옆에 붙습니다) */
  className?: string;
}

/**
 * 두 언어를 나란히 놓고 지금 언어를 밝게 표시합니다.
 * 목록이 둘뿐이라 접었다 펴는 메뉴 대신 그냥 다 보여줍니다 — 한 번에 누를 수 있습니다.
 */
export function LanguagePicker({ className = '' }: LanguagePickerProps) {
  const locale = useLocale();

  return (
    <div className={`inline-flex overflow-hidden rounded-md border border-slate-800 ${className}`}>
      {LOCALE_OPTIONS.map((option) => {
        const active = option.locale === locale;
        return (
          <button
            key={option.locale}
            type="button"
            lang={option.locale}
            aria-pressed={active}
            onClick={() => setLocale(option.locale)}
            className={`px-2.5 py-1 text-xs transition-colors ${
              active
                ? 'bg-slate-800 text-slate-100'
                : 'bg-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
