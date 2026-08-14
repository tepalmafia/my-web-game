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
 * 돈을 한국식 단위(만·억·조)로 짧게 씁니다.
 * 예) 32_000_000 → '3,200만 달러' / 120_000_000 → '1.2억 달러'
 *
 * 왜 필요한가: 이 게임의 금액은 수천만~수십억 달러라
 * 숫자를 그대로 다 적으면 화면에서 읽히지 않습니다.
 */
export function formatMoney(value: Money): string {
  const magnitude = Math.abs(value);

  if (magnitude >= 1_000_000_000_000) return `${groupDigits(value / 1_000_000_000_000)}조 달러`;
  if (magnitude >= 100_000_000) return `${groupDigits(value / 100_000_000)}억 달러`;
  if (magnitude >= 10_000) return `${groupDigits(Math.round(value / 10_000))}만 달러`;

  return `${groupDigits(Math.round(value))} 달러`;
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

/**
 * 한국어 조사를 앞말에 맞춰 골라 줍니다.
 *
 * 한국어는 앞 글자에 받침이 있느냐에 따라 조사가 달라집니다.
 *      받침 있음: 벡스 랩스'이' / 오린'은' / 헬리온'을'
 *      받침 없음: 아우로라'가' / 오린 인스티튜트'는' / 벡스'를'
 *
 * 이걸 처리하지 않으면 '벡스 랩스이(가)' 같은 어색한 글이 화면에 나갑니다.
 * 연구소 이름은 플레이어가 직접 짓기 때문에 미리 정해둘 수도 없습니다.
 *
 * 한글이 아닌 글자(영어·숫자)로 끝나면 판단할 수 없으므로 받침 없는 쪽을 씁니다.
 */
export function withParticle(word: string, afterConsonant: string, afterVowel: string): string {
  const last = word.trim().slice(-1);
  if (last === '') return word + afterVowel;

  const code = last.charCodeAt(0);
  // 한글 음절 영역(가~힣)이 아니면 받침 여부를 알 수 없습니다
  if (code < 0xac00 || code > 0xd7a3) return word + afterVowel;

  // 한글 음절은 (초성, 중성, 종성) 순서로 배열되어 있어서, 28로 나눈 나머지가
  // 0이면 종성(받침)이 없다는 뜻입니다.
  const hasFinalConsonant = (code - 0xac00) % 28 !== 0;
  return word + (hasFinalConsonant ? afterConsonant : afterVowel);
}
