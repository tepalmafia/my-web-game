/**
 *  밸런스 확인용 봇 (게임에는 들어가지 않습니다. tsconfig 의 검사 대상에서도 빠져 있습니다)
 *
 *  자동 사냥만 켠 채 몇 시간 치를 빠르게 돌려보고
 *  "레벨이 언제 오르는가 · 몇 번 죽는가 · 골드가 도는가"를 숫자로 확인합니다.
 *
 *      npx esbuild tools/sim.ts --bundle --format=esm --platform=node --outfile=/tmp/sim.mjs
 *      node /tmp/sim.mjs knight 3
 */

import { MAP_LEVEL, MAP_ORDER, mapDef } from '../src/rpg/content/maps';
import { ITEMS, itemDef } from '../src/rpg/content/items';
import { buyItem, countOf, equip } from '../src/rpg/core/inventory';
import { createWorld } from '../src/rpg/core/create';
import { step } from '../src/rpg/core/engine';
import { respawnInTown } from '../src/rpg/core/commands';
import { enterMap } from '../src/rpg/core/world';
import { derive, equipProblem, itemName } from '../src/rpg/core/stats';
import type { ClassId, EquipSlot, MapId, World } from '../src/rpg/types';

declare const process: { argv: string[] };

const DT = 1 / 20;
const CLASS = (process.argv[2] ?? 'knight') as ClassId;
const HOURS = Number(process.argv[3] ?? 3);
const MODE = process.argv[4] ?? '';

/** 지금 레벨에서 가야 할 사냥터 */
function bestZone(level: number): MapId {
  let chosen: MapId = 'field';
  for (const id of MAP_ORDER) {
    if (id === 'town') continue;
    if (level >= MAP_LEVEL[id]!) chosen = id;
  }
  return chosen;
}

/** 상점에서 살 수 있는 것 중 지금 낄 수 있는 가장 좋은 장비로 갈아입습니다 */
function upgradeGear(world: World): void {
  const player = world.player;

  for (const slot of ['weapon', 'armor', 'helmet', 'ring'] as EquipSlot[]) {
    const candidates = Object.values(ITEMS)
      .filter((def) => def.slot === slot && def.price > 0 && !equipProblem(player, def))
      .sort((a, b) => b.price - a.price);

    for (const def of candidates) {
      const worn = player.equipped[slot];
      const wornDef = worn ? itemDef(worn.defId) : null;
      if (wornDef && wornDef.price >= def.price) break;
      // 물약값은 남겨둡니다
      if (player.gold < def.price + 15000) break;
      buyItem(world, def.id, 1);
      const bought = player.inventory.find((s) => s.defId === def.id);
      if (bought) equip(world, bought.uid);
      break;
    }
  }
}

/** 재료를 팔고 물약을 채웁니다 */
function shop(world: World): void {
  const player = world.player;

  for (const stack of [...player.inventory]) {
    const def = itemDef(stack.defId);
    if (def.kind === 'misc') {
      player.gold += def.sell * stack.count;
      player.inventory = player.inventory.filter((s) => s.uid !== stack.uid);
    }
  }

  upgradeGear(world);

  const potion = player.level >= 22 ? 'pot-hp-l' : player.level >= 10 ? 'pot-hp' : 'pot-hp-s';
  const want = 40 - countOf(player, potion);
  if (want > 0) {
    buyItem(world, potion, Math.max(0, Math.min(want, Math.floor((player.gold * 0.6) / itemDef(potion).price))));
  }
  const mana = player.level >= 20 ? 'pot-mp' : 'pot-mp-s';
  const wantMana = 20 - countOf(player, mana);
  if (wantMana > 0 && player.gold > itemDef(mana).price * wantMana * 3) buyItem(world, mana, wantMana);
}

function goTo(world: World, id: MapId): void {
  const def = mapDef(id);
  enterMap(world, id, def.entryTx, def.entryTy);
  world.player.auto = true;
}

/**
 * 고룡 카르나스 전투만 따로 재봅니다.
 * 만렙 근처에 전설 장비 +7 을 갖춘 사람이 몇 분 만에 잡는지 / 잡히긴 하는지 봅니다.
 */
function bossTest(geared: boolean): void {
  const world = createWorld('용잡이', CLASS);
  world.seed = 777;
  const player = world.player;
  player.level = geared ? 34 : 31;

  const legend: Record<ClassId, string> = {
    knight: 'sword-fang', elf: 'bow-dragon', wizard: 'staff-carnas',
  };
  const rare: Record<ClassId, string> = {
    knight: 'sword-claymore', elf: 'bow-silver', wizard: 'staff-arch',
  };
  const kit = geared
    ? [legend[CLASS], 'armor-dragon', 'helm-mithril', 'ring-dragon']
    : [rare[CLASS], 'armor-plate', 'helm-knight', 'ring-power'];
  const plus = geared ? 7 : 3;
  for (const defId of kit) {
    player.inventory.push({ uid: world.nextId++, defId, plus, count: 1 });
    const stack = player.inventory[player.inventory.length - 1]!;
    equip(world, stack.uid);
  }
  buyItemFree(world, 'pot-hp-l', 200);
  buyItemFree(world, 'pot-mp', 100);

  const stats = derive(player);
  player.hp = stats.maxHp;
  player.mp = stats.maxMp;
  player.auto = true;
  player.autoPotionAt = 0.65;

  goTo(world, 'nest');
  // 맵을 다시 들어가면 몬스터가 새로 배치되므로, 그때마다 보스를 다시 찾아야 합니다
  let boss = world.monsters.find((m) => m.defId === 'carnas')!;
  const started = world.time;
  let killed = false;

  while (world.time - started < 900) {
    if (boss.state !== 'dead') player.targetId = boss.id;
    step(world, DT);
    if (boss.state === 'dead') {
      killed = true;
      break;
    }
    if (player.dead) {
      console.log(`  ...${Math.round(world.time - started)}초에 사망 (보스 체력 ${Math.round((boss.hp / boss.maxHp) * 100)}%)`);
      respawnInTown(world);
      goTo(world, 'nest');
      boss = world.monsters.find((m) => m.defId === 'carnas')!;
      player.hp = derive(player).maxHp;
    }
  }

  console.log(`\n=== ${CLASS} · 고룡 카르나스 (Lv.${player.level}, ${geared ? '전설 +7' : '희귀 +3'}) ===`);
  console.log(killed
    ? `처치 성공 — ${Math.round(world.time - started)}초, 사망 ${player.deaths}회`
    : `실패 — 15분 안에 못 잡음 (남은 체력 ${Math.round((boss.hp / boss.maxHp) * 100)}%, 사망 ${player.deaths}회)`);
  console.log(`쓴 물약 ${200 - countOf(player, 'pot-hp-l')}병`);
}

/** 시험용 — 돈 안 내고 물건을 채웁니다 */
function buyItemFree(world: World, defId: string, count: number): void {
  world.player.gold += itemDef(defId).price * count;
  buyItem(world, defId, count);
}

function run(): void {
  const world = createWorld('봇', CLASS);
  world.seed = 12345;
  world.player.auto = true;

  const marks: Record<number, number> = {};
  let lastLevel = 1;
  const limit = HOURS * 3600;
  let sinceCheck = 0;

  while (world.time < limit) {
    step(world, DT);

    if (world.player.level !== lastLevel) {
      lastLevel = world.player.level;
      marks[lastLevel] = world.time;
    }

    if (world.player.dead) {
      respawnInTown(world);
      shop(world);
      goTo(world, bestZone(world.player.level));
      continue;
    }

    sinceCheck += DT;
    if (sinceCheck > 20) {
      sinceCheck = 0;
      const potions = world.player.inventory
        .filter((s) => itemDef(s.defId).healHp)
        .reduce((a, b) => a + b.count, 0);
      const zone = bestZone(world.player.level);

      if (potions < 5 || world.mapId !== zone) {
        const town = mapDef('town');
        enterMap(world, 'town', town.entryTx, town.entryTy);
        shop(world);
        goTo(world, zone);
      }
    }
  }

  const stats = derive(world.player);
  const gear = (['weapon', 'armor', 'helmet', 'ring'] as EquipSlot[])
    .map((slot) => {
      const worn = world.player.equipped[slot];
      return worn ? itemName(worn) : '없음';
    })
    .join(' / ');

  console.log(`\n=== ${CLASS} · ${HOURS}시간 자동 사냥 ===`);
  console.log(`레벨 ${world.player.level}  ·  사망 ${world.player.deaths}회  ·  골드 ${Math.floor(world.player.gold).toLocaleString()}`);
  console.log(`장비: ${gear}`);
  console.log(`체력 ${Math.round(stats.maxHp)}  공격 ${Math.round(stats.minDamage)}~${Math.round(stats.maxDamage)}  AC ${stats.ac}`);
  console.log(`퀘스트 ${world.player.questIndex}/16  ·  마지막 사냥터 ${world.map.def.name}`);
  console.log('레벨 도달(분):');
  for (const level of Object.keys(marks).map(Number).sort((a, b) => a - b)) {
    if (level % 5 === 0 || level < 4) console.log(`  Lv.${level}  ${(marks[level]! / 60).toFixed(1)}분`);
  }
  const kills = Object.entries(world.player.kills).sort((a, b) => b[1] - a[1]);
  console.log('처치:', kills.map(([id, n]) => `${id} ${n}`).join(', '));
}

if (MODE === 'boss') bossTest(true);
else if (MODE === 'boss-early') bossTest(false);
else run();
