/**
 * ===========================================================================
 *  표시 형식 — 숫자를 플레이어가 읽는 글자로 바꿉니다
 * ===========================================================================
 *
 *  이 게임의 숫자는 자릿수가 아주 큽니다(수천만~수십억 달러, GPU 수만 장).
 *  숫자를 그대로 화면에 적으면 사람 눈으로는 45,000,000 과 450,000,000 을
 *  구분하지 못합니다. 그래서 항상 짧게 줄여서 보여줍니다.
 *
 *  ─ 규칙 요약
 *      돈    : $820K · $45.0M · $1.20B   (의미 있는 숫자 세 자리까지)
 *      개수  : 12,400 · 1.2M             (100만 미만은 쉼표만 찍습니다)
 *      비율  : 14.2%
 *      시간  : 12:34 · 1:02:11
 *      증감  : +$12.4K/초 · -$8.0K/초    (부호를 반드시 붙입니다)
 *
 *  ※ 브라우저마다 결과가 달라지는 기능(toLocaleString 등)은 일부러 쓰지 않았습니다.
 *    어디서 돌려도 똑같은 글자가 나와야 자동 테스트를 할 수 있기 때문입니다.
 *  ※ 여기 있는 숫자는 '보여주는 방식'일 뿐 게임 규칙이 아니라서
 *    balance.ts 가 아니라 이 파일에 있습니다. (고쳐도 게임 난이도는 그대로입니다)
 */

import type { Money, Ratio, Seconds } from '../types';

/** 큰 수를 줄여 쓸 때 쓰는 단위표 (큰 것부터 차례로 봅니다) */
const UNITS: { limit: number; suffix: string }[] = [
  { limit: 1_000_000_000_000, suffix: 'T' },
  { limit: 1_000_000_000, suffix: 'B' },
  { limit: 1_000_000, suffix: 'M' },
  { limit: 1_000, suffix: 'K' },
];

/** 돈은 '의미 있는 숫자' 세 자리까지만 보여줍니다. ($45.0M, $1.20B) */
const MONEY_DIGITS = 3;

/** 개수는 이 값 미만이면 줄이지 않고 쉼표만 찍습니다 (12,400 은 그대로 읽히니까) */
const COMPACT_LIMIT = 1_000_000;

/** 정수 부분에 세 자리마다 쉼표를 넣습니다. 소수점 아래는 건드리지 않습니다 */
function withCommas(text: string): string {
  const dot = text.indexOf('.');
  const whole = dot < 0 ? text : text.slice(0, dot);
  const rest = dot < 0 ? '' : text.slice(dot);
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + rest;
}

/**
 * 앞에서부터 원하는 자릿수만 남기고 반올림합니다.
 * 예) 999,999 를 세 자리로 → 1,000,000 (덕분에 '$1000K' 같은 이상한 표기가 안 나옵니다)
 */
function roundToDigits(value: number, digits: number): number {
  if (value === 0) return 0;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const factor = Math.pow(10, digits - 1 - magnitude);
  return Math.round(value * factor) / factor;
}

/**
 * 돈을 짧게 씁니다. 예) '$820K', '$45.0M', '$1.20B', '$0'
 *
 * 항상 의미 있는 숫자 세 자리로 맞춥니다. 그래서 자릿수가 달라져도
 * 글자 길이가 비슷하게 유지되어 버튼 안에서 줄이 밀리지 않습니다.
 */
export function formatMoney(value: Money): string {
  if (!Number.isFinite(value)) return '$0';

  const rounded = roundToDigits(value, MONEY_DIGITS);
  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';

  // 1,000 달러 미만은 줄일 것이 없으니 그대로 적습니다
  if (abs < 1_000) {
    const whole = Math.round(abs);
    if (whole === 0) return '$0';
    return `${sign}$${withCommas(String(whole))}`;
  }

  for (const unit of UNITS) {
    if (abs < unit.limit) continue;
    const scaled = abs / unit.limit;
    // 세 자리를 채우도록 소수점 자릿수를 정합니다 (820 / 45.0 / 1.20)
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${sign}$${withCommas(scaled.toFixed(decimals))}${unit.suffix}`;
  }

  return '$0';
}

/**
 * 단위가 없는 큰 수(GPU 장수 등)를 짧게 씁니다. 예) '12,400', '1.2M'
 *
 * 100만 미만은 쉼표만 찍습니다. GPU 12,400장은 그대로 읽는 편이
 * '0.01M' 보다 훨씬 잘 와닿기 때문입니다.
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';

  const abs = Math.abs(value);
  if (abs < COMPACT_LIMIT) return withCommas(String(Math.round(value)));

  const rounded = roundToDigits(value, MONEY_DIGITS);
  const scaledAbs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';

  for (const unit of UNITS) {
    // K(천) 단위는 쓰지 않습니다 — 위에서 쉼표로 처리했습니다
    if (unit.limit < COMPACT_LIMIT) break;
    if (scaledAbs < unit.limit) continue;
    const scaled = scaledAbs / unit.limit;
    const decimals = scaled >= 100 ? 0 : 1;
    return `${sign}${withCommas(scaled.toFixed(decimals))}${unit.suffix}`;
  }

  return withCommas(String(Math.round(value)));
}

/**
 * 비율(0~1)을 퍼센트로 씁니다. 예) 0.142 → '14.2%'
 * digits 를 적지 않으면 소수점 한 자리까지 보여줍니다.
 */
export function formatPercent(value: Ratio, digits: number = 1): string {
  if (!Number.isFinite(value)) return '0%';
  const places = Math.max(0, Math.min(4, Math.floor(digits)));
  return `${withCommas((value * 100).toFixed(places))}%`;
}

/**
 * 초를 시계 모양으로 씁니다. 예) 754 → '12:34', 3731 → '1:02:11'
 * 남은 시간을 알 수 없을 때(무한대 등)는 '--:--' 를 돌려줍니다.
 */
export function formatDuration(seconds: Seconds): string {
  if (!Number.isFinite(seconds)) return '--:--';

  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(rest)}`;
  return `${minutes}:${pad(rest)}`;
}

/**
 * 매초 들어오거나 나가는 돈을 부호와 함께 씁니다.
 * 예) '+$12.4K/초', '-$8.0K/초', '$0/초'
 *
 * 부호를 반드시 붙이는 이유: 이 게임에서 제일 중요한 정보가
 * '통장이 지금 차고 있나, 마르고 있나' 이기 때문입니다.
 */
export function formatRate(perSecond: Money): string {
  if (!Number.isFinite(perSecond)) return '$0/초';

  const rounded = roundToDigits(perSecond, MONEY_DIGITS);
  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '+';

  if (abs < 1_000) {
    const whole = Math.round(abs);
    if (whole === 0) return '$0/초';
    return `${sign}$${withCommas(String(whole))}/초`;
  }

  for (const unit of UNITS) {
    if (abs < unit.limit) continue;
    const scaled = abs / unit.limit;
    // 매초 바뀌는 값이라 소수점을 한 자리까지만 보여줍니다 (눈이 덜 어지럽습니다)
    const decimals = scaled >= 100 ? 0 : 1;
    return `${sign}$${withCommas(scaled.toFixed(decimals))}${unit.suffix}/초`;
  }

  return '$0/초';
}

/**
 * 전력을 MW 로 씁니다. 예) 5 → '5MW', 0.12 → '0.12MW'
 * (소수점 둘째 자리까지만 남기고 끝의 0은 지웁니다)
 *
 * ※ 화면 전체에서 쓰라고 만든 것이 아니라 버튼 설명문을 만들 때 쓰는 보조 도구라
 *   input 폴더의 정문(index.ts)에서는 내보내지 않습니다.
 */
export function formatMegawatts(megawatts: number): string {
  if (!Number.isFinite(megawatts)) return '0MW';

  let rounded = Math.round(megawatts * 100) / 100;

  // GPU 한 장이 먹는 전력처럼 아주 작은 값은 소수점 둘째 자리에서 0이 되어버립니다.
  // 그럴 때는 '0MW'(=안 든다)로 잘못 읽히지 않게 자릿수를 더 살려서 보여줍니다.
  if (rounded === 0 && megawatts !== 0) rounded = roundToDigits(megawatts, 2);

  return `${withCommas(String(rounded))}MW`;
}

// 한국어 조사 처리(withParticle)는 state 폴더도 함께 쓰기 때문에
// 두 곳이 모두 의존하는 constraints/format 에 두고 여기서는 다시 내보내기만 합니다.
export { withParticle } from '../constraints/format';
