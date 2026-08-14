/**
 * ===========================================================================
 *  시작 화면 — 연구소 이름을 정하고 판에 들어갑니다
 * ===========================================================================
 *
 *  여기서 하는 일은 딱 하나입니다. 이름을 받아 startGame 신호를 보내는 것.
 *  게임의 규칙은 한 줄 설명으로만 알려주고, 나머지는 직접 눌러보며 알게 둡니다.
 *  (첫 화면에 버튼이 두 개뿐인 이유와 같습니다 — 설명이 길면 아무도 읽지 않습니다)
 *
 *  ※ rngSeed 로 Date.now() 를 넘깁니다. 시작한 시각이 곧 이 판의 주사위 씨앗이 되어
 *    매번 다른 순서로 사건이 터집니다.
 */

import { useState } from 'react';
import type { Dispatch } from 'react';
import { TARGET_PLAY_SECONDS } from '../balance';
import { s } from '../i18n';
import { availability, formatDuration } from '../input';
import type { GameAction, GameState } from '../types';
import { LanguagePicker } from './LanguagePicker';

interface TitleScreenProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

/**
 * 제목 · 한 줄 설명 · 연구소 이름 입력 · 시작 버튼을 그립니다.
 *
 * 이름을 비워두면 balance.ts 의 기본 이름으로 시작합니다.
 * 엔터만 쳐도 시작되도록 form 으로 감쌌습니다.
 */
export function TitleScreen({ state, dispatch }: TitleScreenProps) {
  const [labName, setLabName] = useState('');

  // 시작 버튼도 다른 버튼과 똑같이 input 폴더의 판정을 따릅니다
  const status = availability(state, { type: 'startGame', labName, rngSeed: 0 });

  const start = () => {
    dispatch({ type: 'startGame', labName, rngSeed: Date.now() });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-md">
        <div className="flex items-start justify-between gap-4">
          <p className="font-mono text-[10px] tracking-[0.3em] text-cyan-400">AGI RACE</p>
          <LanguagePicker />
        </div>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          {s().title.heading}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {s().title.body} {s().title.length(formatDuration(TARGET_PLAY_SECONDS))}
        </p>

        <form
          className="mt-8"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            start();
          }}
        >
          <label className="block text-xs tracking-wide text-slate-500" htmlFor="lab-name">
            {s().title.labelName}
          </label>
          <input
            id="lab-name"
            type="text"
            value={labName}
            maxLength={20}
            placeholder={s().names.defaultLab}
            onChange={(changeEvent) => setLabName(changeEvent.target.value)}
            className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!status.enabled}
            title={status.reason ?? status.detail ?? undefined}
            className={`mt-4 w-full rounded-md border px-4 py-3 text-base font-bold transition-colors ${
              status.enabled
                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30 active:bg-cyan-500/40'
                : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600'
            }`}
          >
            {s().title.start}
          </button>
        </form>

        <p className="mt-3 text-xs text-slate-600">{status.detail}</p>
      </div>
    </div>
  );
}
