/**
 * ===========================================================================
 *  숫자를 사람이 읽는 글자로 바꾸는 도구 (이 폴더 안에서만 씁니다)
 * ===========================================================================
 *
 *  한계 위반 문구('자금이 3,200만 달러 부족합니다')를 만들 때만 쓰는 보조 도구입니다.
 *  게임 규칙과는 아무 상관이 없고, 계산 결과를 바꾸지도 않습니다.
 *
 *  ※ 브라우저마다 결과가 달라지는 기능(toLocaleString 등)을 일부러 쓰지 않았습니다.
 *    어디서 돌려도 똑같은 글자가 나와야 자동 테스트가 가능하기 때문입니다.
 */

import { s } from '../i18n';
import type { Megawatts, Money } from '../types';

/**
 * 숫자에 천 단위 쉼표를 붙입니다. 소수점은 최대 두 자리까지만 남깁니다.
 * 예) 3200 → '3,200' / 1.2 → '1.2' / 1.999 → '2'
 *
 * 왜 필요한가: 게임에 나오는 숫자는 자릿수가 크기 때문에
 * 쉼표가 없으면 1000만인지 100만인지 눈으로 구분되지 않습니다.
 */
export function groupDigits(value: number): string {
  if (!Number.isFinite(value)) return '0';

  const sign = value < 0 ? '-' : '';
  // 소수점 두 자리에서 먼저 반올림해두면 아래 계산이 어긋나지 않습니다
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const whole = Math.floor(rounded);
  const fraction = Math.round((rounded - whole) * 100); // 0 ~ 99

  // 정수 부분에 세 자리마다 쉼표를 넣습니다
  let text = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (fraction > 0) {
    // '.30' 처럼 끝에 붙는 0은 지워서 '.3' 으로 보이게 합니다
    text += ('.' + String(fraction).padStart(2, '0')).replace(/0+$/, '');
  }

  return sign + text;
}

/**
 * 돈을 짧게 씁니다.
 *
 * 단위 체계가 언어마다 달라서(한국어는 만·억·조, 영어는 K·M·B) 실제 규칙은
 * 사전에 두고 여기서는 지금 언어의 규칙을 불러다 씁니다.
 *
 * 왜 필요한가: 이 게임의 금액은 수천만~수십억 달러라
 * 숫자를 그대로 다 적으면 화면에서 읽히지 않습니다.
 */
export function formatMoney(value: Money): string {
  return s().units.money(value);
}

/**
 * 개수(GPU 장수, 연구원 명수 등)를 쉼표를 넣어 씁니다.
 * 예) 11800 → '11,800'
 */
export function formatCount(value: number): string {
  return groupDigits(Math.round(value));
}

/**
 * 전력을 MW 단위로 씁니다. 소수점 둘째 자리까지만 보여줍니다.
 * 예) 14.4 → '14.4MW'
 */
export function formatPower(value: Megawatts): string {
  return `${groupDigits(value)}MW`;
}

// 한국어 조사 처리는 사전(i18n)도 함께 쓰기 때문에 그쪽에 두고 여기서는 다시 내보냅니다.
export { withParticle } from '../i18n/particle';
