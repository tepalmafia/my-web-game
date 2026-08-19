/**
 * ===========================================================================
 *  합성 기본 단위 — 이 넷으로 게임의 모든 소리를 만듭니다
 * ===========================================================================
 *
 *  오디오 파일은 한 개도 쓰지 않습니다. 화면을 도형으로 그리듯, 소리도 코드로 만듭니다.
 *
 *      noise  화이트노이즈 → 필터 → 엔벨로프.  긁힘 · 딸깍 · 바람
 *      thump  주파수를 위에서 아래로 떨어뜨림.  "부딪혔다"의 정체
 *      metal  비조화 배음(1 : 2.41 : 3.83).     쇠 · 종 · 잔향
 *      sweep  밴드패스를 훑고 지나감.           빗나감 · 스침
 *
 *  ★ 공통 규칙
 *    · 어택은 2~5ms. 10ms 를 넘기면 그 순간 물렁해집니다.
 *    · 감쇄는 반드시 지수. 선형으로 내리면 끝에서 딸깍거립니다.
 *    · 0 으로 내리지 않고 0.0001 로 내립니다 (exponentialRamp 가 0 을 못 받습니다).
 *    · 예약은 전부 voice.at + 오프셋. setTimeout 으로 소리를 내지 않습니다.
 *
 *  ★ 흔들림(jitter)에 세계의 난수를 쓰지 않습니다.
 *    seeded RNG 를 건드리면 봇 실측이 재현되지 않습니다. 소리는 헤드리스에서
 *    돌지 않으므로 Math.random 으로 충분합니다.
 */

import { takeVoice, type Voice } from './bus';

/** 게인은 여기까지만 내립니다 */
const FLOOR = 0.0001;

/** 어택 (설계 문서 §3) */
const ATTACK = 0.003;

/** 금속의 기본 배음비 — 정수배가 아니라서 '쇳소리'가 됩니다 */
export const METAL_RATIOS = [1, 2.41, 3.83] as const;

export interface Common {
  /** 길이 (ms) */
  dur: number;
  /** 상대 게인 0~1 */
  gain: number;
  /** 지금부터 이만큼 뒤에 시작 (ms) */
  at?: number;
  /** 피치를 이 비율만큼 무작위로 흔듭니다 (0.06 = ±6%) */
  jitter?: number;
  /** 같은 소리인지 가리는 이름. 없으면 종류 이름을 씁니다 */
  key?: string;
  /** 정적(§4.7) 중에도 통과시킵니다 — 정적 한가운데 울려야 하는 소리 하나뿐입니다 */
  force?: boolean;
}

export interface NoiseOptions extends Common {
  /** 하이패스 (Hz) */
  hp?: number;
  /** 로우패스 (Hz) */
  lp?: number;
  /** 밴드패스 중심 (Hz) */
  bp?: number;
  /** 밴드패스·하이패스의 Q */
  q?: number;
}

export interface ThumpOptions extends Common {
  from: number;
  to: number;
  wave?: OscillatorType;
}

export interface MetalOptions extends Common {
  base: number;
  /** 기본은 [1, 2.41, 3.83] */
  ratios?: readonly number[];
  /** 주면 base 에서 여기까지 미끄러집니다 (상승이면 좋은 일, 하강이면 나쁜 일) */
  to?: number;
}

export interface SweepOptions extends Common {
  from: number;
  to: number;
  q?: number;
}

/* ===========================================================================
 *  공통 도구
 * ======================================================================== */

/** 같은 소리라도 매번 조금씩 다르게 — 이게 없으면 수천 번 반복에 귀가 지칩니다 */
function shake(value: number, jitter: number | undefined): number {
  if (!jitter) return value;
  return value * (1 + (Math.random() * 2 - 1) * jitter);
}

/** 지수 램프는 0 을 못 받습니다 */
function safe(hz: number): number {
  return Math.max(1, hz);
}

/**
 * 어택 → 지수 감쇄.
 * 소리의 성격 절반이 여기서 정해집니다.
 */
function envelope(node: GainNode, voice: Voice, gain: number, durSeconds: number): void {
  const peak = Math.max(FLOOR, gain);
  const attack = Math.min(ATTACK, durSeconds * 0.4);

  node.gain.setValueAtTime(FLOOR, voice.at);
  node.gain.exponentialRampToValueAtTime(peak, voice.at + attack);
  node.gain.exponentialRampToValueAtTime(FLOOR, voice.at + durSeconds);
}

/* --------------------------------------------------------------- 노이즈 원료 */

let noiseBuffer: AudioBuffer | null = null;
let noiseOwner: BaseAudioContext | null = null;

/**
 * 화이트노이즈 1초짜리 한 장을 만들어 두고 계속 돌려 씁니다.
 * 매번 새로 만들면 채굴처럼 잦은 소리에서 눈에 띄게 버벅입니다.
 */
function whiteNoise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuffer && noiseOwner === ctx) return noiseBuffer;

  const frames = Math.floor(ctx.sampleRate);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  noiseBuffer = buffer;
  noiseOwner = ctx;
  return buffer;
}

/** 노이즈 한 조각을 아무 데서나 잘라 씁니다 (같은 자리를 반복하면 티가 납니다) */
function noiseSource(ctx: BaseAudioContext, voice: Voice, durSeconds: number): AudioBufferSourceNode {
  const source = (ctx as AudioContext).createBufferSource();
  source.buffer = whiteNoise(ctx);
  source.loop = true;
  const offset = Math.random() * 0.9;
  source.start(voice.at, offset);
  source.stop(voice.at + durSeconds + 0.02);
  return source;
}

function begin(kind: string, options: Common): { voice: Voice; ctx: BaseAudioContext; dur: number } | null {
  const voice = takeVoice(options.key ?? kind, options.dur, options.at ?? 0, options.force ?? false);
  if (!voice) return null;
  const ctx = voice.out.context;
  return { voice, ctx, dur: Math.max(0.001, options.dur / 1000) };
}

/* ===========================================================================
 *  1. noise — 긁힘과 딸깍
 * ======================================================================== */

export function noise(options: NoiseOptions): Voice | null {
  const started = begin('noise', options);
  if (!started) return null;
  const { voice, ctx, dur } = started;

  const source = noiseSource(ctx, voice, dur);
  let tail: AudioNode = source;

  if (options.bp !== undefined) {
    const band = (ctx as AudioContext).createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(safe(shake(options.bp, options.jitter)), voice.at);
    band.Q.value = options.q ?? 1;
    tail.connect(band);
    tail = band;
  }
  if (options.hp !== undefined) {
    const high = (ctx as AudioContext).createBiquadFilter();
    high.type = 'highpass';
    high.frequency.setValueAtTime(safe(shake(options.hp, options.jitter)), voice.at);
    high.Q.value = options.q ?? 0.7;
    tail.connect(high);
    tail = high;
  }
  if (options.lp !== undefined) {
    const low = (ctx as AudioContext).createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.setValueAtTime(safe(shake(options.lp, options.jitter)), voice.at);
    low.Q.value = options.q ?? 0.7;
    tail.connect(low);
    tail = low;
  }

  const env = (ctx as AudioContext).createGain();
  envelope(env, voice, options.gain, dur);
  tail.connect(env);
  env.connect(voice.out);
  return voice;
}

/* ===========================================================================
 *  2. thump — 부딪혔다는 느낌 그 자체
 * ======================================================================== */

export function thump(options: ThumpOptions): Voice | null {
  const started = begin('thump', options);
  if (!started) return null;
  const { voice, ctx, dur } = started;

  const osc = (ctx as AudioContext).createOscillator();
  osc.type = options.wave ?? 'triangle';

  const from = safe(shake(options.from, options.jitter));
  const to = safe(shake(options.to, options.jitter));
  osc.frequency.setValueAtTime(from, voice.at);
  // 지수로 떨어져야 '툭' 하고 박힙니다. 선형으로 내리면 미끄러지는 소리가 됩니다.
  osc.frequency.exponentialRampToValueAtTime(to, voice.at + dur);

  const env = (ctx as AudioContext).createGain();
  envelope(env, voice, options.gain, dur);

  osc.connect(env);
  env.connect(voice.out);
  osc.start(voice.at);
  osc.stop(voice.at + dur + 0.02);
  return voice;
}

/* ===========================================================================
 *  3. metal — 정수배가 아닌 배음이 쇳소리를 만듭니다
 * ======================================================================== */

export function metal(options: MetalOptions): Voice | null {
  const started = begin('metal', options);
  if (!started) return null;
  const { voice, ctx, dur } = started;

  const ratios = options.ratios ?? METAL_RATIOS;
  const base = safe(shake(options.base, options.jitter));
  const glide = options.to === undefined ? null : safe(shake(options.to, options.jitter));

  const env = (ctx as AudioContext).createGain();
  envelope(env, voice, options.gain, dur);
  env.connect(voice.out);

  ratios.forEach((ratio, index) => {
    const osc = (ctx as AudioContext).createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * ratio, voice.at);
    if (glide !== null) osc.frequency.exponentialRampToValueAtTime(glide * ratio, voice.at + dur);

    // 높은 배음일수록 먼저 사그라듭니다 — 실제 쇠가 그렇습니다
    const part = (ctx as AudioContext).createGain();
    const share = 1 / (index + 1);
    part.gain.setValueAtTime(Math.max(FLOOR, share), voice.at);
    part.gain.exponentialRampToValueAtTime(FLOOR, voice.at + dur * (1 - index * 0.18));

    osc.connect(part);
    part.connect(env);
    osc.start(voice.at);
    osc.stop(voice.at + dur + 0.02);
  });

  return voice;
}

/* ===========================================================================
 *  4. sweep — 스쳐 지나가는 소리. 무게가 없어야 합니다
 * ======================================================================== */

export function sweep(options: SweepOptions): Voice | null {
  const started = begin('sweep', options);
  if (!started) return null;
  const { voice, ctx, dur } = started;

  const source = noiseSource(ctx, voice, dur);

  const band = (ctx as AudioContext).createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = options.q ?? 3;
  band.frequency.setValueAtTime(safe(shake(options.from, options.jitter)), voice.at);
  band.frequency.exponentialRampToValueAtTime(safe(shake(options.to, options.jitter)), voice.at + dur);

  const env = (ctx as AudioContext).createGain();
  envelope(env, voice, options.gain, dur);

  source.connect(band);
  band.connect(env);
  env.connect(voice.out);
  return voice;
}
