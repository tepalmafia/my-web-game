/**
 * ===========================================================================
 *  밸런스 확인용 봇 (게임에는 들어가지 않습니다)
 * ===========================================================================
 *
 *  캐고 → 만들고 → 싸우고 → 닳고 → 다시 만드는 한 바퀴를 몇 시간 치 돌려보고,
 *  지시서 §4.3 의 지표를 잽니다.
 *
 *      npx esbuild tools/sim.ts --bundle --format=esm --platform=node --outfile=/tmp/sim.mjs
 *      node /tmp/sim.mjs miner 3
 */

import { ITEMS, itemDef } from '../src/rpg/content/items';
import { MONSTERS } from '../src/rpg/content/monsters';
import { createWorld } from '../src/rpg/core/create';
import { step } from '../src/rpg/core/engine';
import { countOf } from '../src/rpg/core/inventory';
import { derive, wearRatio } from '../src/rpg/core/stats';
import { autopilot, newPilot } from './autopilot';
import type { Focus } from './autopilot';
import type { World } from '../src/rpg/types';

declare const process: { argv: string[] };

const DT = 1 / 20;
const TEMPLATE = process.argv[2] ?? 'miner';
const HOURS = Number(process.argv[3] ?? 3);
/** 네 번째 인자: balanced | mine | fight — 무엇의 곡선을 잴 것인가 */
const FOCUS = (process.argv[4] ?? 'balanced') as Focus;
/** 다섯 번째 인자에 trace 를 주면 목표가 바뀔 때마다 찍습니다 (원인 찾기용) */
const TRACE = process.argv[5] === 'trace';
/** 여섯 번째 인자: 세계 씨앗 (여러 번 돌려 편차를 봅니다) */
const SEED = Number(process.argv[6] ?? 20250819);

interface Marks {
  firstIronSword: number | null;
  mining50: number | null;
  mining100: number | null;
  smithing100: number | null;
  firstFullCycle: number | null;
  swordLives: number[];
}

/** 기록표에는 물건 id 와 몬스터 id 가 섞여 있습니다 */
function nameOfTally(tally: Record<string, number>): string {
  const rows = Object.entries(tally).map(([id, n]) => {
    const monster = MONSTERS[id];
    const item = ITEMS[id];
    return `${monster?.name ?? item?.name ?? id} ${n}`;
  });
  return rows.join(' · ') || '(없음)';
}

function minutes(seconds: number | null): string {
  return seconds === null ? '—' : `${(seconds / 60).toFixed(1)}분`;
}

function run(): void {
  const world: World = createWorld('봇', TEMPLATE);
  world.seed = SEED;
  const pilot = newPilot(FOCUS);

  const marks: Marks = {
    firstIronSword: null,
    mining50: null,
    mining100: null,
    smithing100: null,
    firstFullCycle: null,
    swordLives: [],
  };

  // 검 한 자루의 수명 — 그 검을 들고 잡은 몬스터 수
  const lives = new Map<number, number>();
  /** 마지막으로 본 상태 — 성한 채로 팔린 검은 '수명을 다했다'고 볼 수 없습니다 */
  const seen = new Map<number, { durability: number; max: number; born: number }>();
  let lastKills = 0;

  // 한 바퀴(채집 → 제작 → 전투) 완결 여부
  let minedOnce = false;
  let craftedOnce = false;

  // 시간이 어디로 가는지 — 지표가 나쁠 때 원인을 찾는 유일한 방법입니다
  const spent: Record<string, number> = { gather: 0, haul: 0, work: 0, hunt: 0 };
  const mapTime: Record<string, number> = {};
  let mineSwings = 0;
  let fighting = 0;
  let walking = 0;

  const limit = HOURS * 3600;
  let lastGoal = pilot.goal;
  const transitions: Record<string, number> = {};
  while (world.time < limit) {
    autopilot(world, pilot);
    if (pilot.goal !== lastGoal) {
      const key = `${lastGoal}→${pilot.goal}`;
      transitions[key] = (transitions[key] ?? 0) + 1;
      if (TRACE && world.time < 900) {
        const w = world.me.equipped.weapon;
        console.log(
          `${(world.time / 60).toFixed(1)}분 ${key.padEnd(14)} ${world.mapId.padEnd(6)} ` +
            `짐 ${derive(world.me).load}/${derive(world.me).carry} · 금 ${Math.floor(world.me.gold)} · ` +
            `무기 ${w ? `${itemDef(w.defId).name} ${Math.round((wearRatio(w) ?? 0) * 100)}%` : '맨손'} · ` +
            `광석 ${countOf(world.me, 'iron-ore')} · 주괴 ${countOf(world.me, 'iron-ingot')}`,
        );
      }
      lastGoal = pilot.goal;
    }
    spent[pilot.goal] = (spent[pilot.goal] ?? 0) + DT;
    mapTime[world.mapId] = (mapTime[world.mapId] ?? 0) + DT;
    if (world.me.action?.kind === 'mine') mineSwings += DT;
    if (world.monsters.some((m) => m.id === world.me.targetId && m.state !== 'dead')) fighting += DT;
    else if (world.me.moveTarget) walking += DT;
    step(world, DT);

    const me = world.me;

    // 지표
    if (marks.mining50 === null && me.skills.mining >= 50) marks.mining50 = world.time;
    if (marks.mining100 === null && me.skills.mining >= 100) marks.mining100 = world.time;
    if (marks.smithing100 === null && me.skills.blacksmithing >= 100) marks.smithing100 = world.time;
    if (marks.firstIronSword === null && (me.tally['iron-sword'] ?? 0) > 0) {
      marks.firstIronSword = world.time;
    }

    if (!minedOnce && (me.tally['iron-ore'] ?? 0) > 0) minedOnce = true;
    if (!craftedOnce && ((me.tally['iron-ingot'] ?? 0) > 0 || (me.tally['iron-dagger'] ?? 0) > 0)) {
      craftedOnce = true;
    }
    const kills = ['stray-dog', 'wolf', 'cave-bat', 'cave-spider'].reduce(
      (a, id) => a + (me.tally[id] ?? 0),
      0,
    );
    if (marks.firstFullCycle === null && minedOnce && craftedOnce && kills > 0) {
      marks.firstFullCycle = world.time;
    }

    // 검 수명 — 한 자루가 만들어져서 손을 떠날 때까지 잡은 수
    const weapon = me.equipped.weapon;
    if (weapon && weapon.defId !== 'rusty-sword') {
      if (!lives.has(weapon.uid)) lives.set(weapon.uid, 0);
      lives.set(weapon.uid, lives.get(weapon.uid)! + (kills - lastKills));
      seen.set(weapon.uid, {
        durability: weapon.durability ?? 0,
        max: weapon.maxDurability ?? 0,
        born: itemDef(weapon.defId).durability ?? 0,
      });
    }
    lastKills = kills;

    // 사라진 검은 수명을 마감합니다 (부러졌거나 팔았거나)
    for (const uid of [...lives.keys()]) {
      const alive =
        me.equipped.weapon?.uid === uid || me.backpack.some((s) => s.uid === uid);
      if (alive) continue;
      const life = lives.get(uid)!;
      const last = seen.get(uid);
      lives.delete(uid);
      seen.delete(uid);
      // 부러졌거나 수리로 수명이 반 넘게 깎인 검만 셉니다
      const spent = last && (last.durability <= 0 || last.max <= last.born * 0.6);
      if (life > 0 && spent) marks.swordLives.push(life);
    }
  }

  // 아직 손에 남아 있는 검은 '한창 쓰는 중'이므로 세지 않습니다

  const me = world.me;
  const stats = derive(me);
  const kills = ['stray-dog', 'wolf', 'cave-bat', 'cave-spider'].reduce(
    (a, id) => a + (me.tally[id] ?? 0),
    0,
  );
  const weapon = me.equipped.weapon;

  console.log(`\n=== ${TEMPLATE} · ${HOURS}시간 · ${FOCUS} · 씨앗 ${SEED} ===`);
  console.log(
    `채광 ${me.skills.mining.toFixed(1)} · 대장 ${me.skills.blacksmithing.toFixed(1)} · ` +
      `검술 ${me.skills.swordsmanship.toFixed(1)} · 방어 ${me.skills.defense.toFixed(1)}`,
  );
  console.log(
    `힘 ${me.str.toFixed(1)} · 민첩 ${me.dex.toFixed(1)} · 지능 ${me.int.toFixed(1)} ` +
      `(합 ${(me.str + me.dex + me.int).toFixed(1)})`,
  );
  console.log(`골드 ${Math.floor(me.gold).toLocaleString()} · 사망 ${me.deaths}회 · 처치 ${kills}마리`);
  console.log(
    `장비: ${weapon ? `${itemDef(weapon.defId).name} (내구 ${Math.round((wearRatio(weapon) ?? 0) * 100)}%)` : '맨손'}` +
      ` / ${me.equipped.armor ? itemDef(me.equipped.armor.defId).name : '없음'}`,
  );
  console.log(`체력 ${stats.maxHp} · 공격 ${stats.minDamage.toFixed(0)}~${stats.maxDamage.toFixed(0)} · 짐 ${stats.load}/${stats.carry}`);

  console.log('\n--- §4.3 지표 ---');
  console.log(`첫 철검              ${minutes(marks.firstIronSword)}   (목표 15~25분)`);
  console.log(`채광 50              ${minutes(marks.mining50)}   (목표 약 60분)`);
  console.log(`한 바퀴 완결         ${minutes(marks.firstFullCycle)}   (목표 30분 안에 1회)`);
  console.log(
    `철검 한 자루 수명    ${
      marks.swordLives.length > 0
        ? `${Math.round(marks.swordLives.reduce((a, b) => a + b, 0) / marks.swordLives.length)}마리 ` +
          `(${marks.swordLives.join(', ')})`
        : '—'
    }   (목표 80~120마리)`,
  );
  console.log(`채광 100             ${minutes(marks.mining100)}   (실측만)`);
  console.log(`대장 100             ${minutes(marks.smithing100)}   (실측만)`);

  console.log('\n--- 시간이 어디로 갔나 ---');
  const totalTime = HOURS * 3600;
  console.log(
    Object.entries(spent)
      .map(([goal, sec]) => `${goal} ${((sec / totalTime) * 100).toFixed(0)}%`)
      .join(' · '),
  );
  console.log(
    '지역: ' +
      Object.entries(mapTime)
        .map(([id, sec]) => `${id} ${((sec / totalTime) * 100).toFixed(0)}%`)
        .join(' · '),
  );
  // ★ 길을 못 찾으면 봇은 엉뚱한 데서 일하면서도 숫자는 멀쩡히 냅니다. 그래서 함께 찍습니다.
  if (pilot.stranded.length > 0) {
    const tally: Record<string, number> = {};
    for (const pair of pilot.stranded) tally[pair] = (tally[pair] ?? 0) + 1;
    console.log(
      '★ 길을 못 찾음: ' +
        Object.entries(tally)
          .map(([pair, n]) => `${pair} ${n}회`)
          .join(' · '),
    );
  }
  console.log(
    '목표 전환: ' +
      Object.entries(transitions)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(' · '),
  );
  console.log(
    `곡괭이질 ${((mineSwings / totalTime) * 100).toFixed(1)}% · ` +
      `싸움 ${((fighting / totalTime) * 100).toFixed(1)}% · ` +
      `걷기 ${((walking / totalTime) * 100).toFixed(1)}%`,
  );

  console.log('\n--- 만든 것과 캔 것 ---');
  console.log(nameOfTally(me.tally));
  console.log(`남은 광석 ${countOf(me, 'iron-ore')} · 주괴 ${countOf(me, 'iron-ingot')}`);
}

run();
