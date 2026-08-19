/**
 *  게임 화면.
 *
 *  하는 일은 셋뿐입니다.
 *      1) 매 프레임 세계를 한 칸 굴리고 (core/engine.ts)
 *      2) 그 결과를 캔버스에 그리고 (ui/draw.ts)
 *      3) 마우스·손가락·키보드를 core/commands.ts 로 넘깁니다
 *
 *  계산은 60프레임으로 돌지만 글자로 된 화면(체력 숫자, 가방)은 초당 12번만 다시 그립니다.
 *  매 프레임 다시 그릴 이유가 없고, 그렇게 하면 휴대폰이 뜨거워집니다.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { MAX_STEP } from '../balance';
import { clickWorld, drinkBestPotion, moveTo, toggleAuto, useSkill } from '../core/commands';
import { step } from '../core/engine';
import { saveWorld } from '../core/save';
import type { World } from '../types';
import { ActionBar, BossTimer, BuffRow, DeathOverlay, QuestTracker, StatusBlock, Toast } from './Hud';
import { LogPanel } from './LogPanel';
import { SidePanel } from './Panels';
import { draw, computeView, screenToWorld } from './draw';

export function GameScreen({ world, onQuit }: { world: World; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const refresh = useCallback(() => bump(), []);

  /* ---------------------------------------------------------- 게임 루프 */
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let uiTimer = 0;
    let saveTimer = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;

      // 한 번에 크게 뛰지 않도록 잘게 나눠 계산합니다 (탭을 다시 켰을 때 순간이동을 막습니다)
      let remaining = dt;
      let guard = 0;
      while (remaining > 0 && guard++ < 6) {
        const slice = Math.min(MAX_STEP, remaining);
        step(world, slice);
        remaining -= slice;
      }

      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (canvas && wrap) {
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const width = wrap.clientWidth;
        const height = wrap.clientHeight;
        if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
          canvas.width = Math.floor(width * ratio);
          canvas.height = Math.floor(height * ratio);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          draw(ctx, world, width, height);
        }
      }

      uiTimer += dt;
      if (uiTimer > 0.08) {
        uiTimer = 0;
        bump();
      }
      saveTimer += dt;
      if (saveTimer > 5) {
        saveTimer = 0;
        saveWorld(world);
      }
    };

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      saveWorld(world);
    };
  }, [world]);

  /* ---------------------------------------------------------- 키보드 */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      switch (event.key) {
        case '1': useSkill(world, 0); break;
        case '2': useSkill(world, 1); break;
        case '3': useSkill(world, 2); break;
        case 'q': case 'Q': case 'ㅂ': drinkBestPotion(world, 'hp'); break;
        case 'w': case 'W': case 'ㅈ': drinkBestPotion(world, 'mp'); break;
        case 'i': case 'I': case 'ㅑ': world.panel = 'inventory'; break;
        case 'c': case 'C': case 'ㅊ': world.panel = 'character'; break;
        case ' ': event.preventDefault(); toggleAuto(world); break;
        case 'Escape': world.panel = null; break;
        default: return;
      }
      bump();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [world]);

  /* ---------------------------------------------------------- 마우스와 손가락 */
  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const view = computeView(world, rect.width, rect.height);
    return screenToWorld(view, event.clientX - rect.left, event.clientY - rect.top);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    const point = pointFromEvent(event);
    clickWorld(world, point.x, point.y);
    bump();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    // 누른 채로 끌면 계속 따라옵니다 (몬스터를 다시 고르지는 않습니다)
    const point = pointFromEvent(event);
    if (world.player.targetId === null) moveTo(world, point.x, point.y);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-ink-900 text-parch-100 lg:flex-row">
      {/* ----------------------------------------------------- 화면 */}
      <div ref={wrapRef} className="relative h-[56dvh] shrink-0 overflow-hidden lg:h-full lg:min-h-0 lg:flex-1">
        <canvas ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        <div className="pointer-events-none absolute left-2 top-2 z-10">
          <StatusBlock world={world} />
          <BuffRow world={world} />
          <div className="mt-1"><QuestTracker world={world} /></div>
        </div>

        <div className="pointer-events-none absolute right-2 top-[136px] z-10 flex flex-col items-end gap-1">
          <BossTimer world={world} />
        </div>

        {/*
          단추 줄은 화면 아래 전체를 가로지릅니다. 그대로 두면 단추 사이의 빈 곳이
          캔버스 클릭을 가로채, 화면 아래쪽을 눌러도 캐릭터가 움직이지 않습니다.
          그래서 껍데기는 클릭을 통과시키고(pointer-events-none) 단추만 받습니다.
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center px-2">
          <ActionBar world={world} refresh={refresh} />
        </div>

        <button
          type="button"
          onClick={onQuit}
          className="btn absolute bottom-16 left-2 z-10 rounded-sm px-2.5 py-1 text-[11px] text-parch-300 lg:bottom-2"
        >
          나가기
        </button>

        <Toast world={world} />
        <DeathOverlay world={world} refresh={refresh} />
      </div>

      {/* ----------------------------------------------------- 오른쪽 창 */}
      <aside className="flex min-h-0 flex-1 flex-col border-ink-600 bg-ink-800 lg:h-full lg:w-[380px] lg:flex-none lg:border-l">
        <div className="flex min-h-0 flex-1 flex-col">
          <SidePanel world={world} refresh={refresh} />
        </div>
        <LogPanel world={world} />
      </aside>
    </div>
  );
}
