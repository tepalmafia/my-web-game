/**
 *  시험이 파일을 읽으려고 쓰는 것 둘.
 *
 *  ★ 왜 `@types/node` 를 안 넣는가: **의존성 추가 금지** (CLAUDE.md 5장).
 *    시험이 실제로 도는 곳은 node 라 함수는 이미 있고 **타입만 없습니다.**
 *    그래서 쓰는 둘만 여기 적습니다 — 패키지 하나를 들이는 것보다 작습니다.
 *    `tools/png.mjs` 를 직접 짠 것과 같은 이유입니다.
 *
 *  ★ 이 파일에는 위쪽 import/export 가 없어야 합니다. 있으면 「모듈 보강」이 되어
 *    `node:fs` 가 이미 있어야 한다고 요구합니다.
 */
declare module 'node:fs' {
  /** PNG 머리에서 크기를 읽는 데만 씁니다 */
  export function readFileSync(path: string): { readUInt32BE(offset: number): number };
  export function existsSync(path: string): boolean;
}
