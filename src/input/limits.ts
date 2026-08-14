/**
 * ===========================================================================
 *  최대 수량 — "지금 돈으로 최대 몇 개까지?"
 * ===========================================================================
 *
 *  '×최대' 버튼을 만들기 위한 계산입니다.
 *  가격은 전부 constraints 폴더에서 가져옵니다. 여기서 가격을 다시 계산하면
 *  나중에 밸런스를 고쳤을 때 버튼에 적힌 수량과 실제 결제 금액이 어긋납니다.
 */

import { GPU } from '../balance';
import {
  burnPerSecond,
  gpuCapacity,
  gpuUnitPrice,
  powerContractUpfront,
  researcherPrice,
} from '../constraints';
import type { GameState, Megawatts, Money } from '../types';
import { withResearchers } from './simulate';

/**
 * 소수점 오차 때문에 '최대'로 계산한 수량을 정작 살 수 없는 일이 없도록,
 * 총액이 보유 자금을 아주 조금이라도 넘으면 한 개를 덜어냅니다.
 */
function trimToAffordable(count: number, unitPrice: Money, money: Money): number {
  if (count > 0 && count * unitPrice > money) return count - 1;
  return count;
}

/**
 * 지금 살 수 있는 GPU 최대 장수.
 *
 * 두 가지 벽을 동시에 봅니다.
 *   ① 지갑  : 자금 ÷ GPU 한 장 값
 *   ② 자리  : 데이터센터 수용 한도 − 이미 가진 장수
 * 둘 중 더 작은 쪽이 답입니다. (돈이 있어도 둘 자리가 없으면 못 삽니다)
 */
export function maxAffordableGpus(state: GameState): number {
  const room = Math.max(0, Math.floor(gpuCapacity(state) - state.player.gpus));
  const price = gpuUnitPrice(state);

  // 전 재산을 쓰지 않고 운영자금을 남깁니다.
  // 남기지 않으면 누르는 순간 잔액 0에서 적자가 시작되어 곧 파산합니다.
  const money = Math.max(0, state.player.money - maxBuyReserve(state));

  // 값이 0 이하인 비정상 상황에서는 자리만 보고 답합니다
  if (!(price > 0)) return room;

  const byMoney = trimToAffordable(Math.floor(money / price), price, money);
  return Math.max(0, Math.min(room, byMoney));
}

/**
 * '최대' 버튼이 남겨두는 운영자금.
 * 지금 지출로 balance.ts 가 정한 시간만큼 버틸 돈, 최소한 정해진 하한만큼입니다.
 */
export function maxBuyReserve(state: GameState): Money {
  return Math.max(GPU.maxBuyReserveFloor, burnPerSecond(state) * GPU.maxBuyReserveSeconds);
}

/**
 * 지금 계약할 수 있는 전력 최대 용량(MW).
 *
 * 계약할 때 한 번 내는 설치비만 기준으로 봅니다. 계약 뒤에 매초 나가는
 * 전기 요금까지 감당할 수 있는지는 플레이어가 판단할 몫입니다.
 * (여기서 요금까지 막아버리면 '전기를 과하게 계약해 통장을 말리는' 실수를
 *  아예 못 하게 되는데, 그 실수를 겪는 것이 이 게임의 핵심 재미입니다)
 *
 * 1 MW 단위로 내림합니다 — 0.3 MW 짜리 계약은 하지 않습니다.
 */
export function maxAffordablePower(state: GameState): Megawatts {
  const perMw = powerContractUpfront(state, 1);
  const money = Math.max(0, state.player.money);

  // 설치비가 0 이하인 비정상 상황에서는 계산이 의미가 없으므로 0으로 봅니다
  if (!(perMw > 0)) return 0;

  return Math.max(0, trimToAffordable(Math.floor(money / perMw), perMw, money));
}

/**
 * 연구원을 count 명 한꺼번에 뽑을 때 드는 총액.
 *
 * 연구원 몸값은 한 명 뽑을 때마다 비싸지므로 단순 곱셈이 아니라
 * 한 명씩 값을 물어보며 더해야 정확합니다.
 *
 * 돌려주는 값의 exact 는 '총액을 끝까지 정확히 더했는가'입니다.
 * 도중에 이미 보유 자금을 넘어섰다면 더 계산해봐야 결론(못 뽑는다)은 같으므로
 * 거기서 멈추고 exact 를 false 로 알려줍니다.
 */
export function researcherHireCost(
  state: GameState,
  count: number,
): { total: Money; exact: boolean } {
  const owned = Math.max(0, Math.floor(state.player.researchers));
  let total = 0;

  for (let i = 0; i < count; i += 1) {
    total += researcherPrice(withResearchers(state, owned + i));
    // 아직 더 뽑아야 하는데 벌써 자금을 넘었다면 여기서 멈춥니다
    if (total > state.player.money && i + 1 < count) {
      return { total, exact: false };
    }
  }

  return { total, exact: true };
}
