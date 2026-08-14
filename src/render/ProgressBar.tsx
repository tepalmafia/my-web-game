/**
 * ===========================================================================
 *  진행도 막대 — 화면에서 가장 많이 쓰이는 부품
 * ===========================================================================
 *
 *  AGI 진행도, 경쟁사 추정 진행도, 전력 사용률처럼 "0%에서 100%까지 차오르는 것"은
 *  전부 이 부품 하나로 그립니다. 한 곳에 모아둔 이유는 두 가지입니다.
 *
 *    1) 눈이 못 보는 사람도 쓸 수 있게 하는 표시(role="progressbar" 등)를
 *       빠뜨리는 일이 없도록 하기 위해서입니다.
 *    2) 막대 모양을 바꾸고 싶을 때 이 파일 하나만 고치면 되기 때문입니다.
 *
 *  ※ 막대의 길이는 게임 상황에 따라 매 순간 달라지므로 Tailwind 클래스로 표현할 수
 *    없습니다. 그래서 이 파일에서만 예외적으로 style 로 너비를 직접 지정합니다.
 */

import type { Ratio } from '../types';

interface ProgressBarProps {
  /** 채워질 비율 (0 = 0%, 1 = 100%) */
  value: Ratio;
  /** 화면을 읽어주는 프로그램에게 이 막대가 무엇인지 알려주는 이름 */
  label: string;
  /** 채워진 부분의 색 (Tailwind 클래스. 예: 'bg-cyan-400') */
  colorClass: string;
  /** 막대 두께. 'sm' 은 경쟁사 목록처럼 여러 줄이 늘어설 때 씁니다 */
  size?: 'sm' | 'md' | 'lg';
}

/** 두께별 높이 (Tailwind 는 문자열을 조립해서 만들면 인식하지 못하므로 표로 둡니다) */
const HEIGHT: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

/**
 * 0~1 사이 비율을 가로 막대로 그립니다.
 *
 * 화면에 보이는 길이뿐 아니라 aria-valuenow(지금 값)까지 함께 넣기 때문에,
 * 화면을 읽어주는 프로그램을 쓰는 사람도 "지금 몇 퍼센트인지"를 알 수 있습니다.
 */
export function ProgressBar({ value, label, colorClass, size = 'md' }: ProgressBarProps) {
  // 계산 오차나 사건 효과로 0~1 을 살짝 벗어나도 막대가 삐져나오지 않게 잘라둡니다
  const percent = Math.max(0, Math.min(100, value * 100));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-full bg-slate-800 ${HEIGHT[size]}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-200 ease-out ${colorClass}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
