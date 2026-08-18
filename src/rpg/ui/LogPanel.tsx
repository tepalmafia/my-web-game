/** 방금 무슨 일이 있었는지 — 아래에서 위로 쌓이는 기록창 */

import { useEffect, useRef } from 'react';
import type { World } from '../types';

const TONE: Record<string, string> = {
  normal: 'text-slate-400',
  good: 'text-emerald-300',
  bad: 'text-rose-300',
  epic: 'text-amber-300 font-bold',
};

export function LogPanel({ world }: { world: World }) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = world.log[world.log.length - 1]?.id ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  return (
    <div className="h-32 shrink-0 overflow-y-auto border-t border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-[11px] leading-relaxed lg:h-40">
      {world.log.map((line) => (
        <p key={line.id} className={TONE[line.tone]}>
          {line.text}
        </p>
      ))}
      <div ref={endRef} />
    </div>
  );
}
