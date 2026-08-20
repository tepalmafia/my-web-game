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
import { TOWN_STAGES, stageReady } from '../../src/rpg/content/town';

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

/* ===========================================================================
 *  마을 사다리가 바뀐 뒤 옛 기록을 읽을 때
 *  ---------------------------------------------------------------------------
 *  ★ 2단계 조건이 구리광석에서 구리 주괴로 바뀌었습니다.
 *    그 전에 구릿돌을 판 사람의 진행이 말없이 0 이 되면 그것도 조용한 실패입니다.
 * ======================================================================== */

describe('옛 기록 맞추기', () => {
  /** spent 가 생기기 전의 기록 — sold 와 chosen 만 있습니다 */
  function oldSave(town: { sold: Record<string, number>; chosen: string[] }): string {
    const world = played();
    const packed = JSON.parse(utf8Base64Decode(exportSave(world))) as {
      me: { town: unknown };
    };
    packed.me.town = town;
    return utf8Base64(JSON.stringify(packed));
  }

  function utf8Base64Decode(code: string): string {
    const binary = atob(code.trim());
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  }

  it('spent 가 없던 기록도 읽힌다', () => {
    const result = readSaveCode(oldSave({ sold: {}, chosen: [] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.world.me.town.spent).toEqual({});
  });

  it('이미 지나간 단계가 먹은 몫이 되돌려 적힌다 — 아니면 다음 단계가 미리 찬다', () => {
    const result = readSaveCode(oldSave({ sold: { 'iron-ingot': 40 }, chosen: ['forge-blade'] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const town = result.world.me.town;
    expect(town.sold['iron-ingot'], '판 기록이 깎였습니다').toBe(40);
    //  ★ 사다리 앞에 갈림길 없는 단계가 끼어들었습니다. 이미 뒤 단계를 지난 사람은
    //    그 단계도 지난 것으로 봅니다 — 다시 요구하면 이미 판 것을 또 팔라는 말입니다.
    //    그래서 먹은 몫은 지나온 단계들이 요구한 합(4 + 40)입니다.
    const passed = TOWN_STAGES.slice(0, 2).reduce(
      (sum, stage) => sum + stage.needs.reduce((n, need) => n + need.count, 0),
      0,
    );
    expect(town.spent['iron-ingot'], '지나온 단계의 몫이 안 적혔습니다').toBe(passed);
    expect(town.chosen[0], '끼어든 단계가 자리를 못 찾았습니다').toBe(TOWN_STAGES[0]!.id);
  });

  it('이미 구릿돌을 판 사람의 진행이 0 으로 돌아가지 않는다', () => {
    // 옛 규칙에서 2단계는 구리광석 25 였습니다. 30 을 판 사람은 조건을 채운 상태였습니다.
    const result = readSaveCode(
      oldSave({ sold: { 'iron-ingot': 40, 'copper-ore': 30 }, chosen: ['forge-blade'] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const town = result.world.me.town;

    // 판 기록은 구릿돌 그대로입니다 — 없는 주괴를 팔았다고 적지 않습니다
    expect(town.sold['copper-ore']).toBe(30);
    expect(town.sold['copper-ingot']).toBeUndefined();
    // 대신 셈 장부에 얹어줍니다
    expect(stageReady(town), '구릿돌을 30개나 팔았는데 진행이 사라졌습니다').toBe(true);
  });

  it('무엇이 옮겨졌는지 화면에 남는다 — 말없이 셈이 바뀌면 안 된다', () => {
    const result = readSaveCode(
      oldSave({ sold: { 'iron-ingot': 40, 'copper-ore': 30 }, chosen: ['forge-blade'] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.world.log.some((line) => line.text.includes('구릿돌'))).toBe(true);
  });
});
