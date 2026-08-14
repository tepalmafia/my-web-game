/**
 * ===========================================================================
 *  데이터센터 시각화 — 내 설비가 지금 어떤 상태인가
 * ===========================================================================
 *
 *  숫자로 "GPU 12,400 / 20,000장, 그중 8,300장 가동" 이라고 적으면 읽어야 알지만,
 *  칸이 차오르다가 일부가 회색으로 꺼져 있으면 한눈에 압니다.
 *
 *  칸 색이 뜻하는 것은 셋뿐입니다.
 *      청록 = 지금 돌아가는 GPU        (연구 속도를 만드는 것은 이것뿐입니다)
 *      호박 = 샀지만 전력이 없어 노는 GPU  (돈만 나가고 일은 안 하는 상태)
 *      회색 = 아직 비어 있는 자리
 *
 *  이 게임에서 가장 흔한 실수가 '전력 없이 GPU만 사기' 인데,
 *  호박색 칸이 눈에 띄게 늘어나면 설명 없이도 무엇이 잘못됐는지 알게 됩니다.
 *
 *  건물 한 동은 칸 32개로 그립니다. 실제 장수와 칸 수는 비례하지 않고,
 *  '이 동이 얼마나 찼는가'를 비율로 보여줍니다.
 */

import { DATACENTER } from '../balance';
import { activeGpus, gpuCapacity } from '../constraints';
import type { GameState } from '../types';

/** 건물 한 동을 그릴 때 쓰는 칸 수 (4줄 × 8칸) */
const CELLS_PER_BLOCK = 32;

interface Block {
  label: string;
  /** 이 동이 수용할 수 있는 GPU 장수 */
  capacity: number;
  /** 이 동에서 돌아가는 장수 */
  active: number;
  /** 이 동에서 놀고 있는 장수 */
  idle: number;
}

/**
 * 보유·가동 장수를 건물별로 나눠 담습니다.
 * 기본 클러스터부터 채우고 넘치면 다음 동으로 넘어갑니다.
 */
function buildBlocks(state: GameState): Block[] {
  const blocks: Block[] = [
    { label: '기본 클러스터', capacity: DATACENTER.baseCapacity, active: 0, idle: 0 },
  ];
  for (let i = 0; i < state.player.datacenters; i++) {
    blocks.push({
      label: `데이터센터 ${i + 1}동`,
      capacity: DATACENTER.slotsPerUnit,
      active: 0,
      idle: 0,
    });
  }

  // 돌아가는 GPU를 앞 동부터 채우고, 그다음 노는 GPU를 이어서 채웁니다
  let remainingActive = activeGpus(state);
  let remainingIdle = Math.max(0, state.player.gpus - remainingActive);

  for (const block of blocks) {
    const room = block.capacity;
    block.active = Math.min(remainingActive, room);
    remainingActive -= block.active;
    block.idle = Math.min(remainingIdle, room - block.active);
    remainingIdle -= block.idle;
  }

  return blocks;
}

/** 건물 한 동 */
function RackBlock({ block }: { block: Block }) {
  const activeCells = Math.round((block.active / block.capacity) * CELLS_PER_BLOCK);
  // 0장이 아닌데 0칸으로 보이면 '아무것도 없다'고 오해하므로 최소 한 칸은 켭니다
  const shownActive = block.active > 0 ? Math.max(1, activeCells) : 0;
  const idleCells = Math.round((block.idle / block.capacity) * CELLS_PER_BLOCK);
  const shownIdle = Math.min(
    CELLS_PER_BLOCK - shownActive,
    block.idle > 0 ? Math.max(1, idleCells) : 0,
  );

  const used = block.active + block.idle;

  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 p-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-1">
        <span className="truncate text-[10px] text-slate-500">{block.label}</span>
        <span className="font-mono text-[10px] tabular-nums text-slate-600">
          {Math.round((used / block.capacity) * 100)}%
        </span>
      </div>
      <div className="grid grid-cols-8 gap-[2px]">
        {Array.from({ length: CELLS_PER_BLOCK }, (_, i) => {
          const kind = i < shownActive ? 'active' : i < shownActive + shownIdle ? 'idle' : 'empty';
          return (
            <span
              key={i}
              className={`h-1.5 rounded-[1px] ${
                kind === 'active'
                  ? 'bg-cyan-400'
                  : kind === 'idle'
                    ? 'bg-amber-400/80'
                    : 'bg-slate-800'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

interface DatacenterViewProps {
  state: GameState;
  isNew?: boolean;
}

/** 설비 현황판 */
export function DatacenterView({ state, isNew = false }: DatacenterViewProps) {
  const blocks = buildBlocks(state);
  const running = activeGpus(state);
  const owned = state.player.gpus;
  const idle = Math.max(0, owned - running);
  const capacity = gpuCapacity(state);

  return (
    <section
      className={`rounded-lg border bg-slate-900/60 p-3 ${
        idle > 0 ? 'border-amber-500/40' : 'border-slate-800'
      }`}
      aria-label="설비 현황"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-300">
          설비 현황
          {isNew && (
            <span className="rounded bg-cyan-500/20 px-1 py-px text-[9px] font-bold text-cyan-300">
              NEW
            </span>
          )}
        </h2>
        <span className="font-mono text-[11px] tabular-nums text-slate-500">
          {owned.toLocaleString()} / {capacity.toLocaleString()}장
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {blocks.map((block) => (
          <RackBlock key={block.label} block={block} />
        ))}
      </div>

      {/* 범례 — 색이 무엇을 뜻하는지 한 줄로 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-[1px] bg-cyan-400" />
          가동 {running.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-[1px] bg-amber-400/80" />
          노는 중 {idle.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-[1px] bg-slate-800" />빈 자리{' '}
          {Math.max(0, capacity - owned).toLocaleString()}
        </span>
      </div>

      {idle > 0 && (
        <p className="mt-1.5 text-[11px] text-amber-300">
          전력이 모자라 {idle.toLocaleString()}장이 돈만 먹고 놀고 있습니다 — 전력을 더
          계약하세요.
        </p>
      )}
    </section>
  );
}
