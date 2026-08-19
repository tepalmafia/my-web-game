/**
 *  직업 선택 화면에 세워두는 인물상.
 *
 *  게임 안에서 쓰는 그리기 코드를 그대로 불러 크게 그립니다.
 *  따로 그림을 그려두면 나중에 캐릭터 모양을 고쳤을 때 이 그림만 옛날 모습으로 남습니다.
 */

import { useEffect, useRef } from 'react';

import { createWorld } from '../core/create';
import type { ClassId } from '../types';
import { drawPlayer } from './art/actors';

export function ClassPortrait({ classId, size = 96 }: { classId: ClassId; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 이 인물 하나를 그리기 위한 최소한의 세계
    const world = createWorld('', classId);
    world.player.pos = { x: 0, y: 0 };
    world.player.facing = 0.6;
    world.playerMoving = false;

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * ratio;
    canvas.height = size * ratio;

    let frame = 0;
    let start = performance.now();

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      world.time = (now - start) / 1000;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.translate(size / 2, size * 0.66);
      ctx.scale(size / 46, size / 46);
      drawPlayer(ctx, world);
      ctx.restore();
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [classId, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} aria-hidden />;
}
