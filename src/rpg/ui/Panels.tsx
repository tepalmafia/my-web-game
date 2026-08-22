/**
 *  오른쪽 창 넷 — 스킬 · 가방 · 대장간 · 상점.
 *
 *  전부 world 를 직접 읽고, 무언가를 바꿀 때는 core/ 의 함수를 부릅니다.
 *  여기에는 규칙이 없습니다.
 */

import { useState } from 'react';

import { LOOT, MAX_SKILL, SKILL_TOTAL_MAX, STATS } from '../balance';
import { ITEMS, itemDef } from '../content/items';
import { RECIPE_ORDER, recipeDef } from '../content/recipes';
import { TEMPER_ORDER, temperDef } from '../content/tempers';
import { forsaken, nextStage, openRecipes, openStock, progressOf, stageReady } from '../content/town';
import { AXES, AXIS_ORDER, SKILLS, SKILL_ORDER } from '../content/skills';
import { titleDef } from '../content/titles';
import { canTemper, craftChance, craftFineChance, craftLoss, nearForge } from '../core/action';
import { SLOT_LABEL, borrowPickaxe, chooseTownPath, craft, dropItem, repair, useItem, wear } from '../core/commands';
import { hasTool, repairQuote } from '../core/durability';
import { durinSays, pickaxeLoanProblem, pickaxeLoanSays } from '../core/npc';
import { buyItem, countOf, equip, sellItem, sellUnitPrice, unequip } from '../core/inventory';
import { axisSpent, budgetLeft, learnBlock, lessonsFor, skillTotal } from '../core/skillgain';
import { derive, itemName, itemSummary, wearRatio } from '../core/stats';
import type { EquipSlot, ItemKind, ItemStack, PanelId, SkillId, World } from '../types';
import { duration, fmt, percent } from './format';

/** 가방 줄 앞에 붙는 한 글자 — 종류를 늘리면 컴파일이 막습니다 */
export const KIND_ICON: Record<ItemKind, string> = {
  weapon: '검', armor: '갑', helmet: '투', tool: '연', resource: '광', potion: '물',
};

/* ===========================================================================
 *  창 껍데기
 * ======================================================================== */

export function SidePanel({
  world, refresh, open, onOpen, onClose,
}: {
  world: World;
  refresh: () => void;
  /** 폰 세로에서 아래 창이 펼쳐져 있는가 (넓은 화면에서는 늘 펼쳐져 있습니다) */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const inTown = world.map.def.safe;
  const tabs: { id: PanelId; label: string }[] = [
    { id: 'skills', label: '실력' },
    { id: 'pack', label: '가방' },
  ];
  if (inTown) tabs.push({ id: 'craft', label: '대장간' }, { id: 'shop', label: '상점' });

  const active: PanelId = world.panel && tabs.some((t) => t.id === world.panel) ? world.panel : 'skills';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        ★ 접혀 있으면 이 줄만 보입니다. 탭을 누르면 펼쳐지고, 손잡이로 다시 접습니다.
        ★ 넓은 화면에서도 접힙니다. 접히면 오른쪽에 가느다란 기둥만 남고
          탭이 세로로 섭니다 — 여기 있는 숫자는 초 단위로 변하는 것이 아니라
          늘 보고 있을 것이 아닙니다.
      */}
      <div
        className={`flex shrink-0 gap-0.5 border-b border-ink-600 bg-ink-900 px-1 pt-1 ${
          open ? 'items-stretch' : 'items-stretch lg:flex-col lg:border-b-0 lg:pb-1'
        }`}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { world.panel = tab.id; onOpen(); refresh(); }}
            className={`display relative flex-1 px-2 py-2.5 text-[13px] font-bold transition ${
              open && active === tab.id ? 'text-brass-300' : 'text-parch-400 hover:text-parch-200'
            } ${open ? '' : 'lg:flex-none lg:px-0 lg:text-[12px]'}`}
          >
            {tab.label}
            {open && active === tab.id && (
              <span className="absolute inset-x-1 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-brass-400 to-transparent" />
            )}
          </button>
        ))}

        <button
          type="button"
          onClick={() => { onClose(); refresh(); }}
          aria-label="창 접기"
          className={`w-11 shrink-0 text-[15px] text-parch-400 hover:text-parch-200 ${open ? '' : 'hidden'}`}
        >
          ∨
        </button>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto p-2.5 ${open ? '' : 'hidden'}`}>
        {active === 'skills' && <SkillPanel world={world} />}
        {active === 'pack' && <PackPanel world={world} refresh={refresh} />}
        {active === 'craft' && <CraftPanel world={world} refresh={refresh} />}
        {active === 'shop' && <ShopPanel world={world} refresh={refresh} />}
      </div>
    </div>
  );
}

/* ===========================================================================
 *  실력
 * ======================================================================== */

/**
 *  왜 안 오르는지 한 줄로.
 *
 *  ★ 이유가 둘이라 둘을 갈라 말합니다. 판단은 core/skillgain 이 하고
 *    여기는 그 답에 말을 붙이기만 합니다.
 */
const BLOCK_SAID: Record<string, { text: string; tone: string }> = {
  maxed: { text: '경지에 올랐습니다', tone: 'text-brass-300' },
  budget: { text: '예산을 다 썼습니다', tone: 'text-[#e88a86]' },
  ceiling: { text: '여기서 배울 수 있는 것은 다 배웠습니다', tone: 'text-parch-400' },
};

function LessonList({ world, skillId }: { world: World; skillId: SkillId }) {
  const lessons = lessonsFor(world, skillId);
  const block = learnBlock(world, skillId);
  const said = BLOCK_SAID[block];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold" style={{ color: SKILLS[skillId].color }}>
          {SKILLS[skillId].name} {world.me.skills[skillId].toFixed(1)}
        </span>
        {said && <span className={`text-[11px] ${said.tone}`}>{said.text}</span>}
      </div>
      <div className="mt-1 space-y-1">
        {lessons.map((lesson) => {
          // 예산이 막고 있으면 확률이 얼마든 안 오릅니다 — 그렇게 보여야 합니다
          const dead = block === 'budget' || block === 'maxed' || lesson.chance <= 0;
          return (
            <div
              key={lesson.id}
              className="flex items-center justify-between rounded-sm border border-ink-600 bg-ink-700/60 px-2 py-1 text-[11px]"
            >
              <span className={dead ? 'text-parch-400/60' : 'text-parch-200'}>{lesson.name}</span>
              <span className="tabular text-parch-400">난이도 {lesson.difficulty}</span>
              <span
                className={`tabular w-20 text-right font-bold ${
                  dead ? 'text-parch-400/60' : lesson.chance > 0.2 ? 'text-[#8fcf8a]' : 'text-brass-300'
                }`}
              >
                {block === 'budget'
                  ? '자리 없음'
                  : lesson.chance <= 0
                    ? '배울 것 없음'
                    // ★ 0% 로 반올림되면 "안 오른다" 로 읽힙니다. 오르긴 오릅니다
                    : lesson.chance < 0.005
                      ? '성장 <1%'
                      : `성장 ${percent(lesson.chance)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkillPanel({ world }: { world: World }) {
  const me = world.me;
  const stats = derive(me);
  const total = me.str + me.dex + me.int;

  const spent = skillTotal(me);
  const left = budgetLeft(me);
  const over = spent > SKILL_TOTAL_MAX;

  return (
    <div className="space-y-3">
      <section>
        <h3 className="eyebrow mb-1.5">스킬</h3>
        <div className="space-y-2">
          {SKILL_ORDER.map((id) => {
            const info = SKILLS[id];
            const value = me.skills[id];
            const block = learnBlock(world, id);
            return (
              <div key={id}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold" style={{ color: info.color }}>
                    {info.name}
                    {!info.counts && <span className="ml-1 text-[10px] font-normal text-parch-400">총합 밖</span>}
                  </span>
                  <span className="tabular text-xs font-bold text-parch-100">
                    {value.toFixed(1)}
                    <span className="text-parch-400"> / {MAX_SKILL}</span>
                  </span>
                </div>
                <div className="socket mt-1 h-2 rounded-[2px]">
                  <div className="fill" style={{ width: `${value}%`, background: info.color }} />
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-parch-400">{info.desc}</p>
                {block !== 'none' && BLOCK_SAID[block] && (
                  <p className={`mt-0.5 text-[11px] leading-snug ${BLOCK_SAID[block]!.tone}`}>
                    더 오르지 않습니다 — {BLOCK_SAID[block]!.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-1.5">스킬 총합</h3>
        <div className="space-y-1 text-xs">
          {AXIS_ORDER.map((axis) => (
            <div key={axis} className="flex items-baseline justify-between border-b border-ink-600/70 py-1">
              <span className="text-parch-300">
                {AXES[axis].name}{' '}
                <span className="text-[10px] text-parch-400">
                  {AXES[axis].skills.filter((id) => SKILLS[id].counts).map((id) => SKILLS[id].name).join(' · ')}
                </span>
              </span>
              <span className="tabular font-semibold text-parch-100">{axisSpent(me, axis).toFixed(1)}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-parch-400">총합</span>
            <span className={`tabular font-bold ${left <= 0 ? 'text-brass-300' : 'text-parch-200'}`}>
              {spent.toFixed(1)} / {SKILL_TOTAL_MAX}
            </span>
          </div>

          {/*  ★ 방어만 예외인 이유를 밝힙니다. 이유 없이 예외면 그냥 이상한 규칙입니다  */}
          <p className="text-[11px] leading-snug text-parch-400">
            <b className="text-parch-300">방어는 총합에 들어가지 않습니다.</b> 방어는 맞아봐야 아는 것이라
            내가 고른 일이 아닙니다 — 안 고른 것이 자리를 먹으면 무엇에 몰지 고르는 뜻이 없어집니다.
          </p>

          {/*
            ★ 사실만 적습니다. 상한은 오늘 콘텐츠로는 안 물리므로(전체설계 6.2.2)
              "무엇에 몰지가 이 캐릭터를 정합니다" 는 아직 참이 아닌 무게입니다.
              총량이 있다는 것과 오른 것은 줄지 않는다는 것, 둘 다 지금도 참입니다.
          */}
          {left > 0 ? (
            <p className="text-[11px] leading-snug text-parch-400">
              이 세계에는 스킬 총량이 있습니다 — 남은 자리{' '}
              <b className="tabular text-parch-200">{left.toFixed(1)}</b>. 오른 스킬은 줄지 않습니다.
            </p>
          ) : (
            <p className="text-[11px] leading-snug text-brass-300">
              총합이 꽉 찼습니다{over && ` (${spent.toFixed(1)})`}. 이제 채광 · 대장기술 · 검술은 아무것도 오르지 않습니다.
              {over && ' 넘긴 것은 줄지 않습니다.'}
            </p>
          )}
        </div>
      </section>

      {me.titles.length > 0 && (
        <section>
          <h3 className="eyebrow mb-1.5">칭호</h3>
          <div className="space-y-1">
            {me.titles.map((id) => {
              const def = titleDef(id);
              const worn = me.wearing === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => wear(world, worn ? null : id)}
                  className={`btn w-full rounded-sm px-2 py-1.5 text-left ${worn ? 'text-brass-300' : 'text-parch-400'}`}
                >
                  <span className="text-xs font-bold">
                    「{def.name}」{worn && <span className="ml-1 text-[10px] font-normal">달고 있음</span>}
                  </span>
                  <span className="block text-[11px] leading-snug text-parch-400">{def.earned}</span>
                </button>
              );
            })}
          </div>
          {/*
            ★ 하나뿐일 때는 고르라고 하지 않습니다. 아직 없는 선택을 미리 말하면
              이상해집니다 — 둘이 되는 순간 이 줄이 나타납니다 (목적지-기획안 2.3).
          */}
          {me.titles.length > 1 && (
            <p className="mt-1 text-[11px] leading-snug text-parch-400">
              <b className="text-parch-300">하나만 달 수 있습니다.</b> 단 것이 이름 옆에 붙습니다.
            </p>
          )}
        </section>
      )}

      <section>
        <h3 className="eyebrow mb-1.5">지금 배울 수 있는 것</h3>
        <p className="mb-1.5 text-[11px] text-parch-400">
          지금 실력보다 <b className="text-parch-200">한참 쉬운 일에서는 아무것도 배우지 못합니다.</b>
        </p>
        <div className="space-y-2.5">
          {SKILL_ORDER.map((id) => (
            <LessonList key={id} world={world} skillId={id} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-1.5">능력치</h3>
        <div className="space-y-1 text-xs">
          {([['str', '힘', '드는 무게와 체력'], ['dex', '민첩', '휘두르는 속도'], ['int', '지능', '아직 쓰이지 않음']] as const).map(
            ([id, name, note]) => (
              <div key={id} className="flex items-baseline justify-between border-b border-ink-600/70 py-1">
                <span className="text-parch-300">{name} <span className="text-[10px] text-parch-400">{note}</span></span>
                <span className="tabular font-semibold text-parch-100">{me[id].toFixed(1)}</span>
              </div>
            ),
          )}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-parch-400">총합</span>
            <span className={`tabular font-bold ${total >= STATS.totalMax - 1 ? 'text-brass-300' : 'text-parch-200'}`}>
              {total.toFixed(1)} / {STATS.totalMax}
            </span>
          </div>
          {total >= STATS.totalMax - 1 && (
            <p className="text-[11px] text-brass-300">
              총합이 꽉 찼습니다. 이제 하나가 오르면 다른 하나가 내려갑니다.
            </p>
          )}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-1.5">기록</h3>
        <div className="space-y-1 text-xs">
          <Row label="최대 체력" value={fmt(stats.maxHp)} />
          <Row label="공격력" value={`${fmt(stats.minDamage)} ~ ${fmt(stats.maxDamage)}`} />
          <Row label="휘두르는 속도" value={`${stats.swing.toFixed(2)}초`} />
          <Row label="방어" value={fmt(stats.defense)} />
          <Row label="쓰러진 횟수" value={`${me.deaths} 번`} />
          <Row label="놀아본 시간" value={duration(me.playSeconds)} />
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink-600/70 py-1">
      <span className="text-parch-400">{label}</span>
      <span className="tabular font-semibold text-parch-100">{value}</span>
    </div>
  );
}

/* ===========================================================================
 *  가방
 * ======================================================================== */

function DurabilityBar({ stack }: { stack: ItemStack }) {
  const ratio = wearRatio(stack);
  if (ratio === null) return null;
  const color = ratio > 0.5 ? '#8fcf8a' : ratio > 0.2 ? '#e0b23a' : '#c2352f';
  return (
    <div className="socket mt-0.5 h-1 rounded-[1px]">
      <div className="fill" style={{ width: `${ratio * 100}%`, background: color }} />
    </div>
  );
}

function PackPanel({ world, refresh }: { world: World; refresh: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const me = world.me;
  const stats = derive(me);
  const stack = me.backpack.find((s) => s.uid === selected) ?? null;
  const def = stack ? itemDef(stack.defId) : null;
  const forge = nearForge(world);

  return (
    <div className="space-y-3">
      <section>
        <h3 className="eyebrow mb-1.5">입은 것</h3>
        <div className="space-y-1">
          {(['weapon', 'armor', 'helmet'] as EquipSlot[]).map((slot) => {
            const worn = me.equipped[slot];
            return (
              <div key={slot} className="rounded-sm border border-ink-600 bg-ink-700/60 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-[11px] text-parch-400">{SLOT_LABEL[slot]}</span>
                  {worn ? (
                    <>
                      <span className="flex-1 truncate text-xs font-semibold text-parch-100">{itemName(worn)}</span>
                      <span className="shrink-0 text-[10px] text-parch-400">{itemSummary(worn)}</span>
                      {forge && wearRatio(worn) !== null && wearRatio(worn)! < 1 && (
                        <button type="button" onClick={() => { repair(world, worn.uid); refresh(); }}
                          className="btn shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] text-brass-300">
                          수리
                        </button>
                      )}
                      <button type="button" onClick={() => { unequip(world, slot); refresh(); }}
                        className="btn shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]">
                        해제
                      </button>
                    </>
                  ) : (
                    <span className="flex-1 text-xs text-parch-400/70">비어 있음</span>
                  )}
                </div>
                {worn && <DurabilityBar stack={worn} />}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-1.5 flex items-baseline justify-between">
          <span>
            가방{' '}
            <span className={`tabular ${me.backpack.length >= LOOT.packSlots ? 'text-[#e88a86]' : 'text-parch-300'}`}>
              {me.backpack.length} / {LOOT.packSlots}
            </span>{' '}
            칸
          </span>
          <span className={stats.load > stats.carry * 0.9 ? 'text-[#e88a86]' : 'text-brass-300'}>
            {fmt(stats.load)} / {fmt(stats.carry)} 스톤
          </span>
        </h3>
        <div className="socket mb-2 h-2 rounded-[2px]">
          <div className="fill fill-exp" style={{ width: `${Math.min(100, (stats.load / stats.carry) * 100)}%` }} />
        </div>

        {/* ★ 예전에는 종류를 뜻하는 글자 한 자('연' '광' '물')만 칸에 찍혀서,
            무엇이 몇 개인지 알 수 없었습니다. 이름과 개수를 나란히 적습니다. */}
        <div className="space-y-1">
          {me.backpack.map((s) => {
            const d = itemDef(s.defId);
            const chosen = s.uid === selected;
            return (
              <button
                key={s.uid}
                type="button"
                onClick={() => setSelected(chosen ? null : s.uid)}
                title={`${d.name} — ${d.desc}`}
                className={`flex w-full items-center gap-2 rounded-sm border px-1.5 py-1 text-left transition ${
                  chosen ? 'border-brass-400 bg-ink-700' : 'border-ink-600 bg-ink-700/60 hover:border-brass-500/60'
                }`}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-ink-500 text-[11px] font-bold text-parch-200"
                  style={{ background: 'linear-gradient(180deg,#241d16,#171310)' }}
                >
                  {KIND_ICON[d.kind]}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-parch-100">
                    {itemName(s)}
                  </span>
                  {wearRatio(s) !== null && (
                    <span className="tabular block text-[10px] text-parch-400">
                      내구 {Math.ceil(s.durability ?? 0)}/{Math.round(s.maxDurability ?? 0)}
                    </span>
                  )}
                </span>

                {/* 수량은 하나뿐이어도 적습니다 — "몇 개인지" 를 매번 세지 않게 */}
                <span className="tabular shrink-0 text-xs font-bold text-parch-100">×{s.count}</span>
                <span className="tabular w-12 shrink-0 text-right text-[10px] text-parch-400">
                  {fmt(d.weight * s.count)} 스톤
                </span>
              </button>
            );
          })}
          {me.backpack.length === 0 && (
            <p className="py-4 text-center text-xs text-parch-400/70">가방이 비었습니다</p>
          )}
        </div>
      </section>

      {stack && def && (
        <section className="panel rounded-sm p-2">
          <div className="flex items-baseline justify-between">
            <span className="display text-sm font-bold text-parch-100">{itemName(stack)}</span>
            <span className="tabular text-[10px] text-parch-400">{def.weight * stack.count} 스톤</span>
          </div>
          <div className="mt-0.5 text-xs text-[#8fcf8a]">{itemSummary(stack)}</div>
          <p className="mt-1 text-[11px] leading-snug text-parch-400">{def.desc}</p>
          <DurabilityBar stack={stack} />

          <div className="mt-2 flex flex-wrap gap-1.5">
            {def.slot && (
              <button type="button" onClick={() => { equip(world, stack.uid); setSelected(null); refresh(); }}
                className="btn btn-brass rounded-sm px-2.5 py-1 text-xs">
                착용
              </button>
            )}
            {def.healHp && (
              <button type="button" onClick={() => { useItem(world, stack.uid); refresh(); }}
                className="btn rounded-sm px-2.5 py-1 text-xs text-[#8fd0e8]">
                마시기
              </button>
            )}
            {forge && wearRatio(stack) !== null && wearRatio(stack)! < 1 && (
              <button type="button" onClick={() => { repair(world, stack.uid); refresh(); }}
                className="btn rounded-sm px-2.5 py-1 text-xs text-brass-300">
                수리
              </button>
            )}
            {world.map.def.safe && def.sell > 0 && (
              <button type="button" onClick={() => { sellItem(world, stack.uid, 1); setSelected(null); refresh(); }}
                className="btn rounded-sm px-2.5 py-1 text-xs">
                팔기 {fmt(def.sell)}골드
              </button>
            )}
            {/* ★ 짐을 더는 길이 그동안 파는 것뿐이었습니다. 놓고 갈 수 있어야
                   무엇을 들고 다닐지가 판단이 됩니다 (전체설계 3.2) */}
            <button type="button"
              onClick={() => { dropItem(world, stack.uid, 1); setSelected(null); refresh(); }}
              className="btn rounded-sm px-2.5 py-1 text-xs text-parch-300">
              놓기
            </button>
            {stack.count > 1 && (
              <button type="button"
                onClick={() => { dropItem(world, stack.uid, stack.count); setSelected(null); refresh(); }}
                className="btn rounded-sm px-2.5 py-1 text-xs text-parch-300">
                전부 놓기
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-parch-400/80">
            {world.map.def.safe
              ? '여기 내려놓은 것은 없어지지 않습니다.'
              : '밖에 내려놓은 것은 한참 뒤에 사라집니다. 가져갈 때는 눌러서 가져갑니다.'}
          </p>
        </section>
      )}
    </div>
  );
}

/* ===========================================================================
 *  대장간
 * ======================================================================== */

/* ---------------------------------------------------------------- 마을이 자란다 */

/**
 *  다음 단계까지 얼마나 왔는가.
 *
 *  ★ 얼마 남았는지는 보여줍니다 — 모르면 목표가 될 수 없습니다.
 *  ★ 무엇이 열리는지는 보여주지 않습니다 — 알면 선택이 아니라 목표치입니다.
 */
function TownProgress({ world }: { world: World }) {
  const town = world.me.town;
  const stage = nextStage(town);
  if (!stage || stageReady(town)) return null;

  return (
    <section className="rounded-sm border border-ink-600 bg-ink-700/40 p-2">
      <h3 className="eyebrow mb-1">두린에게 판 것</h3>
      {progressOf(town).map((row) => (
        <div key={row.defId} className="mb-1">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-parch-300">{itemDef(row.defId).name}</span>
            <span className="tabular text-parch-100">
              {row.have} <span className="text-parch-400">/ {row.need}</span>
            </span>
          </div>
          <div className="socket mt-0.5 h-1.5 rounded-[2px]">
            <div className="fill fill-exp" style={{ width: `${(row.have / row.need) * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="mt-1 text-[11px] leading-snug text-parch-400/80">
        팔면 마을이 자랍니다. 무엇이 열릴지는 두린만 압니다.
      </p>
    </section>
  );
}

/**
 *  갈림길.
 *
 *  ★ 고르는 순간이 되돌릴 수 없다는 것이 분명해야 합니다. 그래서 두 걸음입니다 —
 *    고를 것을 누르면 무엇을 버리는지 이름을 대고 다시 묻습니다.
 */
function TownChoicePanel({ world, refresh }: { world: World; refresh: () => void }) {
  const [asking, setAsking] = useState<string | null>(null);
  const town = world.me.town;
  const stage = nextStage(town);
  // ★ 갈림길이 없는 단계는 저절로 오릅니다 — 물을 것이 없으니 이 창도 안 뜹니다
  if (!stage || !stage.choices || !stageReady(town)) return null;
  const choices = stage.choices;

  const picked = asking ? choices.find((c) => c.id === asking) : null;
  const dropped = asking ? choices.find((c) => c.id !== asking) : null;

  return (
    <section className="rounded-sm border border-brass-400/70 bg-[#241c0e]/60 p-2.5">
      <h3 className="display text-[13px] font-bold text-brass-300">{stage.name}</h3>

      {picked && dropped ? (
        <div className="mt-2 rounded-sm border border-[#e88a86]/60 bg-[#3a1512]/50 p-2.5">
          <p className="text-[13px] font-bold text-[#e88a86]">되돌릴 수 없습니다.</p>
          <p className="mt-1.5 text-[12px] leading-snug text-parch-200">
            <b className="text-brass-300">{picked.name}</b> 을(를) 고릅니다.
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[#e88a86]">
            <b>{dropped.name}</b> 은(는) 이 인물에서 <b>영영 열리지 않습니다.</b>
          </p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => setAsking(null)} className="btn h-11 flex-1 rounded-sm text-[13px] text-parch-300">
              그만두기
            </button>
            <button
              type="button"
              onClick={() => { chooseTownPath(world, picked.id); setAsking(null); refresh(); }}
              className="btn h-11 flex-1 rounded-sm text-[13px] font-bold"
              style={{ borderColor: 'rgba(194,53,47,0.7)', color: '#e88a86' }}
            >
              고른다
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-[11px] leading-snug text-parch-400">
            두린이 둘을 내놓았습니다. <b className="text-[#e88a86]">하나만 고를 수 있습니다.</b>
          </p>
          <div className="mt-2 space-y-1.5">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => setAsking(choice.id)}
                className="btn w-full rounded-sm px-2.5 py-2 text-left"
              >
                <span className="block text-[13px] font-bold text-brass-300">{choice.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-parch-300">{choice.desc}</span>
                <span className="mt-1 block text-[11px] text-parch-400">
                  {choice.recipes.map((id) => recipeDef(id).name).join(' · ')} 을(를) 만들 수 있게 됩니다
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** 고르지 않아 버린 것 — 무엇을 놓쳤는지는 알아야 합니다 */
function ForsakenList({ world }: { world: World }) {
  const gone = forsaken(world.me.town);
  if (gone.length === 0) return null;
  return (
    <section>
      <h3 className="eyebrow mb-1">고르지 않은 길</h3>
      <div className="space-y-1">
        {gone.map((choice) => (
          <div key={choice.id} className="rounded-sm border border-ink-600 bg-ink-800/60 px-2 py-1.5">
            <span className="text-[12px] text-parch-400/70 line-through">{choice.name}</span>
            <span className="ml-1.5 text-[11px] text-parch-400/50">
              {choice.recipes.map((id) => recipeDef(id).name).join(' · ')}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CraftPanel({ world, refresh }: { world: World; refresh: () => void }) {
  const me = world.me;
  const forge = nearForge(world);

  const damaged = [me.equipped.weapon, me.equipped.armor, me.equipped.helmet, ...me.backpack]
    .filter((s): s is ItemStack => !!s && wearRatio(s) !== null && wearRatio(s)! < 1);

  return (
    <div className="space-y-3">
      {/*
        ★ 두린의 말은 두 겹입니다 (이야기-기획안 2.2).
          인정은 도달했을 때만 얹히고, 안내는 늘 있습니다.
          어느 줄을 할지는 core/npc 가 정합니다 — 여기는 받아 그리기만 합니다.
      */}
      {(() => {
        const said = durinSays(world);
        return (
          <div className="rounded-sm border border-ink-600 bg-ink-700/60 p-2">
            <span className="text-[11px] font-bold text-[#e0764a]">대장장이 두린</span>
            {said.noted && (
              <p className="mt-1 text-[11px] italic leading-snug text-brass-300">{said.noted}</p>
            )}
            <p className="mt-1 text-[11px] leading-snug text-parch-300">{said.guide}</p>
          </div>
        );
      })()}

      {/*
        ★ 막다른 길을 여는 단추. 곡괭이가 없을 때만 나타납니다.
          될까/왜 안 될까는 core/npc 가 답합니다 — 여기는 그 말을 그립니다 (4장 3번).
          맨손으로는 들개도 못 잡습니다(재봤습니다). 그래서 이 자리가 필요합니다.
      */}
      {!hasTool(world.me, 'pickaxe') && (
        <div className="rounded-sm border border-[#5a3a12] bg-[#2a1c0a] p-2">
          <p className="text-[11px] leading-snug text-[#e8b483]">{pickaxeLoanSays(world)}</p>
          <button
            type="button"
            disabled={pickaxeLoanProblem(world) !== null}
            onClick={() => {
              borrowPickaxe(world);
              refresh();
            }}
            className="btn mt-2 h-9 rounded-sm px-3 text-[11px] text-parch-200 disabled:opacity-40"
          >
            곡괭이를 빌린다
          </button>
        </div>
      )}

      {!forge && (
        <p className="rounded-sm border border-[#5a3a12] bg-[#2a1c0a] p-2 text-[11px] text-[#e8b483]">
          화로 앞에 서야 만들 수 있습니다. 대장장이 두린 옆의 붉은 화로로 가세요.
        </p>
      )}

      <TownChoicePanel world={world} refresh={refresh} />
      <TownProgress world={world} />

      <section>
        <h3 className="eyebrow mb-1.5">만들기</h3>
        <div className="space-y-1.5">
          {/* ★ 잠긴 제작법은 목록에 없습니다. 미리 보이면 선택이 아니라 목표치입니다 */}
          {RECIPE_ORDER.filter((id) => openRecipes(me.town).has(id)).map((id) => {
            const recipe = recipeDef(id);
            const chance = craftChance(world, id);
            const fine = craftFineChance(world, id);
            const enough = recipe.needs.every((n) => countOf(me, n.defId) >= n.count);

            return (
              <div key={id} className="rounded-sm border border-ink-600 bg-ink-700/60 p-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-parch-100">{recipe.name}</span>
                  <span className="tabular text-[10px] text-parch-400">난이도 {recipe.difficulty}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]">
                  {recipe.needs.map((n) => {
                    const have = countOf(me, n.defId);
                    return (
                      <span key={n.defId} className={have >= n.count ? 'text-parch-300' : 'text-[#e88a86]'}>
                        {itemDef(n.defId).name} {have}/{n.count}
                      </span>
                    );
                  })}
                </div>
                {/* ★ 실패하면 무엇을 잃는지 누르기 전에 보여줍니다.
                       돌려받는 몫은 없습니다 — 재료가 전부 사라집니다 */}
                <div className="mt-0.5 text-[11px] text-[#e88a86]">
                  실패하면{' '}
                  <b>
                    {craftLoss(id)
                      .map((l) => `${itemDef(l.defId).name} ${l.lost}개`)
                      .join(' · ')}
                  </b>
                  가 전부 사라집니다
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="tabular text-[11px] text-parch-400">
                    성공 <b className={chance > 0.6 ? 'text-[#8fcf8a]' : 'text-brass-300'}>{percent(chance)}</b>
                    {fine > 0 && <span className="text-brass-300"> · 우수 {percent(fine)}</span>}
                  </span>
                  {!canTemper(id) && (
                    <div className="flex gap-1">
                      <button type="button" disabled={!forge || !enough}
                        onClick={() => { craft(world, id, false); refresh(); }}
                        className="btn rounded-sm px-2 py-0.5 text-[11px]">
                        한 번
                      </button>
                      <button type="button" disabled={!forge || !enough}
                        onClick={() => { craft(world, id, true); refresh(); }}
                        className="btn btn-brass rounded-sm px-2 py-0.5 text-[11px]">
                        반복
                      </button>
                    </div>
                  )}
                </div>

                {/*
                  ★ 셋을 나란히 놓고, 얻는 것과 버리는 것을 함께 적습니다.
                    무엇을 버리는지 모르고 고르는 것은 선택이 아니라 제비뽑기입니다.
                  ★ 고르면 그 물건은 영영 그것입니다 — 수리해도 안 바뀝니다.
                */}
                {canTemper(id) && (
                  <div className="mt-1.5 space-y-1">
                    <div className="eyebrow text-[10px] text-parch-400/80">
                      어떻게 벼릴까 — 고르면 이 물건은 영영 그것입니다
                    </div>
                    {TEMPER_ORDER.map((tid) => {
                      const t = temperDef(tid);
                      return (
                        <button key={tid} type="button" disabled={!forge || !enough}
                          onClick={() => { craft(world, id, false, tid); refresh(); }}
                          className="btn flex w-full items-baseline justify-between rounded-sm px-2 py-1 text-left text-[11px]">
                          <span className="font-bold text-parch-100">{t.name}</span>
                          <span className="text-[10px]">
                            <span className="text-[#8fcf8a]">{t.gives}</span>
                            <span className="text-parch-400"> · </span>
                            <span className="text-[#e88a86]">{t.givesUp}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <ForsakenList world={world} />

      {damaged.length > 0 && (
        <section>
          <h3 className="eyebrow mb-1.5">고치기</h3>
          <p className="mb-1.5 text-[11px] text-parch-400">
            고칠 때마다 <b className="text-[#e88a86]">최대 내구도가 줄어듭니다.</b> 언젠가는 새로 만들어야 합니다.
          </p>
          <div className="space-y-1">
            {damaged.map((s) => {
              const quote = repairQuote(s);
              return (
                <div key={s.uid} className="flex items-center gap-2 rounded-sm border border-ink-600 bg-ink-700/60 px-2 py-1">
                  <span className="flex-1 truncate text-xs text-parch-100">{itemName(s)}</span>
                  <span className="tabular shrink-0 text-[10px] text-parch-400">
                    {quote.problem ?? `${itemDef(quote.ingotId).name} ${quote.ingots} → 최대 ${quote.newMax}`}
                  </span>
                  <button type="button" disabled={!forge || !!quote.problem}
                    onClick={() => { repair(world, s.uid); refresh(); }}
                    className="btn shrink-0 rounded-sm px-2 py-0.5 text-[11px] text-brass-300">
                    수리
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ===========================================================================
 *  상점
 * ======================================================================== */

/**
 *  파는 줄 하나.
 *
 *  ★ 개수를 고를 수 있어야 합니다. 마을 성장이 "판 누계" 로 걸려 있어서
 *    **얼마를 팔지가 이 게임의 갈림**인데, 1개 아니면 전부뿐이면 그 갈림을
 *    실행할 수단이 없습니다 — 47개 중 20개를 팔려고 스무 번 누를 수는 없습니다.
 *
 *  ★ 값을 팔기 전에 보여줍니다. 예전에는 def.sell(기본값)을 찍어서
 *    닳은 무기는 최대 70% 싸게, 우수품은 40% 비싸게 팔렸는데 화면은 몰랐습니다.
 *    단가는 core 의 sellUnitPrice 가 냅니다 — 규칙을 여기서 다시 만들지 않습니다.
 *
 *  ★ 이만큼 팔면 마을이 몇까지 가는지도 보여줍니다. 그것이 보여야
 *    "팔아서 세계를 키울까, 써서 나를 키울까" 가 실제 판단이 됩니다.
 */
function SellRow({ world, stack, refresh }: { world: World; stack: ItemStack; refresh: () => void }) {
  const def = itemDef(stack.defId);
  const [count, setCount] = useState(1);
  const n = Math.max(1, Math.min(count, stack.count));
  const unit = sellUnitPrice(stack);

  //  이 물건이 다음 단계의 조건에 걸려 있나 (걸려 있을 때만 진행을 보여줍니다)
  const row = progressOf(world.me.town).find((r) => r.defId === stack.defId);
  const after = row ? Math.min(row.need, row.have + n) : 0;

  const step = (by: number) => setCount(() => Math.max(1, Math.min(stack.count, n + by)));

  return (
    <div className="rounded-sm border border-ink-600 bg-ink-700/60 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex-1 truncate text-xs text-parch-100">
          {KIND_ICON[def.kind]} {itemName(stack)}
          {stack.count > 1 && <span className="text-parch-400"> ×{stack.count}</span>}
        </span>
        <span className="tabular shrink-0 text-[11px] text-parch-400">한 개 {fmt(unit)}골드</span>
      </div>

      {stack.count > 1 && (
        <div className="mt-1 flex items-center gap-1">
          <button type="button" onClick={() => step(-10)} className="btn h-8 w-9 rounded-sm text-[11px]">−10</button>
          <button type="button" onClick={() => step(-1)} className="btn h-8 w-8 rounded-sm text-[13px]">−</button>
          <span className="tabular min-w-10 text-center text-sm font-bold text-parch-100">{n}</span>
          <button type="button" onClick={() => step(1)} className="btn h-8 w-8 rounded-sm text-[13px]">+</button>
          <button type="button" onClick={() => step(10)} className="btn h-8 w-9 rounded-sm text-[11px]">+10</button>
          <button
            type="button"
            onClick={() => setCount(Math.floor(stack.count / 2))}
            className="btn h-8 shrink-0 rounded-sm px-2 text-[11px] text-parch-300"
          >
            절반
          </button>
          <button
            type="button"
            onClick={() => setCount(stack.count)}
            className="btn h-8 shrink-0 rounded-sm px-2 text-[11px] text-parch-300"
          >
            전부
          </button>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[11px] leading-snug text-parch-400">
          {row ? (
            <>
              두린에게 <b className="tabular text-parch-200">{row.have}</b>
              <span className="text-parch-400/70"> → </span>
              <b className={`tabular ${after >= row.need ? 'text-[#8fcf8a]' : 'text-brass-300'}`}>{after}</b>
              <span className="text-parch-400"> / {row.need}</span>
              {after >= row.need && <b className="text-[#8fcf8a]"> 조건이 찹니다</b>}
            </>
          ) : (
            <span className="text-parch-400/70">지금 단계와는 상관없는 물건입니다</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => { sellItem(world, stack.uid, n); setCount(1); refresh(); }}
          className="btn btn-brass h-9 shrink-0 rounded-sm px-3 text-[12px] font-bold"
        >
          {n}개 팔기 · {fmt(unit * n)}골드
        </button>
      </div>
    </div>
  );
}

function ShopPanel({ world, refresh }: { world: World; refresh: () => void }) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const me = world.me;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['buy', 'sell'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`btn rounded-sm px-3 py-1 text-xs ${tab === t ? 'btn-brass' : ''}`}>
              {t === 'buy' ? '사기' : '팔기'}
            </button>
          ))}
        </div>
        <span className="tabular text-xs font-bold text-brass-300">{fmt(me.gold)} 골드</span>
      </div>

      {tab === 'buy' ? (
        <>
          <p className="text-[11px] text-parch-400">
            상인은 연장과 물약만 팝니다. <b className="text-parch-200">좋은 무기와 갑옷은 직접 만들어야 합니다.</b>
          </p>
          <div className="space-y-1">
            {openStock(me.town).map((defId) => {
              const def = ITEMS[defId]!;
              const owned = countOf(me, defId);
              return (
                <div key={defId} className="rounded-sm border border-ink-600 bg-ink-700/60 p-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-parch-100">{KIND_ICON[def.kind]} {def.name}</span>
                    <span className={`tabular text-xs ${me.gold < def.price ? 'text-parch-400/60' : 'text-brass-300'}`}>
                      {fmt(def.price)} 골드
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-parch-400">{def.desc}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {owned > 0 && <span className="tabular text-[10px] text-parch-400">보유 {owned}</span>}
                      {/* 살 때도 개수를 고릅니다. 다만 파는 쪽만큼 갈림이 아니라 미리 정해둔 몇 개로 둡니다 */}
                      {(def.stackable ? [1, 5, 10] : [1]).map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={me.gold < def.price * n}
                          onClick={() => { buyItem(world, defId, n); refresh(); }}
                          className="btn rounded-sm px-2 py-0.5 text-[11px]"
                          title={`${fmt(def.price * n)} 골드`}
                        >
                          {n}개
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-1">
          {me.backpack.filter((s) => itemDef(s.defId).sell > 0).map((s) => {
            return <SellRow key={s.uid} world={world} stack={s} refresh={refresh} />;
          })}
          {me.backpack.filter((s) => itemDef(s.defId).sell > 0).length === 0 && (
            <p className="text-[11px] text-parch-400">팔 것이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
