/**
 *  화면 위에 겹쳐지는 것들 — 체력 막대, 스킬 단추, 보스 시계, 죽음 화면.
 *
 *  창의 재질은 rpg.css 에 있습니다 (가죽 판 .panel, 놋쇠 단추 .btn, 홈이 파인 막대 .socket).
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
  value, max, kind, label, height = 15,
}: {
  value: number; max: number; kind: 'hp' | 'mp' | 'exp'; label: string; height?: number;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="socket relative w-full rounded-[2px]" style={{ height }}>
      <div className={`fill fill-${kind}`} style={{ width: `${ratio * 100}%` }} />
      <div className="tabular absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-tight text-parch-100/95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
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
    <div className="panel studded pointer-events-none w-60 space-y-1.5 rounded-sm px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="display truncate text-base font-bold" style={{ color: cls.color }}>
          {player.name}
        </span>
        <span className="eyebrow shrink-0">
          {cls.name} · LV {player.level}
        </span>
      </div>

      <Bar value={player.hp} max={stats.maxHp} kind="hp" label={`${fmt(player.hp)} / ${fmt(stats.maxHp)}`} />
      <Bar value={player.mp} max={stats.maxMp} kind="mp" label={`${fmt(player.mp)} / ${fmt(stats.maxMp)}`} height={11} />
      <Bar
        value={needed === 0 ? 1 : player.exp}
        max={needed === 0 ? 1 : needed}
        kind="exp"
        label={needed === 0 ? '최고 레벨' : `${((player.exp / needed) * 100).toFixed(1)}%`}
        height={8}
      />

      <div className="flex items-center justify-between pt-0.5 text-[11px]">
        <span className="tabular font-bold text-brass-300">{fmt(player.gold)} <span className="font-normal text-parch-400">골드</span></span>
        <span className="display text-parch-300">{world.map.def.name}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 버프 */

export function BuffRow({ world }: { world: World }) {
  if (world.player.buffs.length === 0) return null;
  return (
    <div className="pointer-events-none mt-1.5 flex gap-1">
      {world.player.buffs.map((buff) => (
        <div
          key={buff.id}
          className="panel rounded-sm px-1.5 py-0.5 text-[10px] font-bold"
          style={{ color: buff.color, borderColor: `${buff.color}55` }}
        >
          {buff.name} <span className="tabular text-parch-300">{Math.ceil(buff.until - world.time)}초</span>
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
          <div
            key={boss.id}
            className={`panel flex items-center gap-2 rounded-sm px-2.5 py-1 text-xs ${
              alive ? 'text-brass-300' : 'text-parch-400'
            }`}
            style={alive ? { borderColor: 'rgba(224,178,58,0.55)' } : undefined}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${alive ? 'bg-brass-400' : 'bg-parch-400/50'}`}
              style={alive ? { boxShadow: '0 0 6px #e0b23a' } : undefined}
            />
            <span className="display font-bold">{def.name}</span>
            <span className="tabular text-[11px]">{alive ? '출현 중' : `${clock(boss.respawnIn)} 뒤`}</span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- 의뢰 안내 */

export function QuestTracker({ world }: { world: World }) {
  const quest = currentQuest(world);
  if (!quest) return null;
  const def = monsterDef(quest.monsterId);
  const ratio = Math.min(1, world.player.questKills / quest.count);

  return (
    <div className="panel pointer-events-none w-60 rounded-sm px-2.5 py-2 text-[11px]">
      <div className="eyebrow mb-0.5">의뢰</div>
      <div className="display text-[13px] font-bold text-brass-300">{quest.name}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="socket h-1.5 flex-1 rounded-[2px]">
          <div className="fill fill-exp" style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className="tabular shrink-0 text-parch-200">
          {def.name} {world.player.questKills}/{quest.count}
        </span>
      </div>
      <div className="mt-1 text-parch-400">{quest.hint}</div>
    </div>
  );
}

/* --------------------------------------------------------------- 아래 단추들 */

export function ActionBar({ world, refresh }: { world: World; refresh: () => void }) {
  const player = world.player;
  const skills = skillsOf(player.classId);

  return (
    <div className="pointer-events-auto flex flex-wrap items-end justify-center gap-1.5">
      {skills.map((skill, index) => {
        const locked = player.level < skill.reqLevel;
        const cooling = player.skillCooldowns[skill.id] ?? 0;
        const problem = skillProblem(world, skill);
        const ready = !locked && !problem;

        return (
          <button
            key={skill.id}
            type="button"
            onClick={() => { useSkill(world, index); refresh(); }}
            disabled={locked}
            title={`${skill.name} — ${skill.desc}`}
            className={`btn relative h-12 w-12 overflow-hidden rounded-sm text-[9px] leading-tight lg:h-14 lg:w-14 lg:text-[10px] ${
              ready ? 'text-brass-300' : 'text-parch-400'
            }`}
            style={ready ? { borderColor: `${skill.color}88`, boxShadow: `inset 0 0 12px ${skill.color}22` } : undefined}
          >
            <span className="absolute left-1 top-0.5 text-[9px] text-parch-400/70">{index + 1}</span>
            <span className="mt-2.5 block px-0.5 font-bold lg:mt-3">{locked ? `LV ${skill.reqLevel}` : skill.name}</span>
            <span className="tabular block text-[9px] text-parch-400">{skill.mpCost} MP</span>
            {cooling > 0 && (
              <span className="tabular absolute inset-0 flex items-center justify-center bg-ink-900/80 text-sm font-bold text-parch-100">
                {cooling.toFixed(1)}
              </span>
            )}
          </button>
        );
      })}

      <PotionButton world={world} refresh={refresh} kind="hp" hotkey="Q" />
      <PotionButton world={world} refresh={refresh} kind="mp" hotkey="W" />

      <button
        type="button"
        onClick={() => { toggleAuto(world); refresh(); }}
        className={`btn h-12 w-12 rounded-sm text-[10px] lg:h-14 lg:w-14 lg:text-[11px] ${
          player.auto ? 'btn-brass' : 'text-parch-300'
        }`}
      >
        자동
        <br />
        사냥
        <span className="mt-0.5 block text-[9px] opacity-70">Space</span>
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
  world, refresh, kind, hotkey,
}: {
  world: World; refresh: () => void; kind: 'hp' | 'mp'; hotkey: string;
}) {
  const defId = bestPotion(world, kind);
  const count = defId ? countOf(world.player, defId) : 0;
  const empty = count === 0;

  return (
    <button
      type="button"
      onClick={() => { drinkBestPotion(world, kind); refresh(); }}
      disabled={empty}
      className="btn relative h-12 w-12 overflow-hidden rounded-sm text-[10px] lg:h-14 lg:w-14 lg:text-[11px]"
      style={{ borderColor: kind === 'hp' ? 'rgba(194,53,47,0.55)' : 'rgba(75,157,189,0.5)' }}
    >
      {/* 병에 남은 양이 눈에 보이게 */}
      <span
        className="absolute inset-x-0 bottom-0 opacity-25"
        style={{
          height: `${Math.min(100, count * 2.5)}%`,
          background: kind === 'hp' ? 'linear-gradient(180deg,#c2352f,#7e1a1d)' : 'linear-gradient(180deg,#4b9dbd,#1d4a63)',
        }}
      />
      <span className="relative block pt-1.5 font-bold" style={{ color: kind === 'hp' ? '#e88a86' : '#8fd0e8' }}>
        {kind === 'hp' ? '체력' : '마나'}
      </span>
      <span className="tabular relative block text-sm font-bold text-parch-100">{count > 99 ? '99+' : count}</span>
      <span className="relative block text-[9px] text-parch-400">{hotkey}</span>
    </button>
  );
}

/* --------------------------------------------------------------- 알림과 죽음 */

export function Toast({ world }: { world: World }) {
  if (!world.toast) return null;
  const tone =
    world.toast.tone === 'epic' ? '#f2c14e' : world.toast.tone === 'bad' ? '#e88a86' : '#a8d5a2';

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
  const player = world.player;
  if (!player.dead) return null;

  const scroll = player.inventory.find((s) => s.defId === 'scroll-resurrect');

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5"
      style={{ background: 'radial-gradient(ellipse at center, rgba(60,8,8,0.55), rgba(6,4,3,0.92) 70%)' }}
    >
      <div className="display text-5xl font-bold tracking-tight text-blood-400" style={{ textShadow: '0 3px 18px rgba(0,0,0,0.9)' }}>
        쓰러졌습니다
      </div>
      <div className="rule w-56" />
      <div className="text-center text-sm text-parch-200">
        <span className="tabular">경험치 {fmt(player.lostExp)}</span> 을(를) 잃었습니다.
        <br />
        <span className="text-parch-400">가진 골드의 8%도 함께 사라졌습니다.</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { respawnInTown(world); refresh(); }}
          className="btn btn-brass rounded-sm px-6 py-2.5 text-sm"
        >
          마을에서 일어나기
        </button>
        {scroll && player.lostExp > 0 && (
          <button
            type="button"
            onClick={() => { useItem(world, scroll.uid); refresh(); }}
            className="btn rounded-sm px-5 py-2.5 text-sm text-brass-300"
          >
            부활 주문서 사용 <span className="tabular">({scroll.count})</span>
          </button>
        )}
      </div>
    </div>
  );
}
