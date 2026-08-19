/** 화면에 숫자를 보기 좋게 찍는 도우미들 */

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('ko-KR');
}

/** 초 → 3:07 */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 초 → 1시간 23분 */
export function duration(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
