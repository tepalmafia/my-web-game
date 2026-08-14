/**
 * ===========================================================================
 *  상단 자원 표시줄 — 화면에서 제일 자주 보게 될 곳
 * ===========================================================================
 *
 *  이 게임은 스프라이트도 배경도 없습니다. 숫자가 곧 주인공입니다.
 *  그래서 자금·GPU·전력·연구원 네 가지를 크고 굵은 고정폭 글씨(font-mono)로 두고,
 *  이름표는 작고 흐리게 둡니다. 눈이 숫자에 먼저 가야 하기 때문입니다.
 *
 *  ─ 여기 보이는 값 중 '계산해서 나오는 값'은 하나도 저장돼 있지 않습니다.
 *    가동 중인 GPU 수, 초당 증감, 남은 시간 등은 전부 computeDerived 가
 *    매 순간 새로 계산해 줍니다. (저장해두면 실제와 어긋나는 버그가 반드시 생깁니다)
 */

import type { Dispatch } from 'react';
import { SPEED_OPTIONS } from '../balance';
import { computeDerived, powerAvailable } from '../constraints';
import { s } from '../i18n';
import { formatCompact, formatDuration, formatMoney, formatPercent, formatRate } from '../input';
import { formatMegawatts } from '../input/format';
import type { GameAction, GameState } from '../types';
import { guarded } from './ActionPanel';
import { LanguagePicker } from './LanguagePicker';
import { ProgressBar } from './ProgressBar';

interface ResourceBarProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

/** 숫자 하나를 보여주는 칸 (큰 숫자 + 작은 이름표 + 작은 보조 설명) */
function Stat({
  label,
  value,
  hint,
  valueClass = 'text-slate-100',
}: {
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-2.5 py-2">
      <div className="text-[10px] tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-lg leading-tight font-semibold sm:text-xl ${valueClass}`}>
        {value}
      </div>
      <div className="font-mono text-[10px] text-slate-500">{hint}</div>
    </div>
  );
}

/**
 * 상단 표시줄 전체를 그립니다.
 *
 * 왼쪽에는 연구소 이름과 경과 시간, 오른쪽에는 일시정지·배속 버튼을 둡니다.
 * 그 아래에 자원 네 칸, 맨 아래에 AGI 진행도 막대가 옵니다.
 * 좁은 화면(휴대폰)에서는 자원 칸이 두 줄로 접힙니다.
 */
export function ResourceBar({ state, dispatch }: ResourceBarProps) {
  const act = guarded(state, dispatch);
  const derived = computeDerived(state);
  const player = state.player;

  // 통장이 차고 있는지 마르고 있는지 — 이 게임에서 가장 중요한 한 가지
  const gaining = derived.netPerSecond >= 0;
  const runway =
    derived.runwaySeconds === null
      ? s().bar.inTheBlack
      : s().bar.runwayLeft(formatDuration(derived.runwaySeconds));

  // 전력이 모자라면 사둔 GPU가 놀고 있다는 뜻이라 색으로 알려줍니다
  const idleGpus = player.gpus - derived.activeGpus;

  // 전력 칸의 분모는 '계약한 양'이 아니라 '실제로 쓸 수 있는 양'입니다.
  // 계약이 0이어도 기본으로 주어지는 용량이 있어서, 계약량만 적으면
  // '0MW 인데 GPU가 돌아가네?' 하고 오히려 헷갈리기 때문입니다.
  // 계약한 양은 그 아래 작은 글씨에 따로 적어둡니다.

  const eta = derived.etaToAgi === null ? '--:--' : formatDuration(derived.etaToAgi);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-3 py-3 backdrop-blur">
      <div className="mx-auto max-w-6xl">
        {/* 이름 · 시간 · 조작 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h1 className="text-sm font-semibold text-slate-200">{player.labName}</h1>
            <span className="font-mono text-xs text-slate-500">
              {s().bar.elapsed(formatDuration(state.elapsed))}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* 좁은 화면에서는 숨깁니다 — 한 줄이 더 늘어나면 게임 화면이 밀립니다 */}
            <LanguagePicker className="mr-1 hidden md:inline-flex" />
            <button
              type="button"
              onClick={() => act({ type: 'setPaused', paused: !state.paused })}
              aria-pressed={state.paused}
              className={`min-h-11 md:min-h-0 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                state.paused
                  ? 'border-amber-400/60 bg-amber-400/20 text-amber-200 hover:bg-amber-400/30'
                  : 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700/70'
              }`}
            >
              {state.paused ? s().bar.resume : s().bar.pause}
            </button>

            <div className="flex items-center gap-1" role="group" aria-label={s().bar.speedGroup}>
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => act({ type: 'setSpeed', speed: option })}
                  aria-pressed={state.speed === option}
                  className={`min-h-11 rounded-md border px-3 py-1 font-mono text-xs transition-colors md:min-h-0 ${
                    state.speed === option
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                      : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:bg-slate-700/70'
                  }`}
                >
                  {s().bar.speed(String(option))}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 자원 네 칸 */}
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label={s().bar.money}
            value={formatMoney(player.money)}
            hint={`${formatRate(derived.netPerSecond)} · ${runway}`}
            valueClass={gaining ? 'text-emerald-300' : 'text-rose-300'}
          />
          <Stat
            label={s().bar.gpus}
            value={`${formatCompact(derived.activeGpus)} / ${formatCompact(player.gpus)}`}
            hint={
              idleGpus > 0 ? s().bar.gpusIdle(formatCompact(idleGpus)) : s().bar.gpusAllRunning
            }
            valueClass={idleGpus > 0 ? 'text-amber-300' : 'text-slate-100'}
          />
          <Stat
            label={s().bar.power}
            value={`${formatMegawatts(derived.powerDemand)} / ${formatMegawatts(
              powerAvailable(state),
            )}`}
            hint={s().bar.powerHint(
              formatMegawatts(player.powerContracted),
              formatPercent(derived.powerHeadroom, 0),
            )}
            valueClass={derived.powerHeadroom <= 0 ? 'text-rose-300' : 'text-slate-100'}
          />
          <Stat
            label={s().bar.researchers}
            value={formatCompact(player.researchers)}
            hint={s().bar.researchersHint(
              formatPercent(player.equityRetained, 0),
              formatPercent(player.safety, 0),
            )}
          />
        </div>

        {/* AGI 진행도 */}
        <div className="mt-2.5">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-[10px] tracking-wide text-slate-500">
              {s().bar.progressLabel}
            </span>
            <span className="font-mono text-xs text-slate-400">
              <span className="text-base font-semibold text-cyan-300">
                {formatPercent(player.researchProgress)}
              </span>
              <span className="ml-2">
                {s().bar.progressRate(formatPercent(derived.researchRate, 3), eta)}
              </span>
            </span>
          </div>
          <ProgressBar
            value={player.researchProgress}
            label={s().bar.progressAria}
            colorClass="bg-cyan-400"
            size="lg"
          />
        </div>
      </div>
    </header>
  );
}
