/**
 *  그림 파일 — 도형 대신 그리는 것.
 *
 *  ★ 이 파일이 지키는 것은 하나입니다. **없으면 조용히 사라지지 않는다.**
 *    `drawImage` 에 아직 안 받아진 이미지를 넣으면 브라우저는 **예외도 로그도 없이
 *    아무것도 안 그립니다.** 그래서 화면이 텅 비는데 콘솔은 깨끗합니다 —
 *    이 저장소가 제일 싫어하는 종류의 실패입니다 (CLAUDE.md 6장).
 *    그것을 막으려고 `spriteFor()` 는 **정말 그릴 수 있을 때만** 그림을 돌려주고,
 *    아니면 null 을 돌려줘서 부르는 쪽이 도형으로 떨어지게 합니다.
 *
 *  ★ 그림에 그림자를 굽지 않습니다. 그림자는 코드가 그립니다 (terrain.ts 의
 *    drawProp, actors.ts 의 drawShadow). 구우면 그림자가 둘이 되고 방향이 어긋납니다.
 *
 *  ★ 빛은 언제나 왼쪽 위입니다 (palette.ts 의 LIGHT). 그림도 그래야 합니다.
 *
 *  ★ 앵커는 **발밑**입니다. 그림의 아래 끝이 그 물건이 땅에 닿는 자리입니다.
 *    장애물의 접지선은 타일 위에서 0.72 지점입니다 (draw.ts 의 깊이 정렬과 같은 값).
 */

/** 그림이 놓이는 곳 — vite 의 base 를 타므로 GitHub Pages 에서도 맞습니다 */
const ROOT = `${import.meta.env.BASE_URL}props/`;

/**
 *  무엇을 어느 파일로 그리는가.
 *
 *  ★ 여기에 없는 키는 그냥 도형으로 그립니다. 그래서 **한 장씩 켜고 끌 수 있습니다** —
 *    파일을 넣으면 켜지고, 줄을 지우거나 파일을 빼면 도형으로 돌아갑니다.
 *  ★ 프롭은 지역마다 다른 그림을 씁니다. `theme/kind` 가 없으면 `kind` 를 찾고,
 *    그것도 없으면 도형입니다.
 */
export const SPRITES: Record<string, string> = {
  //  여기에 줄을 넣는 순간 그 물건이 그림으로 바뀝니다. 비어 있으면 전부 도형입니다.
  //  파일 이름과 키는 public/props/README.md 에 적혀 있습니다.
  //
  //  ★ 지금 켜둔 것은 셋뿐입니다. 나머지(덤불·소나무·첨탑·갱목 등)는 일부러
  //    도형으로 둡니다 — 그림과 도형이 한 화면에 같이 섰을 때 어떻게 보이는지가
  //    지금 판단해야 하는 것이기 때문입니다 (docs/그림-작업.md 4장).
  //
  //  ★ 테마를 안 붙인 맨 키('tree')로 넣습니다. 그러면 마을·숲·강가·광산
  //    어디서 나오든 같은 그림이 걸립니다. 지역마다 다른 그림은 나중에
  //    'forest/tree' 처럼 앞에 테마를 붙여 덮어씁니다.
  tree: 'forest-tree.png',
  rock: 'forest-rock.png',

  //  ★ 광산만 따로 겁니다. 'cave/rock' 이 'rock' 을 덮습니다.
  //    회색 바위를 보라 바닥(#3a3442)에 놓으면 혼자 다른 데서 온 것처럼 보였습니다
  //    — 띄워서 보고 안 값입니다. 광산 세 톤으로 다시 뽑은 한 장입니다.
  'cave/rock': 'cave-rock.png',

  //  ★ 몬스터는 모양 단위로 겁니다. 들개·늑대·얼어붙은 것 셋이 이 한 장을 씁니다
  //    — 색과 크기는 코드가 입힙니다 (아래 SPRITE_TONES 와 def.size).
  'shape/beast': 'monster-beast.png',
};

/**
 *  그림에 구워진 세 톤 — **코드가 다른 색으로 갈아끼우라고 적어두는 값입니다.**
 *
 *  ★ 왜 필요한가. 7종이 모양 3개에 얹혀 있어서, 색을 그림에 구우면
 *    모양마다 7장이 필요하고 몬스터가 늘 때마다 또 뽑아야 합니다.
 *    **색은 코드가 입혀야 그 구조가 성립합니다.**
 *
 *  ★ 값이 왜 이것인가. 그림을 뽑을 때 `color_image` 로 팔레트를 강제했고,
 *    넣은 것이 `shades('#7d8590')`(늑대) 셋이었습니다. 실제로 나온 그림도
 *    딱 그 셋 + 윤곽선 + 발톱 어둠, 모두 5색입니다. 세어서 확인한 값입니다.
 *
 *  ★ 여기 없는 색은 안 건드립니다 — **윤곽선(#1b1613)은 그대로 둡니다.**
 *    윤곽선까지 물들이면 짐승마다 테두리 색이 달라져 한 겹으로 맞춰둔 것이 풀립니다.
 */
export const SPRITE_TONES: Record<string, readonly [light: string, base: string, dark: string]> = {
  'shape/beast': ['#a4aab1', '#7d8590', '#494d54'],
};

/** 한 번 부르면 받아오기 시작하고, 준비되면 그때부터 그림을 돌려줍니다 */
const loaded = new Map<string, HTMLImageElement>();
const failed = new Set<string>();

/**
 *  못 받은 그림 목록. **비어 있어야 정상입니다.**
 *  표에 적어놓고 파일이 없으면 여기 쌓입니다 — 조용히 넘어가지 않게.
 */
export function spriteFailures(): string[] {
  return [...failed];
}

/**
 *  이 키의 그림. **지금 당장 그릴 수 있을 때만** 돌려주고, 아니면 null.
 *
 *  ★ `complete` 만 보면 안 됩니다. 404 도 complete 이 true 가 되는데
 *    `naturalWidth` 는 0 입니다. 그걸 그리면 아무것도 안 나옵니다.
 */
export function spriteFor(...keys: string[]): HTMLImageElement | null {
  return spriteEntry(...keys)?.img ?? null;
}

/**
 *  같은 것을 돌려주되 **어느 키가 맞았는지도** 알려줍니다.
 *
 *  ★ 왜 키가 필요한가. 색을 갈아끼울지 말지가 키에 달렸습니다 —
 *    `shape/beast`(여럿이 나눠 쓰는 그림)는 물들이고,
 *    `monster/<id>`(그 몬스터 전용 그림)는 이미 제 색이라 그대로 둡니다.
 */
export function spriteEntry(
  ...keys: string[]
): { img: HTMLImageElement; key: string } | null {
  for (const key of keys) {
    const file = SPRITES[key];
    if (!file) continue;

    const found = loaded.get(key);
    if (found) return found.complete && found.naturalWidth > 0 ? { img: found, key } : null;

    // 브라우저가 아니면(시험은 environment:'node') 언제나 도형입니다
    if (typeof Image === 'undefined') return null;

    const img = new Image();
    img.onerror = () => {
      if (failed.has(key)) return;
      failed.add(key);
      //  ★ 표에 있는데 파일이 없는 것은 조용히 넘길 일이 아닙니다.
      console.error(`그림을 못 찾았습니다: ${key} → ${ROOT}${file}`);
    };
    img.src = `${ROOT}${file}`;
    loaded.set(key, img);
    return null;
  }
  return null;
}

/**
 *  같은 그림을 다른 색으로. 한 번 만들고 캐시합니다.
 *
 *  ★ 왜 여기서 하는가. 7종이 모양 3개를 나눠 쓰는데 색을 그림에 구우면
 *    종류마다 그림이 필요합니다. 원본 팔레트가 `SPRITE_TONES` 에 적혀 있고
 *    그림이 그 색만 쓰므로, **칸마다 색을 1:1 로 갈아끼우면** 됩니다.
 *
 *  ★ 표에 없는 색은 안 건드립니다 — 윤곽선이 그대로 남습니다.
 *
 *  ★ 실패하면 원본을 돌려줍니다. 캔버스가 없는 곳(시험)에서도 화면이 비지 않게.
 */
/**
 *  색 문자열 → 0xrrggbb.
 *
 *  ★★ **두 가지 꼴이 다 들어옵니다.** palette.ts 의 `lighten`/`darken` 은
 *    '#rrggbb' 가 아니라 **'rgb(r,g,b)'** 를 돌려주고, `def.color` 만 '#rrggbb' 입니다.
 *
 *  ★ 안 가르면 어떻게 되나: rgb() 쪽이 `parseInt('gb(160,147,125)', 16)` → NaN 이 되고
 *    `(NaN >> 16) & 255` 는 0 이라 **짐승이 새까맣게 칠해집니다.**
 *    실제로 한 번 그렇게 나왔고 화면도 콘솔도 아무 말을 안 했습니다 (CLAUDE.md 6장).
 *    그래서 못 읽으면 **던집니다.** 조용히 검정으로 떨어지지 않게.
 */
export function packColor(color: string): number {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    if (Number.isNaN(n)) throw new Error(`색을 못 읽었습니다: ${color}`);
    return n;
  }
  const parts = color.match(/\d+/g);
  if (!parts || parts.length < 3) throw new Error(`색을 못 읽었습니다: ${color}`);
  return (Number(parts[0]) << 16) | (Number(parts[1]) << 8) | Number(parts[2]);
}

const tinted = new Map<string, CanvasImageSource>();

export function tintedSprite(
  img: HTMLImageElement,
  from: readonly [string, string, string],
  to: readonly [string, string, string],
): CanvasImageSource {
  const id = `${img.src}|${to.join(',')}`;
  const done = tinted.get(id);
  if (done) return done;

  //  브라우저가 아니면 그대로 씁니다 (시험은 environment:'node')
  if (typeof document === 'undefined') return img;

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  if (!c) return img;

  c.drawImage(img, 0, 0);
  const frame = c.getImageData(0, 0, canvas.width, canvas.height);
  const px = frame.data;

  const key = packColor;
  const map = new Map<number, [number, number, number]>();
  for (let i = 0; i < 3; i++) {
    const t = key(to[i]!);
    map.set(key(from[i]!), [(t >> 16) & 255, (t >> 8) & 255, t & 255]);
  }

  for (let i = 0; i < px.length; i += 4) {
    const hit = map.get((px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!);
    if (!hit) continue;
    px[i] = hit[0];
    px[i + 1] = hit[1];
    px[i + 2] = hit[2];
  }
  c.putImageData(frame, 0, 0);

  tinted.set(id, canvas);
  return canvas;
}

/**
 *  발밑을 맞춰 그립니다.
 *
 *  @param footY  이 물건이 땅에 닿는 y (그림의 아래 끝이 여기 옵니다)
 *  @param width  화면에서 차지할 가로 크기. 세로는 그림 비율대로 따라옵니다.
 *
 *  ★ 가로만 정하고 세로를 비율로 두는 이유: 그림마다 비율이 다른데 둘 다 박으면
 *    그림을 바꿀 때마다 코드를 고쳐야 합니다.
 *
 *  ★★ **화면 픽셀 격자에 맞춰 놓습니다.** view.ts 의 snapView 가 카메라를 맞춰놨는데
 *    여기서 다시 소수가 되면 헛일입니다. 실제로 재보니 그림의 62~68% 가
 *    반 칸 어긋난 자리에 떨어지고 있었습니다.
 *
 *    ★ 월드 좌표에서 반올림하면 안 됩니다. 월드 한 칸이 화면에서 몇 픽셀인지는
 *      `zoom × dpr` 이라 정수가 아닙니다 (1.70 · 2.11 · 2.75 …).
 *
 *    ★ snapView 의 step 을 그대로 못 씁니다. 여기에는 View 가 없고,
 *      **몬스터는 로컬 원점 자체가 소수**입니다 (actors.ts 가 translate(x, y) 를
 *      먼저 걸고 부릅니다). 로컬에서 반올림하면 그 소수는 그대로 남습니다.
 *      그래서 **현재 변환을 읽어 화면 픽셀 자리에서 맞추고 되돌립니다** —
 *      식은 snapView 와 같고(값 × step 을 반올림), step 을 변환에서 가져올 뿐입니다.
 *
 *    ★ 돌아간 변환에서는 안 맞춥니다. 쓰러지는 몬스터가 그렇고,
 *      기울어진 것을 격자에 맞추는 것은 뜻이 없습니다.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  cx: number,
  footY: number,
  width: number,
): void {
  const w = typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement
    ? img.naturalWidth : (img as HTMLCanvasElement).width;
  const h = typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement
    ? img.naturalHeight : (img as HTMLCanvasElement).height;
  const height = (h / w) * width;

  const left = cx - width / 2;
  const top = footY - height;

  const t = ctx.getTransform?.();
  //  b·c 가 0 이 아니면 돌아간 것입니다 (쓰러지는 몬스터)
  const straight = t && Math.abs(t.b) < 1e-6 && Math.abs(t.c) < 1e-6 && t.a !== 0 && t.d !== 0;
  if (straight) {
    //  로컬 → 화면 픽셀 → 반올림 → 로컬. 네 변을 다 맞춰야 폭도 정수가 됩니다
    const backX = (v: number) => (Math.round(t.a * v + t.e) - t.e) / t.a;
    const backY = (v: number) => (Math.round(t.d * v + t.f) - t.f) / t.d;
    const l = backX(left), r = backX(left + width);
    const tp = backY(top), b = backY(top + height);
    ctx.drawImage(img, l, tp, r - l, b - tp);
    return;
  }

  ctx.drawImage(img, left, top, width, height);
}
