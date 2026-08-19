/**
 *  의뢰.
 *
 *  혼자 하는 게임에서 "다음에 어디로 가야 하는가"를 알려주는 유일한 장치라,
 *  조건을 채웠는데 안 끝나거나 보상이 안 들어오면 길을 잃습니다.
 */

import { describe, expect, it } from 'vitest';

import { QUESTS } from '../../src/rpg/content/quests';
import { createWorld } from '../../src/rpg/core/create';
import { countOf } from '../../src/rpg/core/inventory';
import { currentQuest, recordKill } from '../../src/rpg/core/quests';

describe('진행', () => {
  it('처음에는 첫 의뢰를 들고 시작한다', () => {
    const world = createWorld('시험', 'knight');
    expect(world.player.questIndex).toBe(0);
    expect(currentQuest(world)!.id).toBe(QUESTS[0]!.id);
  });

  it('맞는 몬스터를 잡을 때만 세어진다', () => {
    const world = createWorld('시험', 'knight');
    const quest = currentQuest(world)!;

    recordKill(world, quest.monsterId);
    recordKill(world, 'goblin');

    expect(world.player.questKills).toBe(1);
    expect(world.player.kills.goblin).toBe(1); // 도감에는 남습니다
  });

  it('마릿수를 채우면 그 자리에서 끝나고 다음 의뢰로 넘어간다', () => {
    const world = createWorld('시험', 'knight');
    const quest = currentQuest(world)!;
    const goldBefore = world.player.gold;

    for (let i = 0; i < quest.count; i++) recordKill(world, quest.monsterId);

    expect(world.player.questIndex).toBe(1);
    expect(world.player.questKills, '다음 의뢰의 진행도가 초기화되지 않았습니다').toBe(0);
    expect(world.player.gold).toBe(goldBefore + quest.rewardGold);
    expect(world.player.exp + world.player.level).toBeGreaterThan(1);

    for (const reward of quest.rewardItems) {
      expect(countOf(world.player, reward.defId)).toBeGreaterThanOrEqual(reward.count);
    }
  });

  it('더 잡아도 다음 의뢰가 저절로 끝나지는 않는다', () => {
    const world = createWorld('시험', 'knight');
    const quest = currentQuest(world)!;

    for (let i = 0; i < quest.count + 5; i++) recordKill(world, quest.monsterId);

    expect(world.player.questIndex).toBe(1);
    expect(world.player.questKills).toBe(0);
  });

  it('전부 끝내면 더 이상 진행할 의뢰가 없다', () => {
    const world = createWorld('시험', 'knight');
    world.player.questIndex = QUESTS.length;

    expect(currentQuest(world)).toBeNull();
    expect(() => recordKill(world, 'rat')).not.toThrow();
  });
});
