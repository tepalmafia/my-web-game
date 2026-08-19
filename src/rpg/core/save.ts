/**
 *  저장과 불러오기 (브라우저 안에만 남습니다).
 *
 *  ★ 열쇠에 처음부터 이름칸을 둡니다 — `aden:v2:char:<id>:state`
 *    지금은 캐릭터 하나뿐이지만, 나중에 슬롯이 여럿이 되어도 구조를 바꾸지 않습니다.
 *
 *  ★ 지형과 몬스터와 광맥은 저장하지 않습니다. 씨앗으로 다시 만들면 되기 때문입니다.
 *
 *  플레이가 길어지므로 텍스트로 내보내고 불러오는 길도 함께 둡니다.
 */

import { mapDef } from '../content/maps';
import { buildMap, populate, tileCenter } from './world';
import type { Character, MapId, World } from '../types';

const VERSION = 2;
const ACTIVE_KEY = 'aden:v2:active';
const stateKey = (id: string) => `aden:v2:char:${id}:state`;

interface SaveData {
  version: number;
  me: Character;
  mapId: MapId;
  time: number;
  nextId: number;
  seed: number;
}

/* --------------------------------------------------------------- 저장소 접근 */

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function activeId(): string {
  const box = store();
  if (!box) return 'main';
  try {
    const found = box.getItem(ACTIVE_KEY);
    if (found) return found;
    const fresh = `c${Date.now().toString(36)}`;
    box.setItem(ACTIVE_KEY, fresh);
    return fresh;
  } catch {
    return 'main';
  }
}

/** 새 인물을 시작할 때 — 새 이름칸을 잡습니다 (이전 기록은 지웁니다) */
export function newSlot(): void {
  const box = store();
  if (!box) return;
  try {
    const previous = box.getItem(ACTIVE_KEY);
    if (previous) box.removeItem(stateKey(previous));
    box.setItem(ACTIVE_KEY, `c${Date.now().toString(36)}`);
  } catch {
    // 저장이 막혀 있어도 게임은 돌아가야 합니다
  }
}

/* --------------------------------------------------------------- 저장·불러오기 */

function pack(world: World): SaveData {
  return {
    version: VERSION,
    me: world.me,
    mapId: world.mapId,
    time: world.time,
    nextId: world.nextId,
    seed: world.seed,
  };
}

export function saveWorld(world: World): void {
  const box = store();
  if (!box) return;
  try {
    box.setItem(stateKey(activeId()), JSON.stringify(pack(world)));
  } catch {
    // 저장 공간이 막혀도 계속 놀 수 있어야 합니다
  }
}

export function hasSave(): boolean {
  const box = store();
  if (!box) return false;
  try {
    return box.getItem(stateKey(activeId())) !== null;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  const box = store();
  if (!box) return;
  try {
    box.removeItem(stateKey(activeId()));
  } catch {
    // 무시
  }
}

/** 저장된 내용을 실제 세계로 되살립니다 */
function rebuild(data: SaveData): World | null {
  if (data.version !== VERSION || !data.me) return null;

  const me = data.me;
  // 죽은 채로 껐다면 마을에서 시작합니다
  const startMap = mapDef(me.dead ? 'town' : data.mapId);

  me.pos = { x: tileCenter(startMap.entryTx), y: tileCenter(startMap.entryTy) };
  me.moveTarget = null;
  me.targetId = null;
  me.action = null;
  me.tally = me.tally ?? {};
  me.statTouched = me.statTouched ?? { str: 0, dex: 0, int: 0 };

  const world: World = {
    me,
    mapId: startMap.id,
    map: buildMap(startMap),
    monsters: [],
    veins: [],
    ground: [],
    floaters: [],
    vfx: [],
    log: [],
    time: data.time ?? 0,
    nextId: data.nextId ?? 1000,
    camera: { x: me.pos.x, y: me.pos.y },
    shake: 0,
    path: [],
    pathTimer: 0,
    panel: null,
    pendingNpc: null,
    toast: null,
    seed: data.seed ?? 12345,
    meAnim: 0,
    meMoving: false,
    meSwing: 0,
  };
  populate(world);
  return world;
}

export function loadWorld(): World | null {
  const box = store();
  if (!box) return null;
  try {
    const raw = box.getItem(stateKey(activeId()));
    if (!raw) return null;
    return rebuild(JSON.parse(raw) as SaveData);
  } catch {
    return null;
  }
}

/* ===========================================================================
 *  텍스트로 내보내고 불러오기
 *  ---------------------------------------------------------------------------
 *  브라우저를 비우면 기록이 사라지므로, 한 줄짜리 글자로 뽑아둘 수 있게 합니다.
 *  한글 이름이 들어가므로 그냥 btoa 를 쓰면 깨집니다 — UTF-8 을 거쳐야 합니다.
 * ======================================================================== */

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(code: string): string {
  const binary = atob(code.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** 지금 상태를 한 줄 글자로 */
export function exportSave(world: World): string {
  return toBase64(JSON.stringify(pack(world)));
}

/** 글자에서 되살립니다. 형식이 아니면 null */
export function importSave(code: string): World | null {
  try {
    const data = JSON.parse(fromBase64(code)) as SaveData;
    const world = rebuild(data);
    if (world) saveWorld(world);
    return world;
  } catch {
    return null;
  }
}
