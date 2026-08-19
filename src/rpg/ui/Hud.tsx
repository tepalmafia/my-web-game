/**
 *  화면 위에 겹쳐지는 것들.
 *
 *  ★ 레벨 막대도 마나도 스킬 단추도 없습니다.
 *    대신 이 게임에서 계속 쳐다보게 되는 두 가지가 있습니다 — 체력과 ★무게.
 *    그리고 무언가 하고 있을 때의 진행 막대.
 */

import { itemDef } from '../content/items';
import { SKILLS, SKILL_ORDER } from '../content/skills';
import { drinkBestPotion, potionCount, respawnInTown, stopAction } from '../core/commands';
import { derive } from '../core/stats';
import type { World } from '../types';
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

export function StatusBlock({ world }: { world: World }) {
  const me = world.me;
  const stats = derive(me);
  const heavy = stats.load / stats.carry;

  return (
    <div className="panel studded pointer-events-none w-60 space-y-1.5 rounded-sm px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="display truncate text-base font-bold text-parch-100">{me.name}</span>
        <span className="eyebrow shrink-0">{world.map.def.name}</span>
      </div>

      <Bar ratio={me.hp / stats.maxHp} kind="hp" label={`${fmt(me.hp)} / ${fmt(stats.maxHp)}`} />
      <Bar
        ratio={heavy}
        kind="load"
        label={`짐 ${fmt(stats.load)} / ${fmt(stats.carry)} 스톤`}
        height={11}
      />

      <div className="flex items-center justify-between pt-0.5 text-[11px]">
        <span className="tabular font-bold text-brass-300">
          {fmt(me.gold)} <span className="font-normal text-parch-400">골드</span>
        </span>
        <span className={`tabular ${heavy > 0.9 ? 'text-[#e88a86]' : 'text-parch-400'}`}>
          {heavy > 0.5 ? `이동 ${Math.round((1 - stats.moveSpeed / 120) * 100)}% 느림` : '가뿐함'}
        </span>
      </div>
    </div>
  );
}

/** 스킬 넉 줄 — 0.1 씩 오르는 것이 눈에 보이는 것이 중요합니다 */
export function SkillStrip({ world }: { world: World }) {
  return (
    <div className="panel pointer-events-none mt-1.5 w-60 space-y-1 rounded-sm px-2.5 py-2">
      {SKILL_ORDER.map((id) => {
        const info = SKILLS[id];
        const value = world.me.skills[id];
        return (
          <div key={id} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[11px] text-parch-300">{info.name}</span>
            <div className="socket h-1.5 flex-1 rounded-[2px]">
              <div className="fill" style={{ width: `${value}%`, background: info.color }} />
            </div>
            <span className="tabular w-9 shrink-0 text-right text-[11px] font-bold text-parch-100">
              {value.toFixed(1)}
            </span>
          </div>
        );
      })}
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
    <div className="pointer-events-auto flex items-end gap-2">
      {action && (
        <div className="panel w-48 rounded-sm px-2.5 py-1.5">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-bold text-brass-300">{label}</span>
            {action.repeat && <span className="eyebrow">반복</span>}
          </div>
          <Bar ratio={1 - action.remaining / action.total} kind="work" label="" height={8} />
        </div>
      )}

      <button
        type="button"
        onClick={() => { drinkBestPotion(world); refresh(); }}
        disabled={potions === 0}
        className="btn h-12 w-12 rounded-sm text-[10px] lg:h-14 lg:w-14"
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
          className="btn h-12 w-12 rounded-sm text-[10px] lg:h-14 lg:w-14"
        >
          멈춤
          <span className="mt-0.5 block text-[9px] text-parch-400">Esc</span>
        </button>
      )}
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
