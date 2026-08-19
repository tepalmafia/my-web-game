/**
 *  기록을 글자로 뽑고 되살리기.
 *
 *  ★ importSave 는 무엇이 잘못됐든 null 하나만 돌려줬습니다.
 *    붙여넣기가 안 먹으면 글자가 잘린 건지 다른 판인지 알 길이 없었습니다.
 *    readSaveCode 는 이유를 함께 돌려줍니다 — 여기서 다섯 가지를 갈라서 못 박습니다.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { addItem } from '../../src/rpg/core/inventory';
import { createWorld } from '../../src/rpg/core/create';
import { exportSave, importSave, readSaveCode } from '../../src/rpg/core/save';
import { enterMap } from '../../src/rpg/core/world';
import { mapDef } from '../../src/rpg/content/maps';

/** localStorage 가 없는 곳에서도 돌아야 합니다 (vitest 는 node 환경입니다) */
class MemoryStorage {
  private box = new Map<string, string>();
  get length() { return this.box.size; }
  key(i: number) { return [...this.box.keys()][i] ?? null; }
  getItem(k: string) { return this.box.get(k) ?? null; }
  setItem(k: string, v: string) { this.box.set(k, String(v)); }
  removeItem(k: string) { this.box.delete(k); }
  clear() { this.box.clear(); }
}

function utf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

function played(): ReturnType<typeof createWorld> {
  const world = createWorld('한글 이름', 'miner');
  world.me.gold = 4321;
  world.me.skills.mining = 37.5;
  world.me.skills.blacksmithing = 12.25;
  addItem(world, 'iron-ore', 3);
  enterMap(world, 'forest', mapDef('forest').entryTx, mapDef('forest').entryTy);
  world.time = 987.5;
  return world;
}

describe('내보내기 → 불러오기 왕복', () => {
  it('뽑은 글자를 도로 넣으면 그 인물이 그대로 돌아온다', () => {
    const before = played();
    const code = exportSave(before);

    const result = readSaveCode(code);
    expect(result.ok, result.ok ? '' : result.problem).toBe(true);
    if (!result.ok) return;

    const after = result.world;
    expect(after.me.name, '한글 이름이 깨졌습니다').toBe('한글 이름');
    expect(after.me.gold).toBe(4321);
    expect(after.me.skills.mining).toBeCloseTo(37.5, 6);
    expect(after.me.skills.blacksmithing).toBeCloseTo(12.25, 6);
    expect(after.mapId).toBe('forest');
    expect(after.time).toBeCloseTo(987.5, 6);
    expect(after.me.backpack.find((s) => s.defId === 'iron-ore')?.count).toBe(3);
  });

  it('되살린 것을 또 뽑아도 같은 글자가 나온다', () => {
    // ★ 왕복이 한 번만 되는 것으로는 모자랍니다. 옮겨 다니는 것이 목적이니까요.
    const code = exportSave(played());
    const once = readSaveCode(code);
    expect(once.ok).toBe(true);
    if (!once.ok) return;

    const again = exportSave(once.world);
    const twice = readSaveCode(again);
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;

    expect(twice.world.me.name).toBe(once.world.me.name);
    expect(twice.world.me.gold).toBe(once.world.me.gold);
    expect(twice.world.me.skills).toEqual(once.world.me.skills);
  });

  it('importSave 는 저장까지 하고, 그 다음 이어서 하기가 그 인물이다', () => {
    const code = exportSave(played());
    const world = importSave(code);
    expect(world).not.toBeNull();
    expect(world!.me.name).toBe('한글 이름');

    const raw = localStorage.getItem(localStorage.key(1) ?? localStorage.key(0)!);
    expect(raw, '저장이 안 됐습니다').toBeTruthy();
    expect(raw!).toContain('한글 이름');
  });
});

describe('잘못된 글자는 이유를 말한다', () => {
  const problemOf = (code: string): string => {
    const result = readSaveCode(code);
    expect(result.ok, '통과하면 안 되는 글자가 통과했습니다').toBe(false);
    return result.ok ? '' : result.problem;
  };

  it('빈 글자', () => {
    expect(problemOf('   ')).toContain('글자가 없습니다');
  });

  it('기록 글자 자체가 아님', () => {
    expect(problemOf('안녕하세요 이건 그냥 한국어입니다')).toContain('기록 글자가 아닙니다');
  });

  it('글자가 중간에 잘림', () => {
    const code = exportSave(played());
    // 뒤를 잘라내면 base64 로는 읽히지만 JSON 이 안 됩니다
    expect(problemOf(code.slice(0, Math.floor(code.length / 2)))).toMatch(/잘렸|기록 글자가 아닙니다/);
  });

  it('다른 판의 기록', () => {
    const older = utf8Base64(JSON.stringify({ version: 1, me: { name: '옛사람', skills: {} }, mapId: 'town' }));
    expect(problemOf(older)).toContain('1판 기록입니다');
  });

  it('이 게임의 기록이 아님', () => {
    expect(problemOf(utf8Base64(JSON.stringify({ hello: 'world' })))).toContain('이 게임의 기록이 아닙니다');
  });

  it('인물이 망가진 기록', () => {
    const broken = utf8Base64(JSON.stringify({ version: 2, me: { gold: 5 }, mapId: 'town' }));
    expect(problemOf(broken)).toContain('망가졌습니다');
  });

  it('이유가 서로 다르다 — "안 됩니다" 하나로 뭉뚱그리지 않는다', () => {
    const reasons = [
      problemOf('   '),
      problemOf('그냥 한국어'),
      problemOf(utf8Base64(JSON.stringify({ hello: 'world' }))),
      problemOf(utf8Base64(JSON.stringify({ version: 1, me: { name: 'x', skills: {} } }))),
      problemOf(utf8Base64(JSON.stringify({ version: 2, me: { gold: 1 } }))),
    ];
    expect(new Set(reasons).size, `겹치는 이유: ${reasons.join(' / ')}`).toBe(reasons.length);
  });
});
