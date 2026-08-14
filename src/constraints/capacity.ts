/**
 * ===========================================================================
 *  설비 한계 — GPU가 부딪히는 두 개의 벽
 * ===========================================================================
 *
 *  이 게임에서 "충돌"은 물체끼리 부딪히는 게 아니라
 *  자원이 한계선에 부딪히는 일입니다. GPU에는 벽이 두 개 있습니다.
 *
 *    1) 자리의 벽  : 데이터센터 수용 한도를 넘으면 아예 살 수 없습니다.
 *    2) 전기의 벽  : 살 수는 있지만 전력이 모자라면 일부가 놀게 됩니다(=느려짐).
 *
 *  두 벽의 성격이 다르다는 점이 중요합니다.
 *  자리는 "구매를 막는" 벽이고, 전기는 "샀는데 안 돌아가는" 벽입니다.
 */

import { DATACENTER, GPU, POWER } from '../balance';
import type { GameState, Megawatts, Ratio } from '../types';

/**
 * GPU를 최대 몇 장까지 둘 수 있는지 (자리의 벽).
 * 기본 수용량 + 데이터센터 동수 × 한 동당 수용량.
 */
export function gpuCapacity(state: GameState): number {
  return DATACENTER.baseCapacity + state.player.datacenters * DATACENTER.slotsPerUnit;
}

/**
 * 지금 쓸 수 있는 전력 총량(MW).
 * 계약이 하나도 없어도 기본 용량만큼은 쓸 수 있어서
 * 게임 초반에는 전기를 신경 쓰지 않고 GPU만 사면 됩니다.
 */
export function powerAvailable(state: GameState): Megawatts {
  return POWER.baseCapacity + state.player.powerContracted;
}

/**
 * 보유한 GPU를 전부 돌리려면 필요한 전력(MW).
 * 실제로 돌아가는 장수가 아니라 "보유 장수" 기준입니다.
 */
export function powerDemand(state: GameState): Megawatts {
  return state.player.gpus * GPU.powerPerUnit;
}

/**
 * 실제로 돌아가고 있는 GPU 수 (전기의 벽을 반영한 값).
 *
 * 전력이 모자라면 모자란 만큼 GPU가 놀고, 그만큼 연구가 느려집니다.
 * 한 장이라도 전력이 부족하면 그 장은 아예 안 돌아가므로 소수점은 버립니다(내림).
 */
export function activeGpus(state: GameState): number {
  const owned = Math.max(0, Math.floor(state.player.gpus));
  if (owned <= 0) return 0;

  // 전력 소비량이 0으로 설정된 경우(밸런스 실험)에는 전기가 제약이 되지 않습니다
  if (GPU.powerPerUnit <= 0) return owned;

  const poweredUnits = Math.floor(powerAvailable(state) / GPU.powerPerUnit);
  return Math.max(0, Math.min(owned, poweredUnits));
}

/**
 * 전력 여유율 (0~1). 계약한 전력 중 아직 안 쓰고 남은 비율입니다.
 *   1   = 여유 만점 (GPU가 없거나 전력이 남아돔)
 *   0.3 = 30% 남음
 *   0   = 여유 없음 (딱 맞거나 모자람 → GPU가 놀기 시작)
 *
 * 화면에서 전력 막대의 색을 정하거나 '전력 계약' 패널을 여는 판단에 씁니다.
 */
export function powerHeadroom(state: GameState): Ratio {
  const demand = powerDemand(state);
  if (demand <= 0) return 1; // 아직 GPU가 없으면 여유는 최대

  const available = powerAvailable(state);
  if (available <= 0) return 0;

  const spare = (available - demand) / available;
  return Math.max(0, Math.min(1, spare));
}
