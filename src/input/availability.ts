/**
 * ===========================================================================
 *  버튼 판정 — "지금 이걸 눌러도 되나? 얼마 드나? 누르면 어떻게 되나?"
 * ===========================================================================
 *
 *  이 게임에는 조준도 이동도 없습니다. 플레이어가 하는 일은 버튼을 누르는 것뿐이고,
 *  재미는 '지금 무엇을 누를 수 있고 무엇을 못 누르는가'에서 나옵니다.
 *  그래서 그 판정을 화면 코드에 흩뿌리지 않고 이 파일 한 곳에 모았습니다.
 *
 *  화면은 이 파일이 돌려주는 네 가지만 보고 버튼을 그리면 됩니다.
 *      enabled : 누를 수 있는가 (false 면 흐리게)
 *      reason  : 못 누르는 이유 한 줄 (그대로 화면에 띄우면 됩니다)
 *      cost    : 누를 때 나가는 돈 (없으면 null)
 *      detail  : 누르면 어떻게 되는지 한 줄
 *
 *  ─ 두 가지 원칙
 *    1) 값과 한계는 전부 constraints 폴더에서 가져옵니다.
 *       여기서 가격을 다시 계산하면, 버튼에 적힌 값과 실제로 빠져나가는 돈이
 *       언젠가 반드시 어긋납니다.
 *    2) 플레이어에게 보이는 글은 전부 쉬운 한국어입니다.
 *       영어 오류 문구나 프로그램 용어는 절대 화면에 내보내지 않습니다.
 */

import { SAFETY, SPEED_OPTIONS, START } from '../balance';
import {
  accidentChancePerSecond,
  burnPerSecond,
  checkAffordable,
  checkGpuPurchase,
  checkRequirement,
  computeDerived,
  datacenterPrice,
  fundingBlock,
  fundingOffer,
  fundingReadyAt,
  fundingRequiredProgress,
  gpuCapacity,
  gpuUnitPrice,
  powerContractUpfront,
  powerCostPerSecond,
  powerDemand,
  researcherMultiplier,
  safetySpeedMultiplier,
  violationMessage,
} from '../constraints';
import type { LimitViolation } from '../constraints';
import type { EventChoice, GameAction, GameState, Money, PanelId, PlayerDelta } from '../types';
import { formatCompact, formatDuration, formatMegawatts, formatMoney, formatPercent } from './format';
import { researcherHireCost } from './limits';
import {
  withDatacenters,
  withGpus,
  withPowerContracted,
  withResearchers,
  withSafety,
} from './simulate';

/** 버튼 하나에 대한 판정 결과 */
export interface ActionAvailability {
  /** 지금 이 버튼을 누를 수 있는가 */
  enabled: boolean;
  /** 못 누르는 이유 (한글). enabled 가 true 면 null */
  reason: string | null;
  /** 이 버튼을 누를 때 드는 돈. 비용이 없으면 null */
  cost: Money | null;
  /** 버튼 밑에 붙일 한 줄 설명 (예: '전력 +5MW · 초당 $4.50K 추가') */
  detail: string | null;
}

/** 누를 수 있다 */
function allow(cost: Money | null, detail: string | null): ActionAvailability {
  return { enabled: true, reason: null, cost, detail };
}

/** 누를 수 없다 (이유를 반드시 한글로 적습니다) */
function block(reason: string, cost: Money | null, detail: string | null): ActionAvailability {
  return { enabled: false, reason, cost, detail };
}

/**
 * 한계에 부딪힌 사실을 버튼 밑에 띄울 한 줄로 바꿉니다.
 *
 * 판정 자체는 전부 constraints 폴더가 하고, 여기서는 문구만 다듬습니다.
 * 돈과 개수는 화면의 다른 곳(버튼에 적힌 가격)과 똑같은 방식으로 적어야
 * 플레이어가 '$120M 짜리를 누르려는데 왜 만 단위로 부족하다고 하지?' 하고
 * 헷갈리지 않습니다. 나머지 경우는 constraints 의 문구를 그대로 씁니다.
 */
function reasonFor(violation: LimitViolation): string {
  switch (violation.kind) {
    case 'insufficientFunds':
      return `자금이 ${formatMoney(violation.needed - violation.have)} 부족합니다`;

    case 'gpuCapacityExceeded': {
      const room = violation.capacity - violation.current;
      const missing = violation.requested - room;
      return `GPU 자리가 ${formatCompact(missing)}장 모자랍니다 (데이터센터를 먼저 지으세요)`;
    }

    default:
      return violationMessage(violation);
  }
}

/**
 * 지금 시간이 멈춰 있다면 그 이유를, 잘 흐르고 있다면 null 을 돌려줍니다.
 *
 * '멈췄는지 아닌지'는 constraints 의 판정을 그대로 따르고,
 * 여기서는 그 상황을 플레이어가 알아들을 말로 바꾸는 일만 합니다.
 * (같은 '멈춤'이라도 사건 창 때문인지 일시정지 때문인지에 따라
 *  플레이어가 해야 할 행동이 다르기 때문입니다)
 */
function stoppedReason(state: GameState): string | null {
  if (computeDerived(state).running) return null;

  if (state.activeEvent !== null) return '먼저 사건 창에서 결정을 내려 주세요';
  if (state.phase === 'title') return '아직 게임을 시작하지 않았습니다';
  if (state.phase === 'ended') return '이미 끝난 판입니다';
  if (state.paused) return '일시정지 중입니다. 재개한 뒤에 눌러 주세요';

  return reasonFor({ kind: 'gameNotRunning' });
}

/**
 * 운영 버튼(투자·구매·건설·채용·안전)을 지금 누를 수 있는지 공통으로 확인합니다.
 * 시간이 흐르고 있어야 하고, 그 영역이 화면에 열려 있어야 합니다.
 */
function operationBlock(state: GameState, panel: PanelId): string | null {
  const stopped = stoppedReason(state);
  if (stopped !== null) return stopped;

  if (!state.unlocks[panel]) return reasonFor({ kind: 'panelLocked', panel });

  return null;
}

/** 늘어나는 값 앞에 + 를 붙입니다 (줄어드는 값은 이미 - 가 붙어 있습니다) */
function withSign(value: number, text: string): string {
  return value >= 0 ? `+${text}` : text;
}

/**
 * 사건 선택지가 내 연구소에 일으키는 변화를 한 줄로 요약합니다.
 * 예) '자금 -$2.00M · GPU +500장'
 */
function describeDelta(delta: PlayerDelta | undefined): string | null {
  if (delta === undefined) return null;

  const parts: string[] = [];

  const money = delta.money;
  if (money !== undefined) parts.push(`자금 ${withSign(money, formatMoney(money))}`);

  const gpus = delta.gpus;
  if (gpus !== undefined) parts.push(`GPU ${withSign(gpus, formatCompact(gpus))}장`);

  const power = delta.powerContracted;
  if (power !== undefined) parts.push(`전력 ${withSign(power, formatMegawatts(power))}`);

  const progress = delta.researchProgress;
  if (progress !== undefined) parts.push(`진행도 ${withSign(progress, formatPercent(progress))}`);

  const datacenters = delta.datacenters;
  if (datacenters !== undefined) {
    parts.push(`데이터센터 ${withSign(datacenters, formatCompact(datacenters))}동`);
  }

  const researchers = delta.researchers;
  if (researchers !== undefined) {
    parts.push(`연구원 ${withSign(researchers, formatCompact(researchers))}명`);
  }

  const equity = delta.equityRetained;
  if (equity !== undefined) parts.push(`지분 ${withSign(equity, formatPercent(equity))}`);

  const safety = delta.safety;
  if (safety !== undefined) parts.push(`안전 ${withSign(safety, formatPercent(safety))}`);

  return parts.length === 0 ? null : parts.join(' · ');
}

/** 사건 선택지를 고를 때 실제로 나가는 돈 (돈이 들어오는 선택지는 비용 없음) */
function choiceCost(choice: EventChoice): Money | null {
  const money = choice.player?.money;
  if (money === undefined || money >= 0) return null;
  return -money;
}

/**
 * 어떤 버튼이든 이 함수 하나로 판정합니다.
 *
 * 규칙:
 *   · 운영 버튼(투자·GPU·전력·데이터센터·연구원·안전)은 시간이 흐르는 중일 때만 눌립니다.
 *     아직 열리지 않은 영역의 버튼도 막습니다.
 *   · 시간·속도·다시하기·시작·사건 선택은 그 제약을 받지 않습니다.
 *     (게임이 멈춘 상태에서도 눌러야 하는 것들이라서 막으면 안 됩니다)
 */
export function availability(state: GameState, action: GameAction): ActionAvailability {
  switch (action.type) {
    // ── 게임 진행 자체를 다루는 것들 (멈춰 있어도 눌러야 합니다) ──────────

    case 'startGame': {
      const typed = action.labName.trim();
      const name = typed === '' ? START.labName : typed;
      const detail = `'${name}' 이름으로 새 판을 시작합니다`;
      if (state.phase === 'playing') return block('이미 게임이 진행 중입니다', null, detail);
      return allow(null, detail);
    }

    case 'tick': {
      // 화면이 실수로 0초나 음수 시간을 보내면 시간이 거꾸로 흐를 수 있어 막습니다
      if (!Number.isFinite(action.deltaSeconds) || action.deltaSeconds <= 0) {
        return block('흐른 시간은 0보다 커야 합니다', null, null);
      }
      return allow(null, null);
    }

    case 'setPaused': {
      const detail = action.paused ? '시간을 잠시 멈춥니다' : '멈췄던 시간을 다시 흐르게 합니다';
      return allow(null, detail);
    }

    case 'setSpeed': {
      if (!SPEED_OPTIONS.includes(action.speed)) {
        return block('고를 수 없는 속도입니다', null, null);
      }
      return allow(null, `${formatCompact(action.speed)}배 속도로 진행합니다`);
    }

    case 'restart':
      return allow(null, '지금 판을 접고 처음부터 다시 시작합니다');

    case 'resolveEvent': {
      const event = state.activeEvent;
      if (event === null) return block('지금은 답해야 할 사건이 없습니다', null, null);

      const index = action.choiceIndex;
      if (!Number.isInteger(index) || index < 0 || index >= event.choices.length) {
        return block('고를 수 없는 선택지입니다', null, null);
      }

      const choice = event.choices[index];
      const cost = choiceCost(choice);
      const detail = choice.hint ?? describeDelta(choice.player);

      // 조건이 적힌 선택지만 막습니다.
      // 돈이 모자란다고 전부 막아버리면 사건 창을 닫을 방법이 사라져
      // 게임이 그대로 멈춰버리기 때문입니다.
      const unmet = choice.requires === undefined ? null : checkRequirement(state, choice.requires);
      if (unmet !== null) return block(reasonFor(unmet), cost, detail);

      return allow(cost, detail);
    }

    // ── 운영 버튼들 (시간이 흐르는 중에만 눌립니다) ───────────────────────

    case 'raiseFunding': {
      const offer = fundingOffer(state);
      const why = fundingBlock(state);

      // 못 받는 이유마다 안내 문구가 다릅니다.
      // 지분 소진은 영영 끝이지만, 시간·성과 부족은 기다리면 열리는 조건이라
      // "얼마나 더 있어야 하는지"를 숫자로 알려줘야 답답하지 않습니다.
      let detail: string;
      if (offer !== null) {
        detail = `자금 +${formatMoney(offer.amount)} · 지분 ${formatPercent(offer.equityCost)} 내줌`;
      } else if (why === 'tooSoon') {
        detail = `다음 라운드까지 ${formatDuration(Math.max(0, fundingReadyAt(state) - state.elapsed))} 남음`;
      } else if (why === 'needProgress') {
        detail = `진행도 ${formatPercent(fundingRequiredProgress(state))} 이상이어야 다음 투자를 받습니다`;
      } else {
        detail = '더 내줄 지분이 남지 않았습니다';
      }

      const blocked = operationBlock(state, 'funding');
      if (blocked !== null) return block(blocked, null, detail);

      // 비활성 버튼에는 사유만 보이므로, 얼마나 더 기다려야 하는지를 사유 안에 넣습니다.
      // (그냥 '아직 안 됩니다' 라고만 하면 플레이어가 언제 다시 눌러야 할지 알 수 없습니다)
      if (why === 'tooSoon') {
        const left = formatDuration(Math.max(0, fundingReadyAt(state) - state.elapsed));
        return block(`투자자들이 아직 다음 라운드를 열지 않았습니다 (${left} 남음)`, null, detail);
      }
      if (why === 'needProgress') {
        const need = formatPercent(fundingRequiredProgress(state));
        return block(`성과가 더 필요합니다 (진행도 ${need} 이상)`, null, detail);
      }
      // 지분을 다 팔았으면 더 이상 투자를 받을 수 없습니다
      if (offer === null) return block(reasonFor({ kind: 'equityExhausted' }), null, detail);

      return allow(null, detail);
    }

    case 'buyGpu': {
      const count = action.count;
      if (!Number.isInteger(count) || count <= 0) {
        return block('GPU는 한 장 이상부터 살 수 있습니다', null, null);
      }

      const unitPrice = gpuUnitPrice(state);
      const cost = unitPrice * count;
      // 산 GPU가 추가로 먹는 전력 (지금 상태에 count 장만 있다고 가정해서 구합니다)
      const addedPower = powerDemand(withGpus(state, count));
      const detail = `장당 ${formatMoney(unitPrice)} · 전력 ${formatMegawatts(addedPower)} 더 필요`;

      const stopped = stoppedReason(state);
      if (stopped !== null) return block(stopped, cost, detail);

      // 자리·자금·해금 여부는 constraints 의 판정을 그대로 씁니다
      const violation = checkGpuPurchase(state, count);
      if (violation !== null) return block(reasonFor(violation), cost, detail);

      return allow(cost, detail);
    }

    case 'contractPower': {
      const megawatts = action.megawatts;
      if (!Number.isFinite(megawatts) || megawatts <= 0) {
        return block('계약할 전력은 0보다 커야 합니다', null, null);
      }

      const cost = powerContractUpfront(state, megawatts);
      // 이만큼만 계약했다고 가정하면 매초 얼마가 더 나가는지가 나옵니다
      const addedBurn = powerCostPerSecond(withPowerContracted(state, megawatts));
      const detail = `전력 +${formatMegawatts(megawatts)} · 초당 ${formatMoney(addedBurn)} 추가`;

      const blocked = operationBlock(state, 'power');
      if (blocked !== null) return block(blocked, cost, detail);

      const short = checkAffordable(state, cost);
      if (short !== null) return block(reasonFor(short), cost, detail);

      return allow(cost, detail);
    }

    case 'buildDatacenter': {
      const cost = datacenterPrice(state);
      const next = withDatacenters(state, state.player.datacenters + 1);
      const addedSlots = gpuCapacity(next) - gpuCapacity(state);
      const addedUpkeep = burnPerSecond(next) - burnPerSecond(state);
      const detail = `GPU 자리 +${formatCompact(addedSlots)}장 · 초당 ${formatMoney(
        addedUpkeep,
      )} 추가`;

      const blocked = operationBlock(state, 'datacenter');
      if (blocked !== null) return block(blocked, cost, detail);

      const short = checkAffordable(state, cost);
      if (short !== null) return block(reasonFor(short), cost, detail);

      return allow(cost, detail);
    }

    case 'hireResearcher': {
      const count = action.count;
      if (!Number.isInteger(count) || count <= 0) {
        return block('연구원은 한 명 이상부터 뽑을 수 있습니다', null, null);
      }

      const price = researcherHireCost(state, count);
      const next = withResearchers(state, state.player.researchers + count);
      const speedGain = researcherMultiplier(next) / researcherMultiplier(state) - 1;
      const addedSalary = burnPerSecond(next) - burnPerSecond(state);
      const detail = `연구 속도 +${formatPercent(speedGain)} · 초당 ${formatMoney(
        addedSalary,
      )} 추가`;

      const blocked = operationBlock(state, 'researchers');
      if (blocked !== null) return block(blocked, price.total, detail);

      // 뽑을수록 몸값이 오르기 때문에 총액 계산을 도중에 접은 경우입니다
      if (!price.exact) return block('자금이 부족합니다', price.total, detail);

      const short = checkAffordable(state, price.total);
      if (short !== null) return block(reasonFor(short), price.total, detail);

      return allow(price.total, detail);
    }

    case 'setSafety': {
      const value = action.value;
      if (!Number.isFinite(value) || value < SAFETY.minLevel || value > 1) {
        return block(
          `안전 수준은 ${formatPercent(SAFETY.minLevel, 0)} ~ ${formatPercent(
            1,
            0,
          )} 사이에서만 정할 수 있습니다`,
          null,
          null,
        );
      }

      const next = withSafety(state, value);
      const speedBonus = safetySpeedMultiplier(next) - 1;
      const risk = accidentChancePerSecond(next);
      const detail = `연구 속도 +${formatPercent(speedBonus)} · 매초 사고 위험 ${formatPercent(
        risk,
        2,
      )}`;

      const blocked = operationBlock(state, 'safety');
      if (blocked !== null) return block(blocked, null, detail);

      return allow(null, detail);
    }

    default:
      // 여기까지 오는 일은 없지만, 알 수 없는 신호가 들어오면 안전하게 막습니다
      return block('지금은 할 수 없습니다', null, null);
  }
}

/**
 * 화면이 보낸 액션을 마지막으로 한 번 더 걸러줍니다.
 *
 * 누를 수 있는 액션이면 그대로 돌려주고, 아니면 null 을 돌려줍니다.
 * 화면에서 버튼을 흐리게 만드는 걸 깜빡했더라도 여기서 막히기 때문에
 * '돈도 없는데 GPU가 늘어나는' 사고가 생기지 않습니다.
 */
export function guard(state: GameState, action: GameAction): GameAction | null {
  return availability(state, action).enabled ? action : null;
}
