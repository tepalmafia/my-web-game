/**
 * ===========================================================================
 *  고정 상태바 — 휴대폰에서 조작하는 동안에도 판세를 놓치지 않게
 * ===========================================================================
 *
 *  휴대폰에서 재보니 문제가 분명했습니다.
 *    · 자원 표시줄이 화면의 80%를 차지하고
 *    · 그 아래 레이스 트랙은 조작 버튼까지 내려가는 순간 화면 밖으로 사라집니다
 *  즉 "버튼을 누르는 동안에는 내가 몇 등인지, 자금이 마르는지 알 수 없다"는 뜻입니다.
 *
 *  그래서 화면 맨 위에 한 줄만 붙여 둡니다. 스크롤해도 따라옵니다.
 *  넣을 것을 고르는 기준은 하나 — "이걸 놓치면 지는가":
 *      · AGI 진행도   (내가 얼마나 왔는가)
 *      · 선두와의 격차 (지고 있는가)
 *      · 자금 증감     (파산하는가)
 *      · 통제력        (후반에만 — 놓치면 그 자리에서 패배)
 *  나머지(GPU 수, 전력, 연구원)는 아래 표시줄에 그대로 있습니다.
 *
 *  넓은 화면에서는 전부 한눈에 들어오므로 이 줄을 띄우지 않습니다(md:hidden).
 */

import { computeDerived, isSelfImproving } from '../constraints';
import { formatMoney, formatPercent, formatRate } from '../input';
import type { GameState } from '../types';
import { rivalDisplayProgress } from './RaceTrack';

/** 내가 몇 등인지 (경쟁사 상황판이 열린 뒤에만 의미가 있습니다) */
function rankOf(state: GameState): number {
  const mine = state.player.researchProgress;
  const ahead = state.rivals.filter(
    (rival) => rival.status !== 'collapsed' && rivalDisplayProgress(rival) > mine,
  ).length;
  return ahead + 1;
}

export function StickyStatus({ state }: { state: GameState }) {
  const derived = computeDerived(state);
  const progress = state.player.researchProgress;
  const net = derived.netPerSecond;
  const showRivals = state.unlocks.rivals;
  const rank = rankOf(state);
  const margin = derived.leadMargin;
  const phase2 = isSelfImproving(state);
  const control = state.player.control;

  return (
    <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* AGI 진행도 — 가장 먼저 눈에 들어와야 하는 값 */}
        <span className="font-mono text-sm font-bold tabular-nums text-cyan-300">
          {formatPercent(progress, 1)}
        </span>

        {/* 순위와 선두와의 격차 */}
        {showRivals && (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              margin >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
            }`}
          >
            {rank}위 {margin >= 0 ? '+' : ''}
            {formatPercent(margin, 0)}
          </span>
        )}

        {/* 후반에만 — 놓치면 그 자리에서 지는 값 */}
        {phase2 && (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              control < 0.3
                ? 'bg-rose-500/20 text-rose-300'
                : control < 0.6
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-emerald-500/15 text-emerald-300'
            }`}
          >
            통제 {formatPercent(control, 0)}
          </span>
        )}

        {/* 자금은 오른쪽 끝 — 증감 부호가 색으로 바로 읽히게 */}
        <span className="ml-auto shrink-0 text-right">
          <span className="block font-mono text-[11px] leading-tight tabular-nums text-slate-200">
            {formatMoney(state.player.money)}
          </span>
          <span
            className={`block font-mono text-[10px] leading-tight tabular-nums ${
              net >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatRate(net)}
          </span>
        </span>
      </div>

      {/* 진행도 막대 — 내 위치와 선두 위치를 같은 자 위에 겹쳐 놓습니다 */}
      <div className="relative h-1 w-full bg-slate-800">
        <div
          className="h-full bg-cyan-400 motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
        {showRivals && derived.leadingRival !== null && (
          <span
            className="absolute top-0 h-1 w-0.5 -translate-x-1/2 bg-rose-400"
            style={{
              left: `${Math.min(100, Math.max(0, rivalDisplayProgress(derived.leadingRival) * 100))}%`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
