/**
 * ===========================================================================
 *  계산해서 얻는 값 모으기
 * ===========================================================================
 *
 *  화면에 필요한 '계산된 값'을 한 번에 전부 만들어 돌려줍니다.
 *
 *  왜 이렇게 하나:
 *    이 값들을 게임 상태에 저장해두면 반드시 어긋납니다.
 *    (GPU를 팔았는데 전력 소비량은 그대로인 종류의 버그)
 *    그래서 저장하지 않고, 화면을 그릴 때마다 여기서 새로 계산합니다.
 */

import { RESEARCH } from '../balance';
import type { DerivedStats, GameState, Rival } from '../types';
import { activeGpus, gpuCapacity, powerDemand, powerHeadroom } from './capacity';
import {
  burnPerSecond,
  netPerSecond,
  researchRate,
  revenuePerSecond,
} from './rates';
import { isRunning } from './running';

/**
 * 가장 앞서 있는 경쟁사를 찾습니다.
 * 탈락(collapsed)한 곳은 더 이상 경주에 없으므로 제외하고,
 * 남은 곳이 하나도 없으면 null 을 돌려줍니다.
 */
function findLeadingRival(state: GameState): Rival | null {
  let leader: Rival | null = null;
  for (const rival of state.rivals) {
    if (rival.status === 'collapsed') continue;
    if (leader === null || rival.researchProgress > leader.researchProgress) {
      leader = rival;
    }
  }
  return leader;
}

/**
 * 지금 상태를 보고 화면에 필요한 모든 계산값을 한 번에 만듭니다.
 *
 * 여기 담기는 것: 시간이 흐르는 중인지, 설비 한계, 연구 속도와 남은 시간,
 * 돈이 도는 속도와 버틸 수 있는 시간, 그리고 1등 경쟁사와의 격차.
 */
export function computeDerived(state: GameState): DerivedStats {
  const rate = researchRate(state);
  const burn = burnPerSecond(state);
  const revenue = revenuePerSecond(state);
  const net = netPerSecond(state);

  // 지금 속도로 AGI까지 몇 초 남았는지. 연구가 멈춰 있으면 '알 수 없음'(null)
  const remaining = Math.max(0, RESEARCH.goal - state.player.researchProgress);
  const etaToAgi = rate > 0 ? remaining / rate : null;

  // 적자일 때만 '몇 초 버티는지'가 의미를 가집니다. 흑자면 null
  const runwaySeconds = net < 0 ? Math.max(0, state.player.money) / -net : null;

  const leadingRival = findLeadingRival(state);
  // 경쟁사가 아무도 남지 않았다면 격차는 최대치(1)로 봅니다
  const leadMargin =
    leadingRival === null
      ? 1
      : state.player.researchProgress - leadingRival.researchProgress;

  return {
    running: isRunning(state),

    gpuCapacity: gpuCapacity(state),
    powerDemand: powerDemand(state),
    activeGpus: activeGpus(state),
    powerHeadroom: powerHeadroom(state),

    researchRate: rate,
    etaToAgi,

    burnPerSecond: burn,
    revenuePerSecond: revenue,
    netPerSecond: net,
    runwaySeconds,

    leadingRival,
    leadMargin,
  };
}
