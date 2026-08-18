/**
 *  씨앗이 있는 난수.
 *
 *  같은 씨앗에서 시작하면 항상 같은 순서의 숫자가 나옵니다.
 *  지형을 만들 때 이걸 쓰기 때문에, 저장했다 다시 켜도 지도가 그대로입니다.
 */

/** 씨앗을 가진 무언가 (보통 World) */
export interface Seeded {
  seed: number;
}

/** 0 이상 1 미만의 다음 난수. 씨앗이 한 칸 앞으로 갑니다 */
export function nextRandom(s: Seeded): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** min 이상 max 이하의 실수 */
export function randRange(s: Seeded, min: number, max: number): number {
  return min + nextRandom(s) * (max - min);
}

/** min 이상 max 이하의 정수 */
export function randInt(s: Seeded, min: number, max: number): number {
  return Math.floor(min + nextRandom(s) * (max - min + 1));
}

/** p 의 확률로 true (p = 0.3 이면 30%) */
export function chance(s: Seeded, p: number): boolean {
  return nextRandom(s) < p;
}

/** 목록에서 하나 고르기 */
export function pick<T>(s: Seeded, list: readonly T[]): T {
  return list[Math.floor(nextRandom(s) * list.length)]!;
}

/**
 * 좌표 해시 — 씨앗과 (x, y) 만으로 0~1 사이 값을 만듭니다.
 * 순서에 상관없이 항상 같은 값이 나오므로 지형을 그릴 때 씁니다.
 */
export function hash2(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
