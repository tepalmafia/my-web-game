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
  const boxRef = useRef<HTMLDivElement>(null);
  const lastId = world.log[world.log.length - 1]?.id ?? 0;

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // ★ scrollIntoView 를 쓰면 안 됩니다. 그것은 스크롤되는 조상을 전부 움직여서,
    //   새 기록 한 줄이 들어올 때마다 아래 창 전체가 밀려 올라갔습니다.
    //   여기서는 이 상자만 맨 아래로 내립니다.
    box.scrollTop = box.scrollHeight;
  }, [lastId]);

  return (
    <div
      ref={boxRef}
      // 폰 세로에서는 기록이 아래 창을 잡아먹지 않도록 얇게 (세 줄), 큰 화면에서는 넉넉히
      className="h-16 shrink-0 overflow-y-auto overscroll-contain border-t border-ink-600 bg-ink-900 px-3 py-1.5 text-[11px] leading-relaxed lg:h-36 lg:py-2"
    >
      {world.log.map((line) => (
        <p key={line.id} className={TONE[line.tone]}>
          <span className="text-parch-400/50">· </span>
          {line.text}
        </p>
      ))}
    </div>
  );
}
