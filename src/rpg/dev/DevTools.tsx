/**
 * ===========================================================================
 *  시험용 도구 — 게임이 아닙니다
 * ===========================================================================
 *
 *  검이 닳는 것, 상위 광맥, 제작 확률을 판단하려면 몇 시간을 놀아야 합니다.
 *  그래서 밖에서 상태를 밀어넣는 길을 둡니다.
 *
 *  ★ 규칙 안에는 if (테스트) 가 한 줄도 없습니다.
 *    여기 있는 것은 전부 core/ 가 이미 내보내고 있는 함수와 그냥 필드 대입뿐입니다.
 *    그래서 ★ 이 파일 하나와 GameScreen 의 두 줄만 지우면 흔적 없이 사라집니다.
 *
 *  ★ 세계의 난수를 건드리지 않습니다. 봇 실측(tools/sim.ts)과 같은 씨앗이면 같은 결과입니다.
 *
 *  손가락으로만 쓰는 폰에는 콘솔이 없어서 화면 패널을 함께 둡니다.
 *  콘솔 명령(window.aden)도 그대로 남아 있습니다.
 */

import { useEffect, useState } from 'react';

import { LOOT, MAX_SKILL, STATS, carryCapacity, maxHpOf } from '../balance';
import { ITEMS, itemDef } from '../content/items';
import { MAPS, MAP_ORDER, mapDef } from '../content/maps';
import { SKILL_ORDER, SKILLS } from '../content/skills';
import { step } from '../core/engine';
import { addItem, freeWeight, hasRoom } from '../core/inventory';
import { saveWorld } from '../core/save';
import { derive, totalWeight } from '../core/stats';
import { enterMap } from '../core/world';
import { inspect } from './inspect';
import { autopilot, newPilot } from '../../../tools/autopilot';
import type { Focus } from '../../../tools/autopilot';
import type { ItemStack, MapId, SkillId, World } from '../types';

/**
 *  '물건' 단추가 주는 것.
 *
 *  ★ 여기 적힌 개수는 힘 상한에서 실제로 들 수 있어야 합니다.
 *    철광석 50 은 힘 100(소지 상한 405)에서도 500 스톤이라 못 들었고,
 *    그래서 누를 때마다 실패하는 단추였습니다. 시험이 그것을 지킵니다.
 */
export const GIVE_BUTTONS: ReadonlyArray<readonly [defId: string, count: number]> = [
  ['iron-ingot', 100],
  ['iron-ore', 30],
  ['potion-heal', 20],
];

/* ===========================================================================
 *  배속
 *  ---------------------------------------------------------------------------
 *  ★ 게임 규칙에는 배속이라는 것이 없습니다. core/ 는 이것이 있는지 모릅니다.
 *    tools/sim.ts 가 하는 것과 똑같이, **밖에서 step(world, dt) 를 더 부를 뿐**입니다.
 *    그래서 봇 실측은 이 값과 무관합니다.
 *
 *  ★ fast() 와 다릅니다. fast 는 시간을 한 번에 건너뛰어서 그 사이에 조작을
 *    못 하고, 배속은 놀면서 빨리 보는 것입니다.
 *
 *  ★ 저장하지 않습니다. 나가거나 새로 시작하면 1배로 돌아갑니다.
 * ======================================================================== */

export const SPEEDS = [1, 2, 4, 8] as const;

let speed = 1;
/** 지난 프레임에 실제로 몇 배가 흘렀는가 — 상한에 걸리면 요청보다 작습니다 */
let achieved = 1;

/** 게임 루프가 읽습니다 */
export function devSpeed(): number {
  return speed;
}

/** 게임 루프가 알려줍니다 — 조용히 느려지지 않게 화면에 그대로 보여줍니다 */
export function reportSpeed(actual: number): void {
  achieved = actual;
}

/** 지난 프레임에 실제로 흐른 배수 */
export function achievedSpeed(): number {
  return achieved;
}

export function setDevSpeed(next: number): void {
  speed = next;
  achieved = next;
}

/** 봇과 빨리감기가 한 번에 굴리는 시간 — tools/sim.ts 와 같은 값입니다 */
const DT = 1 / 20;
/** 한 번에 굴릴 수 있는 최대 시간 (초). 실수로 fast(999999) 를 쳐서 탭이 굳는 것을 막습니다 */
const MAX_FAST_SECONDS = 6 * 3600;

function isSkill(id: string): id is SkillId {
  return (SKILL_ORDER as readonly string[]).includes(id);
}

function isMap(id: string): id is MapId {
  return Object.prototype.hasOwnProperty.call(MAPS, id);
}

/** 내구도가 있는 물건 전부 (입은 것 + 가방) */
function durables(world: World): ItemStack[] {
  const me = world.me;
  return [me.equipped.weapon, me.equipped.armor, me.equipped.helmet, ...me.backpack].filter(
    (stack): stack is ItemStack => !!stack && stack.maxDurability !== undefined,
  );
}

/**
 *  왜 못 넣는지 숫자로 말합니다.
 *
 *  ★ "무게나 칸이 모자랍니다" 처럼 둘을 묶어 말하면 어느 쪽인지 알 수 없습니다.
 *    실제로 가방 칸이 남아 있는데 무게에 막힌 것을 칸 문제로 읽고 헤맸습니다.
 *    막는 쪽 하나만 대고, 숫자를 댑니다.
 */
function whyNot(world: World, defId: string, count: number): string | null {
  const me = world.me;
  const def = itemDef(defId);
  const need = def.weight * count;
  const free = freeWeight(me);
  if (need > free) {
    const fits = Math.floor(free / def.weight);
    // ★ "힘을 올려라" 는 올릴 힘이 남아 있을 때만 참입니다.
    //   상한에 닿았는데 그렇게 말하면 시키는 대로 해도 안 되는 길로 보냅니다.
    const more =
      me.str >= STATS.max
        ? `힘이 이미 상한(${STATS.max})이라 더 못 늘립니다 — 이 개수는 규칙 안에서 못 듭니다`
        : `힘을 올리면 상한이 늘어납니다 (힘 ${STATS.max} 이면 ${carryCapacity(STATS.max)})`;
    return `무게가 모자랍니다 (남은 ${Math.round(free)} / 필요 ${need}) — 지금은 ${fits}개까지. ${more}`;
  }
  if (!hasRoom(me, defId)) {
    return `가방 칸이 다 찼습니다 (${me.backpack.length}/${LOOT.packSlots}) — 겹치지 않는 물건이라 빈 칸이 필요합니다`;
  }
  return null;
}

/* ===========================================================================
 *  명령
 * ======================================================================== */

export function createApi(world: World, refresh: () => void) {
  const done = <T,>(value: T): T => {
    saveWorld(world);
    refresh();
    return value;
  };

  return {
    /** 스킬 값을 그대로 세웁니다 — aden.skill('mining', 60) */
    skill(id: string, value: number) {
      if (!isSkill(id)) throw new Error(`스킬은 ${SKILL_ORDER.join(' · ')} 중 하나입니다 (받은 것: ${id})`);
      const next = Math.max(0, Math.min(MAX_SKILL, value));
      world.me.skills[id] = next;
      return done(`${SKILLS[id].name} ${next}`);
    },

    /** 물건을 줍니다 — aden.give('iron-ingot', 100) */
    give(defId: string, count = 1) {
      if (!ITEMS[defId]) throw new Error(`그런 물건이 없습니다: ${defId} (aden.items 로 목록)`);
      // ★ addItem 을 그대로 씁니다. 무게·칸 규칙에 막히면 그 사실을 알려줍니다 —
      //   규칙을 우회하면 여기서 만든 상태가 게임에서 나올 수 없는 상태가 됩니다.
      const why = whyNot(world, defId, count);
      if (why) throw new Error(`${itemDef(defId).name} ${count}개를 못 넣었습니다 — ${why}`);
      if (!addItem(world, defId, count)) {
        // whyNot 이 막을 이유를 못 찾았는데 addItem 이 거절했다면 둘이 어긋난 것입니다.
        // 조용히 넘기면 여기가 거짓말을 하기 시작합니다.
        throw new Error(`${itemDef(defId).name} ${count}개를 못 넣었습니다 — 이유를 못 찾았습니다 (whyNot 과 addItem 이 어긋납니다)`);
      }
      return done(`${itemDef(defId).name} ${count}개`);
    },

    /**
     *  힘을 세웁니다 — aden.str(100)
     *
     *  ★ 소지 상한을 직접 세우지 않습니다. 상한은 힘에서 나오는 값이라
     *    저장하면 계산 가능한 값을 저장하는 것이 됩니다 (CLAUDE.md 4장 1번).
     *    여기서는 힘만 세우고 상한은 그대로 derive 가 냅니다.
     */
    str(value: number) {
      const next = Math.max(1, Math.min(STATS.max, value));
      world.me.str = next;
      // 힘을 내리면 최대 체력도 내려갑니다. 지금 체력이 그 위에 떠 있게 두지 않습니다.
      world.me.hp = Math.min(world.me.hp, maxHpOf(next));
      const me = world.me;
      return done(`힘 ${next} · 소지 상한 ${derive(me).carry} (지금 ${Math.round(totalWeight(me))})`);
    },

    /** 지역을 옮깁니다 — aden.go('mine') */
    go(mapId: string) {
      if (!isMap(mapId)) throw new Error(`지역은 ${Object.keys(MAPS).join(' · ')} 중 하나입니다`);
      const def = mapDef(mapId);
      enterMap(world, mapId, def.entryTx, def.entryTy);
      return done(`${def.name} 입구`);
    },

    /**
     *  내구도를 남은 비율로 맞춥니다 — aden.dur(0.02) 면 거의 부러지기 직전
     *  두 번째 인자로 하나만 고를 수 있습니다: 'weapon' | 'armor' | 'helmet' | 물건 id
     */
    dur(ratio: number, only?: string) {
      const target = Math.max(0, Math.min(1, ratio));
      const me = world.me;
      const picked =
        only === 'weapon' ? [me.equipped.weapon]
        : only === 'armor' ? [me.equipped.armor]
        : only === 'helmet' ? [me.equipped.helmet]
        : only ? durables(world).filter((s) => s.defId === only)
        : durables(world);

      const touched = picked.filter((s): s is ItemStack => !!s && s.maxDurability !== undefined);
      if (touched.length === 0) throw new Error('내구도가 있는 물건을 못 찾았습니다');
      for (const stack of touched) stack.durability = stack.maxDurability! * target;
      return done(touched.map((s) => `${itemDef(s.defId).name} ${Math.round(target * 100)}%`).join(' · '));
    },

    /**
     *  시간을 그냥 흘려보냅니다 — aden.fast(60) 이면 1분치
     *
     *  ★ 규칙에는 배속이라는 것이 없습니다. tools/sim.ts 가 하는 것과 똑같이
     *    바깥에서 step 을 여러 번 부를 뿐입니다.
     */
    fast(seconds: number) {
      const span = Math.max(0, Math.min(MAX_FAST_SECONDS, seconds));
      const ticks = Math.round(span / DT);
      for (let i = 0; i < ticks; i++) step(world, DT);
      return done(`${(span / 60).toFixed(1)}분 흘려보냄 (지금 ${(world.time / 60).toFixed(1)}분)`);
    },

    /**
     *  봇에게 대신 놀게 합니다 — aden.bot(30) 이면 30분치
     *
     *  ★ 값을 손으로 세우는 것과 다릅니다. 실제로 캐고 만들고 싸워서 도달한 상태라
     *    "검이 닳는 것" 같은 것은 이쪽이 훨씬 정직합니다. tools/autopilot 그대로입니다.
     */
    bot(minutes: number, focus: Focus = 'balanced') {
      const span = Math.max(0, Math.min(MAX_FAST_SECONDS, minutes * 60));
      const pilot = newPilot(focus);
      const ticks = Math.round(span / DT);
      for (let i = 0; i < ticks; i++) {
        autopilot(world, pilot);
        step(world, DT);
      }
      const me = world.me;
      return done(
        `${(span / 60).toFixed(0)}분 · 채광 ${me.skills.mining.toFixed(1)} · 대장 ${me.skills.blacksmithing.toFixed(1)} · ` +
          `검술 ${me.skills.swordsmanship.toFixed(1)} · 금 ${Math.floor(me.gold)} · ${mapDef(world.mapId).name}`,
      );
    },

    help() {
      return [
        "aden.skill('mining'|'blacksmithing'|'swordsmanship'|'defense', 0~100)",
        'aden.give(물건id, 개수)   물건id 목록: aden.items',
        `aden.str(1~${STATS.max})           소지 상한 (힘 ${STATS.max} 이면 ${carryCapacity(STATS.max)})`,
        `aden.go('${Object.keys(MAPS).join("'|'")}')`,
        "aden.dur(0~1, 'weapon'|'armor'|'helmet'|물건id)",
        'aden.fast(초)            시간만 흘려보냅니다',
        "aden.bot(분, 'balanced'|'mine'|'fight')   봇이 대신 놉니다",
      ].join('\n');
    },

    get items() {
      return Object.keys(ITEMS);
    },
  };
}

export type DevApi = ReturnType<typeof createApi>;

/** 콘솔에서도 쓸 수 있게 window.aden 에 걸어둡니다 */
export function attach(world: World, refresh: () => void): () => void {
  const holder = globalThis as unknown as { aden?: DevApi & { inspect?: () => unknown } };
  const api = createApi(world, refresh) as DevApi & { inspect?: () => unknown };

  //  ★ 검증용 읽기 창구. **개발 중에만 붙습니다.**
  //    vite 가 빌드 때 `import.meta.env.DEV` 를 false 로 박으므로 이 가지째 사라지고,
  //    inspect 모듈도 따라 들어가지 않습니다 (dist 를 뒤져 확인했습니다).
  //
  //  ★ 있는 이유는 하나입니다 — **화면 픽셀로 위치를 역추적하지 않기 위해서**입니다.
  //    자세한 것은 dev/inspect.ts 머리말과 .claude/rules/rendering.md.
  if (import.meta.env.DEV) {
    api.inspect = () => inspect(world);
  }

  holder.aden = api;
  return () => {
    delete holder.aden;
  };
}

/* ===========================================================================
 *  화면 패널 — 폰에는 콘솔이 없습니다
 * ======================================================================== */

const BTN = 'btn h-10 rounded-sm px-2.5 text-[12px] text-parch-200';

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-1">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function DevTools({ world, refresh }: { world: World; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  // ★ where 를 함께 들고 있습니다 — 답을 패널 맨 밑에 몰아 놓으면
  //   무엇을 눌러서 나온 말인지 알 수 없고, 줄이 길어지면 스크롤 밖으로 나갑니다.
  const [said, setSaid] = useState<{ text: string; bad: boolean; where: string } | null>(null);
  const [skillId, setSkillId] = useState<SkillId>('mining');

  // 콘솔 명령은 패널을 열지 않아도 늘 붙어 있습니다
  useEffect(() => attach(world, refresh), [world, refresh]);

  //  ★ 나가거나 새로 시작하면 1배로 돌아갑니다. 저장하지 않습니다.
  useEffect(() => () => setDevSpeed(1), []);

  const speedNow = devSpeed();
  const actualNow = achievedSpeed();

  const api = createApi(world, refresh);
  const run = (where: string, fn: () => string) => {
    try {
      setSaid({ text: fn(), bad: false, where });
    } catch (error) {
      setSaid({ text: error instanceof Error ? error.message : String(error), bad: true, where });
    }
  };

  /** 답을 누른 단추 바로 아래에 놓습니다 */
  const note = (where: string) =>
    said && said.where === where ? (
      <p
        className={`rounded-sm border px-2.5 py-2 text-[12px] leading-snug ${
          said.bad
            ? 'border-[#e88a86]/50 bg-[#3a1512]/40 text-[#e88a86]'
            : 'border-ink-600 bg-ink-700/60 text-parch-200'
        }`}
      >
        {said.text}
      </p>
    ) : null;

  if (!open) {
    return (
      <div className="absolute right-2 top-32 z-30 flex items-center gap-1.5">
        {/* ★ 패널을 닫아도 몇 배인지 보여야 합니다. 안 보이면 왜 이상한지 모릅니다 */}
        {speedNow !== 1 && (
          <button
            type="button"
            onClick={() => { setDevSpeed(1); refresh(); }}
            className="btn h-9 rounded-sm px-2 text-[11px] font-bold text-brass-300"
            title="눌러서 1배로"
          >
            <span>×{speedNow}</span>
            {actualNow < speedNow - 0.15 && (
              <span className="ml-1.5 font-normal text-[#e88a86]">실제 ×{actualNow.toFixed(1)}</span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn h-9 rounded-sm px-2 text-[11px] text-parch-400"
        >
          시험
        </button>
      </div>
    );
  }

  return (
    <div className="panel absolute inset-2 z-30 flex flex-col overflow-hidden rounded-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-ink-600 px-2.5 py-2">
        <span className="display text-[13px] font-bold text-brass-300">시험용 도구</span>
        <button type="button" onClick={() => setOpen(false)} className="btn h-9 rounded-sm px-3 text-[12px] text-parch-300">
          닫기
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5">
        <Row title="봇이 대신 놀기">
          {[5, 15, 30, 60].map((m) => (
            <button key={m} type="button" className={BTN} onClick={() => run('bot', () => api.bot(m, 'balanced'))}>
              {m}분
            </button>
          ))}
        </Row>
        {note('bot')}

        <Row title="스킬 고르기">
          {SKILL_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSkillId(id)}
              className={`${BTN} ${skillId === id ? 'text-brass-300' : 'text-parch-400'}`}
            >
              {SKILLS[id].name}
            </button>
          ))}
        </Row>
        <div className="-mt-1.5 flex flex-wrap gap-1.5">
          {[25, 50, 75, 100].map((v) => (
            <button key={v} type="button" className={BTN} onClick={() => run('skill', () => api.skill(skillId, v))}>
              {SKILLS[skillId].name} {v}
            </button>
          ))}
        </div>
        {note('skill')}

        <Row title="지역">
          {/* ★ 목록을 여기 다시 적지 않습니다 — 지역을 늘리면 단추도 저절로 생깁니다 */}
          {MAP_ORDER.map((id) => (
            <button key={id} type="button" className={BTN} onClick={() => run('go', () => api.go(id))}>
              {mapDef(id).name}
            </button>
          ))}
        </Row>
        {note('go')}

        <Row title="장비 닳게 하기">
          {[0.5, 0.1, 0.02].map((r) => (
            <button key={r} type="button" className={BTN} onClick={() => run('dur', () => api.dur(r))}>
              {Math.round(r * 100)}% 남기기
            </button>
          ))}
        </Row>
        {note('dur')}

        {/* ★ 물건 바로 위에 둡니다 — 물건이 안 들어가는 이유가 거의 늘 무게라서,
            막혔을 때 손이 갈 곳이 눈앞에 있어야 합니다 */}
        <Row title={`힘 ${Math.round(world.me.str)} · 소지 ${Math.round(totalWeight(world.me))}/${derive(world.me).carry}`}>
          {[20, 50, 100].map((v) => (
            <button key={v} type="button" className={BTN} onClick={() => run('str', () => api.str(v))}>
              힘 {v}
            </button>
          ))}
        </Row>
        {note('str')}

        <Row title="물건">
          {/* ★ 목록을 여기 다시 적지 않습니다 — 시험이 보는 것과 같은 표여야 합니다 */}
          {GIVE_BUTTONS.map(([defId, count]) => (
            <button key={defId} type="button" className={BTN} onClick={() => run('give', () => api.give(defId, count))}>
              {itemDef(defId).name} {count}
            </button>
          ))}
        </Row>
        {note('give')}

        <Row title="배속">
          {SPEEDS.map((n) => (
            <button
              key={n}
              type="button"
              className={`${BTN} ${speed === n ? 'text-brass-300' : 'text-parch-400'}`}
              onClick={() => { setDevSpeed(n); refresh(); }}
            >
              {n}배
            </button>
          ))}
        </Row>
        <p className="-mt-1.5 text-[11px] leading-snug text-parch-400/80">
          놀면서 빨리 봅니다. 아래 '시간' 은 한 번에 건너뛰는 것이라 그 사이에 아무것도 못 합니다.
          {actualNow < speedNow - 0.15 && (
            <b className="text-[#e88a86]">
              {' '}지금은 화면이 못 따라가서 실제로 ×{actualNow.toFixed(1)} 만 흐릅니다.
            </b>
          )}
        </p>

        <Row title="시간">
          <button type="button" className={BTN} onClick={() => run('fast', () => api.fast(30))}>
            30초
          </button>
          <button type="button" className={BTN} onClick={() => run('fast', () => api.fast(300))}>
            5분
          </button>
        </Row>
        {note('fast')}

        <p className="text-[11px] leading-snug text-parch-400/70">
          콘솔에서는 <b className="text-parch-300">aden.help()</b> — 이 패널과 같은 명령입니다.
        </p>
      </div>
    </div>
  );
}
