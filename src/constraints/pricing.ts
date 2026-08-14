/**
 * ===========================================================================
 *  가격 — 지금 이 순간 무엇이 얼마인가
 * ===========================================================================
 *
 *  여기 있는 함수들은 전부 "지금 상태를 보고 현재 가격을 계산"할 뿐,
 *  돈을 깎거나 물건을 늘리지 않습니다. (실제 구매 처리는 state 폴더가 합니다)
 *
 *  가격이 고정되어 있지 않은 이유는 두 가지입니다.
 *    1) 사건 때문에 시장 가격이 흔들립니다  (market.gpuPrice / market.powerPrice 배수)
 *    2) 많이 살수록 비싸집니다             (데이터센터·연구원의 priceGrowth)
 */

import { DATACENTER, FUNDING, GPU, POWER, RESEARCHER } from '../balance';
import type { GameState, Megawatts, Money, Ratio } from '../types';

/**
 * GPU 한 장의 현재 가격.
 * 기본 가격에 시장 배수를 곱합니다. 공급난 사건이 터지면 이 값이 몇 배로 뜁니다.
 */
export function gpuUnitPrice(state: GameState): Money {
  return GPU.price * state.market.gpuPrice;
}

/**
 * 전력을 새로 계약할 때 한 번 내는 설치비.
 * 계약하려는 용량(MW)에 비례하고, 전기 요금 시장 배수의 영향도 받습니다.
 *
 * 주의: 이건 "한 번 내는 돈"입니다. 계약한 뒤 매초 나가는 요금은 아래
 * powerCostPerSecond 가 따로 계산합니다.
 */
export function powerContractUpfront(state: GameState, megawatts: Megawatts): Money {
  // 음수 용량을 계약할 수는 없으므로 0 밑으로는 내려가지 않게 막습니다
  const amount = Math.max(0, megawatts);
  return POWER.contractUpfrontPerMw * amount * state.market.powerPrice;
}

/**
 * 지금 계약해둔 전력에 대해 매초 나가는 전기 요금.
 *
 * 중요: GPU를 실제로 몇 장 돌리는지와 상관없이 "계약한 용량 전체"에 요금이 붙습니다.
 * 전력을 필요보다 많이 계약해두면 그만큼 돈이 새어나간다는 뜻입니다.
 */
export function powerCostPerSecond(state: GameState): Money {
  return state.player.powerContracted * POWER.costPerMwPerSecond * state.market.powerPrice;
}

/**
 * 다음 데이터센터 한 동의 건설비.
 * 이미 지은 동수만큼 priceGrowth 가 곱해져서 지을수록 비싸집니다.
 * (무한정 짓는 플레이를 막는 장치입니다)
 */
export function datacenterPrice(state: GameState): Money {
  return DATACENTER.basePrice * Math.pow(DATACENTER.priceGrowth, state.player.datacenters);
}

/**
 * 다음 연구원 한 명의 영입 비용.
 * 데이터센터와 같은 이유로, 이미 고용한 인원수만큼 비싸집니다.
 */
export function researcherPrice(state: GameState): Money {
  return RESEARCHER.basePrice * Math.pow(RESEARCHER.priceGrowth, state.player.researchers);
}

/**
 * 지금 받을 수 있는 투자 조건 (들어오는 금액과 내주는 지분).
 *
 * 라운드가 올라갈수록 금액도 커지지만 내주는 지분도 함께 커집니다.
 * 이번 투자를 받으면 내 지분이 최소선(FUNDING.minEquity) 밑으로 내려가는 경우
 * null 을 돌려줍니다 = "더 이상 팔 지분이 없다".
 * → 돈이 필요할 때마다 투자 버튼만 연타하는 플레이를 막는 장치입니다.
 */
export function fundingOffer(state: GameState): { amount: Money; equityCost: Ratio } | null {
  const round = Math.max(0, state.player.fundingRound);

  const amount = FUNDING.baseAmount * Math.pow(FUNDING.amountGrowth, round);
  const equityCost = FUNDING.baseEquityCost * Math.pow(FUNDING.equityCostGrowth, round);

  // 이번 라운드를 받고 나면 남는 지분
  const remaining = state.player.equityRetained - equityCost;
  if (remaining < FUNDING.minEquity) return null;

  return { amount, equityCost };
}
