/**
 *  오른쪽 창 넷 — 스킬 · 가방 · 대장간 · 상점.
 *
 *  전부 world 를 직접 읽고, 무언가를 바꿀 때는 core/ 의 함수를 부릅니다.
 *  여기에는 규칙이 없습니다.
 */

import { useState } from 'react';

import { LOOT, MAX_SKILL, STATS, gainChance } from '../balance';
import { ITEMS, SHOP_STOCK, itemDef } from '../content/items';
import { RECIPE_ORDER, recipeDef } from '../content/recipes';
import { SKILLS, SKILL_ORDER } from '../content/skills';
import { VEINS } from '../content/veins';
import { craftChance, craftFineChance, nearForge } from '../core/action';
import { SLOT_LABEL, craft, repair, useItem } from '../core/commands';
import { repairQuote } from '../core/durability';
import { buyItem, countOf, equip, sellItem, unequip } from '../core/inventory';
import { derive, itemName, itemSummary, wearRatio } from '../core/stats';
import type { EquipSlot, ItemStack, PanelId, World } from '../types';
import { duration, fmt, percent } from './format';

const KIND_ICON: Record<string, string> = {
  weapon: '검', armor: '갑', helmet: '투', tool: '연', resource: '광', potion: '물',
};

/* ===========================================================================
 *  창 껍데기
 * ======================================================================== */

export function SidePanel({ world, refresh }: { world: World; refresh: () => void }) {
  const inTown = world.map.def.safe;
  const tabs: { id: PanelId; label: string }[] = [
    { id: 'skills', label: '실력' },
    { id: 'pack', label: '가방' },
  ];
  if (inTown) tabs.push({ id: 'craft', label: '대장간' }, { id: 'shop', label: '상점' });

  const active: PanelId = world.panel && tabs.some((t) => t.id === world.panel) ? world.panel : 'skills';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-0.5 border-b border-ink-600 bg-ink-900 px-1 pt-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { world.panel = tab.id; refresh(); }}
            className={`display relative flex-1 px-2 py-2 text-[13px] font-bold transition ${
              active === tab.id ? 'text-brass-300' : 'text-parch-400 hover:text-parch-200'
            }`}
          >
            {tab.label}
            {active === tab.id && (
              <span className="absolute inset-x-1 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-brass-400 to-transparent" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
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

function SkillPanel({ world }: { world: World }) {
  const me = world.me;
  const stats = derive(me);
  const total = me.str + me.dex + me.int;

  return (
    <div className="space-y-3">
      <section>
        <h3 className="eyebrow mb-1.5">스킬</h3>
        <div className="space-y-2">
          {SKILL_ORDER.map((id) => {
            const info = SKILLS[id];
            const value = me.skills[id];
            return (
              <div key={id}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold" style={{ color: info.color }}>{info.name}</span>
                  <span className="tabular text-xs font-bold text-parch-100">
                    {value.toFixed(1)}
                    <span className="text-parch-400"> / {MAX_SKILL}</span>
                  </span>
                </div>
                <div className="socket mt-1 h-2 rounded-[2px]">
                  <div className="fill" style={{ width: `${value}%`, background: info.color }} />
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-parch-400">{info.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-1.5">지금 배울 수 있는 것</h3>
        <p className="mb-1.5 text-[11px] text-parch-400">
          지금 실력보다 <b className="text-parch-200">한참 쉬운 일에서는 아무것도 배우지 못합니다.</b>
        </p>
        <div className="space-y-1">
          {Object.values(VEINS).map((vein) => {
            const chance = gainChance(me.skills.mining, vein.difficulty);
            return (
              <div key={vein.id} className="flex items-center justify-between rounded-sm border border-ink-600 bg-ink-700/60 px-2 py-1 text-[11px]">
                <span className="text-parch-200">{vein.name}</span>
                <span className="tabular text-parch-400">난이도 {vein.difficulty}</span>
                <span className={`tabular w-20 text-right font-bold ${chance <= 0 ? 'text-parch-400/60' : chance > 0.2 ? 'text-[#8fcf8a]' : 'text-brass-300'}`}>
                  {chance <= 0 ? '배울 것 없음' : `성장 ${percent(chance)}`}
                </span>
              </div>
            );
          })}
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
          </div>
        </section>
      )}
    </div>
  );
}

/* ===========================================================================
 *  대장간
 * ======================================================================== */

/**
 *  대장장이 두린이 처음 하는 말.
 *
 *  ★ 이 게임은 무엇을 해야 하는지 알려주는 퀘스트가 없습니다. 그래서 적어도
 *    "어디로 가서 무엇을 누르는가" 한 줄은 사람 입으로 나와야 합니다.
 *    쇠가 없으면 캐 오라 하고, 쇠가 있으면 두드리라 합니다.
 */
function durinSays(world: World): string {
  const me = world.me;
  const iron = countOf(me, 'iron-ore') + countOf(me, 'iron-ingot');
  const pickaxe = me.backpack.some((s) => itemDef(s.defId).tool === 'pickaxe' && (s.durability ?? 0) > 0);

  if (!pickaxe) {
    return '곡괭이부터 챙기게. 마르카에게 하나 사서 가방에 넣어 두면 되네 — 손에 들 것도 없어.';
  }
  if (iron <= 0) {
    return '남쪽 문으로 나가면 초록 숲일세. 반짝이는 광맥을 찾아 눌러만 두게 — 걸어가서 알아서 캘 테니. 그걸 여기 화로로 가져오게.';
  }
  return '쇠를 가져왔군. 화로 앞에 서서 녹이고, 주괴가 모이면 두드려 보게. 몇 번은 망칠 걸세 — 그러면서 느는 거야.';
}

function CraftPanel({ world, refresh }: { world: World; refresh: () => void }) {
  const me = world.me;
  const forge = nearForge(world);

  const damaged = [me.equipped.weapon, me.equipped.armor, me.equipped.helmet, ...me.backpack]
    .filter((s): s is ItemStack => !!s && wearRatio(s) !== null && wearRatio(s)! < 1);

  return (
    <div className="space-y-3">
      <p className="rounded-sm border border-ink-600 bg-ink-700/60 p-2 text-[11px] leading-snug text-parch-300">
        <span className="font-bold text-[#e0764a]">대장장이 두린</span>
        <span className="text-parch-400"> — </span>
        {durinSays(world)}
      </p>

      {!forge && (
        <p className="rounded-sm border border-[#5a3a12] bg-[#2a1c0a] p-2 text-[11px] text-[#e8b483]">
          화로 앞에 서야 만들 수 있습니다. 대장장이 두린 옆의 붉은 화로로 가세요.
        </p>
      )}

      <section>
        <h3 className="eyebrow mb-1.5">만들기</h3>
        <div className="space-y-1.5">
          {RECIPE_ORDER.map((id) => {
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
                <div className="mt-1 flex items-center justify-between">
                  <span className="tabular text-[11px] text-parch-400">
                    성공 <b className={chance > 0.6 ? 'text-[#8fcf8a]' : 'text-brass-300'}>{percent(chance)}</b>
                    {fine > 0 && <span className="text-brass-300"> · 우수 {percent(fine)}</span>}
                  </span>
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
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
            {SHOP_STOCK.map((defId) => {
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
                      <button type="button" disabled={me.gold < def.price}
                        onClick={() => { buyItem(world, defId, 1); refresh(); }}
                        className="btn rounded-sm px-2 py-0.5 text-[11px]">1개</button>
                      {def.stackable && (
                        <button type="button" disabled={me.gold < def.price * 5}
                          onClick={() => { buyItem(world, defId, 5); refresh(); }}
                          className="btn rounded-sm px-2 py-0.5 text-[11px]">5개</button>
                      )}
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
            const def = itemDef(s.defId);
            return (
              <div key={s.uid} className="flex items-center gap-2 rounded-sm border border-ink-600 bg-ink-700/60 px-2 py-1">
                <span className="flex-1 truncate text-xs text-parch-100">
                  {KIND_ICON[def.kind]} {itemName(s)} {s.count > 1 && <span className="text-parch-400">×{s.count}</span>}
                </span>
                <button type="button" onClick={() => { sellItem(world, s.uid, 1); refresh(); }}
                  className="btn shrink-0 rounded-sm px-2 py-0.5 text-[11px]">
                  {fmt(def.sell)}골드
                </button>
                {s.count > 1 && (
                  <button type="button" onClick={() => { sellItem(world, s.uid, s.count); refresh(); }}
                    className="btn shrink-0 rounded-sm px-2 py-0.5 text-[11px]">전부</button>
                )}
              </div>
            );
          })}
          {me.backpack.length === 0 && <p className="py-4 text-center text-xs text-parch-400/70">팔 물건이 없습니다</p>}
        </div>
      )}
    </div>
  );
}
