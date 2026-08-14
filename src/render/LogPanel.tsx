/**
 * ===========================================================================
 *  기록창 — 지금까지 무슨 일이 있었는가
 * ===========================================================================
 *
 *  버튼을 누른 결과, 새로 열린 항목, 사건의 결말이 여기에 한 줄씩 쌓입니다.
 *  색만 봐도 좋은 일인지 나쁜 일인지 알 수 있게 tone 별로 색을 다르게 씁니다.
 *
 *  최신 줄이 맨 위에 옵니다. state.log 자체가 이미 최신 순으로 정렬되어 오기 때문에
 *  여기서 다시 정렬하지 않습니다.
 */

import { formatDuration } from '../input';
import type { LogEntry, LogTone } from '../types';

/** 로그 색깔표 (types.ts 의 LogTone 네 가지와 하나씩 짝을 이룹니다) */
const TONE_CLASS: Record<LogTone, string> = {
  info: 'text-slate-400',
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  bad: 'text-rose-300',
};

interface LogPanelProps {
  log: LogEntry[];
}

/**
 * 기록을 최신 순으로 그립니다.
 *
 * 줄이 계속 쌓이므로 창 안에서만 스크롤되게 하고, 화면 전체는 흐르지 않게 둡니다.
 * (화면 전체가 길어지면 위쪽 자원 표시줄과 버튼을 다시 찾아 올라가야 해서 불편합니다)
 */
export function LogPanel({ log }: LogPanelProps) {
  return (
    <aside className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <h2 className="text-sm font-semibold tracking-wide text-slate-200">기록</h2>

      {log.length === 0 ? (
        <p className="mt-2 text-xs text-slate-600">아직 기록이 없습니다.</p>
      ) : (
        <ol className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1 md:max-h-[calc(100vh-19rem)]">
          {log.map((entry) => (
            <li key={entry.id} className="flex gap-2 text-xs leading-relaxed">
              <span className="shrink-0 font-mono text-[10px] text-slate-600">
                {formatDuration(entry.at)}
              </span>
              <span className={TONE_CLASS[entry.tone]}>{entry.text}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
