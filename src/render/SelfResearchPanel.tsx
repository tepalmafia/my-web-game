/**
 * ===========================================================================
 *  자율 연구 — 후반 단계의 유일한 조작
 * ===========================================================================
 *
 *  진행도가 일정 수준을 넘으면 모델이 스스로 연구를 돕기 시작하고,
 *  그 순간부터 게임의 성격이 바뀝니다.
 *
 *      전반: 무엇을 살까   (돈 → 설비 → 속도)
 *      후반: 그 힘을 어디에 쓸까 (가속 ↔ 정렬)
 *
 *  전반의 버튼들은 여전히 눌리지만 영향력이 확 줄어듭니다.
 *  GPU를 몇백 장 더 사는 것보다 이 저울을 몇 %p 움직이는 쪽이 훨씬 크게 작용합니다.
 *
 *  ─ 이 패널이 반드시 보여줘야 하는 것
 *    1) 지금 얼마나 빨라지고 있는가
 *    2) 통제력이 늘고 있는가 줄고 있는가, 줄고 있다면 언제 바닥나는가
 *  이 둘을 못 읽으면 플레이어는 영문도 모른 채 통제 상실로 집니다.
 */

import type { Dispatch } from 'react';
import {
  controlChangePerSecond,
  secondsUntilControlLost,
  selfImproveDepth,
  selfResearchMultiplier,
} from '../constraints';
import { formatDuration, formatPercent } from '../input';
import type { GameAction, GameState } from '../types';

interface SelfResearchPanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export function SelfResearchPanel({ state, dispatch }: SelfResearchPanelProps) {
  const alignmentShare = state.player.alignmentShare;
  const control = state.player.control;
  const change = controlChangePerSecond(state);
  const untilLost = secondsUntilControlLost(state);
  const speedBonus = selfResearchMultiplier(state) - 1;
  const depth = selfImproveDepth(state);

  // 통제력이 줄고 있고 시간이 얼마 안 남았으면 눈에 띄게 경고합니다
  const critical = untilLost !== null && untilLost < 60;
  const losing = change < 0;

  return (
    <section
      className={`rounded-lg border p-3 sm:col-span-2 ${
        critical
          ? 'border-fuchsia-500/60 bg-fuchsia-950/20 motion-safe:animate-pulse'
          : 'border-fuchsia-500/30 bg-slate-900/60'
      }`}
      aria-label="자율 연구"
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-fuchsia-200">자율 연구</h2>
        <span className="font-mono text-[11px] tabular-nums text-fuchsia-300">
          자기개선 {formatPercent(depth, 0)} 진입
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
        모델이 스스로 연구를 돕고 있습니다. 그 힘을 <b className="text-slate-200">가속</b>에 쓸수록
        빨라지지만 통제력이 깎이고, <b className="text-slate-200">정렬</b>에 쓸수록 통제력이
        회복되지만 경쟁사에 뒤처집니다.
      </p>

      {/* 통제력 */}
      <div className="mb-3">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-slate-400">통제력</span>
          <span
            className={`font-mono text-xs tabular-nums ${
              critical ? 'text-rose-300' : losing ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {formatPercent(control, 0)}
            <span className="ml-1 opacity-70">
              ({change >= 0 ? '+' : ''}
              {formatPercent(change, 2)}/초)
            </span>
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-label="통제력"
          aria-valuenow={Math.round(control * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300 ${
              critical ? 'bg-rose-400' : losing ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, control * 100))}%` }}
          />
        </div>
        <p
          className={`mt-1 text-[11px] ${
            critical ? 'font-semibold text-rose-300' : losing ? 'text-amber-300' : 'text-slate-500'
          }`}
        >
          {untilLost === null
            ? '통제력이 회복되고 있습니다'
            : `이대로면 ${formatDuration(untilLost)} 뒤 통제를 잃습니다`}
        </p>
      </div>

      {/* 배분 저울 */}
      <label className="block">
        <span className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-cyan-300">가속 {formatPercent(1 - alignmentShare, 0)}</span>
          <span className="text-slate-500">연구 속도 +{formatPercent(speedBonus, 0)}</span>
          <span className="text-emerald-300">정렬 {formatPercent(alignmentShare, 0)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(alignmentShare * 100)}
          onChange={(changeEvent) =>
            dispatch({
              type: 'setAlignmentShare',
              value: Number(changeEvent.target.value) / 100,
            })
          }
          className="h-6 w-full cursor-pointer accent-fuchsia-400 md:h-4"
          aria-label="자율 연구력 배분 (오른쪽으로 갈수록 정렬)"
        />
      </label>
    </section>
  );
}
