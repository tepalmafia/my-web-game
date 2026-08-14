/**
 * ===========================================================================
 *  레이스 트랙 — 지금 누가 앞서고 있는가
 * ===========================================================================
 *
 *  이 게임의 긴장감은 숫자가 아니라 '거리'에서 나옵니다.
 *  "벡스 랩스 71%" 라고 적어두면 읽어야 알지만, 내 점보다 앞서 있는 점이
 *  결승선 쪽으로 슬금슬금 가는 걸 보면 읽지 않아도 압니다.
 *
 *  ─ 규칙 두 가지
 *    1) 경쟁사는 반드시 reportedProgress(추정치)만 보여줍니다.
 *       진짜 값(researchProgress)은 내부 계산용이라 화면에 절대 내보내지 않습니다.
 *    2) 경쟁사 상황판이 열리기 전에는 내 선 하나만 보입니다.
 *       아직 경쟁자의 존재를 모르는 단계인데 먼저 보여주면 해금의 의미가 없어집니다.
 *
 *  ─ 추월 연출
 *    경쟁사가 나를 앞지르는 '순간'을 놓치지 않도록, 그 줄을 잠깐 번쩍이게 합니다.
 *    막대 길이만 보고 있으면 언제 뒤집혔는지 모르고 지나가기 때문입니다.
 */

import { useEffect, useRef, useState } from 'react';
import type { GameState, Ratio, Rival, RivalPersonality, RivalStatus } from '../types';
import { ALERT } from '../balance';
import { rivalStatusFor } from '../constraints';
import { rivalName, s } from '../i18n';

/** 경쟁사마다 다른 색 (플레이어의 청록색과 겹치지 않게 고른 차분한 색들) */
const RIVAL_COLORS = [
  { dot: 'bg-amber-400', ring: 'ring-amber-300/60', text: 'text-amber-300', bar: 'bg-amber-400/80' },
  { dot: 'bg-rose-400', ring: 'ring-rose-300/60', text: 'text-rose-300', bar: 'bg-rose-400/80' },
  {
    dot: 'bg-violet-400',
    ring: 'ring-violet-300/60',
    text: 'text-violet-300',
    bar: 'bg-violet-400/80',
  },
];

/**
 * 경쟁사 한 곳의 색을 골라 줍니다.
 * 순서(index)로 정하므로 경쟁사가 늘어나도 색이 돌아가며 배정됩니다.
 * (레이스 트랙과 엔딩 화면이 같은 색을 쓰도록 여기 한 곳에서만 정합니다)
 */
export function rivalStyle(index: number): { bar: string; text: string } {
  return RIVAL_COLORS[index % RIVAL_COLORS.length]!;
}

/**
 * 화면에 보여줄 경쟁사 진행도.
 *
 * 평소에는 추정치(reportedProgress)를 그대로 씁니다.
 * 다만 이미 AGI에 도달한 곳은 추정치가 99%로 보이면 이상하므로 100%로 채웁니다.
 * (진짜 값 researchProgress 는 여기서도 쓰지 않습니다)
 */
export function rivalDisplayProgress(rival: Rival): number {
  if (rival.status === 'achieved') return 1;
  return rival.reportedProgress;
}

/** 추월 번쩍임이 유지되는 시간(밀리초) */
const OVERTAKE_FLASH_MS = 1800;

/** 성향을 한 단어로 (이름 밑 작은 글씨) */
function personalityNote(personality: RivalPersonality): string {
  return s().race.personality[personality];
}

/**
 * 상태 표시. 평소(racing)에는 아무것도 붙이지 않습니다 —
 * 늘 뭔가 적혀 있으면 정작 스퍼트나 정체가 눈에 안 들어옵니다.
 */
const STATUS_CLASS: Record<RivalStatus, string> = {
  racing: 'text-slate-500',
  sprinting: 'text-amber-400',
  stalled: 'text-sky-400',
  collapsed: 'text-slate-600',
  achieved: 'text-rose-400',
};

/** 트랙 위 점 하나가 놓일 위치를 % 로 바꿉니다 (양 끝이 잘리지 않게 살짝 여백을 둡니다) */
function trackLeft(progress: Ratio): string {
  const clamped = Math.max(0, Math.min(1, progress));
  return `calc(${(clamped * 100).toFixed(2)}% * 0.94 + 3%)`;
}

interface LaneProps {
  name: string;
  progress: Ratio;
  dotClass: string;
  ringClass: string;
  textClass: string;
  isPlayer: boolean;
  flashing: boolean;
  /** 결승선이 코앞이라 강조해야 하는가 */
  nearGoal: boolean;
  /** 이름 밑에 붙는 작은 글씨 (성향과 상태) */
  note?: string;
  /** 상태가 평소와 다를 때 그 글씨에 입힐 색 */
  noteClass?: string;
}

/** 트랙 한 줄 (연구소 하나) */
function Lane({
  name,
  progress,
  dotClass,
  ringClass,
  textClass,
  isPlayer,
  flashing,
  nearGoal,
  note,
  noteClass = 'text-slate-500',
}: LaneProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded px-1 py-1 transition-colors duration-500 ${
        flashing ? 'bg-rose-500/15' : ''
      }`}
    >
      <span className="w-20 shrink-0 sm:w-32" title={name}>
        <span
          className={`block truncate text-[11px] leading-tight ${
            isPlayer ? 'font-semibold text-cyan-300' : textClass
          }`}
        >
          {name}
        </span>
        {note !== undefined && (
          <span className={`block truncate text-[10px] leading-tight ${noteClass}`}>{note}</span>
        )}
      </span>

      {/* 트랙 바닥 */}
      <div className="relative h-5 flex-1">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-800" />

        {/*
          결승선 — 체크무늬 깃발.
          반드시 트랙 안쪽에 놓아야 합니다. 줄 전체를 기준으로 놓으면 이름 칸과
          퍼센트 칸까지 폭에 포함되어, 좁은 화면에서 깃발이 퍼센트 숫자를 덮어버립니다.
          위아래로 살짝 넘치게 그려서 줄이 이어져 보이게 합니다.
        */}
        <div
          className="pointer-events-none absolute -inset-y-1 w-1.5 -translate-x-1/2 rounded-sm opacity-70"
          style={{
            left: trackLeft(1),
            backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #0f172a 0% 50%)',
            backgroundSize: '6px 6px',
          }}
          aria-hidden="true"
        />
        {/* 25% / 50% / 75% 눈금 — 거리 감각을 주기 위한 표시 */}
        {[0.25, 0.5, 0.75].map((mark) => (
          <div
            key={mark}
            className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-slate-800"
            style={{ left: trackLeft(mark) }}
          />
        ))}

        {/* 지나온 거리 */}
        <div
          className={`absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full motion-safe:transition-[width] motion-safe:duration-300 ${
            isPlayer ? 'bg-cyan-400/50' : dotClass.replace('bg-', 'bg-') + '/30'
          }`}
          style={{ left: '3%', width: `calc(${trackLeft(progress)} - 3%)` }}
        />

        {/* 주자 */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 motion-safe:transition-[left] motion-safe:duration-300"
          style={{ left: trackLeft(progress) }}
        >
          <span
            className={`block rounded-full ring-2 ${dotClass} ${ringClass} ${
              isPlayer ? 'h-3 w-3' : 'h-2.5 w-2.5'
            } ${nearGoal ? 'motion-safe:animate-pulse' : ''}`}
          />
        </div>
      </div>

      <span
        className={`w-11 shrink-0 text-right font-mono text-[11px] tabular-nums ${
          isPlayer ? 'text-cyan-200' : textClass
        }`}
      >
        {(progress * 100).toFixed(0)}%
      </span>
    </div>
  );
}

interface RaceTrackProps {
  state: GameState;
}

/**
 * 화면 맨 위의 레이스 트랙.
 * 내 선은 항상 맨 위에 있고 혼자만 청록색이라, 눈이 먼저 자기 위치를 찾습니다.
 */
export function RaceTrack({ state }: RaceTrackProps) {
  const showRivals = state.unlocks.rivals;
  const playerProgress = state.player.researchProgress;

  // 직전에 누가 나보다 앞서 있었는지를 기억해두었다가, 새로 앞지른 곳을 번쩍이게 합니다
  const wasAhead = useRef<Record<string, boolean>>({});
  const [flashing, setFlashing] = useState<string[]>([]);

  useEffect(() => {
    if (!showRivals) return;

    const newlyAhead = state.rivals
      .filter((rival) => {
        const ahead = rivalDisplayProgress(rival) > playerProgress;
        const before = wasAhead.current[rival.id] ?? false;
        wasAhead.current[rival.id] = ahead;
        return ahead && !before;
      })
      .map((rival) => rival.id);

    if (newlyAhead.length === 0) return;

    setFlashing((current) => [...current, ...newlyAhead]);
    const timer = setTimeout(() => {
      setFlashing((current) => current.filter((id) => !newlyAhead.includes(id)));
    }, OVERTAKE_FLASH_MS);
    return () => clearTimeout(timer);
  }, [state.rivals, playerProgress, showRivals]);

  return (
    <section
      className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
      aria-label={s().race.aria}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-300">{s().race.heading}</h2>
        <span className="text-[11px] text-slate-500">
          {showRivals ? s().race.finishLine : s().race.unknown}
        </span>
      </div>

      <div className="relative">
        <div className="flex flex-col gap-0.5">
          <Lane
            name={state.player.labName}
            progress={playerProgress}
            dotClass="bg-cyan-400"
            ringClass="ring-cyan-300/60"
            textClass="text-cyan-200"
            isPlayer
            flashing={false}
            nearGoal={playerProgress >= ALERT.rivalNearGoal}
            note={s().race.us}
            noteClass="text-cyan-600"
          />

          {showRivals &&
            state.rivals.map((rival, index) => {
              const color = RIVAL_COLORS[index % RIVAL_COLORS.length]!;
              const dead = rival.status === 'collapsed';
              // 표시용 상태는 저장된 값이 아니라 지금의 속도 배수에서 곧바로 끌어냅니다.
              // (저장값에 기대면 개입 직후 한 박자 늦게 반영됩니다)
              const status = rivalStatusFor(rival);
              return (
                <Lane
                  key={rival.id}
                  name={rivalName(rival)}
                  progress={rivalDisplayProgress(rival)}
                  dotClass={dead ? 'bg-slate-600' : color.dot}
                  ringClass={dead ? 'ring-slate-700' : color.ring}
                  textClass={dead ? 'text-slate-600' : color.text}
                  isPlayer={false}
                  flashing={flashing.includes(rival.id)}
                  nearGoal={!dead && rivalDisplayProgress(rival) >= ALERT.rivalNearGoal}
                  note={`${personalityNote(rival.personality)}${s().race.status[status]}`}
                  noteClass={STATUS_CLASS[status]}
                />
              );
            })}
        </div>
      </div>
    </section>
  );
}
