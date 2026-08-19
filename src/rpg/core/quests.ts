/**
 *  퀘스트 진행.
 *
 *  한 번에 하나씩만 진행되고, 조건을 채우면 그 자리에서 자동으로 끝납니다.
 *  마을로 돌아와 보고할 필요가 없습니다 — 사냥의 흐름을 끊고 싶지 않아서입니다.
 */

import { QUESTS } from '../content/quests';
import { itemDef } from '../content/items';
import { addItem } from './inventory';
import { log, toast, vfx } from './feedback';
import { gainExp } from './progression';
import type { QuestDef, World } from '../types';

/** 지금 진행 중인 퀘스트 (전부 끝냈으면 없음) */
export function currentQuest(world: World): QuestDef | null {
  return QUESTS[world.player.questIndex] ?? null;
}

/** 몬스터 한 마리를 잡았을 때 호출합니다 */
export function recordKill(world: World, monsterId: string): void {
  const player = world.player;
  player.kills[monsterId] = (player.kills[monsterId] ?? 0) + 1;

  const quest = currentQuest(world);
  if (!quest || quest.monsterId !== monsterId) return;

  player.questKills += 1;
  if (player.questKills < quest.count) return;

  completeQuest(world, quest);
}

function completeQuest(world: World, quest: QuestDef): void {
  const player = world.player;

  player.gold += quest.rewardGold;
  for (const reward of quest.rewardItems) {
    addItem(world, reward.defId, reward.count);
  }

  log(world, `퀘스트 완료 — ${quest.name}`, 'epic');
  log(
    world,
    `보상: 경험치 ${quest.rewardExp.toLocaleString()}, ${quest.rewardGold.toLocaleString()} 골드` +
      quest.rewardItems.map((r) => `, ${itemDef(r.defId).name} ${r.count}개`).join(''),
    'good',
  );
  toast(world, `퀘스트 완료\n${quest.name}`, 'good');
  vfx(world, 'ring', player.pos, { life: 1.1, color: '#38bdf8', radius: 60 });

  gainExp(world, quest.rewardExp);

  player.questIndex += 1;
  player.questKills = 0;

  const next = currentQuest(world);
  if (next) log(world, `다음 — ${next.name}: ${next.desc}`, 'normal');
  else log(world, '모든 의뢰를 끝냈습니다. 이제는 강화와 사냥만 남았습니다.', 'epic');
}
