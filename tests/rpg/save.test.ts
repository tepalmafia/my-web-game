/**
 *  저장과 불러오기.
 *
 *  기록이 브라우저에만 남기 때문에, 여기가 깨지면 몇 시간이 그대로 사라집니다.
 *  node 에는 localStorage 가 없어서 같은 모양의 가짜를 하나 만들어 씁니다.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createWorld } from '../../src/rpg/core/create';
import { addItem } from '../../src/rpg/core/inventory';
import { die } from '../../src/rpg/core/progression';
import { clearSave, hasSave, loadWorld, saveWorld } from '../../src/rpg/core/save';
import { enterMap } from '../../src/rpg/core/world';

const KEY = 'aden-shadow-save-v1';

/** 브라우저의 localStorage 를 흉내 낸 것 */
function fakeStorage() {
  const box = new Map<string, string>();
  return {
    getItem: (key: string) => box.get(key) ?? null,
    setItem: (key: string, value: string) => void box.set(key, value),
    removeItem: (key: string) => void box.delete(key),
    clear: () => box.clear(),
    key: (index: number) => Array.from(box.keys())[index] ?? null,
    get length() {
      return box.size;
    },
  };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: unknown }).localStorage = fakeStorage();
});

describe('저장한 뒤 불러오기', () => {
  it('인물과 가진 것이 그대로 돌아온다', () => {
    const world = createWorld('되살림', 'elf');
    world.player.level = 17;
    world.player.exp = 1234;
    world.player.gold = 54_321;
    world.player.questIndex = 5;
    world.player.questKills = 3;
    world.player.deaths = 2;
    world.player.equipped.weapon!.plus = 6;
    addItem(world, 'scroll-blessed', 2);
    enterMap(world, 'canyon', 4, 19);

    saveWorld(world);
    expect(hasSave()).toBe(true);

    const loaded = loadWorld()!;
    expect(loaded).not.toBeNull();
    expect(loaded.player.name).toBe('되살림');
    expect(loaded.player.classId).toBe('elf');
    expect(loaded.player.level).toBe(17);
    expect(loaded.player.exp).toBe(1234);
    expect(loaded.player.gold).toBe(54_321);
    expect(loaded.player.questIndex).toBe(5);
    expect(loaded.player.questKills).toBe(3);
    expect(loaded.player.deaths).toBe(2);
    expect(loaded.player.equipped.weapon!.plus).toBe(6);
    expect(loaded.player.inventory.find((s) => s.defId === 'scroll-blessed')!.count).toBe(2);
  });

  it('있던 지역에서 다시 시작하고, 몬스터는 새로 배치된다', () => {
    const world = createWorld('시험', 'knight');
    enterMap(world, 'mine', 4, 20);
    saveWorld(world);

    const loaded = loadWorld()!;
    expect(loaded.mapId).toBe('mine');
    expect(loaded.monsters.length).toBeGreaterThan(0);
    expect(loaded.map.def.id).toBe('mine');
  });

  it('죽은 채로 껐다면 마을에서 깨어난다', () => {
    const world = createWorld('시험', 'knight');
    enterMap(world, 'nest', 4, 19);
    die(world);
    saveWorld(world);

    const loaded = loadWorld()!;
    expect(loaded.mapId).toBe('town');
    expect(loaded.player.dead).toBe(true); // 부활 단추는 그대로 눌러야 합니다
  });

  it('보스 부활 시계가 이어진다', () => {
    const world = createWorld('시험', 'knight');
    world.time = 500;
    world.bossRespawnAt = { carnas: 620 };
    saveWorld(world);

    const loaded = loadWorld()!;
    expect(loaded.time).toBe(500);
    expect(loaded.bossRespawnAt.carnas).toBe(620);
  });

  it('불러온 판은 멈춰 있는 상태로 시작한다 (켜자마자 달려가면 안 됩니다)', () => {
    const world = createWorld('시험', 'knight');
    world.player.auto = true;
    world.player.targetId = 12;
    world.player.moveTarget = { x: 10, y: 10 };
    world.player.buffs.push({ id: 'k2', name: '광폭화', until: 9999, color: '#fff', effects: {} });
    saveWorld(world);

    const loaded = loadWorld()!;
    expect(loaded.player.auto).toBe(false);
    expect(loaded.player.targetId).toBeNull();
    expect(loaded.player.moveTarget).toBeNull();
    expect(loaded.player.buffs).toHaveLength(0);
  });
});

describe('없거나 망가진 기록', () => {
  it('기록이 없으면 null', () => {
    expect(hasSave()).toBe(false);
    expect(loadWorld()).toBeNull();
  });

  it('내용이 깨져 있으면 게임을 멈추지 않고 null 을 돌려준다', () => {
    localStorage.setItem(KEY, '{이건 JSON 이 아닙니다');
    expect(loadWorld()).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ version: 99 }));
    expect(loadWorld()).toBeNull();
  });

  it('지우면 사라진다', () => {
    saveWorld(createWorld('시험', 'knight'));
    expect(hasSave()).toBe(true);

    clearSave();
    expect(hasSave()).toBe(false);
  });

  it('저장할 곳이 막혀 있어도 게임이 멈추지 않는다', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('저장 공간 없음');
      },
      removeItem: () => {},
    };
    expect(() => saveWorld(createWorld('시험', 'knight'))).not.toThrow();
    expect(hasSave()).toBe(false);
  });
});
