/**
 *  저장 · 불러오기 · 내보내기.
 *
 *  기록이 브라우저에만 남으므로 여기가 깨지면 몇 시간이 사라집니다.
 *  Phase 1 부터 텍스트로 뽑아둘 수 있게 해둡니다 (플레이가 길어지기 때문입니다).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createWorld } from '../../src/rpg/core/create';
import { addItem } from '../../src/rpg/core/inventory';
import { clearSave, exportSave, hasSave, importSave, loadWorld, newSlot, saveWorld } from '../../src/rpg/core/save';
import { enterMap } from '../../src/rpg/core/world';

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
  it('스킬·능력치·가진 것이 그대로 돌아온다', () => {
    const world = createWorld('되살림', 'smith');
    world.me.skills.mining = 42.7;
    world.me.skills.blacksmithing = 61.3;
    world.me.str = 55.5;
    world.me.gold = 12_345;
    addItem(world, 'iron-ingot', 4);
    enterMap(world, 'forest', 5, 18);

    saveWorld(world);
    expect(hasSave()).toBe(true);

    const loaded = loadWorld()!;
    expect(loaded.me.name).toBe('되살림');
    expect(loaded.me.skills.mining).toBe(42.7);
    expect(loaded.me.skills.blacksmithing).toBe(61.3);
    expect(loaded.me.str).toBe(55.5);
    expect(loaded.me.gold).toBe(12_345);
    expect(loaded.me.backpack.find((s) => s.defId === 'iron-ingot')!.count).toBe(4);
    expect(loaded.mapId).toBe('forest');
  });

  it('내구도와 품질이 살아남는다', () => {
    const world = createWorld('시험', 'smith');
    world.me.str = 80;
    addItem(world, 'iron-sword', 1, { quality: 'fine' });
    const sword = world.me.backpack.find((s) => s.defId === 'iron-sword')!;
    sword.durability = 33;
    sword.maxDurability = 90;

    saveWorld(world);
    const loaded = loadWorld()!;
    const back = loaded.me.backpack.find((s) => s.defId === 'iron-sword')!;

    expect(back.quality).toBe('fine');
    expect(back.durability).toBe(33);
    expect(back.maxDurability).toBe(90);
  });

  it('광맥과 몬스터는 저장하지 않고 다시 만든다', () => {
    const world = createWorld('시험', 'miner');
    enterMap(world, 'mine', 4, 20);
    saveWorld(world);

    const loaded = loadWorld()!;
    expect(loaded.veins.length).toBeGreaterThan(0);
    expect(loaded.monsters.length).toBeGreaterThan(0);
  });

  it('죽은 채로 껐다면 마을에서 깨어난다', () => {
    const world = createWorld('시험', 'miner');
    enterMap(world, 'mine', 4, 20);
    world.me.dead = true;
    saveWorld(world);

    const loaded = loadWorld()!;
    expect(loaded.mapId).toBe('town');
    expect(loaded.me.dead).toBe(true);
  });

  it('불러온 판은 멈춰 있는 상태로 시작한다', () => {
    const world = createWorld('시험', 'miner');
    world.me.targetId = 12;
    world.me.moveTarget = { x: 10, y: 10 };
    world.me.action = { kind: 'mine', targetId: '1', remaining: 1, total: 3, repeat: true };
    saveWorld(world);

    const loaded = loadWorld()!;
    expect(loaded.me.targetId).toBeNull();
    expect(loaded.me.moveTarget).toBeNull();
    expect(loaded.me.action).toBeNull();
  });
});

describe('없거나 망가진 기록', () => {
  it('기록이 없으면 null', () => {
    expect(hasSave()).toBe(false);
    expect(loadWorld()).toBeNull();
  });

  it('내용이 깨져 있어도 게임을 멈추지 않는다', () => {
    const world = createWorld('시험', 'miner');
    saveWorld(world);
    // 저장된 자리에 엉뚱한 글자를 넣습니다
    const key = Object.keys(globalThis.localStorage).length;
    void key;
    localStorage.setItem(localStorage.key(0)!, '{망가진 내용');
    expect(() => loadWorld()).not.toThrow();
  });

  it('지우면 사라진다', () => {
    saveWorld(createWorld('시험', 'miner'));
    expect(hasSave()).toBe(true);
    clearSave();
    expect(hasSave()).toBe(false);
  });

  it('새 인물을 시작하면 이전 자리를 비운다', () => {
    saveWorld(createWorld('첫째', 'miner'));
    newSlot();
    expect(hasSave()).toBe(false);
  });
});

describe('텍스트로 내보내고 불러오기', () => {
  it('한 줄 글자로 뽑았다가 그대로 되살릴 수 있다', () => {
    const world = createWorld('내보내기', 'guard');
    world.me.skills.swordsmanship = 77.7;
    world.me.gold = 8_888;

    const code = exportSave(world);
    expect(code.length).toBeGreaterThan(20);

    localStorage.clear();
    const back = importSave(code)!;

    expect(back).not.toBeNull();
    expect(back.me.name).toBe('내보내기');
    expect(back.me.skills.swordsmanship).toBe(77.7);
    expect(back.me.gold).toBe(8_888);
  });

  it('한글 이름이 깨지지 않는다', () => {
    const world = createWorld('대장장이 두린', 'smith');
    const back = importSave(exportSave(world))!;
    expect(back.me.name).toBe('대장장이 두린');
  });

  it('엉뚱한 글자를 넣으면 null 을 돌려준다', () => {
    expect(importSave('이건 저장 코드가 아닙니다')).toBeNull();
    expect(importSave('')).toBeNull();
  });
});
