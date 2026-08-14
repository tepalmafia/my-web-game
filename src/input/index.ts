/**
 * ===========================================================================
 *  input — 버튼과 게임 사이의 문지기 (이 폴더의 정문)
 * ===========================================================================
 *
 *  이 게임의 조작은 버튼 누르기가 전부입니다. 키보드도, 마우스 좌표도 없습니다.
 *  그래서 이 폴더가 맡는 '입력 처리'는 이런 뜻입니다.
 *
 *      · 이 버튼을 지금 누를 수 있는가
 *      · 누르면 돈이 얼마나 나가는가
 *      · 누르면 무슨 일이 벌어지는가
 *      · 못 누른다면 그 이유가 무엇인가 (프로그램 용어가 아닌 한국어로)
 *
 *  화면(React)은 규칙을 하나도 몰라도 됩니다. 버튼마다 availability() 를 한 번
 *  불러서 나온 네 가지 값(enabled·reason·cost·detail)만 그대로 그리면 됩니다.
 *
 *  값과 한계 계산은 전부 constraints 폴더 것을 그대로 씁니다.
 *  여기서 가격을 다시 계산하는 일은 없습니다 — 그래야 버튼에 적힌 금액과
 *  실제로 빠져나가는 금액이 영원히 같습니다.
 *
 *  다른 폴더에서는 이 파일 하나만 보면 됩니다.
 *      import { availability, guard, formatMoney } from '../input';
 */

// ── 버튼 판정 ──
export type { ActionAvailability } from './availability';
export { availability, guard } from './availability';

// ── '최대' 수량 계산 ──
export { maxAffordableGpus, maxAffordablePower, maxBuyReserve } from './limits';

// ── 나란히 놓이는 구매 버튼 목록 ──
export { gpuBuyOptions, powerContractOptions } from './options';

// ── 화면이 함께 쓰는 표시 형식 ──
export {
  formatCompact,
  formatDuration,
  formatMoney,
  formatPercent,
  formatRate,
  withParticle,
} from './format';
