/**
 *  새 인물 만들기.
 *
 *  시작 장비는 직업에 맞는 1레벨 무기 한 자루와 천 갑옷,
 *  그리고 물약 열 병 · 귀환 주문서 두 장입니다.
 *  많이 주지 않는 이유는, 첫 30분이 이 게임에서 제일 위험하기 때문입니다.
 */

import { AUTO } from '../balance';
import { CLASSES } from '../content/classes';
import { QUESTS } from '../content/quests';
import { mapDef } from '../content/maps';
import { addItem } from './inventory';
import { log } from './feedback';
import { derive } from './stats';
import { buildMap, populate, tileCenter } from './world';
import type { ClassId, ItemStack, Player, World } from '../types';

const STARTING_WEAPON: Record<ClassId, string> = {
  knight: 'sword-dagger',
  elf: 'bow-short',
  wizard: 'staff-wood',
};

export function createWorld(name: string, classId: ClassId): World {
  const town = mapDef('town');

  const player: Player = {
    name: name.trim() || '이름 없는 모험가',
    classId,
    level: 1,
    exp: 0,
    hp: 1,
    mp: 1,
    gold: 600,
    pos: { x: tileCenter(town.entryTx), y: tileCenter(town.entryTy) },
    facing: -Math.PI / 2,
    moveTarget: null,
    targetId: null,
    attackCooldown: 0,
    skillCooldowns: {},
    buffs: [],
    equipped: { weapon: null, armor: null, helmet: null, ring: null },
    inventory: [],
    dead: false,
    deadFor: 0,
    lostExp: 0,
    auto: false,
    autoPotionAt: AUTO.defaultPotionAt,
    potionCooldown: 0,
    kills: {},
    questIndex: 0,
    questKills: 0,
    discovered: ['town'],
    playSeconds: 0,
    deaths: 0,
    bossKills: 0,
  };

  const world: World = {
    player,
    mapId: 'town',
    map: buildMap(town),
    monsters: [],
    ground: [],
    floaters: [],
    vfx: [],
    log: [],
    time: 0,
    nextId: 1,
    camera: { x: player.pos.x, y: player.pos.y },
    path: [],
    pathTimer: 0,
    shake: 0,
    playerAnim: 0,
    playerMoving: false,
    playerSwing: 0,
    bossRespawnAt: {},
    panel: null,
    pendingNpc: null,
    toast: null,
    enhanceUid: null,
    enhanceResult: null,
    seed: (Date.now() ^ 0x9e3779b9) | 0,
  };

  // 시작 장비
  world.player.equipped.weapon = makeStack(world, STARTING_WEAPON[classId]);
  world.player.equipped.armor = makeStack(world, 'armor-cloth');
  addItem(world, 'pot-hp-s', 10);
  addItem(world, 'scroll-return', 2);

  const stats = derive(player);
  player.hp = stats.maxHp;
  player.mp = stats.maxMp;

  populate(world);

  log(world, `${CLASSES[classId].name} ${player.name}, 실버우드 마을에 도착했습니다`, 'good');
  log(world, `첫 의뢰 — ${QUESTS[0]!.name}: ${QUESTS[0]!.desc}`, 'normal');
  log(world, '마을 남쪽 문으로 나가면 초원입니다. 땅을 눌러 걷고, 몬스터를 눌러 싸웁니다.', 'normal');

  return world;
}

function makeStack(world: World, defId: string): ItemStack {
  return { uid: world.nextId++, defId, plus: 0, count: 1 };
}
