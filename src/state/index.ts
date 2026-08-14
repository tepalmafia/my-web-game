/**
 * ===========================================================================
 *  state — 게임의 두뇌 (이 폴더의 정문)
 * ===========================================================================
 *
 *  화면(버튼)은 게임 상태를 직접 고치지 않습니다. 대신 "투자를 유치하겠다" 같은
 *  신호(액션)만 보내고, 그 신호를 받아 다음 상태를 만드는 일을 여기서 합니다.
 *
 *      지금 상태 + 액션  →  reducer  →  새 상태
 *
 *  ★ 지켜야 할 두 가지 규칙
 *
 *    1) 들어온 상태를 절대 고치지 않습니다.
 *       항상 새 객체를 만들어 돌려줍니다. (React 가 화면을 다시 그리는 기준이라
 *       원본을 몰래 고치면 화면이 갱신되지 않는 버그가 생깁니다)
 *
 *    2) 숫자와 계산은 여기서 만들지 않습니다.
 *       모든 숫자는 balance.ts, 모든 계산은 constraints 폴더에서 가져옵니다.
 *       이 파일이 하는 일은 "가져온 값을 더하고 빼서 새 상태를 조립하는 것"뿐입니다.
 *       → 밸런스를 고치고 싶으면 balance.ts 만 보면 됩니다.
 *
 *  ─ 화면에서 쓰는 법
 *      const [state, dispatch] = useReducer(reducer, createInitialState('아우로라 AI', 12345));
 *      dispatch({ type: 'startGame', labName: '내 연구소', rngSeed: 12345 });
 *
 *    createInitialState 가 돌려주는 상태는 '시작 화면(title)' 상태입니다.
 *    startGame 액션을 받아야 비로소 시간이 흐르기 시작합니다.
 */

import {
  EVENTS,
  INTERFERENCE,
  MARKET,
  PHASE2,
  RESEARCH,
  RIVALS,
  RIVAL_CURVE,
  SAFETY,
  SPEED_OPTIONS,
  START,
  UNLOCK,
} from '../balance';
import { rivalName, s } from '../i18n';
import {
  accidentChancePerSecond,
  checkAffordable,
  checkGpuPurchase,
  checkOutcome,
  checkRequirement,
  computeDerived,
  datacenterPrice,
  fundingOffer,
  gpuCapacity,
  gpuUnitPrice,
  intelCost,
  netPerSecond,
  poachCost,
  powerAvailable,
  powerContractUpfront,
  powerDemand,
  researchRate,
  researcherPrice,
  rivalSpeed,
  rivalStatusFor,
  controlChangePerSecond,
  isSelfImproving,
  supplyLockCost,
} from '../constraints';
import { formatCount, formatMoney, formatPower, groupDigits } from '../constraints/format';
import { isRunning } from '../constraints/running';
import type {
  GameAction,
  GameEvent,
  GameOutcome,
  GameState,
  LogEntry,
  LogTone,
  MarketDelta,
  MarketState,
  Megawatts,
  PanelId,
  PlayerDelta,
  PlayerState,
  Ratio,
  Rival,
  RivalDelta,
  RivalId,
  RivalStatus,
  Seconds,
  UnlockState,
} from '../types';
import { eventPool } from './events';
import { nextRandom, pickIndex, randomRange } from './rng';

/**
 * 로그창에 남겨두는 최대 줄 수.
 * 게임 규칙과 상관없는 '화면과 메모리' 문제라 balance.ts 가 아니라 여기에 둡니다.
 * (25분 동안 쌓이는 줄을 전부 들고 있을 이유가 없습니다)
 */
const MAX_LOG_LINES = 60;

/**
 * 반복되는 행동을 한 줄로 합칠 때 쓰는 머리말.
 *
 * GPU 구매와 연구원 채용은 한 판에 수십 번 일어납니다. 할 때마다 한 줄씩 남기면
 * 기록창이 구매 내역으로 도배되어, 정작 놓치면 안 되는 사건과 해금 알림이 밀려납니다.
 * 그래서 이 말로 시작하는 줄은 새로 만들지 않고 기존 줄을 고쳐 씁니다.
 */
const gpuBuyPrefix = () => s().log.buyingGpus;
const hirePrefix = () => s().log.hiring;

/**
 * 같은 머리말의 줄이 이 시간(초) 안에 있으면 '연달아 하는 중'으로 봅니다.
 * GPU를 사고 연구원을 뽑고 다시 GPU를 사는 식으로 번갈아 해도 각각 한 줄로 합쳐집니다.
 */
const COALESCE_WINDOW_SECONDS = 12;

/* ===========================================================================
 *  작은 도구들 — 이 파일 안에서만 씁니다
 * ======================================================================== */

/**
 * 비율 값을 0~1 사이로 가둡니다.
 * 여기서 쓰는 0 과 1 은 밸런스 숫자가 아니라 types.ts 가 정한 비율의 정의
 * (0 = 0%, 1 = 100%) 그 자체입니다.
 */
function clampRatio(value: number): Ratio {
  return Math.max(0, Math.min(1, value));
}

/** 진행도를 0 ~ 목표치 사이로 가둡니다. 목표치는 balance.ts 가 정합니다 */
function clampProgress(value: number): Ratio {
  return Math.max(0, Math.min(RESEARCH.goal, value));
}

/** 안전 수준을 balance.ts 가 허용한 범위 안으로 가둡니다 */
function clampSafety(value: number): Ratio {
  return Math.max(SAFETY.minLevel, Math.min(1, value));
}

/** 0~1 비율을 '90%' 같은 글자로 바꿉니다 (로그에 보여줄 때만 씁니다) */
function percentText(ratio: Ratio): string {
  return `${groupDigits(ratio * 100)}%`;
}

/** 아직 로그창에 넣기 전의 문장 한 줄 */
interface PendingLog {
  text: string;
  tone: LogTone;
}

/**
 * 로그 여러 줄을 한꺼번에 붙인 새 로그 목록을 만듭니다.
 *
 * · 최신 줄이 배열 맨 앞에 옵니다 (화면에서 위가 최신)
 * · 줄 번호(id)는 1씩 올라갑니다
 * · 너무 길어지지 않게 MAX_LOG_LINES 줄까지만 남깁니다
 */
function appendLogs(
  log: LogEntry[],
  nextLogId: number,
  at: Seconds,
  lines: PendingLog[],
): { log: LogEntry[]; nextLogId: number } {
  if (lines.length === 0) return { log, nextLogId };

  let merged = log;
  let id = nextLogId;
  for (const line of lines) {
    merged = [{ id, at, text: line.text, tone: line.tone }, ...merged];
    id += 1;
  }
  return { log: merged.slice(0, MAX_LOG_LINES), nextLogId: id };
}

/**
 * 반복되는 행동을 기록할 때 씁니다.
 *
 * 최근에 같은 머리말의 줄이 있으면 그 줄을 지우고 최신 내용으로 맨 위에 다시 답니다.
 * 없으면 평소처럼 새 줄을 만듭니다. 결과적으로 '연달아 사는 동안'에는 줄이
 * 하나만 남고 그 줄의 숫자가 계속 갱신됩니다.
 */
function appendRepeating(
  state: GameState,
  prefix: string,
  text: string,
  tone: LogTone,
): { log: LogEntry[]; nextLogId: number } {
  const recent = state.log.findIndex(
    (entry) =>
      entry.text.startsWith(prefix) && state.elapsed - entry.at <= COALESCE_WINDOW_SECONDS,
  );

  if (recent === -1) {
    return appendLogs(state.log, state.nextLogId, state.elapsed, [{ text, tone }]);
  }

  const found = state.log[recent]!;
  const without = state.log.filter((_, index) => index !== recent);
  // 줄 번호는 그대로 두고 위치와 내용만 갱신합니다 (화면이 목록을 다시 그리지 않아도 되게)
  return {
    log: [{ ...found, at: state.elapsed, text, tone }, ...without],
    nextLogId: state.nextLogId,
  };
}

/* ===========================================================================
 *  1. 시작 상태 만들기
 * ======================================================================== */

/**
 * 새 게임의 첫 상태를 만듭니다.
 *
 * 모든 시작값은 balance.ts 의 START 에서 가져오고, 경쟁사 3곳은 RIVALS 템플릿에서
 * 그대로 찍어냅니다. 처음에는 '투자 유치'와 'GPU 구매' 두 항목만 열려 있고,
 * 나머지는 조건을 만족할 때마다 하나씩 열립니다.
 *
 * 돌려주는 상태는 아직 '시작 화면(title)'입니다.
 * startGame 액션을 받아야 시간이 흐르기 시작합니다.
 *
 * rngSeed 는 이 판의 주사위 씨앗입니다. 같은 씨앗으로 시작하면 사건 순서까지
 * 똑같은 판이 그대로 재현됩니다.
 */
export function createInitialState(labName: string, rngSeed: number): GameState {
  const trimmed = labName.trim();

  const player: PlayerState = {
    labName: trimmed.length > 0 ? trimmed : s().names.defaultLab,
    money: START.money,
    gpus: START.gpus,
    // 전력 계약과 진행도는 '아직 아무것도 하지 않은 상태'라 0에서 출발합니다
    powerContracted: 0,
    researchProgress: 0,
    datacenters: START.datacenters,
    researchers: START.researchers,
    fundingRound: 0,
    equityRetained: START.equity,
    safety: START.safety,
    // 후반 단계 값들 — 진행도가 PHASE2.startProgress 를 넘기 전까지는 움직이지 않습니다
    control: 1,
    alignmentShare: PHASE2.startAlignmentShare,
  };

  // 경쟁사는 전부 같은 출발선(진행도 0)에서 평소 속도로 시작합니다.
  // momentum 1 은 '아무 보정도 붙어 있지 않다'는 뜻입니다.
  const rivals: Rival[] = RIVALS.map((template) => ({
    id: template.id,
    name: s().names.rivals[template.id] ?? template.id,
    personality: template.personality,
    researchProgress: 0,
    reportedProgress: 0,
    baseSpeed: template.baseSpeed,
    momentum: 1,
    status: 'racing',
  }));

  const unlocks: UnlockState = {
    funding: true,
    gpu: true,
    power: false,
    datacenter: false,
    researchers: false,
    rivals: false,
    safety: false,
  };

  const market: MarketState = {
    gpuPrice: MARKET.normalGpuPrice,
    powerPrice: MARKET.normalPowerPrice,
    distortionRemaining: 0,
  };

  const opening = appendLogs([], 1, 0, [
    {
      text: s().log.opening,
      tone: 'info',
    },
  ]);

  return {
    phase: 'title',
    outcome: null,
    outcomeRivalId: null,
    paused: false,
    activeEvent: null,

    elapsed: 0,
    tick: 0,
    // 배속은 플레이어가 고를 수 있는 첫 번째 값(=기본 속도)으로 시작합니다
    speed: SPEED_OPTIONS[0],

    player,
    rivals,

    unlocks,
    market,
    nextEventIn: EVENTS.firstAt,
    seenEventIds: [],

    log: opening.log,
    nextLogId: opening.nextLogId,
    rngSeed,
  };
}

/* ===========================================================================
 *  2. reducer — 액션 하나를 받아 새 상태를 만듭니다
 * ======================================================================== */

/**
 * 게임의 모든 변화가 지나가는 단 하나의 문입니다.
 *
 * types.ts 에 적힌 12가지 액션을 전부 처리하며,
 * 지금 할 수 없는 일(자금 부족, 아직 안 열린 항목, 일시정지 중 등)이 들어오면
 * 아무 일도 하지 않고 받은 상태를 그대로 돌려줍니다.
 * → 화면 쪽에서 "누를 수 있나"를 미리 확인하지 않아도 게임이 망가지지 않습니다.
 */
export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'startGame':
      return startGame(action.labName, action.rngSeed);
    case 'tick':
      return runTick(state, action.deltaSeconds);
    case 'raiseFunding':
      return raiseFunding(state);
    case 'buyGpu':
      return buyGpu(state, action.count);
    case 'contractPower':
      return contractPower(state, action.megawatts);
    case 'buildDatacenter':
      return buildDatacenter(state);
    case 'hireResearcher':
      return hireResearcher(state, action.count);
    case 'setSafety':
      return setSafety(state, action.value);
    case 'setAlignmentShare':
      return setAlignmentShare(state, action.value);
    case 'buyIntel':
      return buyIntel(state, action.rivalId);
    case 'poachRival':
      return poachRival(state, action.rivalId);
    case 'lockSupply':
      return lockSupply(state);
    case 'resolveEvent':
      return resolveEvent(state, action.choiceIndex);
    case 'setPaused':
      return state.paused === action.paused ? state : { ...state, paused: action.paused };
    case 'setSpeed':
      return setSpeed(state, action.speed);
    case 'restart':
      return restart(state);
    default:
      return state;
  }
}

/* ===========================================================================
 *  3. 시간이 흐른다 — tick
 * ======================================================================== */

/**
 * 0.1초가 흘렀을 때 벌어지는 모든 일을 순서대로 처리합니다.
 *
 *   ① 시간   → ② 연구 진행 → ③ 돈 → ④ 시장 회복 → ⑤ 경쟁사 진행
 *   → ⑥ 사고 판정 → ⑦ 새 항목 해금 → ⑧ 사건 발생 → ⑨ 승패 판정
 *
 * deltaSeconds 에는 배속이 이미 반영되어 들어옵니다.
 * (2배속이면 화면 쪽 타이머가 두 배의 시간을 넣어 보냅니다)
 */
function runTick(state: GameState, deltaSeconds: Seconds): GameState {
  // ⓐ 시간이 흐르지 않는 상황(시작 화면·종료·일시정지·사건 창)이면 아무 일도 없습니다
  if (!isRunning(state)) return state;
  // 0 이하이거나 숫자가 아닌 시간이 들어오면 그냥 무시합니다
  if (!(deltaSeconds > 0)) return state;

  const dt = deltaSeconds;
  const lines: PendingLog[] = [];
  let seed = state.rngSeed;

  // ⓑ 흐른 시간과 계산 횟수
  const elapsed = state.elapsed + dt;
  const tickCount = state.tick + 1;

  // ⓒ 연구 진행 (목표치를 넘지 않게 자릅니다)
  const progress = clampProgress(state.player.researchProgress + researchRate(state) * dt);

  // ⓓ 돈 (수입 − 지출). 마이너스가 되면 아래 ⑨에서 파산으로 판정됩니다
  const money = state.player.money + netPerSecond(state) * dt;

  // ⓓ-2 후반 단계 — 자기개선이 시작됐는가, 통제력은 어떻게 되고 있는가
  //
  //  단계 진입은 '이번 틱에 경계를 넘었는가'로 판단합니다. 따로 저장하지 않아도
  //  직전 진행도와 지금 진행도를 비교하면 정확히 한 번만 알릴 수 있습니다.
  if (!isSelfImproving(state) && progress >= PHASE2.startProgress && progress < RESEARCH.goal) {
    lines.push({
      text: s().log.selfImproving,
      tone: 'warn',
    });
  }

  // 통제력은 '진행도가 이미 갱신된 상태'를 기준으로 계산합니다.
  // 그래야 후반에 막 진입한 틱부터 곧바로 깎이기 시작합니다.
  const advancedPlayer: GameState = {
    ...state,
    player: { ...state.player, researchProgress: progress },
  };
  const control = clampRatio(
    state.player.control + controlChangePerSecond(advancedPlayer) * dt,
  );

  const player: PlayerState = { ...state.player, researchProgress: progress, money, control };

  // ⓔ 흔들린 시장 가격이 평상시로 돌아오는 중
  let market = state.market;
  if (market.distortionRemaining > 0) {
    const remaining = market.distortionRemaining - dt;
    if (remaining <= 0) {
      market = {
        gpuPrice: MARKET.normalGpuPrice,
        powerPrice: MARKET.normalPowerPrice,
        distortionRemaining: 0,
      };
      lines.push({ text: s().log.marketNormal, tone: 'info' });
    } else {
      market = { ...market, distortionRemaining: remaining };
    }
  }

  // ⓕ 경쟁사들의 한 걸음
  const rivals: Rival[] = [];
  // 이번 걸음에 사고로 빠진 곳이 있으면 그 id 를 적어둡니다 (아래에서 남은 곳들이 흡수)
  let absorbedFrom: RivalId | null = null;
  for (const rival of state.rivals) {
    // 이미 탈락했거나 달성한 곳은 더 이상 움직이지 않습니다
    if (rival.status === 'collapsed' || rival.status === 'achieved') {
      rivals.push(rival);
      continue;
    }

    // 사고 확률과 추정치 오차는 경쟁사마다 다르며 balance.ts 의 템플릿에 적혀 있습니다
    const template = RIVALS.find((item) => item.id === rival.id);
    const accidentPerSecond = template === undefined ? 0 : template.accidentPerSecond;
    const reportNoise = template === undefined ? 0 : template.reportNoise;

    const advanced = clampProgress(rival.researchProgress + rivalSpeed(state, rival) * dt);
    // 아래에서 '탈락'이나 '달성'으로 바뀔 수 있으므로 상태의 종류를 넓게 열어둡니다
    let status: RivalStatus = rival.status;

    // 속도형 경쟁사는 스스로 사고를 내고 경주에서 빠질 수 있습니다
    if (accidentPerSecond > 0) {
      const roll = nextRandom(seed);
      seed = roll.seed;
      if (roll.value < accidentPerSecond * dt) {
        status = 'collapsed';
        // 사라진 연구소의 사람과 설비는 업계에서 증발하지 않습니다 —
        // 남은 곳들이 데려갑니다. 이게 없으면 가장 위협적인 상대가 내가
        // 아무것도 안 했는데 공짜로 없어져서 그 판이 그 자리에서 시시해집니다.
        absorbedFrom = rival.id;
        lines.push({
          text: s().log.rivalCollapsed(rivalName(rival)),
          tone: 'warn',
        });
      }
    }

    // 사고 없이 목표에 닿았다면 달성 상태가 됩니다 (승패는 아래 ⑨에서 확정)
    if (status !== 'collapsed' && advanced >= RESEARCH.goal) {
      status = 'achieved';
    }

    // 상황판에 보이는 값은 '추정치'라 진짜 값 주변에서 조금 흔들립니다
    const shake = randomRange(seed, -reportNoise, reportNoise);
    seed = shake.seed;

    // 붙어 있던 감속·가속은 시간이 지나면 평상시(1)로 돌아옵니다.
    // 이게 없으면 인재를 한 번 빼온 것만으로 그 경쟁사가 끝까지 절름발이가 되고,
    // 반대로 사건 한 번에 영영 못 따라잡게 되기도 합니다.
    const recovery = RIVAL_CURVE.momentumRecoveryPerSecond * dt;
    const momentum = rival.momentum + (1 - rival.momentum) * Math.min(1, recovery);

    const stepped: Rival = {
      ...rival,
      researchProgress: advanced,
      reportedProgress: clampRatio(advanced + shake.value),
      momentum,
      status,
    };

    // 정체·스퍼트 표시는 저장해둔 값이 아니라 지금의 속도 배수에서 끌어냅니다.
    // 그래야 감속이 풀릴 때 표시도 저절로 '평소'로 돌아옵니다.
    rivals.push({ ...stepped, status: rivalStatusFor(stepped) });
  }

  // ⓕ-2 사고로 빠진 연구소가 있으면 남은 곳들이 그 사람과 설비를 데려갑니다.
  // 그냥 사라지기만 하면 가장 위협적인 상대가 공짜로 없어져서 판이 시시해집니다.
  if (absorbedFrom !== null) {
    for (let i = 0; i < rivals.length; i++) {
      const item = rivals[i]!;
      if (item.id === absorbedFrom) continue;
      if (item.status === 'collapsed' || item.status === 'achieved') continue;
      rivals[i] = { ...item, baseSpeed: item.baseSpeed * RIVAL_CURVE.absorbOnCollapse };
    }
    lines.push({ text: s().log.rivalAbsorbed, tone: 'warn' });
  }

  // ⓖ 내 연구소의 사고 판정 — 안전을 낮춰둔 만큼 확률이 올라갑니다
  const accidentChance = accidentChancePerSecond(state);
  if (accidentChance > 0) {
    const roll = nextRandom(seed);
    seed = roll.seed;
    if (roll.value < accidentChance * dt) {
      lines.push({
        text: s().log.accident,
        tone: 'bad',
      });
      const logged = appendLogs(state.log, state.nextLogId, elapsed, lines);
      return {
        ...state,
        phase: 'ended',
        outcome: 'catastrophe',
        outcomeRivalId: null,
        elapsed,
        tick: tickCount,
        player,
        rivals,
        market,
        log: logged.log,
        nextLogId: logged.nextLogId,
        rngSeed: seed,
      };
    }
  }

  // ⓗ 새로 열리는 항목이 있는지 확인 (한 번 열린 항목은 다시 닫지 않습니다)
  const probe: GameState = { ...state, elapsed, tick: tickCount, player, rivals, market };
  let unlocks = state.unlocks;
  for (const rule of unlockRules(probe)) {
    if (unlocks[rule.panel]) continue;
    if (!rule.met) continue;
    unlocks = { ...unlocks, [rule.panel]: true };
    lines.push({ text: rule.text, tone: rule.tone });
  }

  // ⓘ 다음 사건이 터질 때가 되었는지
  let nextEventIn = state.nextEventIn - dt;
  let activeEvent: GameEvent | null = state.activeEvent;
  let seenEventIds = state.seenEventIds;

  if (nextEventIn <= 0) {
    // 지금 시각에 나올 수 있고, 한 번뿐인 사건이면 아직 안 나온 것만 고릅니다
    const candidates: GameEvent[] = eventPool().filter(
      (candidate: GameEvent) =>
        candidate.earliestAt <= elapsed &&
        !(candidate.once && seenEventIds.includes(candidate.id)),
    );

    // 고를 사건이 있든 없든 다음 사건까지의 시간은 다시 정합니다
    const gap = randomRange(seed, EVENTS.minGap, EVENTS.maxGap);
    seed = gap.seed;
    nextEventIn = gap.value;

    if (candidates.length > 0) {
      const picked = pickIndex(seed, candidates.length);
      seed = picked.seed;
      if (picked.index >= 0) {
        const chosen = candidates[picked.index];
        activeEvent = chosen;
        seenEventIds = seenEventIds.includes(chosen.id)
          ? seenEventIds
          : [...seenEventIds, chosen.id];
        lines.push({ text: s().log.eventFired(chosen.title), tone: 'warn' });
      }
    }
  }

  // ⓙ 승패 판정
  const advancedState: GameState = {
    ...state,
    elapsed,
    tick: tickCount,
    player,
    rivals,
    unlocks,
    market,
    nextEventIn,
    activeEvent,
    seenEventIds,
    rngSeed: seed,
  };

  const result = checkOutcome(advancedState);
  if (result === null) {
    const logged = appendLogs(state.log, state.nextLogId, elapsed, lines);
    return { ...advancedState, log: logged.log, nextLogId: logged.nextLogId };
  }

  // 게임이 끝났다면 사건 창은 띄우지 않고 결과 화면으로 넘어갑니다
  lines.push(outcomeLine(advancedState, result.outcome, result.rivalId));
  const logged = appendLogs(state.log, state.nextLogId, elapsed, lines);
  return {
    ...advancedState,
    phase: 'ended',
    outcome: result.outcome,
    outcomeRivalId: result.rivalId,
    activeEvent: null,
    log: logged.log,
    nextLogId: logged.nextLogId,
  };
}

/** 해금 규칙 하나 (어떤 항목이, 언제 열리고, 그때 뭐라고 알릴지) */
interface UnlockRule {
  panel: PanelId;
  met: boolean;
  text: string;
  tone: LogTone;
}

/**
 * balance.ts 의 UNLOCK 조건을 지금 상태에 대입해 "열릴 때가 되었는가"를 확인합니다.
 * 조건 자체(진행도 몇 %, 전력이 모자란 순간 등)는 전부 balance.ts 가 정하고,
 * 여기서는 그 조건을 읽어 판단만 합니다.
 */
function unlockRules(state: GameState): UnlockRule[] {
  const progress = state.player.researchProgress;

  return [
    {
      // UNLOCK.power: 필요한 전력이 쓸 수 있는 전력을 넘어선 순간 (= GPU가 놀기 시작할 때)
      panel: 'power',
      met: powerDemand(state) > powerAvailable(state),
      text: s().log.unlockPower,
      tone: 'warn',
    },
    {
      // UNLOCK.datacenter: 보유 GPU가 수용 한도에 닿는 순간
      panel: 'datacenter',
      met: state.player.gpus >= gpuCapacity(state),
      text: s().log.unlockDatacenter,
      tone: 'warn',
    },
    {
      panel: 'researchers',
      met: progress >= UNLOCK.researchers.value,
      text: s().log.unlockResearchers,
      tone: 'info',
    },
    {
      panel: 'rivals',
      met: progress >= UNLOCK.rivals.value,
      text: s().log.unlockRivals,
      tone: 'info',
    },
    {
      panel: 'safety',
      met: progress >= UNLOCK.safety.value,
      text: s().log.unlockSafety,
      tone: 'warn',
    },
  ];
}

/** 게임이 끝난 이유를 로그 한 줄로 만듭니다 */
function outcomeLine(state: GameState, outcome: GameOutcome, rivalId: RivalId | null): PendingLog {
  switch (outcome) {
    case 'agiAchieved':
      return {
        text: s().log.playerWon(state.player.labName),
        tone: 'good',
      };
    case 'rivalWon': {
      const winner = state.rivals.find((rival) => rival.id === rivalId);
      const name = winner === undefined ? s().log.fallbackRivalName : winner.name;
      return { text: s().log.rivalWon(name), tone: 'bad' };
    }
    case 'bankrupt':
      return { text: s().log.bankrupt, tone: 'bad' };
    case 'catastrophe':
      return { text: s().log.catastrophe, tone: 'bad' };
    default:
      return { text: s().log.ended, tone: 'info' };
  }
}

/* ===========================================================================
 *  4. 버튼 하나하나가 하는 일
 * ======================================================================== */

/** 시작 화면에서 연구소 이름을 정하고 게임에 들어갑니다 */
function startGame(labName: string, rngSeed: number): GameState {
  const fresh = createInitialState(labName, rngSeed);
  const logged = appendLogs(fresh.log, fresh.nextLogId, 0, [
    { text: s().log.started(fresh.player.labName), tone: 'good' },
  ]);
  return { ...fresh, phase: 'playing', log: logged.log, nextLogId: logged.nextLogId };
}

/**
 * 투자 유치.
 * 이번 라운드에 들어오는 금액과 내주는 지분은 constraints 의 fundingOffer 가 정합니다.
 * 팔 지분이 남지 않았으면(fundingOffer 가 null) 아무 일도 하지 않습니다.
 */
function raiseFunding(state: GameState): GameState {
  if (!isRunning(state)) return state;
  if (!state.unlocks.funding) return state;

  const offer = fundingOffer(state);
  if (offer === null) return state;

  const round = state.player.fundingRound + 1;
  const player: PlayerState = {
    ...state.player,
    money: state.player.money + offer.amount,
    equityRetained: clampRatio(state.player.equityRetained - offer.equityCost),
    fundingRound: round,
  };

  const logged = appendLogs(state.log, state.nextLogId, state.elapsed, [
    {
      text: s().log.funding(round, formatMoney(offer.amount), percentText(player.equityRetained)),
      tone: 'good',
    },
  ]);

  return { ...state, player, log: logged.log, nextLogId: logged.nextLogId };
}

/**
 * GPU 구매.
 * 살 수 있는지(진행 중인가·자리가 있는가·돈이 되는가)는 checkGpuPurchase 가 판단합니다.
 * 전력이 모자라도 사는 것 자체는 막지 않습니다 — 대신 산 GPU 일부가 놀게 됩니다.
 */
function buyGpu(state: GameState, count: number): GameState {
  const wanted = Math.floor(count);
  if (wanted <= 0) return state;
  if (checkGpuPurchase(state, wanted) !== null) return state;

  const cost = gpuUnitPrice(state) * wanted;
  const player: PlayerState = {
    ...state.player,
    money: state.player.money - cost,
    gpus: state.player.gpus + wanted,
  };

  const logged = appendRepeating(
    state,
    gpuBuyPrefix(),
    s().log.buyingGpusLine(formatCount(player.gpus)),
    'info',
  );

  return { ...state, player, log: logged.log, nextLogId: logged.nextLogId };
}

/**
 * 전력 계약.
 * 계약할 때 한 번 내는 설치비는 powerContractUpfront 가 계산합니다.
 * 계약한 뒤에는 실제로 쓰든 안 쓰든 매초 요금이 나갑니다(그 계산은 constraints 담당).
 */
function contractPower(state: GameState, megawatts: Megawatts): GameState {
  if (!isRunning(state)) return state;
  if (!state.unlocks.power) return state;
  if (!(megawatts > 0)) return state;

  const cost = powerContractUpfront(state, megawatts);
  if (checkAffordable(state, cost) !== null) return state;

  const player: PlayerState = {
    ...state.player,
    money: state.player.money - cost,
    powerContracted: state.player.powerContracted + megawatts,
  };

  const logged = appendLogs(state.log, state.nextLogId, state.elapsed, [
    {
      text: s().log.powerContracted(formatPower(megawatts), formatMoney(cost)),
      tone: 'info',
    },
  ]);

  return { ...state, player, log: logged.log, nextLogId: logged.nextLogId };
}

/** 데이터센터 한 동을 짓습니다. 건설비는 지을수록 비싸집니다(datacenterPrice 가 계산) */
function buildDatacenter(state: GameState): GameState {
  if (!isRunning(state)) return state;
  if (!state.unlocks.datacenter) return state;

  const price = datacenterPrice(state);
  if (checkAffordable(state, price) !== null) return state;

  const player: PlayerState = {
    ...state.player,
    money: state.player.money - price,
    datacenters: state.player.datacenters + 1,
  };
  const after: GameState = { ...state, player };

  const logged = appendLogs(state.log, state.nextLogId, state.elapsed, [
    {
      text: s().log.datacenterBuilt(
        formatCount(player.datacenters),
        formatMoney(price,),
        formatCount(gpuCapacity(after)),
      ),
      tone: 'good',
    },
  ]);

  return { ...after, log: logged.log, nextLogId: logged.nextLogId };
}

/**
 * 연구원 채용.
 *
 * 한 명 뽑을 때마다 다음 사람의 몸값이 올라가기 때문에(researcherPrice),
 * 여러 명을 한 번에 뽑을 때는 한 명씩 값을 다시 계산해서 더합니다.
 * 도중에 돈이 모자라면 거기까지만 뽑고 멈춥니다.
 */
function hireResearcher(state: GameState, count: number): GameState {
  if (!isRunning(state)) return state;
  if (!state.unlocks.researchers) return state;

  const wanted = Math.floor(count);
  if (wanted <= 0) return state;

  let money = state.player.money;
  let researchers = state.player.researchers;
  let hired = 0;

  for (let i = 0; i < wanted; i += 1) {
    const probe: GameState = { ...state, player: { ...state.player, money, researchers } };
    const price = researcherPrice(probe);
    if (checkAffordable(probe, price) !== null) break;

    money -= price;
    researchers += 1;
    hired += 1;
  }

  // 한 명도 못 뽑았으면 아무 일도 없었던 것으로 합니다
  if (hired === 0) return state;

  const player: PlayerState = { ...state.player, money, researchers };

  const logged = appendRepeating(
    state,
    hirePrefix(),
    s().log.hiringLine(formatCount(researchers)),
    'good',
  );

  return { ...state, player, log: logged.log, nextLogId: logged.nextLogId };
}

/* ===========================================================================
 *  경쟁사 대응
 *  ---------------------------------------------------------------------------
 *  전부 "내 걸 키울까, 상대를 늦출까"를 묻는 행동입니다.
 *  쓴 돈은 내 설비로 돌아오지 않으므로, 늦추는 값어치가 그만큼 있어야 합니다.
 * ======================================================================== */

/** 지금 손댈 수 있는 경쟁사인지 (이미 탈락했거나 달성한 곳은 의미가 없습니다) */
function targetableRival(state: GameState, rivalId: RivalId): Rival | null {
  const rival = state.rivals.find((item) => item.id === rivalId);
  if (rival === undefined) return null;
  if (rival.status === 'collapsed' || rival.status === 'achieved') return null;
  return rival;
}

/**
 * 첩보 매입 — 그 경쟁사의 '진짜' 진행도를 알아냅니다.
 *
 * 상황판 숫자는 바깥에서 추정한 값이라 실제와 다를 수 있습니다.
 * 이걸 사면 그 순간의 진짜 값을 기록에 남기고 상황판도 정확한 값으로 맞춥니다.
 * 다만 다음 순간부터 다시 추정 오차가 붙기 시작합니다 — 정보는 시간이 지나면 낡습니다.
 */
function buyIntel(state: GameState, rivalId: RivalId): GameState {
  if (!isRunning(state)) return state;
  if (!state.unlocks.rivals) return state;

  const rival = targetableRival(state, rivalId);
  if (rival === null) return state;

  const cost = intelCost(state);
  if (checkAffordable(state, cost) !== null) return state;

  const rivals = state.rivals.map((item) =>
    item.id === rivalId ? { ...item, reportedProgress: item.researchProgress } : item,
  );

  const logged = appendLogs(state.log, state.nextLogId, state.elapsed, [
    {
      text: s().log.intel(rival.name, percentText(rival.researchProgress)),
      tone: 'info',
    },
  ]);

  return {
    ...state,
    player: { ...state.player, money: state.player.money - cost },
    rivals,
    log: logged.log,
    nextLogId: logged.nextLogId,
  };
}

/**
 * 인재 빼오기 — 상대의 핵심 인력을 데려옵니다.
 *
 * 상대는 느려지고 나는 연구원을 얻습니다. 이 게임에서 유일하게
 * '한 번의 지출로 양쪽 격차를 동시에 벌리는' 수단이라 값이 비쌉니다.
 * 비용은 지금 내 연구원 수에 연동되어 쓸수록 저절로 비싸집니다.
 */
function poachRival(state: GameState, rivalId: RivalId): GameState {
  if (!isRunning(state)) return state;
  if (!state.unlocks.rivals) return state;

  const rival = targetableRival(state, rivalId);
  if (rival === null) return state;

  // 아직 지난번 타격에서 못 벗어난 곳에서는 더 데려올 사람이 없습니다.
  // (화면의 버튼 판정과 같은 규칙 — 여기서도 막아야 신호를 직접 보내도 통하지 않습니다)
  if (rival.momentum < RIVAL_CURVE.stalledBelowMomentum) return state;

  const cost = poachCost(state);
  if (checkAffordable(state, cost) !== null) return state;

  // 데려온 사람 몫은 상대의 기본 속도에서 영구히 빠집니다.
  // 원래 속도는 balance.ts 의 표에 남아 있으므로, 바닥선은 거기서 계산합니다.
  const original = RIVALS.find((template) => template.id === rivalId)?.baseSpeed ?? rival.baseSpeed;
  const floor = original * INTERFERENCE.poachSpeedFloor;

  const rivals = state.rivals.map((item) =>
    item.id === rivalId
      ? {
          ...item,
          momentum: item.momentum * INTERFERENCE.poachSlowdown,
          baseSpeed: Math.max(floor, item.baseSpeed * INTERFERENCE.poachPermanentCut),
        }
      : item,
  );

  const player: PlayerState = {
    ...state.player,
    money: state.player.money - cost,
    researchers: state.player.researchers + INTERFERENCE.poachResearchers,
  };

  const logged = appendLogs(state.log, state.nextLogId, state.elapsed, [
    {
      text: s().log.poached(
        rivalName(rival),
        formatCount(INTERFERENCE.poachResearchers),
        formatMoney(cost),
        `${Math.round((1 - INTERFERENCE.poachPermanentCut) * 100)}%`,
      ),
      tone: 'good',
    },
  ]);

  return { ...state, player, rivals, log: logged.log, nextLogId: logged.nextLogId };
}

/**
 * 공급 물량 선점 — GPU를 사재기해 경쟁사 전체를 늦춥니다.
 *
 * 대신 시장이 과열되어 내가 사는 GPU 값도 한동안 오릅니다.
 * "상대를 늦추는 대가로 내 확장이 비싸진다" — 이 게임에서 가장 분명한 맞교환입니다.
 */
function lockSupply(state: GameState): GameState {
  if (!isRunning(state)) return state;
  if (!state.unlocks.rivals) return state;

  const cost = supplyLockCost(state);
  if (checkAffordable(state, cost) !== null) return state;

  const rivals = state.rivals.map((item) =>
    item.status === 'collapsed' || item.status === 'achieved'
      ? item
      : { ...item, momentum: item.momentum * INTERFERENCE.supplyLockSlowdown },
  );

  const market: MarketState = {
    ...state.market,
    gpuPrice: INTERFERENCE.supplyLockGpuPrice,
    distortionRemaining: INTERFERENCE.supplyLockSeconds,
  };

  const logged = appendLogs(state.log, state.nextLogId, state.elapsed, [
    {
      text: s().log.supplyLocked,
      tone: 'warn',
    },
  ]);

  return {
    ...state,
    player: { ...state.player, money: state.player.money - cost },
    rivals,
    market,
    log: logged.log,
    nextLogId: logged.nextLogId,
  };
}

/**
 * 자율 연구력 배분 조절 (0 = 전부 가속, 1 = 전부 정렬).
 *
 * 후반 단계에 들어가기 전에는 아무 의미가 없어서 막습니다.
 * 값 자체는 그냥 저장할 뿐이고, 이 값이 속도와 통제력에 어떻게 작용하는지는
 * 전부 constraints 가 계산합니다.
 */
function setAlignmentShare(state: GameState, value: number): GameState {
  if (!isRunning(state)) return state;
  if (!isSelfImproving(state)) return state;
  if (!Number.isFinite(value)) return state;

  const next = clampRatio(value);
  if (next === state.player.alignmentShare) return state;

  return { ...state, player: { ...state.player, alignmentShare: next } };
}

/**
 * 안전 검증 수준 조절.
 * 낮출수록 훈련이 빨라지지만 사고 확률이 함께 올라갑니다.
 * (얼마나 빨라지고 얼마나 위험해지는지는 전부 constraints 가 계산합니다)
 */
function setSafety(state: GameState, value: Ratio): GameState {
  if (!isRunning(state)) return state;
  if (!state.unlocks.safety) return state;

  const level = clampSafety(value);
  if (level === state.player.safety) return state;

  const lowered = level < state.player.safety;
  const player: PlayerState = { ...state.player, safety: level };

  const logged = appendLogs(state.log, state.nextLogId, state.elapsed, [
    {
      text: lowered
        ? s().log.safetyDown(percentText(level))
        : s().log.safetyUp(percentText(level)),
      tone: lowered ? 'warn' : 'info',
    },
  ]);

  return { ...state, player, log: logged.log, nextLogId: logged.nextLogId };
}

/** 게임 배속 변경. balance.ts 의 SPEED_OPTIONS 에 있는 값만 받아들입니다 */
function setSpeed(state: GameState, speed: number): GameState {
  if (!SPEED_OPTIONS.includes(speed)) return state;
  if (state.speed === speed) return state;
  return { ...state, speed };
}

/**
 * 처음부터 다시 하기.
 * 같은 씨앗으로 다시 시작하면 사건 순서까지 똑같은 판이 반복되므로
 * 씨앗을 한 칸 굴려서 새로운 판을 만듭니다. (연구소 이름은 그대로 물려받습니다)
 */
function restart(state: GameState): GameState {
  const rolled = nextRandom(state.rngSeed);
  return createInitialState(state.player.labName, rolled.seed);
}

/* ===========================================================================
 *  5. 사건 선택지 처리
 * ======================================================================== */

/**
 * 사건 창에서 버튼 하나를 눌렀을 때.
 *
 * 그 선택지에 적힌 변화(내 연구소 / 시장 / 경쟁사)를 그대로 적용하고,
 * 정해진 문장을 로그에 남긴 뒤 사건 창을 닫습니다.
 * 조건(requires)을 만족하지 못하는 선택지는 아무 일도 하지 않습니다.
 */
function resolveEvent(state: GameState, choiceIndex: number): GameState {
  const event = state.activeEvent;
  if (event === null) return state;
  if (choiceIndex < 0 || choiceIndex >= event.choices.length) return state;

  const choice = event.choices[choiceIndex];
  if (choice.requires !== undefined && checkRequirement(state, choice.requires) !== null) {
    return state;
  }

  let seed = state.rngSeed;

  const player =
    choice.player === undefined ? state.player : applyPlayerDelta(state, choice.player);
  const market =
    choice.market === undefined ? state.market : applyMarketDelta(state.market, choice.market);

  let rivals = state.rivals;
  if (choice.rivals !== undefined) {
    const applied = applyRivalDelta(state, choice.rivals, seed);
    rivals = applied.rivals;
    seed = applied.seed;
  }

  const logged = appendLogs(state.log, state.nextLogId, state.elapsed, [
    { text: choice.logText, tone: choice.logTone },
  ]);

  return {
    ...state,
    activeEvent: null,
    player,
    market,
    rivals,
    rngSeed: seed,
    log: logged.log,
    nextLogId: logged.nextLogId,
  };
}

/**
 * 선택지에 적힌 '내 연구소의 변화'를 적용합니다.
 *
 * 전부 증감(더하기·빼기)이며, 적히지 않은 항목은 건드리지 않습니다.
 * 말이 안 되는 값이 되지 않도록 한계선 안으로 가둡니다.
 * (자리보다 많은 GPU, 마이너스 인원, 100%를 넘는 지분 등)
 */
function applyPlayerDelta(state: GameState, delta: PlayerDelta): PlayerState {
  const before = state.player;

  // 데이터센터를 먼저 반영해야 GPU 자리 한도를 제대로 계산할 수 있습니다
  const datacenters = Math.max(0, Math.floor(before.datacenters + (delta.datacenters ?? 0)));
  const capacityProbe: GameState = { ...state, player: { ...before, datacenters } };

  return {
    ...before,
    money: before.money + (delta.money ?? 0),
    gpus: Math.max(
      0,
      Math.min(gpuCapacity(capacityProbe), Math.floor(before.gpus + (delta.gpus ?? 0))),
    ),
    powerContracted: Math.max(0, before.powerContracted + (delta.powerContracted ?? 0)),
    researchProgress: clampProgress(before.researchProgress + (delta.researchProgress ?? 0)),
    datacenters,
    researchers: Math.max(0, Math.floor(before.researchers + (delta.researchers ?? 0))),
    equityRetained: clampRatio(before.equityRetained + (delta.equityRetained ?? 0)),
    safety: clampSafety(before.safety + (delta.safety ?? 0)),
  };
}

/**
 * 선택지에 적힌 '시장의 변화'를 적용합니다.
 * 가격 배수는 적힌 값으로 바뀌고, durationSeconds 만큼 지나면
 * tick 에서 자동으로 평상시 값으로 되돌아옵니다.
 */
function applyMarketDelta(market: MarketState, delta: MarketDelta): MarketState {
  return {
    gpuPrice: delta.gpuPrice ?? market.gpuPrice,
    powerPrice: delta.powerPrice ?? market.powerPrice,
    distortionRemaining: delta.durationSeconds ?? market.distortionRemaining,
  };
}

/**
 * 선택지에 적힌 '경쟁사의 변화'를 적용합니다.
 *
 * 누구에게 적용할지는 세 가지입니다.
 *   all    → 아직 달리고 있는 모든 경쟁사
 *   leader → 지금 가장 앞선 한 곳 (누가 1등인지는 constraints 가 계산)
 *   random → 무작위 한 곳 (반드시 씨앗 난수를 써서 판이 재현되게 합니다)
 *
 * 이미 탈락했거나 AGI에 도달한 곳은 영향을 받지 않습니다.
 */
function applyRivalDelta(
  state: GameState,
  delta: RivalDelta,
  seed: number,
): { rivals: Rival[]; seed: number } {
  const eligible = state.rivals.filter(
    (rival) => rival.status !== 'collapsed' && rival.status !== 'achieved',
  );
  if (eligible.length === 0) return { rivals: state.rivals, seed };

  let nextSeed = seed;
  let targets: RivalId[] = [];

  switch (delta.target) {
    case 'all':
      targets = eligible.map((rival) => rival.id);
      break;
    case 'leader': {
      const leader = computeDerived(state).leadingRival;
      targets = leader === null ? [] : [leader.id];
      break;
    }
    case 'random': {
      const picked = pickIndex(nextSeed, eligible.length);
      nextSeed = picked.seed;
      if (picked.index >= 0) targets = [eligible[picked.index].id];
      break;
    }
    default:
      targets = [];
      break;
  }

  const rivals = state.rivals.map((rival) =>
    targets.includes(rival.id) ? applyOneRivalDelta(rival, delta) : rival,
  );

  return { rivals, seed: nextSeed };
}

/** 경쟁사 한 곳에 변화를 적용합니다 (위 applyRivalDelta 의 부품) */
function applyOneRivalDelta(rival: Rival, delta: RivalDelta): Rival {
  const shift = delta.researchProgress ?? 0;
  return {
    ...rival,
    momentum: delta.momentum ?? rival.momentum,
    researchProgress: clampProgress(rival.researchProgress + shift),
    // 상황판에 보이는 추정치도 함께 움직여야 화면이 어긋나 보이지 않습니다
    reportedProgress: clampRatio(rival.reportedProgress + shift),
    status: delta.status ?? rival.status,
  };
}

/* ===========================================================================
 *  6. 다른 폴더에서 바로 쓰라고 같이 내보내는 것들
 * ======================================================================== */

export { eventPool } from './events';
export { nextRandom, pickIndex, randomRange } from './rng';
