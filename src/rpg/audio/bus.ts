/**
 * ===========================================================================
 *  소리 버스 — AudioContext 하나와 그 뒤의 배관
 * ===========================================================================
 *
 *  ★ 방향은 언제나 audio → core 입니다. core/ 는 소리를 전혀 모릅니다.
 *    core/ 가 여기를 import 하는 순간 헤드리스 봇(tools/)이 죽습니다.
 *    브라우저가 아닌 곳에서는 이 파일의 모든 함수가 조용히 아무 일도 하지 않습니다.
 *
 *  배관:  각 소리 → voice 게인 → 마스터 게인 → 컴프레서 → 스피커
 *
 *  마스터 게인을 따로 두는 이유는 볼륨 때문만이 아닙니다.
 *  크리티컬이 터질 때 주변을 잠깐 눌러주고(덕킹), 제작에 실패했을 때
 *  세상을 통째로 잠깐 조용하게 만드는 것이 전부 여기서 일어납니다.
 *  (설계 문서 §4.2 · §4.5 · §4.7)
 */

/** 게인은 0 으로 내리지 않습니다 — exponentialRamp 가 0 을 못 받습니다 */
const FLOOR = 0.0001;

/** 동시에 낼 수 있는 소리 (설계 문서 §5) */
const MAX_VOICES = 8;

/** 같은 소리가 이 간격 안에 겹치면 뒤엣것을 버립니다 (연타 시 게인 폭발 방지) */
const DEDUPE_SECONDS = 0.012;

/** 소리를 뺏길 때 딸깍거리지 않도록 짧게 지웁니다 */
const STEAL_FADE = 0.005;

const SETTINGS_KEY = 'aden:v2:audio';

export interface AudioSettings {
  muted: boolean;
  /** 0 ~ 1 */
  volume: number;
}

/** 소리 하나가 쓰는 자리. synth.ts 가 여기 물려서 냅니다. */
export interface Voice {
  /** 여기에 연결하면 마스터로 흘러갑니다 */
  out: GainNode;
  /** 예약 기준 시각 — ctx.currentTime 을 다시 읽지 말고 이 값을 쓰세요 */
  at: number;
  /** 이 소리가 끝나는 시각 */
  until: number;
  /** 일찍 끝낼 때 (짧게 지우고 끊습니다) */
  release(): void;
}

interface Slot {
  voice: Voice;
  gain: GainNode;
  until: number;
  /** 오래된 것부터 회수하기 위한 순번 */
  serial: number;
}

/* ===========================================================================
 *  상태
 * ======================================================================== */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let started = false;

let settings: AudioSettings = { muted: false, volume: 0.7 };
let loaded = false;

const slots: Slot[] = [];
const lastPlayed = new Map<string, number>();
let serial = 0;

/** 덕킹·정적이 끝나고 마스터를 되돌릴 시각 (겹칠 때 늦은 쪽이 이깁니다) */
let restoreAt = 0;

/* ===========================================================================
 *  설정 (localStorage)
 * ======================================================================== */

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function loadSettings(): void {
  if (loaded) return;
  loaded = true;
  const box = store();
  if (!box) return;
  try {
    const raw = box.getItem(SETTINGS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Partial<AudioSettings>;
    if (typeof data.muted === 'boolean') settings.muted = data.muted;
    if (typeof data.volume === 'number') settings.volume = clamp01(data.volume);
  } catch {
    // 설정을 못 읽어도 소리는 나야 합니다
  }
}

function saveSettings(): void {
  const box = store();
  if (!box) return;
  try {
    box.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 저장이 막혀 있어도 이번 판에서는 적용됩니다
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/* ===========================================================================
 *  켜기
 * ======================================================================== */

type AudioContextMaker = new (options?: AudioContextOptions) => AudioContext;

function contextMaker(): AudioContextMaker | null {
  const scope = globalThis as unknown as {
    AudioContext?: AudioContextMaker;
    webkitAudioContext?: AudioContextMaker;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/** 이 환경에서 소리를 낼 수 있는가 (노드·테스트에서는 false) */
export function supported(): boolean {
  return contextMaker() !== null;
}

/**
 * 소리를 낼 준비를 합니다.
 * ★ iOS 는 사용자가 화면을 만지기 전에는 소리를 내주지 않습니다.
 *   그래서 첫 터치·클릭·키 입력에서 unlock() 을 불러야 합니다.
 */
export function unlock(): void {
  loadSettings();
  const Maker = contextMaker();
  if (!Maker) return;

  if (!ctx) {
    try {
      ctx = new Maker({ latencyHint: 'interactive' });
    } catch {
      ctx = null;
      return;
    }

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12; // 설계 문서 §5
    compressor.ratio.value = 4;
    compressor.knee.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    master = ctx.createGain();
    master.gain.value = level();
    master.connect(compressor);
    compressor.connect(ctx.destination);

    watchVisibility();
  }

  if (ctx.state === 'suspended') void ctx.resume();
  started = true;
}

/** 소리를 낼 수 있는 상태인가 */
export function ready(): boolean {
  return started && ctx !== null && ctx.state === 'running';
}

/** 지금 시각 (예약은 전부 이 값 + 오프셋으로 합니다. setTimeout 금지) */
export function now(): number {
  return ctx ? ctx.currentTime : 0;
}

/** 소리를 만들 때 쓰는 AudioContext. 준비되지 않았으면 null */
export function context(): AudioContext | null {
  return ready() ? ctx : null;
}

/* ===========================================================================
 *  음량
 * ======================================================================== */

function level(): number {
  return settings.muted ? FLOOR : Math.max(FLOOR, settings.volume);
}

export function getSettings(): AudioSettings {
  loadSettings();
  return { ...settings };
}

export function setVolume(volume: number): void {
  loadSettings();
  settings.volume = clamp01(volume);
  saveSettings();
  applyLevel();
}

export function setMuted(muted: boolean): void {
  loadSettings();
  settings.muted = muted;
  saveSettings();
  if (muted) stopAll();
  applyLevel();
}

export function toggleMuted(): boolean {
  loadSettings();
  setMuted(!settings.muted);
  return settings.muted;
}

/** 덕킹·정적 중이 아니면 마스터를 지금 설정값으로 되돌립니다 */
function applyLevel(): void {
  if (!ctx || !master) return;
  const at = ctx.currentTime;
  if (at < restoreAt) return; // 눌러둔 중이면 복귀 예약이 알아서 합니다
  master.gain.cancelScheduledValues(at);
  master.gain.setValueAtTime(Math.max(FLOOR, master.gain.value), at);
  master.gain.exponentialRampToValueAtTime(level(), at + 0.02);
}

/* ===========================================================================
 *  덕킹과 정적 — 큰 소리보다 그 주변이 조용해지는 쪽이 세게 들립니다
 * ======================================================================== */

/**
 * 마스터를 잠깐 눌렀다 되돌립니다.
 * @param decibels 얼마나 누를지 (양수. 6 이면 -6dB)
 * @param holdMs   누른 채로 버티는 시간
 */
export function duck(decibels: number, holdMs: number): void {
  if (!ctx || !master) return;
  const target = Math.max(FLOOR, level() * Math.pow(10, -Math.abs(decibels) / 20));
  hold(target, holdMs, 0.015, 0.08);
}

/**
 * 세상을 통째로 잠깐 끕니다 (설계 문서 §4.7 제작 실패).
 * @param holdMs    아무 소리도 없는 시간
 * @param restoreMs 되돌아오는 데 걸리는 시간
 */
export function silence(holdMs: number, restoreMs = 0.2 * 1000): void {
  if (!ctx || !master) return;
  stopAll();
  hold(FLOOR, holdMs, 0.005, restoreMs / 1000);
}

function hold(target: number, holdMs: number, fallSeconds: number, riseSeconds: number): void {
  if (!ctx || !master) return;
  const at = ctx.currentTime;
  const back = at + fallSeconds + holdMs / 1000;
  if (back <= restoreAt) return; // 더 길게 눌러둔 것이 이미 있습니다
  restoreAt = back;

  master.gain.cancelScheduledValues(at);
  master.gain.setValueAtTime(Math.max(FLOOR, master.gain.value), at);
  master.gain.exponentialRampToValueAtTime(target, at + fallSeconds);
  master.gain.setValueAtTime(target, back);
  master.gain.exponentialRampToValueAtTime(level(), back + riseSeconds);
}

/* ===========================================================================
 *  자리 나눠주기 (동시 발음 제한과 중복 방지)
 * ======================================================================== */

/**
 * 소리 하나가 쓸 자리를 얻습니다.
 *
 * @param key         같은 소리인지 가리는 이름 (12ms 안에 같은 이름이면 거절)
 * @param durationMs  이 소리가 이어지는 길이
 * @param delayMs     지금부터 이만큼 뒤에 시작 (설계 문서 §4.2 의 잔향 등)
 * @returns 자리. 소리를 낼 수 없거나 거절되면 null
 */
export function takeVoice(key: string, durationMs: number, delayMs = 0): Voice | null {
  const audio = context();
  if (!audio || !master) return null;
  if (settings.muted) return null;

  const at = audio.currentTime + Math.max(0, delayMs) / 1000;

  // 연타로 같은 소리가 겹치면 게인이 폭발합니다
  const last = lastPlayed.get(key);
  if (last !== undefined && at - last < DEDUPE_SECONDS) return null;
  lastPlayed.set(key, at);

  reap(audio.currentTime);
  if (slots.length >= MAX_VOICES) steal();

  const gain = audio.createGain();
  gain.gain.value = 1;
  gain.connect(master);

  const until = at + Math.max(0, durationMs) / 1000;
  const slot: Slot = {
    gain,
    until,
    serial: serial++,
    voice: {
      out: gain,
      at,
      until,
      release: () => drop(slot, true),
    },
  };
  slots.push(slot);
  return slot.voice;
}

/** 끝난 자리를 치웁니다 */
function reap(at: number): void {
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i]!.until <= at) drop(slots[i]!, false);
  }
}

/** 가장 오래된 소리를 회수합니다 */
function steal(): void {
  let oldest: Slot | null = null;
  for (const slot of slots) {
    if (!oldest || slot.serial < oldest.serial) oldest = slot;
  }
  if (oldest) drop(oldest, true);
}

function drop(slot: Slot, fade: boolean): void {
  const index = slots.indexOf(slot);
  if (index < 0) return;
  slots.splice(index, 1);

  const audio = ctx;
  if (!audio) return;
  const at = audio.currentTime;

  if (fade) {
    // 뚝 끊으면 딸깍거립니다
    try {
      slot.gain.gain.cancelScheduledValues(at);
      slot.gain.gain.setValueAtTime(Math.max(FLOOR, slot.gain.gain.value), at);
      slot.gain.gain.exponentialRampToValueAtTime(FLOOR, at + STEAL_FADE);
    } catch {
      // 파라미터가 이미 정리된 경우
    }
  }
  const wait = fade ? (STEAL_FADE + 0.02) * 1000 : 0;
  disconnectLater(slot.gain, wait);
}

/** 끊는 것만은 시계가 아니라 실제 시간이라 setTimeout 을 씁니다 (예약이 아닙니다) */
function disconnectLater(node: GainNode, waitMs: number): void {
  const cut = () => {
    try {
      node.disconnect();
    } catch {
      // 이미 끊겼습니다
    }
  };
  if (waitMs <= 0) cut();
  else globalThis.setTimeout(cut, waitMs);
}

/** 지금 울리고 있는 소리 수 (검증용) */
export function voiceCount(): number {
  if (ctx) reap(ctx.currentTime);
  return slots.length;
}

/** 울리는 것을 전부 끕니다 */
export function stopAll(): void {
  for (const slot of [...slots]) drop(slot, true);
  lastPlayed.clear();
}

/* ===========================================================================
 *  탭이 뒤로 가면 쉽니다
 * ======================================================================== */

let watching = false;

function watchVisibility(): void {
  if (watching) return;
  const doc = (globalThis as { document?: Document }).document;
  if (!doc?.addEventListener) return;
  watching = true;

  doc.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (doc.visibilityState === 'hidden') {
      stopAll();
      void ctx.suspend();
    } else if (started) {
      void ctx.resume();
    }
  });
}

/** 전부 정리합니다 (화면을 떠날 때) */
export function shutdown(): void {
  stopAll();
  started = false;
  restoreAt = 0;
  const audio = ctx;
  ctx = null;
  master = null;
  compressor = null;
  if (audio) void audio.close().catch(() => undefined);
}
