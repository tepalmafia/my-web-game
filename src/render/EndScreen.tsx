/**
 * ===========================================================================
 *  결과 화면 — 이 판이 어떻게 끝났는가
 * ===========================================================================
 *
 *  끝나는 방법은 네 가지이고, 네 가지 모두 다른 문장으로 맞이합니다.
 *      agiAchieved  : 내가 먼저 도달했다            (유일한 승리)
 *      rivalWon     : 경쟁사가 먼저 도달했다
 *      bankrupt     : 통장이 먼저 말랐다
 *      catastrophe  : 검증을 건너뛰다 사고가 났다
 *      controlLost  : 자기개선하는 모델을 놓쳤다 (후반 단계에서만)
 *
 *  "졌습니다" 한 줄로 끝내지 않고 왜 졌는지를 문장으로 남기는 이유는,
 *  다음 판에 무엇을 다르게 해볼지가 이 화면에서 정해지기 때문입니다.
 */

import type { Dispatch } from 'react';
import { rivalName, s } from '../i18n';
import { formatDuration, formatMoney, formatPercent } from '../input';
import type { GameAction, GameOutcome, GameState } from '../types';
import { ProgressBar } from './ProgressBar';
import { LanguagePicker } from './LanguagePicker';
import { rivalDisplayProgress, rivalStyle } from './RaceTrack';
import { ShareResult } from './ShareResult';

interface EndScreenProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

/** 결과 한 가지에 대한 화면 문구 한 벌 */
interface OutcomeCopy {
  /** 이겼는가 (색과 딱지가 달라집니다) */
  won: boolean;
  /** 큰 제목 */
  headline: string;
  /** 왜 이렇게 끝났는지 두세 문장 */
  body: string;
  /** 제목 색 */
  toneClass: string;
  /** 제목 위에 붙는 작은 딱지 */
  badge: string;
}

/**
 * 결과 종류와 상황을 보고 화면에 쓸 문구를 고릅니다.
 *
 * 승자 이름이 필요한 경우(rivalWon)를 위해 게임 상태를 함께 받습니다.
 */
function copyFor(state: GameState, outcome: GameOutcome | null): OutcomeCopy {
  const lab = state.player.labName;

  switch (outcome) {
    case 'agiAchieved':
      return {
        won: true,
        headline: s().end.won.headline,
        body: s().end.won.body(lab),
        toneClass: 'text-emerald-300',
        badge: s().end.won.badge,
      };

    case 'rivalWon': {
      const winner = state.rivals.find((rival) => rival.id === state.outcomeRivalId);
      const name = winner === undefined ? s().log.fallbackRivalName : rivalName(winner);
      return {
        won: false,
        headline: s().end.rivalWon.headline,
        body: s().end.rivalWon.body(name),
        toneClass: 'text-rose-300',
        badge: s().end.rivalWon.badge,
      };
    }

    case 'bankrupt':
      return {
        won: false,
        headline: s().end.bankrupt.headline,
        body: s().end.bankrupt.body,
        toneClass: 'text-amber-300',
        badge: s().end.bankrupt.badge,
      };

    case 'catastrophe':
      return {
        won: false,
        headline: s().end.catastrophe.headline,
        body: s().end.catastrophe.body,
        toneClass: 'text-rose-300',
        badge: s().end.catastrophe.badge,
      };

    case 'controlLost':
      return {
        won: false,
        headline: s().end.controlLost.headline,
        body: s().end.controlLost.body,
        toneClass: 'text-fuchsia-300',
        badge: s().end.controlLost.badge,
      };

    default:
      return {
        won: false,
        headline: s().end.unknown.headline,
        body: s().end.unknown.body,
        toneClass: 'text-slate-300',
        badge: s().end.unknown.badge,
      };
  }
}

/** 최종 순위 한 줄에 담기는 정보 */
interface RankEntry {
  name: string;
  progress: number;
  barClass: string;
  textClass: string;
  mine: boolean;
}

/**
 * 나와 경쟁사 세 곳을 진행도 순으로 줄 세웁니다.
 *
 * 경쟁사 값은 화면용 추정치(reportedProgress)를 씁니다.
 * 끝난 뒤에도 내부 값을 노출하지 않는다는 규칙은 그대로 지킵니다.
 */
function rankings(state: GameState): RankEntry[] {
  const mine: RankEntry = {
    name: state.player.labName,
    progress: state.player.researchProgress,
    barClass: 'bg-cyan-400',
    textClass: 'text-cyan-300',
    mine: true,
  };

  const others: RankEntry[] = state.rivals.map((rival, index) => {
    const style = rivalStyle(index);
    return {
      name: rivalName(rival),
      progress: rivalDisplayProgress(rival),
      barClass: style.bar,
      textClass: style.text,
      mine: false,
    };
  });

  return [mine, ...others].sort((a, b) => b.progress - a.progress);
}

/** 최종 기록 한 칸 */
function Record({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
      <div className="text-[10px] tracking-wide text-slate-500">{label}</div>
      <div className="font-mono text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}

/**
 * 결과 화면 전체를 그립니다.
 *
 * '다시 하기'를 누르면 restart 신호를 보냅니다. 그러면 씨앗이 한 칸 굴러가서
 * 사건 순서가 다른 새 판이 준비되고, 시작 화면으로 돌아갑니다.
 */
export function EndScreen({ state, dispatch }: EndScreenProps) {
  const copy = copyFor(state, state.outcome);
  const board = rankings(state);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-lg">
        <div className="mb-2 flex justify-end">
          <LanguagePicker />
        </div>
        <p
          className={`font-mono text-[10px] tracking-[0.3em] ${
            copy.won ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {copy.badge}
        </p>

        <h1 className={`mt-2 text-3xl font-bold tracking-tight sm:text-4xl ${copy.toneClass}`}>
          {copy.headline}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-400">{copy.body}</p>

        {/* 최종 기록 */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Record label={s().end.elapsed} value={formatDuration(state.elapsed)} />
          <Record
            label={s().end.finalProgress}
            value={formatPercent(state.player.researchProgress)}
          />
          <Record label={s().end.finalEquity} value={formatPercent(state.player.equityRetained)} />
          <Record label={s().end.finalMoney} value={formatMoney(state.player.money)} />
        </div>

        {/* 최종 순위 */}
        <h2 className="mt-6 text-sm font-semibold tracking-wide text-slate-200">{s().end.standings}</h2>
        <ol className="mt-2 space-y-2">
          {board.map((entry, index) => (
            <li
              key={entry.name}
              className={`rounded-md border p-2 ${
                entry.mine ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono text-slate-500">{s().end.place(index + 1)}</span>
                  <span className={`font-semibold ${entry.textClass}`}>{entry.name}</span>
                  {entry.mine && <span className="text-[10px] text-slate-500">{s().end.us}</span>}
                </span>
                <span className="font-mono text-xs text-slate-300">
                  {formatPercent(entry.progress)}
                </span>
              </div>
              <div className="mt-1">
                <ProgressBar
                  value={entry.progress}
                  label={s().end.progressAria(entry.name)}
                  colorClass={entry.barClass}
                  size="sm"
                />
              </div>
            </li>
          ))}
        </ol>

        <ShareResult state={state} />

        <button
          type="button"
          onClick={() => dispatch({ type: 'restart' })}
          className="mt-6 w-full rounded-md border border-cyan-400/60 bg-cyan-500/20 px-4 py-3 text-base font-bold text-cyan-50 transition-colors hover:bg-cyan-500/30 active:bg-cyan-500/40"
        >
          {s().end.restart}
        </button>
      </div>
    </div>
  );
}
