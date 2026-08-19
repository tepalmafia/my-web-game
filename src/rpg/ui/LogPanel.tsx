/** 방금 무슨 일이 있었는지 — 아래에서 위로 쌓이는 기록창 */

import { useEffect, useRef } from 'react';
import type { World } from '../types';

const TONE: Record<string, string> = {
  normal: 'text-parch-400',
  good: 'text-[#8fcf8a]',
  bad: 'text-[#e88a86]',
  epic: 'text-brass-300 font-bold',
};

export function LogPanel({ world }: { world: World }) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = world.log[world.log.length - 1]?.id ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  return (
    <div className="h-28 shrink-0 overflow-y-auto border-t border-ink-600 bg-ink-900 px-3 py-2 text-[11px] leading-relaxed lg:h-36">
      {world.log.map((line) => (
        <p key={line.id} className={TONE[line.tone]}>
          <span className="text-parch-400/50">· </span>
          {line.text}
        </p>
      ))}
      <div ref={endRef} />
    </div>
  );
}
