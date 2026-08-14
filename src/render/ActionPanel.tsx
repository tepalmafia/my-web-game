/**
 * ===========================================================================
 *  조작 패널 — 플레이어가 실제로 누르는 것들
 * ===========================================================================
 *
 *  이 게임의 조작은 버튼 누르기가 전부입니다. 그래서 이 파일이 화면의 심장입니다.
 *
 *  ─ 이 파일에 들어 있는 것
 *      · Panel        : 모든 패널이 공통으로 쓰는 껍데기 (제목·설명·NEW 표시)
 *      · ActionButton : 모든 버튼이 공통으로 쓰는 모양 (이름·금액·비활성 처리)
 *      · 패널 6종     : 투자 유치 / GPU 구매 / 전력 계약 / 데이터센터 / 연구원 / 안전
 *
 *  ─ 이 파일이 절대 하지 않는 것
 *      "지금 이 버튼을 누를 수 있는가", "누르면 얼마가 나가는가" 를 스스로 판단하는 일.
 *      그 판단은 전부 input 폴더의 availability() 가 합니다. 화면은 그 결과
 *      네 가지(enabled·reason·cost·detail)를 그대로 그리기만 합니다.
 *      → 덕분에 버튼에 적힌 금액과 실제로 빠져나가는 금액이 어긋날 수 없습니다.
 */

import type { Dispatch, ReactNode } from 'react';
import { GPU, SAFETY } from '../balance';
import { computeDerived, powerAvailable, powerDemand, researcherMultiplier } from '../constraints';
import { s } from '../i18n';
import {
  availability,
  formatCompact,
  formatMoney,
  formatPercent,
  gpuBuyOptions,
  guard,
  maxBuyReserve,
  powerContractOptions,
} from '../input';
import type { ActionAvailability } from '../input';
// 전력(MW) 표기는 input 폴더가 버튼 설명문을 만들 때 쓰는 것과 같은 함수를 씁니다.
// 여기서 따로 만들면 버튼에 적힌 '+5MW' 와 상단 표시가 언젠가 어긋나기 때문입니다.
import { formatMegawatts } from '../input/format';
import type { GameAction, GameState } from '../types';

/**
 * 연구원을 한 번에 몇 명씩 뽑을지 (화면 편의용 묶음 단위).
 *
 * GPU·전력과 달리 balance.ts 에 연구원용 묶음 단위 항목이 없어서 화면 쪽에 두었습니다.
 * 게임 난이도와는 아무 상관이 없습니다 — '5명' 버튼은 '1명' 버튼을 다섯 번 누르는 것과
 * 결과가 완전히 같습니다(몸값이 오르는 계산까지 input 폴더가 그대로 해줍니다).
 */
const RESEARCHER_HIRE_STEPS = [1, 5];

/**
 * 안전 슬라이더를 몇 칸 단위로 움직일지.
 * 밸런스가 아니라 '손가락으로 조절하기 편한 정도'의 문제라 화면 쪽에 둡니다.
 */
const SAFETY_SLIDER_STEP = 0.05;

/** 패널 하나가 공통으로 받는 정보 */
export interface PanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  /** 방금 열린 패널인가 (NEW 표시를 띄울지) */
  isNew: boolean;
}

/**
 * 버튼이 보낸 신호를 게임에 전달하는 통로를 만듭니다.
 *
 * 그냥 dispatch 를 쓰지 않고 input 폴더의 guard 를 한 번 통과시키는 이유:
 * 화면에서 버튼을 흐리게 만드는 걸 실수로 빠뜨렸더라도 여기서 막히기 때문에
 * '돈도 없는데 GPU가 늘어나는' 사고가 생기지 않습니다.
 */
export function guarded(
  state: GameState,
  dispatch: Dispatch<GameAction>,
): (action: GameAction) => void {
  return (action: GameAction) => {
    const allowed = guard(state, action);
    if (allowed !== null) dispatch(allowed);
  };
}

/* ===========================================================================
 *  공통 껍데기
 * ======================================================================== */

interface PanelShellProps {
  /** 패널 제목 */
  title: string;
  /** 이 패널이 무엇을 하는 곳인지 한두 문장 */
  description: string;
  /** 방금 열렸으면 NEW 딱지를 붙입니다 */
  isNew: boolean;
  /** 제목 옆에 붙는 현재 상태 숫자 (예: '12,400 / 22,000 장') */
  status?: string;
  /** 버튼 밑에 붙는 한 줄 (누르면 어떻게 되는지 / 못 누르는 이유) */
  note?: string | null;
  /** note 가 '못 누르는 이유'면 true → 눈에 띄는 색으로 보여줍니다 */
  noteIsBlocked?: boolean;
  /** 버튼들 */
  children: ReactNode;
  /** 가로로 두 칸을 다 쓰는 패널인가 (안전 조절처럼 넓은 것) */
  wide?: boolean;
}

/**
 * 모든 패널이 똑같이 쓰는 껍데기입니다.
 *
 * 제목 · 설명 · 현재 상태 숫자 · 버튼들 · 한 줄 안내 순서로 늘 같은 자리에 놓습니다.
 * 자리가 늘 같아야 플레이어가 새 패널이 열려도 어디를 봐야 할지 헤매지 않습니다.
 */
export function Panel({
  title,
  description,
  isNew,
  status,
  note,
  noteIsBlocked = false,
  children,
  wide = false,
}: PanelShellProps) {
  return (
    <section
      className={[
        'rounded-lg border bg-slate-900/60 p-3 transition-colors',
        isNew ? 'border-cyan-400/70 ring-2 ring-cyan-400/30' : 'border-slate-800',
        wide ? 'sm:col-span-2' : '',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-slate-200">
          {title}
          {isNew && (
            <span className="animate-pulse rounded bg-cyan-400 px-1.5 py-px text-[10px] font-bold text-slate-950">
              NEW
            </span>
          )}
        </h2>
        {status !== undefined && (
          <span className="font-mono text-xs text-slate-400">{status}</span>
        )}
      </div>

      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>

      <div className="mt-3">{children}</div>

      {note !== null && note !== undefined && (
        <p
          className={`mt-2 text-xs leading-relaxed ${
            noteIsBlocked ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          {note}
        </p>
      )}
    </section>
  );
}

interface ActionButtonProps {
  /** 버튼에 적히는 글자 */
  label: string;
  /** input 폴더가 내려준 판정 결과 */
  status: ActionAvailability;
  /** 눌렀을 때 할 일 */
  onClick: () => void;
  /** 그 패널의 대표 버튼인가 (조금 더 눈에 띄게 그립니다) */
  primary?: boolean;
}

/**
 * 버튼 하나를 그립니다.
 *
 * 누를 수 있는지(enabled), 못 누르면 왜인지(reason), 얼마가 드는지(cost)는
 * 전부 받아온 판정 결과를 그대로 씁니다. 여기서 다시 계산하지 않습니다.
 * 못 누르는 버튼은 disabled 로 만들어 키보드로도 건너뛰게 하고,
 * 이유는 마우스를 올렸을 때(title) 와 패널 밑줄(note) 양쪽에 보여줍니다.
 */
export function ActionButton({ label, status, onClick, primary = false }: ActionButtonProps) {
  const enabled = status.enabled;

  // 휴대폰에서 손가락으로 정확히 누르려면 44px 이상이어야 합니다
  const look = !enabled
    ? 'border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed'
    : primary
      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30 active:bg-cyan-500/40'
      : 'border-slate-700 bg-slate-800/70 text-slate-100 hover:border-cyan-500/50 hover:bg-slate-700/70 active:bg-slate-700';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      title={status.reason ?? status.detail ?? undefined}
      className={`min-h-11 rounded-md border px-3 py-2 text-left transition-colors md:min-h-0 ${look}`}
    >
      <span className="block text-sm font-semibold whitespace-nowrap">{label}</span>
      {status.cost !== null && (
        <span
          className={`mt-0.5 block font-mono text-xs ${
            enabled ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          {formatMoney(status.cost)}
        </span>
      )}
    </button>
  );
}

/** 버튼들을 가로로 늘어놓는 줄 (좁은 화면에서는 자동으로 다음 줄로 넘어갑니다) */
function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

/**
 * 버튼 밑에 보여줄 한 줄을 고릅니다.
 * 누를 수 있으면 '누르면 어떻게 되는지', 못 누르면 '왜 못 누르는지'를 보여줍니다.
 */
function noteOf(status: ActionAvailability): { text: string | null; blocked: boolean } {
  if (status.enabled) return { text: status.detail, blocked: false };
  return { text: status.reason ?? status.detail, blocked: true };
}

/* ===========================================================================
 *  패널 ① 투자 유치 — 게임 시작부터 열려 있습니다
 * ======================================================================== */

/**
 * 지분을 내주고 자금을 받는 패널.
 * 라운드가 올라갈수록 받는 금액도, 내주는 지분도 커집니다.
 */
export function FundingPanel({ state, dispatch, isNew }: PanelProps) {
  const act = guarded(state, dispatch);
  const status = availability(state, { type: 'raiseFunding' });
  const note = noteOf(status);

  return (
    <Panel
      title={s().panels.funding.title}
      description={s().panels.funding.description}
      isNew={isNew}
      status={s().panels.funding.status(formatPercent(state.player.equityRetained))}
      note={note.text}
      noteIsBlocked={note.blocked}
    >
      <ButtonRow>
        <ActionButton
          label={s().panels.funding.button(state.player.fundingRound + 1)}
          status={status}
          onClick={() => act({ type: 'raiseFunding' })}
          primary
        />
      </ButtonRow>
    </Panel>
  );
}

/* ===========================================================================
 *  패널 ② GPU 구매 — 게임 시작부터 열려 있습니다
 * ======================================================================== */

/**
 * GPU를 사는 패널.
 * 묶음 단위(×1 ×10 ×100)와 '지금 살 수 있는 최대' 버튼은 input 폴더가 만들어 줍니다.
 */
export function GpuPanel({ state, dispatch, isNew }: PanelProps) {
  const act = guarded(state, dispatch);
  const derived = computeDerived(state);
  const options = gpuBuyOptions(state);

  // 첫 버튼(가장 작은 묶음)의 판정을 대표로 삼아 밑줄을 씁니다
  const lead = options.length > 0 ? options[0].availability : null;
  const note = lead === null ? { text: null, blocked: false } : noteOf(lead);

  // '최대'가 전 재산을 쓰지 않고 얼마를 남기는지 항상 보이게 적습니다.
  // 마우스를 올려야 보이는 설명은 휴대폰에서 아무 소용이 없습니다.
  const hasMaxButton = options.length > GPU.buySteps.length;
  const reserveNote = hasMaxButton
    ? s().panels.gpu.reserveNote(formatMoney(maxBuyReserve(state)))
    : null;

  return (
    <Panel
      title={s().panels.gpu.title}
      description={s().panels.gpu.description}
      isNew={isNew}
      status={s().panels.gpu.status(
        formatCompact(state.player.gpus),
        formatCompact(derived.gpuCapacity),
      )}
      note={note.text}
      noteIsBlocked={note.blocked}
    >
      <ButtonRow>
        {options.map((option, index) => (
          <ActionButton
            key={`${index}-${option.count}`}
            label={
              index < GPU.buySteps.length
                ? s().panels.gpu.buy(formatCompact(option.count))
                : s().panels.gpu.buyMax(formatCompact(option.count))
            }
            status={option.availability}
            onClick={() => act({ type: 'buyGpu', count: option.count })}
            primary={index === 0}
          />
        ))}
      </ButtonRow>
      {reserveNote !== null && (
        <p className="mt-1 text-[10px] text-slate-500">{reserveNote}</p>
      )}
    </Panel>
  );
}

/* ===========================================================================
 *  패널 ③ 전력 계약 — GPU가 놀기 시작하면 열립니다
 * ======================================================================== */

/**
 * 전력을 계약하는 패널.
 * 계약한 용량만큼 매초 요금이 나갑니다 — 실제로 안 써도 나갑니다.
 */
export function PowerPanel({ state, dispatch, isNew }: PanelProps) {
  const act = guarded(state, dispatch);
  const options = powerContractOptions(state);

  const lead = options.length > 0 ? options[0].availability : null;
  const note = lead === null ? { text: null, blocked: false } : noteOf(lead);

  return (
    <Panel
      title={s().panels.power.title}
      description={s().panels.power.description}
      isNew={isNew}
      status={`${formatMegawatts(powerDemand(state))} / ${formatMegawatts(powerAvailable(state))}`}
      note={note.text}
      noteIsBlocked={note.blocked}
    >
      <ButtonRow>
        {options.map((option, index) => (
          <ActionButton
            key={option.megawatts}
            label={s().panels.power.button(formatMegawatts(option.megawatts))}
            status={option.availability}
            onClick={() => act({ type: 'contractPower', megawatts: option.megawatts })}
            primary={index === 0}
          />
        ))}
      </ButtonRow>
    </Panel>
  );
}

/* ===========================================================================
 *  패널 ④ 데이터센터 건설 — GPU 자리가 꽉 차면 열립니다
 * ======================================================================== */

/**
 * 데이터센터를 짓는 패널.
 * GPU를 둘 자리를 늘려주며, 한 동 지을 때마다 다음 건설비가 비싸집니다.
 */
export function DatacenterPanel({ state, dispatch, isNew }: PanelProps) {
  const act = guarded(state, dispatch);
  const status = availability(state, { type: 'buildDatacenter' });
  const note = noteOf(status);

  return (
    <Panel
      title={s().panels.datacenter.title}
      description={s().panels.datacenter.description}
      isNew={isNew}
      status={s().panels.datacenter.status(formatCompact(state.player.datacenters))}
      note={note.text}
      noteIsBlocked={note.blocked}
    >
      <ButtonRow>
        <ActionButton
          label={s().panels.datacenter.button}
          status={status}
          onClick={() => act({ type: 'buildDatacenter' })}
          primary
        />
      </ButtonRow>
    </Panel>
  );
}

/* ===========================================================================
 *  패널 ⑤ 연구원 채용 — 진행도가 일정 수준을 넘으면 열립니다
 * ======================================================================== */

/**
 * 연구원을 뽑는 패널.
 * 같은 GPU로도 훈련이 빨라지는 대신 매초 인건비가 나갑니다.
 */
export function ResearcherPanel({ state, dispatch, isNew }: PanelProps) {
  const act = guarded(state, dispatch);
  const options = RESEARCHER_HIRE_STEPS.map((count) => ({
    count,
    status: availability(state, { type: 'hireResearcher', count }),
  }));

  const lead = options.length > 0 ? options[0].status : null;
  const note = lead === null ? { text: null, blocked: false } : noteOf(lead);

  // 지금 연구원들이 올려주고 있는 속도 (1.36배 → '+36%')
  const bonus = researcherMultiplier(state) - 1;

  return (
    <Panel
      title={s().panels.researcher.title}
      description={s().panels.researcher.description}
      isNew={isNew}
      status={s().panels.researcher.status(
        formatCompact(state.player.researchers),
        formatPercent(bonus),
      )}
      note={note.text}
      noteIsBlocked={note.blocked}
    >
      <ButtonRow>
        {options.map((option, index) => (
          <ActionButton
            key={option.count}
            label={s().panels.researcher.button(formatCompact(option.count))}
            status={option.status}
            onClick={() => act({ type: 'hireResearcher', count: option.count })}
            primary={index === 0}
          />
        ))}
      </ButtonRow>
    </Panel>
  );
}

/* ===========================================================================
 *  패널 ⑥ 안전 조절 — 후반에 열리는 위험한 선택
 * ======================================================================== */

/**
 * 안전 검증 수준을 조절하는 패널.
 *
 * 다른 패널과 달리 버튼이 아니라 슬라이더입니다. '조금만 낮출까, 끝까지 낮출까'가
 * 이 패널의 재미인데, 버튼 몇 개로는 그 미세한 저울질이 표현되지 않기 때문입니다.
 * 낮췄을 때 얼마나 빨라지고 사고 위험이 얼마나 오르는지를 항상 함께 보여줍니다.
 */
export function SafetyPanel({ state, dispatch, isNew }: PanelProps) {
  const act = guarded(state, dispatch);
  const level = state.player.safety;

  // 지금 수준의 효과와, 끝까지 낮췄을 때의 효과를 나란히 보여줍니다
  const current = availability(state, { type: 'setSafety', value: level });
  const reckless = availability(state, { type: 'setSafety', value: SAFETY.minLevel });
  const note = noteOf(current);

  return (
    <Panel
      title={s().panels.safety.title}
      description={s().panels.safety.description}
      isNew={isNew}
      status={s().panels.safety.status(formatPercent(level, 0))}
      note={note.text}
      noteIsBlocked={note.blocked}
      wide
    >
      <label className="block">
        <span className="sr-only">{s().panels.safety.sliderLabel}</span>
        <input
          type="range"
          min={SAFETY.minLevel}
          max={1}
          step={SAFETY_SLIDER_STEP}
          value={level}
          disabled={!current.enabled}
          onChange={(event) => act({ type: 'setSafety', value: Number(event.target.value) })}
          className="h-6 w-full cursor-pointer appearance-none bg-transparent accent-amber-400 md:h-4"
          aria-label={s().panels.safety.sliderLabel}
        />
      </label>

      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
        <span>{s().panels.safety.low(formatPercent(SAFETY.minLevel, 0))}</span>
        <span>{s().panels.safety.high(formatPercent(1, 0))}</span>
      </div>

      <p className="mt-2 text-xs text-rose-400/90">
        {s().panels.safety.recklessNote(reckless.detail ?? '')}
      </p>
    </Panel>
  );
}
