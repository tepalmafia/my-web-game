/**
 *  화면 위에 겹쳐지는 것들 — 체력바, 스킬 단추, 보스 시계, 죽음 화면.
 *
 *  여기서는 규칙을 판단하지 않고 core/commands.ts 의 함수를 부르기만 합니다.
 */

import { MAX_LEVEL, expToNextLevel } from '../balance';
import { CLASSES } from '../content/classes';
import { itemDef } from '../content/items';
import { monsterDef } from '../content/monsters';
import { skillsOf } from '../content/skills';
import { drinkBestPotion, respawnInTown, skillProblem, toggleAuto, useItem, useSkill } from '../core/commands';
import { countOf } from '../core/inventory';
import { currentQuest } from '../core/quests';
import { derive } from '../core/stats';
import type { World } from '../types';
import { clock, fmt } from './format';

/* --------------------------------------------------------------- 막대 */

function Bar({
  value, max, color, label, height = 14,
}: {
  value: number; max: number; color: string; label: string; height?: number;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="relative w-full overflow-hidden rounded-sm bg-slate-900/80 ring-1 ring-slate-700/70" style={{ height }}>
      <div className="h-full transition-[width] duration-150" style={{ width: `${ratio * 100}%`, background: color }} />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tracking-tight text-white/90 drop-shadow">
        {label}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 왼쪽 위 */

export function StatusBlock({ world }: { world: World }) {
  const player = world.player;
  const stats = derive(player);
  const cls = CLASSES[player.classId];
  const needed = player.level >= MAX_LEVEL ? 0 : expToNextLevel(player.level);

  return (
    <div className="pointer-events-none w-56 space-y-1 rounded-lg bg-slate-950/70 p-2 ring-1 ring-slate-700/60 backdrop-blur-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-bold" style={{ color: cls.color }}>
          {player.name}
        </span>
        <span className="text-xs text-slate-300">
          {cls.name} · Lv.{player.level}
        </span>
      </div>
      <Bar value={player.hp} max={stats.maxHp} color="linear-gradient(90deg,#dc2626,#ef4444)"
        label={`${fmt(player.hp)} / ${fmt(stats.maxHp)}`} />
      <Bar value={player.mp} max={stats.maxMp} color="linear-gradient(90deg,#1d4ed8,#3b82f6)"
        label={`${fmt(player.mp)} / ${fmt(stats.maxMp)}`} height={11} />
      <Bar value={needed === 0 ? 1 : player.exp} max={needed === 0 ? 1 : needed}
        color="linear-gradient(90deg,#a16207,#facc15)"
        label={needed === 0 ? '최고 레벨' : `EXP ${fmt(player.exp)} / ${fmt(needed)}`} height={9} />
      <div className="flex items-center justify-between pt-0.5 text-[11px]">
        <span className="text-amber-300">{fmt(player.gold)} 골드</span>
        <span className="text-slate-400">{world.map.def.name}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 버프 */

export function BuffRow({ world }: { world: World }) {
  if (world.player.buffs.length === 0) return null;
  return (
    <div className="pointer-events-none mt-1 flex gap-1">
      {world.player.buffs.map((buff) => (
        <div key={buff.id}
          className="rounded bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-slate-700/60"
          style={{ color: buff.color }}>
          {buff.name} {Math.ceil(buff.until - world.time)}초
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- 보스 시계 */

export function BossTimer({ world }: { world: World }) {
  const bosses = world.monsters.filter((m) => monsterDef(m.defId).boss);
  if (bosses.length === 0) return null;

  return (
    <div className="pointer-events-none space-y-1">
      {bosses.map((boss) => {
        const def = monsterDef(boss.defId);
        const alive = boss.state !== 'dead';
        return (
          <div key={boss.id}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 backdrop-blur-sm ${
              alive ? 'bg-amber-950/70 text-amber-200 ring-amber-700/60' : 'bg-slate-950/70 text-slate-400 ring-slate-700/60'
            }`}>
            {def.name} — {alive ? '출현 중' : `${clock(boss.respawnIn)} 뒤 부활`}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- 퀘스트 안내 */

export function QuestTracker({ world }: { world: World }) {
  const quest = currentQuest(world);
  if (!quest) return null;
  const def = monsterDef(quest.monsterId);

  return (
    <div className="pointer-events-none w-56 rounded-lg bg-slate-950/70 p-2 text-[11px] ring-1 ring-slate-700/60 backdrop-blur-sm">
      <div className="font-bold text-sky-300">{quest.name}</div>
      <div className="text-slate-300">
        {def.name} {world.player.questKills} / {quest.count}
      </div>
      <div className="mt-0.5 text-slate-500">{quest.hint}</div>
    </div>
  );
}

/* --------------------------------------------------------------- 아래 단추들 */

export function ActionBar({ world, refresh }: { world: World; refresh: () => void }) {
  const player = world.player;
  const skills = skillsOf(player.classId);

  const hpPotion = bestPotion(world, 'hp');
  const mpPotion = bestPotion(world, 'mp');

  return (
    <div className="pointer-events-auto flex flex-wrap items-end justify-center gap-1.5">
      {skills.map((skill, index) => {
        const locked = player.level < skill.reqLevel;
        const cooling = player.skillCooldowns[skill.id] ?? 0;
        const problem = skillProblem(world, skill);
        return (
          <button key={skill.id} type="button"
            onClick={() => { useSkill(world, index); refresh(); }}
            disabled={locked}
            title={`${skill.name} — ${skill.desc}`}
            className={`relative h-12 w-12 overflow-hidden rounded-lg border text-[9px] font-bold leading-tight transition lg:h-14 lg:w-14 lg:text-[10px] ${
              locked
                ? 'border-slate-800 bg-slate-900/70 text-slate-600'
                : problem
                  ? 'border-slate-700 bg-slate-900/80 text-slate-400'
                  : 'border-amber-600/70 bg-slate-900/90 text-amber-200 hover:bg-slate-800'
            }`}>
            <span className="absolute left-1 top-0.5 text-[9px] text-slate-500">{index + 1}</span>
            <span className="mt-2.5 block px-0.5 lg:mt-3">{locked ? `Lv.${skill.reqLevel}` : skill.name}</span>
            <span className="block text-[9px] text-slate-500">{skill.mpCost} MP</span>
            {cooling > 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-slate-950/75 text-sm text-white">
                {cooling.toFixed(1)}
              </span>
            )}
          </button>
        );
      })}

      <PotionButton world={world} refresh={refresh} kind="hp" defId={hpPotion} hotkey="Q" />
      <PotionButton world={world} refresh={refresh} kind="mp" defId={mpPotion} hotkey="W" />

      <button type="button"
        onClick={() => { toggleAuto(world); refresh(); }}
        className={`h-12 w-12 rounded-lg border text-[10px] font-bold transition lg:h-14 lg:w-14 lg:text-[11px] ${
          player.auto
            ? 'border-emerald-500 bg-emerald-900/70 text-emerald-200'
            : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:bg-slate-800'
        }`}>
        자동<br />사냥
        <span className="mt-0.5 block text-[9px] text-slate-500">Space</span>
      </button>
    </div>
  );
}

function bestPotion(world: World, kind: 'hp' | 'mp'): string | null {
  const candidates = world.player.inventory
    .map((s) => itemDef(s.defId))
    .filter((def) => def.kind === 'potion' && (kind === 'hp' ? def.healHp : def.healMp))
    .sort((a, b) => ((kind === 'hp' ? b.healHp : b.healMp) ?? 0) - ((kind === 'hp' ? a.healHp : a.healMp) ?? 0));
  return candidates[0]?.id ?? null;
}

function PotionButton({
  world, refresh, kind, defId, hotkey,
}: {
  world: World; refresh: () => void; kind: 'hp' | 'mp'; defId: string | null; hotkey: string;
}) {
  const count = defId ? countOf(world.player, defId) : 0;
  const color = kind === 'hp' ? 'text-rose-300 border-rose-800/70' : 'text-sky-300 border-sky-800/70';

  return (
    <button type="button"
      onClick={() => { drinkBestPotion(world, kind); refresh(); }}
      disabled={count === 0}
      className={`h-12 w-12 rounded-lg border bg-slate-900/85 text-[10px] font-bold transition hover:bg-slate-800 disabled:opacity-40 lg:h-14 lg:w-14 lg:text-[11px] ${color}`}>
      {kind === 'hp' ? '체력' : '마나'}
      <span className="block text-sm text-slate-100">{count > 99 ? '99+' : count}</span>
      <span className="block text-[9px] text-slate-500">{hotkey}</span>
    </button>
  );
}

/* --------------------------------------------------------------- 알림과 죽음 */

export function Toast({ world }: { world: World }) {
  if (!world.toast) return null;
  const tone =
    world.toast.tone === 'epic' ? 'text-amber-300' : world.toast.tone === 'bad' ? 'text-rose-300' : 'text-emerald-300';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/4 flex justify-center">
      <div className={`whitespace-pre-line text-center text-2xl font-black tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${tone}`}>
        {world.toast.text}
      </div>
    </div>
  );
}

export function DeathOverlay({ world, refresh }: { world: World; refresh: () => void }) {
  const player = world.player;
  if (!player.dead) return null;

  const scroll = player.inventory.find((s) => s.defId === 'scroll-resurrect');

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="text-4xl font-black tracking-tight text-rose-400">쓰러졌습니다</div>
      <div className="text-center text-sm text-slate-300">
        경험치 {fmt(player.lostExp)} 을(를) 잃었습니다.
        <br />
        <span className="text-slate-500">가진 골드의 8%도 함께 사라졌습니다.</span>
      </div>
      <div className="flex gap-2">
        <button type="button"
          onClick={() => { respawnInTown(world); refresh(); }}
          className="rounded-lg bg-slate-100 px-5 py-2 font-bold text-slate-900 hover:bg-white">
          마을에서 일어나기
        </button>
        {scroll && player.lostExp > 0 && (
          <button type="button"
            onClick={() => { useItem(world, scroll.uid); refresh(); }}
            className="rounded-lg border border-amber-600 bg-amber-950/70 px-5 py-2 font-bold text-amber-200 hover:bg-amber-900/70">
            부활 주문서 사용 ({scroll.count})
          </button>
        )}
      </div>
    </div>
  );
}
