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
import { cancelPending, clickWorld, drinkBestPotion, enterPending, moveTo, stopAction, takeGround, takeMyPack } from '../core/commands';
import { startMining, veinAt } from '../core/action';
import { GATHER } from '../balance';
import { step } from '../core/engine';
import { toast } from '../core/feedback';
import { portalWarning } from '../core/world';
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

/**
 *  얼마나 자리를 비웠나 — 사람이 읽는 말로.
 *  ★ format.ts 의 duration() 은 1분 미만을 "0분" 이라고 하는데,
 *    여기서는 "잠깐 다녀온 것" 이 대부분이라 초까지 말해야 합니다.
 */
function awayText(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total}초`;
  const m = Math.floor(total / 60);
  if (m < 60) return `${m}분 ${total % 60}초`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

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
    /** 탭이 뒤로 갔는가. 그동안 세계는 멈춥니다 */
    let hidden = false;
    /** 숨은 시각 (실제 시간) — 돌아왔을 때 얼마나 멈춰 있었는지 말해주려고 */
    let hiddenAt = 0;

    /*
     *  ★ 탭을 벗어나면 세계를 멈춥니다.
     *
     *    예전에는 브라우저가 rAF 를 초당 2회로 늦출 뿐이라 세계가 **26% 속도로
     *    계속 흘렀습니다**(실측: 숨어 있던 30초에 세계 8초). 그건 셋 다 나쁩니다 —
     *      · 브라우저·기기마다 값이 달라 재현이 안 됩니다 (씨앗 RNG 를 지키는 것과 어긋남)
     *      · 안 보이는 채로 몬스터에게 맞아 죽을 수 있습니다.
     *        왜 잃었는지 안 보이는 것은 무게가 아니라 결함입니다 (CLAUDE.md 0장)
     *      · 소리는 이미 여기서 쉽니다(audio/bus.ts). 소리와 게임이 다른 판단을 했습니다
     *
     *    ★ 멈출 때 저장합니다. 그러지 않으면 탭을 그냥 닫았을 때 최대 5초를 잃습니다.
     */
    const doc = (globalThis as { document?: Document }).document;
    const onVisibility = () => {
      if (!doc) return;
      if (doc.visibilityState === 'hidden') {
        if (hidden) return;
        hidden = true;
        hiddenAt = performance.now();
        saveWorld(world);
      } else {
        if (!hidden) return;
        hidden = false;
        //  ★ 시계를 다시 맞춥니다. 안 그러면 돌아온 첫 프레임의 dt 가
        //    떠나 있던 시간만큼 커집니다 (FRAME_MAX 가 자르긴 하지만, 자르는 것과
        //    처음부터 안 재는 것은 다릅니다).
        const away = (performance.now() - hiddenAt) / 1000;
        last = performance.now();
        //  왜 시간이 안 갔는지 말해줍니다. 조용히 멈추면 고장으로 보입니다 (6장)
        if (away >= 3) toast(world, `${awayText(away)} 멈춰 있었습니다\n그동안 세계도 멈췄습니다`, 'good');
      }
    };
    doc?.addEventListener?.('visibilitychange', onVisibility);

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      //  숨어 있는 동안에도 프레임이 몇 장 오는 브라우저가 있습니다.
      //  시각만 따라가고 세계는 굴리지 않습니다.
      if (hidden) { last = now; return; }
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
          //
          //  ★ 미는 양도 화면 픽셀 단위로 반올림합니다. 여기서 소수가 남으면
          //    draw() 안에서 카메라를 격자에 맞춰놔도 화면 전체가 그만큼 어긋나
          //    스냅이 헛일이 됩니다 (view.ts 의 snapView).
          const shove = kick();
          ctx.setTransform(ratio, 0, 0, ratio, Math.round(shove.x * ratio), Math.round(shove.y * ratio));
          //  ★ 늘려 그릴 때 이웃 픽셀을 섞지 않습니다. 지금은 구워둔 지형과
          //    작은 지도만 이 길을 타고, 나중에 스프라이트가 여기 얹힙니다.
          ctx.imageSmoothingEnabled = false;
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
      doc?.removeEventListener?.('visibilitychange', onVisibility);
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
        ★ 비율을 고정하지 않습니다. 8:9 로 못 박아 봤더니 창이 넓을 때 화면이
          가운데 작게 뜨고 양옆이 검은 여백이 됐습니다. 상자(800×900)를 세로까지
          꽉 채우는 것보다 큰 화면을 쓰는 쪽이 낫습니다.

        ★ 오른쪽 창을 접어도 이 상자는 안 바뀝니다. 접기는 화면을 넓히려는 것이
          아니라 안 볼 때 치우는 것입니다.
      */}
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 overflow-hidden lg:h-full lg:max-h-[820px] lg:w-full lg:max-w-[1100px] lg:flex-1"
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
          ★ 되돌아갈 수 없는 문 앞. engine 은 이 문으로 절대 안 들어가고, 여기서만 들어갑니다.
            무엇을 잃는지 모르는 채 잃는 것은 무게가 아니라 결함입니다 (전체설계 0장).
          ★ 문구는 core 가 만듭니다 — ui 는 조건을 조립하지 않습니다 (CLAUDE.md 4-3).
        */}
        {world.pendingPortal && (
          <div className="absolute inset-x-0 top-1/3 z-20 flex justify-center px-4">
            <div className="card max-w-[22rem] rounded-sm border border-rust-600 bg-ink-900/95 p-3 text-center">
              <div className="mb-2 text-[13px] leading-snug text-parch-200">
                {portalWarning(world, world.pendingPortal)}
              </div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => { enterPending(world); refresh(); }}
                  className="btn h-10 rounded-sm px-4 text-[12px] text-rust-300"
                >
                  들어간다
                </button>
                <button
                  type="button"
                  onClick={() => { cancelPending(world); refresh(); }}
                  className="btn h-10 rounded-sm px-4 text-[12px] text-parch-300"
                >
                  돌아선다
                </button>
              </div>
            </div>
          </div>
        )}

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
        className={`flex min-h-0 shrink-0 flex-col border-ink-600 bg-ink-800 lg:h-full lg:max-h-[820px] lg:flex-none lg:border-l ${
          sheetOpen ? 'h-[54dvh] lg:w-[380px]' : 'lg:w-[64px]'
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
