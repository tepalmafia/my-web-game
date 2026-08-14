/**
 * ===========================================================================
 *  constraints — 한계 계산 모음 (이 폴더의 정문)
 * ===========================================================================
 *
 *  이 게임에는 움직이는 물체가 없습니다. 대신 '자원이 한계선에 부딪히는 일'이
 *  게임의 뼈대입니다. 이 폴더는 그 부딪힘을 전부 계산합니다.
 *
 *      · GPU가 데이터센터 수용 한도에 부딪힘
 *      · GPU가 계약 전력에 부딪힘 (사놓고 못 돌리는 상황)
 *      · 구매가 잔액에 부딪힘
 *      · 투자가 지분 최소선에 부딪힘
 *      · 진행도가 승리선(또는 경쟁사가 먼저)에 부딪힘
 *
 *  이 폴더의 모든 함수는 '순수 계산'입니다.
 *      · 게임 상태를 절대 바꾸지 않습니다 (읽기만 합니다)
 *      · 무작위(주사위)를 쓰지 않습니다 — 같은 입력이면 언제나 같은 답
 *      · 화면(React)과 아무 상관이 없습니다
 *  덕분에 밸런스가 맞는지 기계로 수천 판 돌려서 검사할 수 있습니다.
 *
 *  다른 폴더에서는 이 파일 하나만 보면 됩니다.
 *      import { computeDerived, checkGpuPurchase } from '../constraints';
 */

// ── 가격 (시장 배수를 반영한 현재 가격) ──
export {
  gpuUnitPrice,
  powerContractUpfront,
  powerCostPerSecond,
  datacenterPrice,
  researcherPrice,
  fundingBlock,
  fundingOffer,
  fundingReadyAt,
  fundingRequiredProgress,
} from './pricing';

// ── 설비 한계 ──
export { gpuCapacity, powerAvailable, powerDemand, activeGpus, powerHeadroom } from './capacity';

// ── 속도와 경제 ──
export {
  researcherMultiplier,
  safetySpeedMultiplier,
  researchRate,
  burnPerSecond,
  revenuePerSecond,
  netPerSecond,
  accidentChancePerSecond,
  rivalSpeed,
} from './rates';

// ── 한계 위반 판정 ──
export type { LimitViolation } from './violations';
export {
  checkAffordable,
  checkGpuPurchase,
  checkRequirement,
  violationMessage,
} from './violations';

// ── 승패 경계 ──
export { checkOutcome } from './outcome';

// ── 전부 모아서 ──
export { computeDerived } from './derived';
