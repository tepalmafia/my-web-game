/**
 * ===========================================================================
 *  경쟁사 상황판 — 지금 내가 몇 등인가
 * ===========================================================================
 *
 *  이 게임의 긴장감은 전부 이 패널에서 나옵니다. 내 막대와 경쟁사 세 곳의 막대를
 *  같은 자리에 나란히 세워두어, 한눈에 '따라잡히고 있는가'가 보이게 합니다.
 *
 *  ★ 반드시 지켜야 할 규칙
 *    경쟁사에게는 두 개의 진행도가 있습니다.
 *      · researchProgress : 진짜 값. 승패 판정에만 쓰는 내부 값입니다.
 *      · reportedProgress : 바깥에서 추정한 값. 진짜 값과 조금 다릅니다.
 *    화면에는 반드시 reportedProgress 만 보여줍니다.
 *    "경쟁사 사정을 정확히는 알 수 없다"가 이 게임의 설정이기 때문입니다.
 */

import { formatPercent } from '../input';
import type { GameState, Rival, RivalPersonality, RivalStatus } from '../types';
import { Panel } from './ActionPanel';
import { ProgressBar } from './ProgressBar';

/** 경쟁사마다 다른 색 (플레이어의 청록색과 겹치지 않게 고른 차분한 색들) */
export const RIVAL_STYLES: { bar: string; text: string }[] = [
  { bar: 'bg-amber-400/80', text: 'text-amber-300' },
  { bar: 'bg-rose-400/80', text: 'text-rose-300' },
  { bar: 'bg-violet-400/80', text: 'text-violet-300' },
];

/** 성향을 한국어 한 단어로 */
const PERSONALITY_LABEL: Record<RivalPersonality, string> = {
  capital: '자금력형',
  speed: '속도형',
  efficiency: '효율형',
};

/** 상태를 한국어 한 단어로 */
const STATUS_LABEL: Record<RivalStatus, string> = {
  racing: '추격 중',
  sprinting: '가속 중',
  stalled: '정체',
  collapsed: '이탈',
  achieved: '달성',
};

/** 상태별 글자 색 */
const STATUS_CLASS: Record<RivalStatus, string> = {
  racing: 'text-slate-400',
  sprinting: 'text-amber-300',
  stalled: 'text-sky-300',
  collapsed: 'text-slate-600 line-through',
  achieved: 'text-rose-300',
};

/**
 * 경쟁사 한 곳의 색·이름·상태를 골라 줍니다.
 * 순서(index)로 색을 정하므로 경쟁사가 늘어나도 색이 돌아가며 배정됩니다.
 */
export function rivalStyle(index: number): { bar: string; text: string } {
  return RIVAL_STYLES[index % RIVAL_STYLES.length];
}

/**
 * 화면에 보여줄 경쟁사 진행도.
 *
 * 평소에는 추정치(reportedProgress)를 그대로 씁니다.
 * 다만 이미 AGI에 도달한 곳은 추정치가 99% 로 보이면 이상하므로 100%로 채웁니다.
 * (진짜 값 researchProgress 는 여기서도 쓰지 않습니다)
 */
export function rivalDisplayProgress(rival: Rival): number {
  if (rival.status === 'achieved') return 1;
  return rival.reportedProgress;
}

/** 이름 · 성향 · 상태 · 추정 진행도 막대 한 줄 */
function RivalRow({ rival, index }: { rival: Rival; index: number }) {
  const style = rivalStyle(index);
  const progress = rivalDisplayProgress(rival);
  const dimmed = rival.status === 'collapsed';

  return (
    <li className={dimmed ? 'opacity-50' : ''}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1.5 text-xs">
          <span className={`font-semibold ${style.text}`}>{rival.name}</span>
          <span className="text-[10px] text-slate-500">
            {PERSONALITY_LABEL[rival.personality]}
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className={`text-[10px] ${STATUS_CLASS[rival.status]}`}>
            {STATUS_LABEL[rival.status]}
          </span>
          <span className="font-mono text-xs text-slate-300">{formatPercent(progress)}</span>
        </span>
      </div>
      <div className="mt-1">
        <ProgressBar
          value={progress}
          label={`${rival.name} 추정 진행도`}
          colorClass={style.bar}
          size="sm"
        />
      </div>
    </li>
  );
}

interface RivalBoardProps {
  state: GameState;
  /** 방금 열린 패널인가 */
  isNew: boolean;
}

/**
 * 내 진행도와 경쟁사 세 곳의 추정 진행도를 한 자리에 세워 보여줍니다.
 *
 * 맨 위가 항상 내 연구소이고 색도 혼자만 청록색입니다.
 * 그래야 아래 세 줄과 내 줄을 한눈에 구분할 수 있습니다.
 */
export function RivalBoard({ state, isNew }: RivalBoardProps) {
  return (
    <Panel
      title="경쟁사 상황판"
      description="바깥에서 추정한 값이라 실제와 조금 다를 수 있습니다. 그래도 누가 앞서는지는 이걸로 봅니다."
      isNew={isNew}
      wide
    >
      <ul className="space-y-2.5">
        {/* 내 연구소 — 혼자만 다른 색, 항상 맨 위 */}
        <li className="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-cyan-300">
              {state.player.labName} <span className="text-[10px] text-slate-500">우리</span>
            </span>
            <span className="font-mono text-xs text-cyan-200">
              {formatPercent(state.player.researchProgress)}
            </span>
          </div>
          <div className="mt-1">
            <ProgressBar
              value={state.player.researchProgress}
              label="내 연구소의 AGI 진행도"
              colorClass="bg-cyan-400"
              size="sm"
            />
          </div>
        </li>

        {state.rivals.map((rival, index) => (
          <RivalRow key={rival.id} rival={rival} index={index} />
        ))}
      </ul>
    </Panel>
  );
}
