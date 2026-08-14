/**
 * ===========================================================================
 *  경쟁사 대응 — 상대에게 손을 대는 자리
 * ===========================================================================
 *
 *  이 패널이 생기기 전까지 경쟁사는 '달리는 막대'였습니다. 쳐다볼 수는 있어도
 *  건드릴 방법이 없었고, 그래서 플레이어의 결정은 "다음에 뭘 살까" 하나뿐이었습니다.
 *
 *  여기 있는 버튼들은 전부 같은 질문을 던집니다 —
 *      이 돈으로 내 설비를 키울까, 아니면 상대를 늦출까?
 *
 *  쓴 돈은 내 GPU로 돌아오지 않기 때문에, 늦추는 값어치가 그만큼 있어야 합니다.
 *  그 판단이 매 순간 달라지는 것이 이 패널의 존재 이유입니다.
 */

import type { Dispatch } from 'react';
import { rivalName, s } from '../i18n';
import { availability, formatMoney } from '../input';
import type { GameAction, GameState, Rival } from '../types';
import { rivalStyle } from './RaceTrack';

interface ActionButtonProps {
  label: string;
  action: GameAction;
  state: GameState;
  dispatch: Dispatch<GameAction>;
  /** 넓게 쓰는 버튼인지 */
  wide?: boolean;
}

/** 판정 결과를 그대로 반영하는 버튼 하나 */
function InterferenceButton({ label, action, state, dispatch, wide = false }: ActionButtonProps) {
  const status = availability(state, action);

  return (
    <button
      type="button"
      disabled={!status.enabled}
      onClick={() => dispatch(action)}
      title={status.reason ?? status.detail ?? undefined}
      className={`rounded border px-2 py-1.5 text-left transition-colors ${
        wide ? 'w-full' : ''
      } ${
        status.enabled
          ? 'border-slate-700 bg-slate-800/70 text-slate-100 hover:border-slate-600 hover:bg-slate-700/70'
          : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600'
      }`}
    >
      <span className="block text-[11px] font-semibold leading-tight">{label}</span>
      {status.cost !== null && (
        <span className="block font-mono text-[10px] leading-tight opacity-70">
          {formatMoney(status.cost)}
        </span>
      )}
    </button>
  );
}

/** 경쟁사 한 곳에 대한 줄 */
function RivalRow({
  rival,
  index,
  state,
  dispatch,
}: {
  rival: Rival;
  index: number;
  state: GameState;
  dispatch: Dispatch<GameAction>;
}) {
  const style = rivalStyle(index);
  const done = rival.status === 'collapsed' || rival.status === 'achieved';

  return (
    <div className={`rounded border border-slate-800 p-1.5 ${done ? 'opacity-50' : ''}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={`truncate text-[11px] font-semibold ${style.text}`}>
          {rivalName(rival)}
        </span>
        {/*
          속도 배수가 1보다 낮으면 지금 내 개입이 먹히고 있다는 뜻입니다.
          시간이 지나면 1로 돌아오므로 '언제 다시 걸어야 하나'를 여기서 읽습니다.
        */}
        {rival.momentum < 0.97 && !done && (
          <span className="shrink-0 font-mono text-[10px] text-sky-300">
            {s().rivalActions.speed(`${Math.round(rival.momentum * 100)}%`)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1">
        <InterferenceButton
          label={s().rivalActions.intel}
          action={{ type: 'buyIntel', rivalId: rival.id }}
          state={state}
          dispatch={dispatch}
        />
        <InterferenceButton
          label={s().rivalActions.poach}
          action={{ type: 'poachRival', rivalId: rival.id }}
          state={state}
          dispatch={dispatch}
        />
      </div>
    </div>
  );
}

interface RivalActionPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  isNew?: boolean;
}

/** 경쟁사 대응 패널 */
export function RivalActionPanel({ state, dispatch, isNew = false }: RivalActionPanelProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3" aria-label={s().rivalActions.aria}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
          {s().rivalActions.heading}
          {isNew && (
            <span className="rounded bg-cyan-500/20 px-1 py-px text-[9px] font-bold text-cyan-300">
              NEW
            </span>
          )}
        </h2>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
        {s().rivalActions.description}
      </p>

      <div className="grid gap-1.5">
        {state.rivals.map((rival, index) => (
          <RivalRow
            key={rival.id}
            rival={rival}
            index={index}
            state={state}
            dispatch={dispatch}
          />
        ))}
      </div>

      <div className="mt-2">
        <InterferenceButton
          label={s().rivalActions.lockSupply}
          action={{ type: 'lockSupply' }}
          state={state}
          dispatch={dispatch}
          wide
        />
        <p className="mt-1 text-[10px] text-amber-300/80">
          {availability(state, { type: 'lockSupply' }).detail}
        </p>
      </div>
    </section>
  );
}
