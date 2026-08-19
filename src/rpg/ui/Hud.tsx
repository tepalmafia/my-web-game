/**
 *  화면 위에 겹쳐지는 것들.
 *
 *  ★ 레벨 막대도 마나도 스킬 단추도 없습니다.
 *    대신 이 게임에서 계속 쳐다보게 되는 두 가지가 있습니다 — 체력과 ★무게.
 *    그리고 무언가 하고 있을 때의 진행 막대.
 */

import { useEffect, useRef, useState } from 'react';

import { itemDef } from '../content/items';
import { SKILLS, SKILL_ORDER } from '../content/skills';
import { drinkBestPotion, potionCount, respawnInTown, stopAction } from '../core/commands';
import { derive } from '../core/stats';
import type { SkillId, World } from '../types';
import { fmt } from './format';

/* --------------------------------------------------------------- 막대 */

function Bar({
  ratio, kind, label, height = 15,
}: {
  ratio: number; kind: 'hp' | 'load' | 'work'; label: string; height?: number;
}) {
  const fill = kind === 'hp' ? 'fill-hp' : kind === 'load' ? 'fill-exp' : 'fill-mp';
  return (
    <div className="socket relative w-full rounded-[2px]" style={{ height }}>
      <div className={`fill ${fill}`} style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
      <div className="tabular absolute inset-0 flex items-center justify-center text-[10px] font-bold text-parch-100/95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
        {label}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 왼쪽 위 */

/**
 *  왼쪽 위 패널.
 *
 *  ★ 폰 세로를 기준으로 만듭니다. 390×540 캔버스에서 이 패널이 크면 그만큼 세상이 안 보입니다.
 *    그래서 계속 쳐다보게 되는 셋만 남겼습니다 — 체력, 짐, 골드.
 *    이름과 지역명은 뺐습니다(지역은 작은 지도와 기록창이 알려줍니다).
 *
 *  ★ 짐 글자는 막대 밖에 적습니다. 막대 안에 겹쳐 놓았더니 막대 높이(11px)가
 *    글자 높이(13px)보다 낮아, 어느 화면에서나 위아래가 잘렸습니다.
 */
export function StatusBlock({ world }: { world: World }) {
  const me = world.me;
  const stats = derive(me);
  const heavy = stats.load / stats.carry;
  const slow = Math.round((1 - stats.moveSpeed / 120) * 100);

  return (
    <div className="panel studded pointer-events-none w-48 space-y-1 rounded-sm px-2 py-1.5 lg:w-52">
      <Bar ratio={me.hp / stats.maxHp} kind="hp" label={`${fmt(me.hp)} / ${fmt(stats.maxHp)}`} height={14} />

      <div className="socket relative w-full rounded-[2px]" style={{ height: 5 }}>
        <div className="fill fill-exp" style={{ width: `${Math.max(0, Math.min(1, heavy)) * 100}%` }} />
      </div>

      <div className="flex items-baseline justify-between gap-1 text-[10px]">
        {/* 무거워지면 단위를 빼고 그 자리에 "얼마나 느려졌는지"를 적습니다 — 그때 알아야 할 것이 그것입니다 */}
        <span className={`tabular ${heavy > 0.9 ? 'text-[#e88a86]' : 'text-parch-300'}`}>
          짐 {fmt(stats.load)}/{fmt(stats.carry)}
          {heavy > 0.5 ? <span className="text-[#e88a86]"> · {slow}% 느림</span> : ' 스톤'}
        </span>
        <span className="tabular shrink-0 font-bold text-brass-300">
          {fmt(me.gold)} <span className="font-normal text-parch-400">골드</span>
        </span>
      </div>
    </div>
  );
}

/**
 *  스킬이 오른 순간만 잠깐 뜨는 줄.
 *
 *  ★ 예전에는 스킬 넉 줄이 왼쪽 위를 상시 차지했습니다. 폰에서는 그 88px 가 아깝고,
 *    스킬은 3분에 0.1~0.3 오르므로 계속 볼 이유도 없습니다.
 *    그래도 ★ 오르는 순간은 이 게임이 주는 거의 유일한 성장 신호라서, 오른 직후 몇 초만 띄웁니다.
 *
 *  ★ 판단은 하지 않습니다. 지난 값과 지금 값을 견주어 "늘었다"만 봅니다.
 *    core/ 는 이 창이 있는지조차 모릅니다.
 */
const POP_SECONDS = 4;

export function SkillPop({ world }: { world: World }) {
  const previous = useRef<Record<SkillId, number> | null>(null);
  const [pop, setPop] = useState<{ id: SkillId; gain: number; at: number } | null>(null);

  useEffect(() => {
    const now = world.me.skills;
    const before = previous.current;
    previous.current = { ...now };
    if (!before) return; // 처음 그려질 때는 아무것도 띄우지 않습니다
    for (const id of SKILL_ORDER) {
      const gain = now[id] - (before[id] ?? 0);
      if (gain > 1e-9) setPop({ id, gain, at: performance.now() });
    }
  });

  if (!pop) return null;
  const age = (performance.now() - pop.at) / 1000;
  if (age > POP_SECONDS) return null;

  const info = SKILLS[pop.id];
  const value = world.me.skills[pop.id];
  // 마지막 1초 동안 사라집니다
  const fade = Math.min(1, (POP_SECONDS - age) / 1);

  return (
    <div
      className="panel pointer-events-none mt-1 w-48 rounded-sm px-2 py-1.5 lg:w-52"
      style={{ opacity: fade, transition: 'opacity 120ms linear' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold" style={{ color: info.color }}>{info.name}</span>
        <span className="tabular text-[11px] font-bold text-parch-100">
          {value.toFixed(1)}
          <span className="text-[#8fcf8a]"> +{pop.gain.toFixed(1)}</span>
        </span>
      </div>
      <div className="socket mt-1 h-1.5 rounded-[2px]">
        <div className="fill" style={{ width: `${value}%`, background: info.color }} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 하는 일 */

export function ActionBar({ world, refresh }: { world: World; refresh: () => void }) {
  const me = world.me;
  const action = me.action;
  const potions = potionCount(world);

  const label =
    action?.kind === 'mine' ? '캐는 중' : action?.kind === 'craft' ? '만드는 중' : '고치는 중';

  return (
    // ★ 진행 막대를 단추 옆이 아니라 위에 둡니다. 옆에 두면 폰 세로에서 이 묶음이
    //   300px 을 넘어, 화면 반대쪽 구석의 나가기·소리 단추와 겹쳤습니다.
    <div className="pointer-events-auto flex flex-col items-end gap-1.5">
      {action && (
        <div className="panel w-44 rounded-sm px-2.5 py-1.5">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-bold text-brass-300">{label}</span>
            {action.repeat && <span className="eyebrow">반복</span>}
          </div>
          <Bar ratio={1 - action.remaining / action.total} kind="work" label="" height={8} />
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => { drinkBestPotion(world); refresh(); }}
          disabled={potions === 0}
          className="btn h-14 w-14 rounded-sm text-[10px]"
          style={{ borderColor: 'rgba(194,53,47,0.55)' }}
        >
          <span className="block font-bold text-[#e88a86]">물약</span>
          <span className="tabular block text-sm font-bold text-parch-100">{potions}</span>
          <span className="block text-[9px] text-parch-400">Q</span>
        </button>

        {(action || me.targetId !== null) && (
          <button
            type="button"
            onClick={() => { stopAction(world); refresh(); }}
            className="btn h-14 w-14 rounded-sm text-[10px]"
          >
            멈춤
            <span className="mt-0.5 block text-[9px] text-parch-400">Esc</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 알림과 죽음 */

export function Toast({ world }: { world: World }) {
  if (!world.toast) return null;
  const tone = world.toast.tone === 'epic' ? '#f2c14e' : world.toast.tone === 'bad' ? '#e88a86' : '#a8d5a2';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center">
      <div
        className="display whitespace-pre-line px-6 text-center text-3xl font-bold"
        style={{ color: tone, textShadow: `0 2px 10px rgba(0,0,0,0.95), 0 0 26px ${tone}55` }}
      >
        {world.toast.text}
      </div>
    </div>
  );
}

export function DeathOverlay({ world, refresh }: { world: World; refresh: () => void }) {
  const me = world.me;
  if (!me.dead) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5"
      style={{ background: 'radial-gradient(ellipse at center, rgba(60,8,8,0.55), rgba(6,4,3,0.92) 70%)' }}
    >
      <div className="display text-5xl font-bold text-blood-400" style={{ textShadow: '0 3px 18px rgba(0,0,0,0.9)' }}>
        쓰러졌습니다
      </div>
      <div className="rule w-56" />
      <div className="text-center text-sm text-parch-200">
        골드의 10%를 잃었습니다.
        <br />
        <span className="text-parch-400">배운 것은 그대로입니다.</span>
      </div>
      <button
        type="button"
        onClick={() => { respawnInTown(world); refresh(); }}
        className="btn btn-brass rounded-sm px-6 py-2.5 text-sm"
      >
        마을에서 일어나기
      </button>
    </div>
  );
}

/** 손에 든 물약 종류 (없으면 안내) */
export function potionHint(world: World): string {
  const best = world.me.backpack.find((s) => itemDef(s.defId).healHp);
  return best ? itemDef(best.defId).name : '물약 없음';
}
