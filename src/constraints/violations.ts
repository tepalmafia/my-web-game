/**
 * ===========================================================================
 *  한계 위반 판정 — "그 버튼을 지금 누를 수 있는가"
 * ===========================================================================
 *
 *  이 게임의 '충돌'은 자원이 한계선에 부딪히는 일입니다.
 *  여기 있는 함수들은 부딪혔는지 아닌지만 알려주고, 아무것도 바꾸지 않습니다.
 *
 *    돌아오는 값이 null   → 아무 문제 없음, 눌러도 됨
 *    돌아오는 값이 위반   → 왜 안 되는지가 담겨 있음 (화면은 버튼을 흐리게 하고
 *                          violationMessage 로 이유를 한 줄 보여주면 됩니다)
 */

import { s } from '../i18n';
import type { GameState, Megawatts, Money, PanelId, Requirement } from '../types';
import { gpuCapacity } from './capacity';
import { formatCount, formatMoney, formatPower } from './format';
import { gpuUnitPrice } from './pricing';
import { isRunning } from './running';

/**
 * 부딪힐 수 있는 한계선의 종류.
 * 각 항목에는 화면에 이유를 설명하는 데 필요한 숫자가 함께 담깁니다.
 */
export type LimitViolation =
  /** 자금 부족 — 필요한 돈(needed)이 보유액(have)보다 큼 */
  | { kind: 'insufficientFunds'; needed: Money; have: Money }
  /** GPU 자리 부족 — 데이터센터 수용 한도를 넘김 */
  | { kind: 'gpuCapacityExceeded'; capacity: number; current: number; requested: number }
  /** 전력 부족 — 필요한 전력이 계약 용량을 넘김 */
  | { kind: 'powerShortage'; demand: Megawatts; available: Megawatts }
  /** 지분 소진 — 더 이상 팔 지분이 없어 투자를 받을 수 없음 */
  | { kind: 'equityExhausted' }
  /** 조건 미달 — 해당 영역이 아직 열리지 않았거나 요구 조건을 못 채움 */
  | { kind: 'panelLocked'; panel: PanelId }
  /** 지금은 시간이 흐르지 않음 (일시정지·사건 창·게임 종료) */
  | { kind: 'gameNotRunning' };

/**
 * 이만큼의 돈을 낼 수 있는지만 봅니다.
 *
 * 일부러 '지금 게임이 돌아가는 중인지'는 보지 않습니다.
 * 사건 창이 떠 있는 동안에도(=시간이 멈춘 동안에도) 선택지 비용은 내야 하기 때문입니다.
 */
export function checkAffordable(state: GameState, cost: Money): LimitViolation | null {
  if (state.player.money < cost) {
    return { kind: 'insufficientFunds', needed: cost, have: state.player.money };
  }
  return null;
}

/**
 * GPU를 count 장 사려고 할 때 걸리는 것이 있는지 전부 확인합니다.
 *
 * 확인 순서는 "고치기 어려운 문제부터"입니다.
 *   ① 지금 누를 수 있는 상황인가 → ② 패널이 열렸나
 *   → ③ 둘 자리가 있나(데이터센터) → ④ 돈이 되나
 *
 * 전력 부족은 여기서 막지 않습니다. 전기가 모자라도 GPU를 사는 것 자체는 되고,
 * 대신 산 GPU 중 일부가 놀게 됩니다. (이 게임에서 제일 중요한 함정입니다)
 */
export function checkGpuPurchase(state: GameState, count: number): LimitViolation | null {
  if (!isRunning(state)) return { kind: 'gameNotRunning' };
  if (!state.unlocks.gpu) return { kind: 'panelLocked', panel: 'gpu' };

  // 0장 이하를 사는 것은 아무 일도 아니므로 막을 것도 없습니다
  if (count <= 0) return null;

  const capacity = gpuCapacity(state);
  const current = state.player.gpus;
  if (current + count > capacity) {
    return { kind: 'gpuCapacityExceeded', capacity, current, requested: count };
  }

  return checkAffordable(state, gpuUnitPrice(state) * count);
}

/**
 * 사건 선택지의 최소 조건(Requirement)을 만족하는지 봅니다.
 *
 * 조건에 적히지 않은 항목은 "조건 없음"이므로 건너뜁니다.
 *
 * ※ 자금 부족은 숫자까지 담아서 알려주지만, 연구원·데이터센터·GPU 보유량 부족은
 *   담을 수 있는 형태가 panelLocked 뿐이라 "그 항목의 조건을 아직 못 채웠다"는
 *   뜻으로 panelLocked 를 씁니다. (화면에서는 흐린 버튼 + 한 줄 안내로 충분합니다)
 */
export function checkRequirement(state: GameState, req: Requirement): LimitViolation | null {
  const { money, gpus, researchers, datacenters } = state.player;

  if (req.money !== undefined && money < req.money) {
    return { kind: 'insufficientFunds', needed: req.money, have: money };
  }
  if (req.gpus !== undefined && gpus < req.gpus) {
    return { kind: 'panelLocked', panel: 'gpu' };
  }
  if (req.researchers !== undefined && researchers < req.researchers) {
    return { kind: 'panelLocked', panel: 'researchers' };
  }
  if (req.datacenters !== undefined && datacenters < req.datacenters) {
    return { kind: 'panelLocked', panel: 'datacenter' };
  }

  return null;
}

/** 패널 이름표를 사람이 읽는 한글 이름으로 바꿉니다 */
function panelLabel(panel: PanelId): string {
  switch (panel) {
    case 'funding':
      return s().violations.panel.funding;
    case 'gpu':
      return 'GPU';
    case 'power':
      return s().violations.panel.power;
    case 'datacenter':
      return s().violations.panel.datacenter;
    case 'researchers':
      return s().violations.panel.researchers;
    case 'rivals':
      return s().violations.panel.rivals;
    case 'safety':
      return s().violations.panel.safety;
    default:
      return s().violations.panel.unknown;
  }
}

/**
 * 위반 내용을 화면에 그대로 띄울 수 있는 한글 한 줄로 바꿉니다.
 * 예) '자금이 3,200만 달러 부족합니다'
 */
export function violationMessage(v: LimitViolation): string {
  switch (v.kind) {
    case 'insufficientFunds':
      return s().violations.insufficientFunds(formatMoney(v.needed - v.have));
    case 'gpuCapacityExceeded':
      return s().violations.gpuCapacity(
        formatCount(v.capacity),
        formatCount(v.current,
      ),
        formatCount(v.requested),
      );
    case 'powerShortage':
      return s().violations.powerShortage(formatPower(v.demand), formatPower(v.available,
      ));
    case 'equityExhausted':
      return s().violations.equityExhausted;
    case 'panelLocked':
      return s().violations.panelLocked(panelLabel(v.panel));
    case 'gameNotRunning':
      return s().violations.notRunning;
    default:
      return s().violations.generic;
  }
}
