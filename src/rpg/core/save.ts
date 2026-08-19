/**
 *  저장과 불러오기 (브라우저 안에만 남습니다).
 *
 *  지형과 몬스터 배치는 저장하지 않습니다 — 씨앗으로 다시 만들면 되기 때문입니다.
 *  저장되는 것은 "내 인물, 지금 있는 지역, 보스 시계" 정도입니다.
 */

import { mapDef } from '../content/maps';
import { buildMap, populate, tileCenter } from './world';
import type { MapId, Player, World } from '../types';

const KEY = 'aden-shadow-save-v1';

interface SaveData {
  version: 1;
  player: Player;
  mapId: MapId;
  time: number;
  nextId: number;
  seed: number;
  bossRespawnAt: Record<string, number>;
}

export function saveWorld(world: World): void {
  try {
    const data: SaveData = {
      version: 1,
      player: world.player,
      mapId: world.mapId,
      time: world.time,
      nextId: world.nextId,
      seed: world.seed,
      bossRespawnAt: world.bossRespawnAt,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 저장 공간이 막혀 있어도 게임은 계속 돌아가야 합니다
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

/** 저장된 게임을 되살립니다. 없거나 깨졌으면 null */
export function loadWorld(): World | null {
  let data: SaveData;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    data = JSON.parse(raw) as SaveData;
    if (data.version !== 1 || !data.player) return null;
  } catch {
    return null;
  }

  const def = mapDef(data.mapId);
  const player = data.player;

  // 죽은 채로 껐다면 마을에서 다시 시작합니다
  const startMap = player.dead ? mapDef('town') : def;

  player.pos = { x: tileCenter(startMap.entryTx), y: tileCenter(startMap.entryTy) };
  player.moveTarget = null;
  player.targetId = null;
  player.buffs = [];
  player.auto = false;
  player.questKills = player.questKills ?? 0;

  const world: World = {
    player,
    mapId: startMap.id,
    map: buildMap(startMap),
    monsters: [],
    ground: [],
    floaters: [],
    vfx: [],
    log: [],
    time: data.time ?? 0,
    nextId: data.nextId ?? 1000,
    camera: { x: player.pos.x, y: player.pos.y },
    path: [],
    pathTimer: 0,
    shake: 0,
    playerAnim: 0,
    playerMoving: false,
    playerSwing: 0,
    bossRespawnAt: data.bossRespawnAt ?? {},
    panel: null,
    pendingNpc: null,
    toast: null,
    enhanceUid: null,
    enhanceResult: null,
    seed: data.seed ?? 12345,
  };

  populate(world);
  return world;
}
