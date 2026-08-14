/**
 * ===========================================================================
 *  씨앗 난수 — 같은 씨앗이면 언제나 똑같은 판
 * ===========================================================================
 *
 *  이 게임의 주사위는 전부 여기를 거칩니다.
 *
 *  왜 Math.random() 을 쓰지 않는가:
 *    Math.random() 은 돌릴 때마다 결과가 달라서, "이 밸런스가 정말 재밌나"를
 *    확인하려고 같은 판을 두 번 돌려볼 수가 없습니다.
 *    여기 있는 함수들은 '씨앗(seed)'이라는 숫자를 받아서
 *    같은 씨앗이면 언제나 같은 값을 돌려줍니다.
 *    → 씨앗 하나만 적어두면 그 판이 통째로 재현됩니다. (사건 순서까지 똑같이)
 *
 *  쓰는 법 (중요):
 *    주사위를 굴리면 '값'과 '다음 씨앗'이 함께 나옵니다.
 *    다음에 굴릴 때는 반드시 그 '다음 씨앗'을 넣어야 합니다.
 *    같은 씨앗을 두 번 넣으면 같은 값이 두 번 나옵니다.
 *
 *        const a = nextRandom(state.rngSeed);   // a.value 를 씀
 *        const b = nextRandom(a.seed);          // ← a.seed 를 넘겨야 함
 *        // 마지막에 b.seed 를 게임 상태에 다시 저장
 *
 *  ※ 이 파일에는 게임 규칙이 하나도 없습니다. 순수한 숫자 도구입니다.
 */

/**
 * 알고리즘(mulberry32)이 쓰는 두 개의 고정 숫자입니다.
 * 밸런스 값이 아니라 '이 계산법 자체가 그렇게 생겼다'에 해당하는 값이라
 * balance.ts 가 아니라 여기에 둡니다. 절대 건드리지 마세요.
 */
const SEED_STEP = 0x6d2b79f5;
/** 32비트 정수의 개수(2의 32제곱). 결과를 0~1 사이로 옮기는 데 씁니다 */
const UINT32_RANGE = 4294967296;

/**
 * 주사위를 한 번 굴립니다.
 *
 * 돌려주는 값
 *   value : 0 이상 1 미만의 숫자 (0.0 ~ 0.999…)
 *   seed  : 다음번에 굴릴 때 넣어야 하는 씨앗
 *
 * 같은 씨앗을 넣으면 몇 번을 굴려도 언제나 똑같은 결과가 나옵니다.
 */
export function nextRandom(seed: number): { value: number; seed: number } {
  // 씨앗을 한 칸 옮깁니다. `| 0` 은 결과를 32비트 정수로 잘라 어느 컴퓨터에서든
  // 똑같이 계산되게 만드는 장치입니다.
  const moved = (seed + SEED_STEP) | 0;

  // 아래 세 줄이 실제로 숫자를 뒤섞는 부분입니다.
  // 사람이 눈으로 읽어서 이해할 수 있는 종류의 계산이 아니며,
  // 널리 검증된 mulberry32 공식을 그대로 옮겨 적은 것입니다.
  let mixed = moved;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;

  return { value, seed: moved };
}

/**
 * 정해진 범위 안에서 숫자 하나를 뽑습니다. (min 이상 max 미만 근처)
 *
 * 예) randomRange(seed, 90, 150) → 다음 사건까지 90~150초 사이의 시간
 * 예) randomRange(seed, -0.03, 0.03) → 경쟁사 추정치를 흔드는 오차
 *
 * min 과 max 를 거꾸로 넣어도 알아서 바로잡습니다.
 */
export function randomRange(
  seed: number,
  min: number,
  max: number,
): { value: number; seed: number } {
  const rolled = nextRandom(seed);
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return { value: low + (high - low) * rolled.value, seed: rolled.seed };
}

/**
 * 목록에서 무작위로 하나를 고를 때 쓰는 '몇 번째'를 뽑습니다.
 *
 * length 가 5면 0,1,2,3,4 중 하나가 나옵니다.
 * 고를 것이 하나도 없으면(length 가 0 이하) index 로 -1 을 돌려주고
 * 씨앗도 그대로 둡니다. → 부르는 쪽에서 "고를 게 없었다"를 알 수 있습니다.
 */
export function pickIndex(seed: number, length: number): { index: number; seed: number } {
  if (length <= 0) return { index: -1, seed };

  const rolled = nextRandom(seed);
  // value 가 1 에 아주 가까울 때 목록 밖을 가리키지 않도록 마지막 칸으로 묶어둡니다
  const index = Math.min(length - 1, Math.floor(rolled.value * length));
  return { index, seed: rolled.seed };
}
