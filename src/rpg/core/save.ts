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
import { TOWN_STAGES, emptyTown, stageOf } from '../content/town';
import { log } from './feedback';
import { buildMap, populate, tileCenter } from './world';
import type { Character, GroundItem, MapId, TownState, World } from '../types';

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
  /**
   *  지역마다 바닥에 놓여 있는 것 (지금 있는 지역 것까지 함께).
   *  ★ 지형과 달리 이건 씨앗으로 다시 만들 수 없습니다 — 사람이 놓은 것이니까요.
   */
  ground?: Record<MapId, GroundItem[]>;
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
    ground: packGround(world),
  };
}

/** 저장할 바닥 — 지금 지역 것을 보관함에 합쳐서 한 덩어리로 만듭니다 */
function packGround(world: World): Record<MapId, GroundItem[]> {
  const all: Record<MapId, GroundItem[]> = { ...world.stash };
  if (world.ground.length > 0) all[world.mapId] = world.ground;
  else delete all[world.mapId];
  return all;
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
  // 마을을 넣기 전의 기록에는 이 값이 없습니다 — 처음부터 자라기 시작합니다
  me.town = me.town ?? emptyTown();
  // 시체를 넣기 전의 기록에는 이 값이 없습니다
  me.corpse = me.corpse ?? null;
  //  칭호와 열어둔 문을 넣기 전의 기록에는 이 값들이 없습니다.
  //  ★ 칭호는 조건이 이미 찬 사람이라면 다음 걸음에 저절로 붙습니다 —
  //    checkTitles 가 discovered 를 보고 재기 때문에, 빈 배열로 시작해도 잃는 것이 없습니다.
  me.titles = me.titles ?? [];
  me.wearing = me.wearing ?? null;
  me.opened = me.opened ?? [];
  const carried = migrateTown(me.town);

  const world: World = {
    me,
    mapId: startMap.id,
    map: buildMap(startMap, stageOf(me.town)),
    monsters: [],
    veins: [],
    ground: [],
    stash: {},
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
  //  놓아둔 것을 되살립니다. 저장 시점에 이미 수명이 다했던 것은 버립니다.
  //
  //  ★ 여기 world.time 은 **저장 당시의 세계 시간**이고 until 도 같은 축입니다.
  //    그래서 이 검사는 껐다 켠 사이에 흐른 실제 시간을 세지 못합니다 —
  //    하루 뒤에 열어도 밖에 둔 것은 그대로 있습니다.
  //    실제 시각을 저장에 안 남기므로 알 방법 자체가 없습니다.
  //    고치려면 저장에 실제 시각을 넣어야 하고, 그때 광맥·몬스터 재생도
  //    같이 봐야 합니다 (지금은 populate() 가 통째로 초기화합니다).
  //    전체설계 10절 C 뒤 '③ 땅의 변화' 가 그 자리입니다.
  const saved = data.ground ?? {};
  for (const [id, items] of Object.entries(saved)) {
    const kept = items.filter((item) => item.until === null || world.time < item.until);
    if (kept.length > 0) world.stash[id] = kept;
  }
  world.ground = world.stash[world.mapId] ?? [];
  delete world.stash[world.mapId];

  populate(world);
  //  ★ 옮겨온 것이 있으면 말해줍니다. 말없이 셈이 바뀌면 그것도 조용한 실패입니다.
  if (carried > 0) {
    log(
      world,
      `두린이 그동안 받아둔 구릿돌 ${carried}덩이를 녹여 두었습니다 — 구리 주괴로 셈합니다`,
      'good',
    );
  }
  return world;
}

/**
 *  옛 기록을 지금 사다리에 맞춥니다.
 *
 *  ★ spent 가 없는 기록은 이 값이 생기기 전의 것입니다. 이미 지나간 단계가
 *    먹은 몫을 여기서 되돌려 적어줍니다 — 안 그러면 예전에 판 것이
 *    다음 단계를 미리 채워둔 채로 시작합니다.
 *
 *  ★ 2단계 조건이 구리광석에서 구리 주괴로 바뀌었습니다. 그 전에 구릿돌을
 *    판 사람의 진행이 소리 없이 0 으로 돌아가면 안 됩니다. 판 만큼 얹어줍니다.
 *    ★ sold 는 건드리지 않습니다 — 그것은 판 것의 기록이지 셈 장부가 아닙니다.
 *      얹어주는 몫은 spent 에 음수로 적습니다.
 *
 *  돌려주는 값: 구릿돌에서 옮겨온 개수 (없으면 0)
 */
function migrateTown(town: TownState): number {
  alignStages(town);

  if (town.spent) return 0;
  town.spent = {};

  for (let i = 0; i < town.chosen.length; i++) {
    for (const need of TOWN_STAGES[i]?.needs ?? []) {
      town.spent[need.defId] = (town.spent[need.defId] ?? 0) + need.count;
    }
  }

  const ore = town.sold['copper-ore'] ?? 0;
  if (ore > 0) town.spent['copper-ingot'] = (town.spent['copper-ingot'] ?? 0) - ore;
  return ore;
}

/**
 *  사다리 앞쪽에 단계가 끼어들면 옛 기록의 자리가 한 칸씩 밀립니다.
 *
 *  ★ chosen 은 자리로 읽습니다 — chosen[i] 가 TOWN_STAGES[i] 의 답입니다.
 *    앞에 '화로에 불이 세진다' 를 끼워 넣었더니, 이미 대장간 확장을 고른 사람의
 *    chosen[0] 이 엉뚱한 단계의 답이 되었습니다. 그러면 그 단계가 열어주던 것
 *    (상인의 고급 물약)이 조용히 사라집니다.
 *
 *  ★ 갈림길 없는 단계는 고른 기록이 없으므로, 뒤 단계를 이미 지난 사람은
 *    그 단계도 지난 것으로 봅니다. 다시 요구하면 이미 판 것을 또 팔라는 말이 됩니다.
 *  ★ 이미 맞는 기록에는 아무 일도 하지 않습니다 — 몇 번을 불러도 같습니다.
 */
function alignStages(town: TownState): void {
  for (let i = 0; i < TOWN_STAGES.length && i < town.chosen.length; i++) {
    const stage = TOWN_STAGES[i]!;
    if (stage.choices !== null) continue;
    if (town.chosen[i] === stage.id) continue;
    town.chosen.splice(i, 0, stage.id);
    if (town.spent) {
      for (const need of stage.needs) {
        town.spent[need.defId] = (town.spent[need.defId] ?? 0) + need.count;
      }
    }
  }
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

/**
 *  글자를 읽어본 결과.
 *
 *  ★ 예전에는 importSave 가 null 하나만 돌려줬습니다. 붙여넣기가 안 먹으면
 *    글자가 잘린 건지, 다른 게임 글자인지, 판이 다른 건지 알 방법이 없었습니다 —
 *    이 프로젝트가 계속 잡고 있는 그 조용한 실패입니다.
 */
export type SaveCodeResult = { ok: true; world: World } | { ok: false; problem: string };

/** 글자를 읽어봅니다. 안 되면 왜 안 되는지 함께 돌려줍니다 (저장은 하지 않습니다) */
export function readSaveCode(code: string): SaveCodeResult {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, problem: '붙여넣은 글자가 없습니다.' };

  let json: string;
  try {
    json = fromBase64(trimmed);
  } catch {
    return {
      ok: false,
      problem: '기록 글자가 아닙니다. 내보내기로 받은 글자를 통째로(앞뒤 하나도 빠짐없이) 붙여넣으세요.',
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, problem: '글자가 중간에 잘렸거나 섞였습니다. 전체를 다시 복사해 보세요.' };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, problem: '이 게임의 기록이 아닙니다.' };
  }

  const save = data as Partial<SaveData>;
  if (typeof save.version !== 'number' || !save.me) {
    return { ok: false, problem: '이 게임의 기록이 아닙니다.' };
  }
  if (save.version !== VERSION) {
    return {
      ok: false,
      problem: `${save.version}판 기록입니다. 지금 게임은 ${VERSION}판만 읽을 수 있습니다.`,
    };
  }
  if (typeof save.me.name !== 'string' || !save.me.skills) {
    return { ok: false, problem: '기록 안의 인물이 망가졌습니다.' };
  }

  const world = rebuild(save as SaveData);
  if (!world) return { ok: false, problem: '기록을 되살리지 못했습니다.' };
  return { ok: true, world };
}

/** 글자에서 되살리고 저장까지 합니다. 형식이 아니면 null */
export function importSave(code: string): World | null {
  const result = readSaveCode(code);
  if (!result.ok) return null;
  saveWorld(result.world);
  return result.world;
}
