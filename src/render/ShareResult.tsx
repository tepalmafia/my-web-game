/**
 * ===========================================================================
 *  결과 자랑하기 — 한 판이 끝나면 자랑할 문구를 만들어 줍니다
 * ===========================================================================
 *
 *  링크를 받아서 해본 사람이 다시 남에게 퍼뜨리게 만드는 장치입니다.
 *  그러려면 붙여넣기만 하면 되는 완성된 문장이어야 합니다 —
 *  "몇 분에 이겼는지" 와 "어디서 할 수 있는지" 가 한 덩어리로 들어 있어야
 *  받는 사람이 바로 눌러볼 수 있습니다.
 *
 *  주소는 지금 보고 있는 페이지 주소를 그대로 씁니다.
 *  (배포 주소를 코드에 박아두면 나중에 주소가 바뀔 때 조용히 틀린 링크를 뿌리게 됩니다)
 */

import { useEffect, useState } from 'react';
import { formatCompact, formatDuration, formatPercent } from '../input';
import type { GameOutcome, GameState } from '../types';

/** 결과별 한 줄 요약 */
const OUTCOME_LINE: Record<GameOutcome, string> = {
  agiAchieved: 'AGI 달성 — 승리',
  rivalWon: '경쟁 연구소에 선수를 빼앗김',
  bankrupt: '자금이 바닥나 연구소 폐쇄',
  catastrophe: '안전을 무시하다 사고 발생',
};

/**
 * 자랑용 문구를 만듭니다.
 *
 * 화면 없이도 쓸 수 있게 순수 함수로 두었습니다 (주소는 밖에서 넣어 줍니다).
 */
export function buildShareText(state: GameState, url: string): string {
  const outcome = state.outcome;
  const headline = outcome === null ? '진행 중' : OUTCOME_LINE[outcome];
  const win = outcome === 'agiAchieved';

  const lines = [
    `AGI 경주 🏁 ${headline}`,
    `${state.player.labName} · ${formatDuration(state.elapsed)} · 진행도 ${formatPercent(
      state.player.researchProgress,
    )}`,
    `GPU ${formatCompact(state.player.gpus)}장 · 연구원 ${formatCompact(
      state.player.researchers,
    )}명 · 남은 지분 ${formatPercent(state.player.equityRetained)}`,
  ];

  // 진 사람은 도발을, 이긴 사람은 기록 경신을 부추깁니다
  lines.push(win ? '더 빨리 도달할 수 있나요?' : '당신은 더 잘할 수 있나요?');
  lines.push(url);

  return lines.join('\n');
}

/** 지금 보고 있는 페이지 주소 (물음표 뒤와 # 뒤는 떼어 냅니다) */
function currentUrl(): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return `${origin}${pathname}`;
}

/**
 * 클립보드에 복사합니다.
 *
 * navigator.clipboard 는 https 가 아니거나 권한이 없으면 실패합니다.
 * 그럴 때를 대비해 예전 방식(임시 입력칸을 만들어 복사)을 함께 둡니다.
 * 둘 다 실패하면 false 를 돌려주고, 화면은 직접 복사하도록 문구를 보여줍니다.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래 예전 방식으로 한 번 더 시도합니다
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** 복사 완료 표시가 유지되는 시간(밀리초) */
const FEEDBACK_MS = 2200;

/** 결과 화면의 '결과 복사하기' 버튼 */
export function ShareResult({ state }: { state: GameState }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  // 복사 완료 표시는 잠깐 뒤에 스스로 사라집니다
  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const text = buildShareText(state, currentUrl());

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          void copyToClipboard(text).then((ok) => setStatus(ok ? 'copied' : 'failed'));
        }}
        className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 active:bg-slate-700"
      >
        {status === 'copied' ? '복사했습니다 — 붙여넣기만 하면 됩니다' : '결과 자랑하기'}
      </button>

      {/* 복사가 막힌 브라우저에서는 직접 긁어갈 수 있게 문구를 그대로 보여줍니다 */}
      {status === 'failed' && (
        <div className="mt-2">
          <p className="text-[11px] text-amber-300">
            이 브라우저에서는 자동 복사가 막혀 있습니다. 아래 글을 직접 복사해 주세요.
          </p>
          <textarea
            readOnly
            value={text}
            rows={5}
            onFocus={(focusEvent) => focusEvent.currentTarget.select()}
            className="mt-1 w-full resize-none rounded border border-slate-700 bg-slate-950 p-2 font-mono text-[11px] text-slate-300"
          />
        </div>
      )}
    </div>
  );
}
