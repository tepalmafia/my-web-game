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

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { MAX_STEP } from '../balance';
import { clickWorld, drinkBestPotion, moveTo, stopAction, takeGround, takeMyPack } from '../core/commands';
import { startMining, veinAt } from '../core/action';
import { GATHER } from '../balance';
import { step } from '../core/engine';
import { saveWorld } from '../core/save';
import type { World } from '../types';
import { ActionBar, DeathOverlay, SkillPop, StatusBlock, Toast } from './Hud';
import { LogPanel } from './LogPanel';
import { SidePanel } from './Panels';
import { draw, computeView, screenToWorld } from './draw';
import { attachFlinch, tickFlinch } from './flinch';
import { attachImpact, frozen, kick, tickImpact } from './impact';
import { SoundControl } from './SoundControl';
import { attachAudio } from '../audio';
import { DevTools, devSpeed, reportSpeed } from '../dev/DevTools'; // 지울 때: 이 줄과 아래 <DevTools/> 한 줄, 그리고 dev/ 폴더

/**
 *  한 프레임에 흘릴 수 있는 세계 시간의 천장.
 *
 *  ★ 이 값이 하는 일이 둘입니다.
 *      · 탭에서 돌아왔을 때 밀린 시간이 한꺼번에 쏟아지는 것을 막습니다
 *      · 배속이 아무리 높아도 한 프레임이 이보다 더 흐르지 못하게 합니다
 *    둘은 같은 문제입니다 — 한 프레임에 시간을 몰아 흘리는 것.
 *
 *  ★ 0.25초면 MAX_STEP(0.05) 다섯 조각입니다. 그보다 크게 잡으면 한 프레임에
 *    몬스터가 여러 번 때리고, 작게 잡으면 8배속이 낮은 프레임에서 안 나옵니다.
 */
const FRAME_MAX = 0.25;

export function GameScreen({ world, onQuit }: { world: World; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  /** 눌러둔 광맥 — 걸어가서 닿으면 캐기 시작합니다 */
  const pendingVein = useRef<number | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const refresh = useCallback(() => bump(), []);

  /**
   *  창을 접어둡니다 — 폰은 아래로, 넓은 화면은 오른쪽으로.
   *
   *  ★ 폰에서 접혀 있으면 게임 화면이 88% 가 됩니다 (펼치면 46%).
   *  ★ 넓은 화면에서도 접힙니다. 예전에는 380px 를 늘 먹었는데,
   *    거기 있는 숫자(스킬·가방)는 초 단위로 변하는 것이 아니라
   *    늘 보고 있을 것이 아닙니다.
   *  ★ 처음에는 펼쳐 둡니다. 마을에서는 대장간과 상점이 저 창이라
   *    접힌 채로 시작하면 무엇을 눌러야 할지가 한 겹 더 숨습니다.
   */
  const [sheetOpen, setSheetOpen] = useState(true);
  const lastPanel = useRef(world.panel);

  // 대장장이에게 다가가거나(engine), I·S·C·Esc 를 누르면(아래 키보드) world.panel 이 바뀝니다.
  // 그 변화를 따라 저절로 펼쳐지고 접힙니다 — 규칙 쪽은 이 창이 접힌다는 것을 모릅니다.
  useEffect(() => {
    if (world.panel === lastPanel.current) return;
    lastPanel.current = world.panel;
    setSheetOpen(world.panel !== null);
  });

  //  ★ 폰 세로는 접힌 채로 시작합니다. 넓은 화면과 값이 다른 이유는
  //    화면에서 창이 차지하는 몫이 다르기 때문입니다 (폰 54dvh vs 넓은 화면 380px).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setSheetOpen(false);
    }
  }, []);

  /* ---------------------------------------------------------- 소리와 타격감 */
  // 판단은 전부 audio/ 와 ui/impact.ts 가 합니다. 여기서는 잇기만 합니다.
  useEffect(() => attachAudio(), []);
  useEffect(() => attachImpact(), []);
  useEffect(() => attachFlinch(), []);

  /* ---------------------------------------------------------- 게임 루프 */
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let uiTimer = 0;
    let saveTimer = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(FRAME_MAX, (now - last) / 1000);
      last = now;

      // 히트스톱과 움찔거림은 실제 시간으로 흐릅니다 — 멈춰 있는 동안에도 재워야 풀립니다
      tickImpact(dt);
      tickFlinch(dt);

      //  한 번에 크게 뛰지 않도록 잘게 나눠 계산합니다.
      //
      //  ★ 상한이 두 겹입니다. 위의 dt 상한(0.25초)이 **한 프레임에 흘릴 수 있는
      //    세계 시간의 천장**이고, 여기 MAX_STEP(0.05초) 은 그것을 다시 썹니다.
      //    상한이 없으면 탭에서 돌아온 순간이나 배속에서 캐릭터가 순간이동하고
      //    몬스터에게 몰매를 맞습니다 — 한 프레임에 몰아 흐르는 것은 둘 다 같은 문제입니다.
      //
      //  ★ 배속(dev/)은 흘릴 시간을 곱할 뿐입니다. core/ 는 배속을 모릅니다.
      //    상한에 걸리면 요청한 배수보다 덜 흐르는데, 그것을 그대로 알려줍니다 —
      //    조용히 느려지면 왜 이상한지 알 수가 없습니다 (CLAUDE.md 6장).
      if (!frozen()) {
        const want = dt * devSpeed();
        let remaining = Math.min(FRAME_MAX, want);
        const willFlow = remaining;
        while (remaining > 0) {
          const slice = Math.min(MAX_STEP, remaining);
          step(world, slice);
          remaining -= slice;
        }
        reportSpeed(dt > 0 ? willFlow / dt : devSpeed());
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
          // 때린 순간 화면을 몇 픽셀 밀어줍니다 (world.shake 와는 별개로 그 위에 더해집니다)
          const shove = kick();
          ctx.setTransform(ratio, 0, 0, ratio, shove.x * ratio, shove.y * ratio);
          draw(ctx, world, width, height);
        }
      }

      // 광맥을 눌러 걸어간 뒤 도착하면 알아서 캐기 시작합니다
      const pending = pendingVein.current;
      if (pending !== null) {
        const vein = veinAt(world, pending);
        if (!vein || world.me.dead) pendingVein.current = null;
        else if (Math.hypot(vein.pos.x - world.me.pos.x, vein.pos.y - world.me.pos.y) <= GATHER.reach) {
          startMining(world, pending, true);
          pendingVein.current = null;
        } else if (!world.me.moveTarget && !world.me.action) {
          pendingVein.current = null;
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
        case 'q': case 'Q': case 'ㅂ': drinkBestPotion(world); break;
        case 'i': case 'I': case 'ㅑ': world.panel = 'pack'; break;
        case 's': case 'S': case 'ㄴ': world.panel = 'skills'; break;
        case 'c': case 'C': case 'ㅊ': world.panel = 'craft'; break;
        case 'Escape': stopAction(world); world.panel = null; break;
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

    //  ★ 두고 온 짐이 먼저입니다. 그 위에 광맥이 있어도 짐을 먼저 집게 합니다
    const pack = world.me.corpse;
    if (
      pack && pack.mapId === world.mapId &&
      Math.hypot(pack.pos.x - point.x, pack.pos.y - point.y) <= 26
    ) {
      takeMyPack(world, point.x, point.y);
      bump();
      return;
    }

    //  ★ 일부러 놓아둔 것은 밟아도 안 주워집니다. 눌러야 가져옵니다 —
    //    그래야 놓고 갈 수가 있습니다. 광맥·이동보다 먼저 봅니다.
    const placed = world.ground.some(
      (g) => g.placed && Math.hypot(g.pos.x - point.x, g.pos.y - point.y) <= 20,
    );
    if (placed) {
      takeGround(world, point.x, point.y);
      bump();
      return;
    }

    const vein = world.veins.find(
      (v) => Math.hypot(v.pos.x - point.x, v.pos.y - point.y) <= 22,
    );
    pendingVein.current = vein ? vein.id : null;
    clickWorld(world, point.x, point.y);
    bump();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    // 누른 채로 끌면 계속 따라옵니다 (몬스터를 다시 고르지는 않습니다)
    const point = pointFromEvent(event);
    if (world.me.targetId === null) moveTo(world, point.x, point.y);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-ink-900 text-parch-100 lg:flex-row lg:items-center lg:justify-center">
      {/* ----------------------------------------------------- 화면 */}
      {/*
        ★ 폰 세로에서 게임 화면은 아래 창이 쓰고 남은 자리를 전부 가집니다.
        ★ 넓은 화면에서는 여기서 멈춥니다(1100×820). 캔버스가 계속 커지면 확대율만
          치솟아 지형이 흐려지고, 남는 자리를 시야로 채우면 다시 "너무 넓게 보임" 이 됩니다.
          그래서 남는 곳은 여백으로 둡니다.
      */}
      {/*
        ★ 넓은 화면에서는 캔버스를 **8:9** 로 잡습니다.
          view.ts 가 보여주는 세계를 800×900 으로 못 박고 있어서, 캔버스 비율이
          그것과 다르면 상자를 다 못 채웁니다 — 예전에는 1060×820(≈13:10)이라
          세로로 619px 밖에 못 봤습니다(상자는 900). 비율만 맞추면 늘 다 봅니다.

        ★ 그래서 남는 가로는 여백입니다. 캔버스를 넓혀봐야 확대율만 오르고
          보이는 세계는 그대로입니다 (오히려 세로로 덜 보입니다).

        ★ 접으면 세로 상한(820)을 풉니다. 보이는 세계가 넓어지지는 않지만
          같은 세계가 더 크게 보입니다.
      */}
      <div
        ref={wrapRef}
        className={`relative min-h-0 flex-1 overflow-hidden lg:aspect-[8/9] lg:h-full lg:w-auto lg:flex-none ${
          sheetOpen ? 'lg:max-h-[820px]' : 'lg:max-h-none'
        }`}
      >
        <canvas ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        <div className="pointer-events-none absolute left-2 top-2 z-10">
          <StatusBlock world={world} />
          <SkillPop world={world} />
        </div>

        {/*
          단추 줄은 화면 아래 전체를 가로지릅니다. 그대로 두면 단추 사이의 빈 곳이
          캔버스 클릭을 가로채, 화면 아래쪽을 눌러도 캐릭터가 움직이지 않습니다.
          그래서 껍데기는 클릭을 통과시키고(pointer-events-none) 단추만 받습니다.
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-end px-2">
          <ActionBar world={world} refresh={refresh} />
        </div>

        {/*
          ★ 화면 가운데를 비워 둡니다. 나가기·소리는 왼쪽 아래 구석, 물약·멈춤은 오른쪽 아래 구석.
            예전에는 이 묶음이 화면 중턱(bottom-16)에 떠 있어서, 걸어가려고 누른 자리를 가로챘습니다.
        */}
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onQuit}
            className="btn flex h-11 min-w-11 items-center justify-center rounded-sm px-3 text-[11px] text-parch-300"
          >
            나가기
          </button>
          <SoundControl />
        </div>

        <Toast world={world} />
        <DeathOverlay world={world} refresh={refresh} />
        <DevTools world={world} refresh={refresh} />
      </div>

      {/* ----------------------------------------------------- 오른쪽 창 */}
      <aside
        // 넓은 화면에서는 게임 화면과 같은 높이로 나란히 섭니다 (혼자만 천장까지 뻗지 않게)
        className={`flex min-h-0 shrink-0 flex-col border-ink-600 bg-ink-800 lg:h-full lg:flex-none lg:border-l ${
          sheetOpen ? 'h-[54dvh] lg:max-h-[820px] lg:w-[380px]' : 'lg:max-h-none lg:w-[64px]'
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <SidePanel
            world={world}
            refresh={refresh}
            open={sheetOpen}
            onOpen={() => setSheetOpen(true)}
            onClose={() => setSheetOpen(false)}
          />
        </div>
        {/* 접으면 기록창도 함께 접힙니다 — 가느다란 기둥에 들어갈 자리가 없습니다 */}
        <div className={sheetOpen ? 'contents' : 'contents lg:hidden'}>
          <LogPanel world={world} />
        </div>
      </aside>
    </div>
  );
}
