/**
 * ===========================================================================
 *  속도와 경제 — 1초마다 무슨 일이 얼마나 일어나는가
 * ===========================================================================
 *
 *  여기 있는 값은 전부 "1초당" 기준입니다.
 *  게임은 0.1초마다 계산을 돌리므로, 실제로 쓸 때는 여기 값에 흐른 시간을 곱합니다.
 *  (그 곱하는 일은 state 폴더가 하고, 이 파일은 순수하게 비율만 알려줍니다)
 */

import {
  DATACENTER,
  PHASE2,
  RESEARCH,
  RESEARCHER,
  REVENUE,
  RIVAL_CURVE,
  SAFETY,
  TARGET_PLAY_SECONDS,
} from '../balance';
import type {
  GameState,
  Money,
  Multiplier,
  Ratio,
  RatioPerSecond,
  Rival,
  RivalStatus,
  Seconds,
} from '../types';
import { activeGpus } from './capacity';
import { powerCostPerSecond } from './pricing';

/** 값을 최소~최대 사이로 가둡니다 (예: 안전 수준은 0~1을 벗어날 수 없음) */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 연구원들이 올려주는 연구 속도 배수.
 * 연구원 1명당 speedBonusEach 만큼 더해집니다. (0명이면 1 = 변화 없음)
 */
export function researcherMultiplier(state: GameState): Multiplier {
  const headcount = Math.max(0, state.player.researchers);
  return 1 + headcount * RESEARCHER.speedBonusEach;
}

/**
 * 안전 수준을 낮춰서 얻는 연구 속도 배수.
 * 안전 1(원칙대로) = 1배, 안전 0(전부 건너뜀) = 1 + maxSpeedBonus 배.
 *
 * 공짜가 아닙니다. 같은 선택이 아래 accidentChancePerSecond 를 함께 올립니다.
 */
export function safetySpeedMultiplier(state: GameState): Multiplier {
  const safety = clamp(state.player.safety, 0, 1);
  return 1 + (1 - safety) * SAFETY.maxSpeedBonus;
}

/**
 * 1초에 오르는 AGI 진행도.
 *
 * 실제로 돌아가는 GPU 수 × GPU 1장의 기여 × 연구원 배수 × 안전 배수.
 * 보유 GPU가 아니라 '실제로 돌아가는' GPU를 쓰는 것이 핵심입니다.
 * → 전력을 계약하지 않으면 GPU를 아무리 사도 이 값이 오르지 않습니다.
 */
export function researchRate(state: GameState): RatioPerSecond {
  return (
    activeGpus(state) *
    RESEARCH.perGpuPerSecond *
    researcherMultiplier(state) *
    safetySpeedMultiplier(state) *
    selfResearchMultiplier(state)
  );
}

/**
 * 1초에 나가는 돈 = 전기 요금 + 연구원 인건비 + 데이터센터 유지비.
 *
 * 전기 요금은 '계약한 용량' 기준이라 GPU를 안 돌려도 나갑니다.
 * 이 값이 매출보다 크면 통장이 마르기 시작합니다.
 */
export function burnPerSecond(state: GameState): Money {
  const wages = Math.max(0, state.player.researchers) * RESEARCHER.salaryPerSecond;
  const upkeep = Math.max(0, state.player.datacenters) * DATACENTER.upkeepPerSecond;
  return powerCostPerSecond(state) + wages + upkeep;
}

/**
 * 1초에 들어오는 돈 (지금까지 만든 모델을 서비스해서 버는 매출).
 *
 * 진행도가 높을수록 좋은 모델이라 매출이 가파르게(진행도^curve) 오릅니다.
 * 그래서 초반에는 매출이 거의 없고 후반에 몰립니다.
 */
export function revenuePerSecond(state: GameState): Money {
  const progress = Math.max(0, state.player.researchProgress);
  return REVENUE.atFullProgress * Math.pow(progress, REVENUE.curve);
}

/**
 * 1초당 순수입 (매출 − 지출). 음수면 통장이 줄고 있다는 뜻입니다.
 */
export function netPerSecond(state: GameState): Money {
  return revenuePerSecond(state) - burnPerSecond(state);
}

/**
 * 1초당 사고 확률 (0~1).
 *
 * 안전을 낮출수록 제곱으로 가파르게 올라갑니다.
 *   안전 1.0 → 0 (사고 없음)
 *   안전 0.5 → 최대치의 25%
 *   안전 0.0 → 최대치
 * 실제로 주사위를 굴리는 것은 state 폴더의 일이고, 여기서는 확률만 알려줍니다.
 */
export function accidentChancePerSecond(state: GameState): number {
  const safety = clamp(state.player.safety, 0, 1);
  const recklessness = 1 - safety;
  return recklessness * recklessness * SAFETY.maxAccidentPerSecond;
}

/**
 * 경쟁사 한 곳이 1초에 올리는 진행도.
 *
 * 경쟁사는 GPU를 사거나 전기를 계약하지 않습니다. 대신 성향에 따라
 * 시간·진행도에 맞춰 속도 배수가 달라지는 방식으로 단순하게 굴립니다.
 *
 *   탈락(collapsed)·달성(achieved) → 0 (더 이상 움직이지 않음)
 *   효율형(efficiency)             → 시간이 갈수록 느림 → 빠름으로 선형 가속
 *   속도형(speed)                  → 진행도 0.7 을 넘으면 막판 스퍼트
 *   자금력형(capital)              → 추가 배수 없이 처음부터 끝까지 꾸준함
 *
 * ※ 개입이나 사건으로 생기는 감속·가속은 전부 momentum 하나로만 표현합니다.
 *   상태(stalled 등)에 따로 배수를 두면 두 번 곱해져서, 인재를 한 번 빼온 것만으로
 *   상대가 86% 느려지는 식으로 효과가 의도의 두 배가 됩니다.
 *   상태는 momentum 을 보고 붙이는 '표시'일 뿐입니다 (아래 rivalStatusFor 참고).
 */
export function rivalSpeed(state: GameState, rival: Rival): RatioPerSecond {
  // 이미 끝난 경쟁사는 더 이상 진행하지 않습니다
  if (rival.status === 'collapsed' || rival.status === 'achieved') return 0;

  return rival.baseSpeed * rival.momentum * personalityMultiplier(state, rival) * lateBoost(rival);
}

/**
 * 속도 배수를 보고 지금 어떤 상태로 보여줄지 정합니다.
 *
 * 상태를 따로 저장하지 않고 매번 momentum 에서 끌어내기 때문에,
 * 감속이 풀리면 표시도 저절로 '평소'로 돌아옵니다.
 * (저장해두면 한 번 '정체'가 된 경쟁사가 영원히 정체로 남습니다)
 */
export function rivalStatusFor(rival: Rival): RivalStatus {
  if (rival.status === 'collapsed' || rival.status === 'achieved') return rival.status;
  if (rival.momentum < RIVAL_CURVE.stalledBelowMomentum) return 'stalled';
  if (rival.momentum > RIVAL_CURVE.sprintingAboveMomentum) return 'sprinting';
  return 'racing';
}

/** 성향에서 나오는 속도 배수만 따로 계산합니다 (위 rivalSpeed 의 부품) */
function personalityMultiplier(state: GameState, rival: Rival): Multiplier {
  switch (rival.personality) {
    case 'efficiency': {
      // 한 판 기준 시간에 대해 지금 얼마나 왔는지 (0 = 시작, 1 = 목표 시간 도달)
      const elapsedRatio = clamp(state.elapsed / TARGET_PLAY_SECONDS, 0, 1);
      return (
        RIVAL_CURVE.efficiencyStart +
        (RIVAL_CURVE.efficiencyEnd - RIVAL_CURVE.efficiencyStart) * elapsedRatio
      );
    }
    case 'speed':
      return rival.researchProgress >= RIVAL_CURVE.speedSprintFromProgress
        ? RIVAL_CURVE.speedSprint
        : 1;
    case 'capital':
      return 1;
    default:
      return 1;
  }
}

/**
 * 경쟁사도 같은 지점에서 자기개선에 들어갑니다.
 * 플레이어만 후반에 빨라지면 경주가 싱거워지기 때문입니다.
 */
function lateBoost(rival: Rival): Multiplier {
  if (rival.researchProgress < PHASE2.startProgress) return 1;
  return PHASE2.rivalLateBoost;
}

/* ===========================================================================
 *  후반 단계 — 자기개선
 * ======================================================================== */

/**
 * 지금이 후반 단계인가 (모델이 스스로 연구를 돕기 시작했는가).
 *
 * 저장하지 않고 진행도에서 곧바로 판단합니다.
 * 저장해두면 '단계는 후반인데 진행도는 전반' 같은 어긋난 상태가 생길 수 있습니다.
 */
export function isSelfImproving(state: GameState): boolean {
  return state.player.researchProgress >= PHASE2.startProgress;
}

/**
 * 후반 진입 이후 얼마나 왔는지 (0 = 막 진입, 1 = 목표 도달 직전).
 * 자율 연구력의 세기와 통제력 소모가 이 값에 비례해 커집니다.
 */
export function selfImproveDepth(state: GameState): Ratio {
  if (!isSelfImproving(state)) return 0;
  const span = RESEARCH.goal - PHASE2.startProgress;
  if (span <= 0) return 1;
  return clamp((state.player.researchProgress - PHASE2.startProgress) / span, 0, 1);
}

/**
 * 자율 연구력이 붙여주는 속도 배수.
 *
 * 후반 전에는 1(변화 없음)입니다.
 * 후반에는 '가속에 배분한 비율 × 얼마나 깊이 왔는지' 만큼 보너스가 붙습니다.
 * → 후반에는 GPU를 더 사는 것보다 이 배분을 조절하는 쪽이 훨씬 크게 작용합니다.
 */
export function selfResearchMultiplier(state: GameState): Multiplier {
  const depth = selfImproveDepth(state);
  if (depth === 0) return 1;

  const speedShare = 1 - clamp(state.player.alignmentShare, 0, 1);
  return 1 + PHASE2.maxSelfSpeedBonus * speedShare * depth;
}

/**
 * 1초에 변하는 통제력 (양수면 회복, 음수면 깎임).
 *
 * ─ 깎이는 쪽은 '시간'이 아니라 '성과'에 물립니다.
 *   지금 1초에 밀어내는 진행도(researchRate)에 비례해서 깎입니다.
 *   그래서 GPU를 잔뜩 쌓아 후반을 빨리 통과해도 벌을 피할 수 없습니다 —
 *   오히려 빨리 밀수록 그만큼 빨리 깎입니다.
 *
 * ─ 회복하는 쪽은 시간에 붙습니다.
 *   정렬로 돌려놓고 기다리면 통제력이 돌아오지만, 그동안 가속 보너스가 사라져
 *   경쟁사가 따라붙습니다. 되돌리는 값은 '잃은 시간'으로 치릅니다.
 *
 * 깊이 들어갈수록 소모가 커져서, 후반으로 갈수록 같은 배분으로는 버틸 수 없습니다.
 */
export function controlChangePerSecond(state: GameState): RatioPerSecond {
  const depth = selfImproveDepth(state);
  if (depth === 0) return 0;

  const alignmentShare = clamp(state.player.alignmentShare, 0, 1);
  const drain =
    PHASE2.controlDrainPerProgress * researchRate(state) * (1 - alignmentShare) * depth;
  const recovery = PHASE2.controlRecoveryPerSecond * alignmentShare;
  return recovery - drain;
}

/**
 * 지금 통제력이면 통제를 잃기까지 남은 시간(초).
 * 회복 중이거나 후반이 아니면 null 입니다.
 */
export function secondsUntilControlLost(state: GameState): Seconds | null {
  const change = controlChangePerSecond(state);
  if (change >= 0) return null;
  return state.player.control / -change;
}
