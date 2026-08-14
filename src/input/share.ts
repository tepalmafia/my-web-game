/**
 * ===========================================================================
 *  결과 자랑 문구 — 한 판을 한 덩어리 글로
 * ===========================================================================
 *
 *  링크를 받아서 해본 사람이 다시 남에게 퍼뜨리게 만드는 장치입니다.
 *  붙여넣기만 하면 되는 완성된 글이어야 하므로, "몇 분에 이겼는지"와
 *  "어디서 할 수 있는지"가 한 덩어리로 들어 있어야 합니다.
 *
 *  화면 파일이 아니라 여기 있는 이유:
 *  이 파일에는 화면 요소가 하나도 없습니다. 상태를 받아 글자를 돌려주는 계산일 뿐이라
 *  브라우저 없이도 그대로 확인할 수 있어야 합니다. (실제로 화면 안에 두었을 때는
 *  검사 도구가 TSX 를 못 읽어서 눈으로 볼 방법이 없었습니다)
 */

import { rivalDisplayProgress } from '../constraints';
import { rivalName, s } from '../i18n';
import type { GameState } from '../types';
import { formatCompact, formatDuration, formatPercent } from './format';

/**
 * 나와 가장 앞선 경쟁사의 격차 한 줄.
 *
 * '이겼다'만으로는 아슬아슬한 승리와 압승이 똑같아 보입니다.
 * 자랑에도 재미가 없고, 나중에 어느 쪽이었는지 되짚을 수도 없습니다.
 *
 * 경쟁사 값은 결과 화면과 똑같이 화면용 추정치를 씁니다 —
 * 판이 끝난 뒤에도 내부 값은 내보내지 않는다는 규칙은 그대로 지킵니다.
 */
function marginLine(state: GameState): string | null {
  const best = state.rivals.reduce<{ name: string; progress: number } | null>((top, rival) => {
    const progress = rivalDisplayProgress(rival);
    return top === null || progress > top.progress ? { name: rivalName(rival), progress } : top;
  }, null);
  if (best === null) return null;

  const gap = state.player.researchProgress - best.progress;
  // 단위(%p / points)는 언어마다 다르므로 숫자만 넘기고 사전이 붙입니다
  const points = Math.abs(gap * 100).toFixed(1);

  return gap >= 0
    ? s().share.marginAhead(best.name, points)
    : s().share.marginBehind(best.name, points);
}

/**
 * 자랑용 문구를 만듭니다.
 * 주소는 밖에서 넣어 줍니다 (배포 주소를 코드에 박아두면 주소가 바뀔 때
 * 조용히 틀린 링크를 뿌리게 됩니다).
 */
export function buildShareText(state: GameState, url: string): string {
  const outcome = state.outcome;
  const text = s().share;
  const headline = outcome === null ? text.inProgress : text.outcome[outcome];
  const win = outcome === 'agiAchieved';

  const lines = [
    text.headline(headline),
    text.line2(
      state.player.labName,
      formatDuration(state.elapsed),
      formatPercent(state.player.researchProgress),
    ),
    text.line3(
      formatCompact(state.player.gpus),
      formatCompact(state.player.researchers),
      formatPercent(state.player.equityRetained),
    ),
  ];

  const margin = marginLine(state);
  if (margin !== null) lines.push(margin);

  // 진 사람은 도발을, 이긴 사람은 기록 경신을 부추깁니다
  lines.push(win ? text.tauntWin : text.tauntLose);
  lines.push(url);

  return lines.join('\n');
}
