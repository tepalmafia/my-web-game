/**
 * ===========================================================================
 *  한국어 조사 — 앞말에 맞춰 '이/가', '은/는', '을/를' 고르기
 * ===========================================================================
 *
 *  사전(ko.ts)이 문장을 조립할 때 씁니다.
 *  다른 것에 전혀 의존하지 않는 순수 함수라, 어디서 가져다 써도 순환 참조가 생기지 않습니다.
 */

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
