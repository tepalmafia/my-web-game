/**
 * ===========================================================================
 *  버튼 묶음 — 화면에 줄지어 놓을 구매 버튼들
 * ===========================================================================
 *
 *  'GPU ×1  ×10  ×100  ×최대' 처럼 여러 개가 나란히 놓이는 버튼들은
 *  각각 값과 눌림 여부가 다릅니다. 그 목록을 여기서 통째로 만들어 줍니다.
 *
 *  버튼에 적을 묶음 단위(1장·10장·100장, 1MW·5MW·25MW)는 balance.ts 에 있습니다.
 *  거기 숫자를 고치면 화면 버튼도 그대로 따라 바뀝니다.
 */

import { GPU, POWER } from '../balance';
import type { GameState, Megawatts } from '../types';
import type { ActionAvailability } from './availability';
import { availability } from './availability';
import { maxAffordableGpus } from './limits';

/**
 * GPU 구매 버튼 목록.
 * balance.ts 의 묶음 단위(×1 ×10 ×100)를 먼저 놓고,
 * 맨 뒤에 '지금 살 수 있는 최대' 버튼을 하나 더 붙입니다.
 * 한 장도 살 수 없는 상황이면 최대 버튼은 아예 만들지 않습니다.
 */
export function gpuBuyOptions(
  state: GameState,
): { count: number; availability: ActionAvailability }[] {
  const options = GPU.buySteps.map((count) => ({
    count,
    availability: availability(state, { type: 'buyGpu', count }),
  }));

  const most = maxAffordableGpus(state);
  if (most > 0) {
    options.push({ count: most, availability: availability(state, { type: 'buyGpu', count: most }) });
  }

  return options;
}

/**
 * 전력 계약 버튼 목록 (1MW · 5MW · 25MW).
 *
 * GPU와 달리 '최대' 버튼을 붙이지 않습니다.
 * 전기는 계약해두기만 해도 매초 요금이 나가서, 최대로 계약하는 순간
 * 통장이 순식간에 마르기 때문입니다. 필요한 만큼만 조금씩 늘리게 두는 편이 낫습니다.
 */
export function powerContractOptions(
  state: GameState,
): { megawatts: Megawatts; availability: ActionAvailability }[] {
  return POWER.contractSteps.map((megawatts) => ({
    megawatts,
    availability: availability(state, { type: 'contractPower', megawatts }),
  }));
}
