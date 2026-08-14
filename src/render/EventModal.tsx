/**
 * ===========================================================================
 *  사건 창 — 시간을 멈춰 세우고 결정을 요구하는 화면
 * ===========================================================================
 *
 *  사건이 터지면 이 창이 화면 위를 덮고, 창이 떠 있는 동안에는 시간이 흐르지 않습니다.
 *  (그 판단은 constraints 의 running 이 하고, 화면은 그 결과를 따를 뿐입니다)
 *
 *  선택지 버튼의 '누를 수 있는가 / 얼마가 드는가 / 누르면 어떻게 되는가'는
 *  전부 input 폴더의 availability() 가 알려주는 대로 그립니다.
 *  조건(requires)을 만족하지 못하는 선택지는 눌리지 않게 하고 이유를 함께 보여줍니다.
 */

import type { Dispatch } from 'react';
import { s } from '../i18n';
import { availability, formatMoney } from '../input';
import type { GameAction, GameEvent, GameState } from '../types';
import { guarded } from './ActionPanel';

interface EventModalProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  /** 지금 떠 있는 사건 (App 에서 null 이 아닐 때만 이 창을 그립니다) */
  event: GameEvent;
}

/**
 * 사건 하나를 창으로 띄웁니다.
 *
 * 제목 · 본문 · 선택지 버튼 순서로 놓습니다. 선택지는 위아래로 쌓아서
 * 좁은 화면에서도 글자가 잘리지 않게 하고, 버튼마다 결과를 미리 알려줍니다.
 */
export function EventModal({ state, dispatch, event }: EventModalProps) {
  const act = guarded(state, dispatch);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-amber-500/40 bg-slate-900 p-4 shadow-2xl"
      >
        <p className="text-[10px] tracking-widest text-amber-400">{s().eventModal.eyebrow}</p>
        <h2 id="event-title" className="mt-1 text-lg font-bold text-slate-100">
          {event.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{event.description}</p>

        <ul className="mt-4 space-y-2">
          {event.choices.map((choice, index) => {
            const status = availability(state, { type: 'resolveEvent', choiceIndex: index });

            return (
              <li key={`${event.id}-${index}`}>
                <button
                  type="button"
                  disabled={!status.enabled}
                  title={status.reason ?? status.detail ?? undefined}
                  onClick={() => act({ type: 'resolveEvent', choiceIndex: index })}
                  className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                    status.enabled
                      ? 'border-slate-700 bg-slate-800/70 text-slate-100 hover:border-cyan-500/50 hover:bg-slate-700/70'
                      : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600'
                  }`}
                >
                  <span className="block text-sm font-semibold">{choice.label}</span>

                  {status.detail !== null && (
                    <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                      {status.detail}
                    </span>
                  )}

                  {status.cost !== null && (
                    <span className="mt-1 block font-mono text-xs text-amber-300">
                      {formatMoney(status.cost)}
                    </span>
                  )}

                  {!status.enabled && status.reason !== null && (
                    <span className="mt-1 block text-xs text-rose-400">{status.reason}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
