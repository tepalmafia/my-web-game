/**
 * ===========================================================================
 *  가정해보기 — "이걸 사면 어떻게 되지?" 를 계산하기 위한 복사본 만들기
 * ===========================================================================
 *
 *  버튼 밑에 붙는 설명("전력 +5MW · 초당 $4.50K 추가")을 만들려면
 *  '지금'과 '샀을 때'를 비교해야 합니다.
 *
 *  그런데 게임 상태를 실제로 바꿔보고 되돌리는 방식은 절대 쓰면 안 됩니다.
 *  (되돌리는 걸 한 번만 깜빡해도 버튼을 쳐다보기만 했는데 GPU가 늘어납니다)
 *
 *  그래서 여기서는 원본은 그대로 두고 '살짝 다른 복사본'을 새로 만들어 돌려줍니다.
 *  그 복사본을 constraints 폴더의 계산기에 넣으면 "샀을 때의 값"이 나오고,
 *  지금 값과 빼기만 하면 늘어나는 양을 알 수 있습니다.
 *
 *  아래 함수들은 전부 원본을 건드리지 않습니다(읽기만 합니다).
 */

import type { GameState, Megawatts, Ratio } from '../types';

/** GPU 수만 다른 복사본 */
export function withGpus(state: GameState, gpus: number): GameState {
  return { ...state, player: { ...state.player, gpus } };
}

/** 계약 전력만 다른 복사본 */
export function withPowerContracted(state: GameState, powerContracted: Megawatts): GameState {
  return { ...state, player: { ...state.player, powerContracted } };
}

/** 데이터센터 동수만 다른 복사본 */
export function withDatacenters(state: GameState, datacenters: number): GameState {
  return { ...state, player: { ...state.player, datacenters } };
}

/** 연구원 수만 다른 복사본 */
export function withResearchers(state: GameState, researchers: number): GameState {
  return { ...state, player: { ...state.player, researchers } };
}

/** 안전 수준만 다른 복사본 */
export function withSafety(state: GameState, safety: Ratio): GameState {
  return { ...state, player: { ...state.player, safety } };
}

/** 자율 연구력 배분만 다른 복사본 */
export function withAlignmentShare(state: GameState, alignmentShare: Ratio): GameState {
  return { ...state, player: { ...state.player, alignmentShare } };
}
