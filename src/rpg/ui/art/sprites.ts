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

  //  ★ 몬스터는 모양 단위로 겁니다. 들개·늑대·얼어붙은 것 셋이 이 한 장을 씁니다
  //    — 색과 크기는 코드가 입힙니다 (actors.ts 의 shades 와 def.size).
  'shape/beast': 'monster-beast.png',
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
  for (const key of keys) {
    const file = SPRITES[key];
    if (!file) continue;

    const found = loaded.get(key);
    if (found) return found.complete && found.naturalWidth > 0 ? found : null;

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
 *  발밑을 맞춰 그립니다.
 *
 *  @param footY  이 물건이 땅에 닿는 y (그림의 아래 끝이 여기 옵니다)
 *  @param width  화면에서 차지할 가로 크기. 세로는 그림 비율대로 따라옵니다.
 *
 *  ★ 가로만 정하고 세로를 비율로 두는 이유: 그림마다 비율이 다른데 둘 다 박으면
 *    그림을 바꿀 때마다 코드를 고쳐야 합니다.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  footY: number,
  width: number,
): void {
  const height = (img.naturalHeight / img.naturalWidth) * width;
  ctx.drawImage(img, cx - width / 2, footY - height, width, height);
}
