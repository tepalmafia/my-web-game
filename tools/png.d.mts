/**
 *  `png.mjs` 에서 **시험이 쓰는 것만** 적습니다.
 *
 *  ★ 왜 이 파일이 있는가: `@types/node` 처럼 패키지를 들이지 않으려는 것과 같은
 *    이유입니다 (CLAUDE.md 5장). `tests/node-fs.d.ts` 와 한 짝입니다 —
 *    도구는 이미 도는데 **타입만 없어서**, 실제로 부르는 둘만 적습니다.
 *
 *  ★ `buf` 를 `unknown` 으로 둔 것은 `node:fs` 쪽 선언도 최소라 서로 맞물리게
 *    하려는 것입니다. png.mjs 안에서는 Buffer 로 다룹니다.
 */
export interface PngImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export declare function decodePNG(buf: unknown): PngImage;

export declare function opaqueBounds(
  img: PngImage,
  cut?: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null;
