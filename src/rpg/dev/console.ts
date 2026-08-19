/**
 * ===========================================================================
 *  시험용 명령 (게임 규칙이 아닙니다)
 * ===========================================================================
 *
 *  검이 닳는 것, 상위 광맥, 제작 확률 같은 것을 판단하려면 몇 시간을 놀아야 합니다.
 *  그래서 밖에서 상태를 밀어넣는 길을 둡니다.
 *
 *  ★ 규칙 안에는 if (테스트) 가 한 줄도 없습니다.
 *    여기 있는 것은 전부 core/ 가 이미 내보내고 있는 함수와, 그냥 필드 대입뿐입니다.
 *    그래서 이 파일을 통째로 지워도 게임은 한 글자도 안 달라집니다.
 *
 *  ★ 일반 플레이에서는 열리지 않습니다 — 주소에 ?dev=1 을 손으로 붙여야 합니다.
 *    그 전까지는 이 파일이 내려받아지지도 않습니다 (동적 import 라 따로 떨어진 덩어리입니다).
 *
 *  ★ 세계의 난수를 건드리지 않습니다. 봇 실측(tools/sim.ts)과 같은 씨앗이면 같은 결과입니다.
 */

import { MAX_SKILL } from '../balance';
import { ITEMS, itemDef } from '../content/items';
import { MAPS, mapDef } from '../content/maps';
import { SKILL_ORDER, SKILLS } from '../content/skills';
import { step } from '../core/engine';
import { addItem } from '../core/inventory';
import { saveWorld } from '../core/save';
import { enterMap } from '../core/world';
import { autopilot, newPilot } from '../../../tools/autopilot';
import type { Focus } from '../../../tools/autopilot';
import type { ItemStack, MapId, SkillId, World } from '../types';

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

export function attach(world: World, refresh: () => void): () => void {
  const done = <T>(value: T): T => {
    saveWorld(world);
    refresh();
    return value;
  };

  const api = {
    /** 스킬 값을 그대로 세웁니다 — aden.skill('mining', 60) */
    skill(id: string, value: number) {
      if (!isSkill(id)) throw new Error(`스킬은 ${SKILL_ORDER.join(' · ')} 중 하나입니다 (받은 것: ${id})`);
      const next = Math.max(0, Math.min(MAX_SKILL, value));
      world.me.skills[id] = next;
      return done(`${SKILLS[id].name} ${next}`);
    },

    /** 물건을 줍니다 — aden.give('iron-ingot', 100) */
    give(defId: string, count = 1) {
      if (!ITEMS[defId]) throw new Error(`그런 물건이 없습니다: ${defId} (aden.help() 로 목록)`);
      // ★ addItem 을 그대로 씁니다. 무게·칸 규칙에 막히면 그 사실을 알려줍니다 —
      //   규칙을 우회하면 여기서 만든 상태가 게임에서 나올 수 없는 상태가 됩니다.
      if (!addItem(world, defId, count)) {
        throw new Error(
          `${itemDef(defId).name} ${count}개를 못 넣었습니다 — 무게나 칸이 모자랍니다. ` +
            `적게 나눠 주거나, 가방을 비우고 다시 해보세요.`,
        );
      }
      return done(`${itemDef(defId).name} ${count}개`);
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
        "aden.give(물건id, 개수)   물건id 목록: aden.items",
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

  const holder = globalThis as unknown as { aden?: typeof api };
  holder.aden = api;
  console.info('[아덴] 시험용 명령이 열렸습니다. aden.help()');

  return () => {
    delete holder.aden;
  };
}
