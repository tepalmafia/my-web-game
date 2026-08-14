/**
 * ===========================================================================
 *  승패 경계 — 게임이 끝났는지 판정
 * ===========================================================================
 *
 *  진행도와 자금이 '넘으면 끝나는 선'에 닿았는지만 봅니다.
 *  여기서 실제로 게임을 끝내지는 않습니다. 끝났다는 사실만 알려주고,
 *  화면을 바꾸는 일은 state 폴더가 합니다.
 */

import { RESEARCH } from '../balance';
import type { GameOutcome, GameState, RivalId } from '../types';

/**
 * 지금 게임이 끝났는지, 끝났다면 어떤 이유인지.
 * 끝나지 않았으면 null 을 돌려줍니다.
 *
 * 판정 순서(먼저 걸리는 쪽이 이깁니다):
 *   ① 내 진행도가 목표에 도달   → agiAchieved (승리)
 *   ② 경쟁사가 목표에 도달      → rivalWon   (가장 앞선 곳이 승자)
 *   ③ 자금이 0 밑으로 내려감    → bankrupt   (파산)
 *
 * 같은 순간에 나와 경쟁사가 함께 도달하면 내가 이깁니다(①이 먼저라서).
 * 사고(catastrophe)는 무작위라 여기서 판정하지 않습니다 — state 폴더 담당입니다.
 */
export function checkOutcome(state: GameState): { outcome: GameOutcome; rivalId: RivalId | null } | null {
  // ① 내가 먼저 도달했는가
  if (state.player.researchProgress >= RESEARCH.goal) {
    return { outcome: 'agiAchieved', rivalId: null };
  }

  // ② 목표에 도달한 경쟁사가 있는가 (탈락한 곳은 이길 수 없으므로 제외)
  let winner: { id: RivalId; progress: number } | null = null;
  for (const rival of state.rivals) {
    if (rival.status === 'collapsed') continue;
    if (rival.researchProgress < RESEARCH.goal) continue;
    if (winner === null || rival.researchProgress > winner.progress) {
      winner = { id: rival.id, progress: rival.researchProgress };
    }
  }
  if (winner !== null) {
    return { outcome: 'rivalWon', rivalId: winner.id };
  }

  // ③ 통장이 마이너스가 되었는가
  if (state.player.money < 0) {
    return { outcome: 'bankrupt', rivalId: null };
  }

  // ④ 자기개선하는 모델을 놓쳤는가 (후반 단계에서만 일어납니다)
  //   승리 판정보다 뒤에 두는 이유: 통제력이 0이 되는 그 순간 목표에도 닿았다면
  //   아슬아슬하게 성공한 것으로 봐 줍니다.
  if (state.player.control <= 0) {
    return { outcome: 'controlLost', rivalId: null };
  }

  return null;
}
