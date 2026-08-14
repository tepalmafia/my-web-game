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

import { DATACENTER, FUNDING, GPU, INTERFERENCE, POWER, RESEARCHER } from '../balance';
import type { GameState, Megawatts, Money, Ratio, Seconds } from '../types';

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

/** 투자를 지금 받을 수 없는 이유 */
export type FundingBlock =
  /** 내줄 지분이 남지 않음 — 이 판에서는 두 번 다시 받을 수 없습니다 */
  | 'equityExhausted'
  /** 아직 이르다 — 시간이 더 지나야 합니다 */
  | 'tooSoon'
  /** 성과가 부족하다 — 진행도를 더 올려야 합니다 */
  | 'needProgress';

/** 다음 라운드를 받으려면 최소 몇 초가 지나야 하는지 */
export function fundingReadyAt(state: GameState): Seconds {
  return Math.max(0, state.player.fundingRound) * FUNDING.roundIntervalSeconds;
}

/** 다음 라운드를 받으려면 진행도가 최소 얼마여야 하는지 */
export function fundingRequiredProgress(state: GameState): Ratio {
  return Math.max(0, state.player.fundingRound) * FUNDING.progressPerRound;
}

/**
 * 지금 투자를 받을 수 없는 이유를 알려줍니다. 받을 수 있으면 null.
 *
 * 조건이 세 개인 이유: 지분만 제한하면 시작하자마자 버튼을 연타해서
 * 게임 전체 자금을 한 번에 다 받아버릴 수 있기 때문입니다.
 * 시간과 성과 조건이 라운드를 게임 전체에 고르게 흩뿌려 줍니다.
 */
export function fundingBlock(state: GameState): FundingBlock | null {
  const round = Math.max(0, state.player.fundingRound);
  const equityCost = FUNDING.baseEquityCost * Math.pow(FUNDING.equityCostGrowth, round);

  // 이번 라운드를 받고 나면 남는 지분
  if (state.player.equityRetained - equityCost < FUNDING.minEquity) return 'equityExhausted';
  if (state.elapsed < fundingReadyAt(state)) return 'tooSoon';
  if (state.player.researchProgress < fundingRequiredProgress(state)) return 'needProgress';
  return null;
}

/**
 * 지금 받을 수 있는 투자 조건. 받을 수 없는 상황이면 null 을 돌려줍니다.
 * 화면과 상태 변경 양쪽이 이 함수를 거치므로, 여기서 null 이면 실제로 돈이 들어오지 않습니다.
 */
export function fundingOffer(state: GameState): { amount: Money; equityCost: Ratio } | null {
  if (fundingBlock(state) !== null) return null;

  const round = Math.max(0, state.player.fundingRound);
  const amount = FUNDING.baseAmount * Math.pow(FUNDING.amountGrowth, round);
  const equityCost = FUNDING.baseEquityCost * Math.pow(FUNDING.equityCostGrowth, round);

  return { amount, equityCost };
}

/* ===========================================================================
 *  경쟁사 대응 비용
 * ======================================================================== */

/**
 * 첩보 한 건의 값. 그 경쟁사의 진짜 진행도를 알아내는 비용입니다.
 * 정액이라 후반으로 갈수록 상대적으로 싸집니다 — 정보의 가치도 그때는 낮아지므로
 * (이미 상황판만 봐도 대세가 보이는 시점입니다) 일부러 그대로 두었습니다.
 */
export function intelCost(state: GameState): Money {
  // state 를 쓰지 않지만, 나중에 진행도에 따라 값을 바꾸고 싶을 때
  // 부르는 쪽을 고치지 않아도 되도록 다른 가격 함수들과 모양을 맞춰 둡니다
  void state;
  return INTERFERENCE.intelCost;
}

/**
 * 인재 빼오기 비용.
 *
 * '지금 연구원 한 명 뽑는 값'에 배수를 곱합니다.
 * 빼올 때마다 내 연구원이 늘고, 연구원이 늘면 다음 영입비가 오르므로,
 * 사용 횟수를 따로 세지 않아도 쓸수록 저절로 비싸집니다.
 */
export function poachCost(state: GameState): Money {
  return researcherPrice(state) * INTERFERENCE.poachCostMultiplier;
}

/** 공급 물량 선점 비용 */
export function supplyLockCost(state: GameState): Money {
  void state;
  return INTERFERENCE.supplyLockCost;
}
