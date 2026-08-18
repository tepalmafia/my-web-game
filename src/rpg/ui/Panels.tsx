/**
 *  오른쪽 창들 — 가방 · 인물 · 의뢰 · 상점 · 대장간 · 이동.
 *
 *  전부 world 를 직접 읽고, 무언가를 바꿀 때는 core/ 의 함수를 부릅니다.
 *  여기에는 규칙이 없습니다.
 */

import { useState } from 'react';
import { ENHANCE_CHANCE, MAX_LEVEL, MAX_PLUS, expToNextLevel } from '../balance';
import { CLASSES } from '../content/classes';
import { GRADE_COLOR, GRADE_LABEL, SHOP_STOCK, itemDef } from '../content/items';
import { MAP_ORDER, mapDef } from '../content/maps';
import { monsterDef } from '../content/monsters';
import { QUESTS } from '../content/quests';
import { skillsOf } from '../content/skills';
import { SLOT_LABEL, teleportCost, teleportTo, useItem } from '../core/commands';
import { enhance, enhanceChance, findEnhanceable } from '../core/enhance';
import { buyItem, countOf, equip, sellItem, unequip } from '../core/inventory';
import { derive, itemName, itemSummary } from '../core/stats';
import type { EquipSlot, ItemDef, ItemStack, PanelId, World } from '../types';
import { duration, fmt, percent } from './format';

/**
 * 아이템 종류를 한 글자로. 이모지를 쓰면 기기마다 글꼴이 없어
 * 엉뚱한 기호로 보이는 경우가 있어서 한글로 갑니다.
 */
const KIND_ICON: Record<string, string> = {
  weapon: '검', armor: '갑', helmet: '투', ring: '반',
  potion: '물', scroll: '주', misc: '재',
};

/* ===========================================================================
 *  창 껍데기
 * ======================================================================== */

export function SidePanel({ world, refresh }: { world: World; refresh: () => void }) {
  const inTown = world.map.def.safe;
  const tabs: { id: PanelId; label: string }[] = [
    { id: 'inventory', label: '가방' },
    { id: 'character', label: '인물' },
    { id: 'quest', label: '의뢰' },
  ];
  if (inTown) {
    tabs.push({ id: 'shop', label: '상점' }, { id: 'enhance', label: '대장간' }, { id: 'teleport', label: '이동' });
  }

  const active: PanelId = world.panel && tabs.some((t) => t.id === world.panel) ? world.panel : 'inventory';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-1 border-b border-slate-800 bg-slate-950 p-1.5">
        {tabs.map((tab) => (
          <button key={tab.id} type="button"
            onClick={() => { world.panel = tab.id; refresh(); }}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-bold transition ${
              active === tab.id ? 'bg-amber-600/20 text-amber-200 ring-1 ring-amber-600/50' : 'text-slate-400 hover:bg-slate-900'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {active === 'inventory' && <InventoryPanel world={world} refresh={refresh} />}
        {active === 'character' && <CharacterPanel world={world} />}
        {active === 'quest' && <QuestPanel world={world} />}
        {active === 'shop' && <ShopPanel world={world} refresh={refresh} />}
        {active === 'enhance' && <EnhancePanel world={world} refresh={refresh} />}
        {active === 'teleport' && <TeleportPanel world={world} refresh={refresh} />}
      </div>
    </div>
  );
}

/* ===========================================================================
 *  가방
 * ======================================================================== */

function ItemTile({
  stack, def, selected, onClick,
}: {
  stack: ItemStack; def: ItemDef; selected: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`relative flex aspect-square flex-col items-center justify-center rounded border text-base font-bold transition ${
        selected ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'
      }`}
      style={{ boxShadow: def.grade !== 'common' ? `inset 0 0 0 1px ${GRADE_COLOR[def.grade]}55` : undefined }}
      title={def.name}>
      <span style={{ color: GRADE_COLOR[def.grade] }}>{KIND_ICON[def.kind]}</span>
      {stack.plus > 0 && (
        <span className="absolute left-0.5 top-0 text-[10px] font-black text-amber-300">+{stack.plus}</span>
      )}
      {stack.count > 1 && (
        <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-slate-200">{stack.count}</span>
      )}
    </button>
  );
}

function InventoryPanel({ world, refresh }: { world: World; refresh: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const player = world.player;
  const stack = player.inventory.find((s) => s.uid === selected) ?? null;
  const def = stack ? itemDef(stack.defId) : null;

  return (
    <div className="space-y-3">
      <section>
        <h3 className="mb-1.5 text-xs font-bold text-slate-400">착용 중</h3>
        <div className="space-y-1">
          {(['weapon', 'armor', 'helmet', 'ring'] as EquipSlot[]).map((slot) => {
            const worn = player.equipped[slot];
            return (
              <div key={slot} className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/60 px-2 py-1">
                <span className="w-8 shrink-0 text-[11px] text-slate-500">{SLOT_LABEL[slot]}</span>
                {worn ? (
                  <>
                    <span className="flex-1 truncate text-xs font-semibold"
                      style={{ color: GRADE_COLOR[itemDef(worn.defId).grade] }}>
                      {itemName(worn)}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{itemSummary(worn)}</span>
                    <button type="button" onClick={() => { unequip(world, slot); refresh(); }}
                      className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700">
                      해제
                    </button>
                  </>
                ) : (
                  <span className="flex-1 text-xs text-slate-600">비어 있음</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 flex items-baseline justify-between text-xs font-bold text-slate-400">
          <span>가방 ({player.inventory.length}/40)</span>
          <span className="text-amber-300">{fmt(player.gold)} 골드</span>
        </h3>
        <div className="grid grid-cols-6 gap-1">
          {player.inventory.map((s) => (
            <ItemTile key={s.uid} stack={s} def={itemDef(s.defId)}
              selected={s.uid === selected} onClick={() => setSelected(s.uid)} />
          ))}
          {player.inventory.length === 0 && (
            <p className="col-span-6 py-4 text-center text-xs text-slate-600">가방이 비었습니다</p>
          )}
        </div>
      </section>

      {stack && def && (
        <section className="rounded border border-slate-700 bg-slate-900/80 p-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold" style={{ color: GRADE_COLOR[def.grade] }}>{itemName(stack)}</span>
            <span className="text-[10px] text-slate-500">{GRADE_LABEL[def.grade]}</span>
          </div>
          {itemSummary(stack) && <div className="mt-0.5 text-xs text-emerald-300">{itemSummary(stack)}</div>}
          <p className="mt-1 text-[11px] leading-snug text-slate-400">{def.desc}</p>
          {def.reqLevel && def.reqLevel > 1 && (
            <p className="mt-0.5 text-[11px] text-slate-500">필요 레벨 {def.reqLevel}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {def.slot && (
              <button type="button" onClick={() => { equip(world, stack.uid); setSelected(null); refresh(); }}
                className="rounded bg-amber-600 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-500">
                착용
              </button>
            )}
            {(def.kind === 'potion' || def.scroll) && (
              <button type="button" onClick={() => { useItem(world, stack.uid); refresh(); }}
                className="rounded bg-sky-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-sky-600">
                사용
              </button>
            )}
            {def.enhanceable && world.map.def.safe && (
              <button type="button"
                onClick={() => { world.enhanceUid = stack.uid; world.panel = 'enhance'; refresh(); }}
                className="rounded bg-orange-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-orange-600">
                강화하기
              </button>
            )}
            {world.map.def.safe && def.sell > 0 && (
              <button type="button" onClick={() => { sellItem(world, stack.uid, 1); setSelected(null); refresh(); }}
                className="rounded bg-slate-700 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-slate-600">
                판매 {fmt(def.sell * (1 + stack.plus * 0.4))}골드
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ===========================================================================
 *  인물
 * ======================================================================== */

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-800/70 py-1 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${tone ?? 'text-slate-200'}`}>{value}</span>
    </div>
  );
}

function CharacterPanel({ world }: { world: World }) {
  const player = world.player;
  const stats = derive(player);
  const cls = CLASSES[player.classId];
  const kills = Object.values(player.kills).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
        <div className="text-lg font-black" style={{ color: cls.color }}>{player.name}</div>
        <div className="text-xs text-slate-400">{cls.name} · 레벨 {player.level}</div>
      </div>

      <section>
        <h3 className="mb-1 text-xs font-bold text-slate-400">능력치</h3>
        <Row label="체력" value={`${fmt(player.hp)} / ${fmt(stats.maxHp)}`} tone="text-rose-300" />
        <Row label="마나" value={`${fmt(player.mp)} / ${fmt(stats.maxMp)}`} tone="text-sky-300" />
        <Row label="공격력" value={`${fmt(stats.minDamage)} ~ ${fmt(stats.maxDamage)}`} />
        <Row label="AC (방어)" value={`${stats.ac}`} tone="text-emerald-300" />
        <Row label="받는 피해 감소" value={percent(Math.min(0.72, stats.defense / (stats.defense + 34)))} />
        <Row label="공격 속도" value={`${stats.attackInterval.toFixed(2)}초`} />
        <Row label="치명타" value={percent(stats.crit)} />
        {stats.lifesteal > 0 && <Row label="흡혈" value={percent(stats.lifesteal)} tone="text-rose-300" />}
        <Row label="다음 레벨까지"
          value={player.level >= MAX_LEVEL ? '최고 레벨' : fmt(expToNextLevel(player.level) - player.exp)} />
      </section>

      <section>
        <h3 className="mb-1 text-xs font-bold text-slate-400">스킬</h3>
        <div className="space-y-1">
          {skillsOf(player.classId).map((skill, index) => {
            const locked = player.level < skill.reqLevel;
            return (
              <div key={skill.id}
                className={`rounded border px-2 py-1 ${locked ? 'border-slate-800 bg-slate-900/40' : 'border-slate-700 bg-slate-900/70'}`}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className={locked ? 'text-slate-600' : 'font-bold'} style={locked ? undefined : { color: skill.color }}>
                    {index + 1}. {skill.name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {locked ? `레벨 ${skill.reqLevel} 필요` : `${skill.mpCost} MP · ${skill.cooldown}초`}
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-slate-500">{skill.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-xs font-bold text-slate-400">기록</h3>
        <Row label="사냥한 몬스터" value={`${fmt(kills)} 마리`} />
        <Row label="쓰러진 횟수" value={`${player.deaths} 번`} tone="text-rose-300" />
        <Row label="고룡 처치" value={`${player.bossKills} 번`} tone="text-amber-300" />
        <Row label="놀아본 시간" value={duration(player.playSeconds)} />
      </section>
    </div>
  );
}

/* ===========================================================================
 *  의뢰
 * ======================================================================== */

function QuestPanel({ world }: { world: World }) {
  const player = world.player;

  return (
    <div className="space-y-1.5">
      {QUESTS.map((quest, index) => {
        const done = index < player.questIndex;
        const active = index === player.questIndex;
        const def = monsterDef(quest.monsterId);

        return (
          <div key={quest.id}
            className={`rounded border px-2 py-1.5 ${
              active ? 'border-sky-600 bg-sky-950/40' : done ? 'border-slate-800 bg-slate-900/30' : 'border-slate-800 bg-slate-900/20'
            }`}>
            <div className="flex items-baseline justify-between">
              <span className={`text-xs font-bold ${done ? 'text-slate-600 line-through' : active ? 'text-sky-300' : 'text-slate-500'}`}>
                {quest.name}
              </span>
              {active && (
                <span className="text-[11px] font-semibold text-slate-300">
                  {def.name} {player.questKills}/{quest.count}
                </span>
              )}
              {done && <span className="text-[11px] text-emerald-500">완료</span>}
            </div>
            {active && (
              <>
                <p className="mt-0.5 text-[11px] text-slate-400">{quest.desc}</p>
                <p className="text-[11px] text-slate-500">{quest.hint}</p>
                <p className="mt-1 text-[11px] text-amber-300">
                  보상 · 경험치 {fmt(quest.rewardExp)} · {fmt(quest.rewardGold)} 골드
                  {quest.rewardItems.map((r) => ` · ${itemDef(r.defId).name} ${r.count}개`).join('')}
                </p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===========================================================================
 *  상점
 * ======================================================================== */

function ShopPanel({ world, refresh }: { world: World; refresh: () => void }) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const player = world.player;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['buy', 'sell'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded px-2.5 py-1 text-xs font-bold ${
                tab === t ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}>
              {t === 'buy' ? '구매' : '판매'}
            </button>
          ))}
        </div>
        <span className="text-xs font-bold text-amber-300">{fmt(player.gold)} 골드</span>
      </div>

      {tab === 'buy' ? (
        <div className="space-y-1">
          {SHOP_STOCK.map((defId) => {
            const def = itemDef(defId);
            const owned = countOf(player, defId);
            const cannotAfford = player.gold < def.price;
            return (
              <div key={defId} className="rounded border border-slate-800 bg-slate-900/60 p-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold" style={{ color: GRADE_COLOR[def.grade] }}>
                    {KIND_ICON[def.kind]} {def.name}
                  </span>
                  <span className={`text-xs ${cannotAfford ? 'text-slate-600' : 'text-amber-300'}`}>
                    {fmt(def.price)} 골드
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-slate-500">
                    {def.desc}
                    {def.reqLevel && def.reqLevel > 1 ? ` (Lv.${def.reqLevel})` : ''}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    {owned > 0 && <span className="self-center text-[10px] text-slate-500">보유 {owned}</span>}
                    <button type="button" disabled={cannotAfford}
                      onClick={() => { buyItem(world, defId, 1); refresh(); }}
                      className="rounded bg-slate-700 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-slate-600 disabled:opacity-40">
                      1개
                    </button>
                    {def.stackable && (
                      <button type="button" disabled={player.gold < def.price * 10}
                        onClick={() => { buyItem(world, defId, 10); refresh(); }}
                        className="rounded bg-slate-700 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-slate-600 disabled:opacity-40">
                        10개
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {player.inventory.filter((s) => itemDef(s.defId).sell > 0).map((stack) => {
            const def = itemDef(stack.defId);
            const unit = Math.round(def.sell * (1 + stack.plus * 0.4));
            return (
              <div key={stack.uid} className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/60 px-2 py-1">
                <span className="flex-1 truncate text-xs" style={{ color: GRADE_COLOR[def.grade] }}>
                  {KIND_ICON[def.kind]} {itemName(stack)} {stack.count > 1 && <span className="text-slate-500">×{stack.count}</span>}
                </span>
                <button type="button" onClick={() => { sellItem(world, stack.uid, 1); refresh(); }}
                  className="shrink-0 rounded bg-slate-700 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-slate-600">
                  {fmt(unit)}골드
                </button>
                {stack.count > 1 && (
                  <button type="button" onClick={() => { sellItem(world, stack.uid, stack.count); refresh(); }}
                    className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300 hover:bg-slate-700">
                    전부
                  </button>
                )}
              </div>
            );
          })}
          {player.inventory.length === 0 && <p className="py-4 text-center text-xs text-slate-600">팔 물건이 없습니다</p>}
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
 *  대장간 (강화)
 * ======================================================================== */

function EnhancePanel({ world, refresh }: { world: World; refresh: () => void }) {
  const player = world.player;

  const candidates: { stack: ItemStack; where: string }[] = [];
  for (const slot of ['weapon', 'armor', 'helmet', 'ring'] as EquipSlot[]) {
    const worn = player.equipped[slot];
    if (worn && itemDef(worn.defId).enhanceable) candidates.push({ stack: worn, where: '착용 중' });
  }
  for (const stack of player.inventory) {
    if (itemDef(stack.defId).enhanceable) candidates.push({ stack, where: '가방' });
  }

  const chosen = world.enhanceUid !== null ? findEnhanceable(world, world.enhanceUid) : null;
  const normal = countOf(player, 'scroll-enhance');
  const blessed = countOf(player, 'scroll-blessed');
  const rate = chosen ? enhanceChance(chosen.stack.plus) : 0;
  const maxed = chosen ? chosen.stack.plus >= MAX_PLUS : false;

  return (
    <div className="space-y-3">
      <p className="rounded border border-orange-900/60 bg-orange-950/30 p-2 text-[11px] leading-relaxed text-orange-200">
        +3 까지는 반드시 성공합니다. 그 뒤로는 실패하면 <b>일반 주문서는 장비를 부숩니다.</b>
        <br />축복받은 주문서는 실패해도 +0 으로 돌아갈 뿐, 장비는 남습니다.
      </p>

      <section>
        <h3 className="mb-1 text-xs font-bold text-slate-400">강화할 장비</h3>
        <div className="space-y-1">
          {candidates.map(({ stack, where }) => {
            const def = itemDef(stack.defId);
            const selected = world.enhanceUid === stack.uid;
            return (
              <button key={stack.uid} type="button"
                onClick={() => { world.enhanceUid = stack.uid; refresh(); }}
                className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-left transition ${
                  selected ? 'border-amber-400 bg-amber-500/10' : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                }`}>
                <span className="flex-1 truncate text-xs font-semibold" style={{ color: GRADE_COLOR[def.grade] }}>
                  {KIND_ICON[def.kind]} {itemName(stack)}
                </span>
                <span className="shrink-0 text-[10px] text-slate-500">{where}</span>
              </button>
            );
          })}
          {candidates.length === 0 && <p className="py-3 text-center text-xs text-slate-600">강화할 수 있는 장비가 없습니다</p>}
        </div>
      </section>

      {chosen && (
        <section className="rounded border border-slate-700 bg-slate-900/80 p-2.5">
          <div className="text-center">
            <div className="text-sm font-bold text-amber-200">{itemName(chosen.stack)}</div>
            <div className="mt-0.5 text-[11px] text-emerald-300">{itemSummary(chosen.stack)}</div>
          </div>

          {maxed ? (
            <p className="mt-2 text-center text-xs text-slate-400">이미 +{MAX_PLUS} 입니다.</p>
          ) : (
            <>
              <div className="mt-2 flex items-center justify-center gap-3 text-center">
                <div>
                  <div className="text-[10px] text-slate-500">지금</div>
                  <div className="text-lg font-black text-slate-200">+{chosen.stack.plus}</div>
                </div>
                <div className="text-slate-600">→</div>
                <div>
                  <div className="text-[10px] text-slate-500">다음</div>
                  <div className="text-lg font-black text-amber-300">+{chosen.stack.plus + 1}</div>
                </div>
                <div className="ml-2">
                  <div className="text-[10px] text-slate-500">성공 확률</div>
                  <div className={`text-lg font-black ${rate >= 1 ? 'text-emerald-400' : rate >= 0.4 ? 'text-amber-300' : 'text-rose-400'}`}>
                    {percent(rate)}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                <button type="button" disabled={normal <= 0}
                  onClick={() => { enhance(world, chosen.stack.uid, 'scroll-enhance'); refresh(); }}
                  className="rounded bg-orange-700 px-2 py-1.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-40">
                  마법 주문서 ({normal})
                  <span className="block text-[9px] font-normal text-orange-200">실패 시 파괴</span>
                </button>
                <button type="button" disabled={blessed <= 0}
                  onClick={() => { enhance(world, chosen.stack.uid, 'scroll-blessed'); refresh(); }}
                  className="rounded bg-amber-600 px-2 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-500 disabled:opacity-40">
                  축복받은 주문서 ({blessed})
                  <span className="block text-[9px] font-normal text-amber-900">실패해도 남음</span>
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {world.enhanceResult && (
        <div className={`rounded border p-2 text-center text-xs font-bold ${
          world.enhanceResult.tone === 'epic'
            ? 'border-amber-500 bg-amber-950/40 text-amber-200'
            : world.enhanceResult.tone === 'bad'
              ? 'border-rose-700 bg-rose-950/40 text-rose-300'
              : 'border-slate-700 bg-slate-900 text-slate-300'
        }`}>
          {world.enhanceResult.text}
        </div>
      )}

      <section>
        <h3 className="mb-1 text-xs font-bold text-slate-400">확률표</h3>
        <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
          {ENHANCE_CHANCE.map((c, index) => (
            <div key={index} className="rounded bg-slate-900/70 py-1">
              <div className="text-slate-500">+{index}→{index + 1}</div>
              <div className={c >= 1 ? 'text-emerald-400' : c >= 0.4 ? 'text-amber-300' : 'text-rose-400'}>
                {percent(c)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ===========================================================================
 *  순간이동
 * ======================================================================== */

function TeleportPanel({ world, refresh }: { world: World; refresh: () => void }) {
  const player = world.player;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-slate-500">한 번이라도 걸어서 가본 곳이라면 언제든 보내드립니다.</p>
      {MAP_ORDER.map((id) => {
        const def = mapDef(id);
        const known = player.discovered.includes(id);
        const here = world.mapId === id;
        const cost = teleportCost(world, id);

        return (
          <div key={id} className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
            here ? 'border-slate-600 bg-slate-800/60' : known ? 'border-slate-800 bg-slate-900/60' : 'border-slate-900 bg-slate-950/60'
          }`}>
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-bold ${known ? 'text-slate-200' : 'text-slate-600'}`}>{def.name}</div>
              <div className="truncate text-[10px] text-slate-500">{known ? def.subtitle : '아직 가본 적 없음'}</div>
            </div>
            {here ? (
              <span className="shrink-0 text-[11px] text-slate-400">현재 위치</span>
            ) : (
              <button type="button" disabled={!known || player.gold < cost}
                onClick={() => { teleportTo(world, id); refresh(); }}
                className="shrink-0 rounded bg-violet-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-violet-600 disabled:opacity-40">
                {fmt(cost)} 골드
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
