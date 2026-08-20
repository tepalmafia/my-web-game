/**
 *  새 사람 만들기.
 *
 *  ★ 직업이 없습니다. 시작 템플릿은 "처음 스킬을 어디에 조금 얹어줄까"만 정하고,
 *    그 뒤로는 무엇을 하든 자유입니다. 대장장이로 시작해 검사가 되어도 됩니다.
 */

import { STATS } from '../balance';
import { mapDef } from '../content/maps';
import { emptyTown, stageOf } from '../content/town';
import { addItem, equip } from './inventory';
import { log } from './feedback';
import { derive } from './stats';
import { buildMap, populate, tileCenter } from './world';
import type { Character, ItemStack, SkillId, World } from '../types';

/** 시작 템플릿 — 스킬 몇 점과 첫 장비만 다릅니다 */
export interface StartTemplate {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  color: string;
  skills: Partial<Record<SkillId, number>>;
  items: string[];
  equip: string[];
}

export const TEMPLATES: StartTemplate[] = [
  {
    id: 'miner',
    name: '광부',
    tagline: '땅부터 판다',
    desc: '곡괭이질을 조금 배웠습니다. 광석을 캐 팔거나, 직접 녹여 첫 검을 만들 수 있습니다.',
    color: '#c9a227',
    skills: { mining: 25, blacksmithing: 8 },
    items: ['pickaxe', 'hammer', 'potion-heal'],
    equip: ['rusty-sword'],
  },
  {
    id: 'smith',
    name: '견습 대장장이',
    tagline: '만드는 손이 먼저다',
    desc: '망치를 잡아봤습니다. 광석만 구해오면 남들보다 좋은 물건을 만듭니다.',
    color: '#e0764a',
    skills: { blacksmithing: 24, mining: 12 },
    items: ['pickaxe', 'hammer', 'potion-heal'],
    equip: ['rusty-sword'],
  },
  {
    id: 'guard',
    name: '떠돌이 경비병',
    tagline: '먼저 싸워봤다',
    desc: '검을 쥐어봤습니다. 사냥은 쉽지만, 검이 닳으면 결국 대장간을 찾게 됩니다.',
    color: '#c3cbd6',
    skills: { swordsmanship: 25, defense: 15, blacksmithing: 5 },
    items: ['pickaxe', 'hammer', 'potion-heal'],
    equip: ['rusty-sword', 'leather-vest'],
  },
];

export function createWorld(name: string, templateId: string): World {
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]!;
  const town = mapDef('town');

  const me: Character = {
    name: name.trim() || '이름 없는 사람',
    str: STATS.start,
    dex: STATS.start,
    int: STATS.start,
    statTouched: { str: 0, dex: 0, int: 0 },
    hp: 1,
    skills: {
      mining: template.skills.mining ?? 0,
      blacksmithing: template.skills.blacksmithing ?? 0,
      swordsmanship: template.skills.swordsmanship ?? 0,
      defense: template.skills.defense ?? 0,
    },
    pos: { x: tileCenter(town.entryTx), y: tileCenter(town.entryTy) },
    facing: -Math.PI / 2,
    moveTarget: null,
    targetId: null,
    action: null,
    attackCooldown: 0,
    potionCooldown: 0,
    equipped: { weapon: null, armor: null, helmet: null },
    backpack: [],
    gold: 150,
    dead: false,
    deadFor: 0,
    discovered: ['town'],
    playSeconds: 0,
    deaths: 0,
    tally: {},
    town: emptyTown(),
  };

  const world: World = {
    me,
    mapId: 'town',
    map: buildMap(town, stageOf(me.town)),
    monsters: [],
    veins: [],
    ground: [],
    stash: {},
    floaters: [],
    vfx: [],
    log: [],
    time: 0,
    nextId: 1,
    camera: { x: me.pos.x, y: me.pos.y },
    shake: 0,
    path: [],
    pathTimer: 0,
    panel: null,
    pendingNpc: null,
    toast: null,
    seed: (Date.now() ^ 0x9e3779b9) | 0,
    meAnim: 0,
    meMoving: false,
    meSwing: 0,
  };

  for (const defId of template.items) addItem(world, defId, defId === 'potion-heal' ? 3 : 1);
  for (const defId of template.equip) {
    addItem(world, defId, 1);
    const stack = world.me.backpack.find((s: ItemStack) => s.defId === defId);
    if (stack) equip(world, stack.uid);
  }

  me.hp = derive(me).maxHp;
  populate(world);

  log(world, `${me.name}, 실버우드 마을에 도착했습니다`, 'good');
  log(world, '남쪽 문으로 나가면 숲입니다. 바위에 비치는 철광맥을 눌러 캐보세요.', 'normal');
  log(world, '레벨은 없습니다. 무엇이든 해본 만큼만 늡니다.', 'normal');

  return world;
}
