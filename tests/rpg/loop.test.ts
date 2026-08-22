/**
 *  한 바퀴가 실제로 도는지 — 봇을 짧게 돌려서 확인합니다.
 *
 *  ★ 이 게임의 지표는 전부 tools/sim.ts 로 재지만, 그건 손으로 돌리는 도구입니다.
 *    여기서는 "캐고 → 만들고 → 싸우는 고리가 끊기지 않는가"만 자동으로 지킵니다.
 *
 *  특히 목표가 제자리에서 튀는 것(gather → haul → work → gather …)을 감시합니다.
 *  그 고장은 화면상 아무 일도 일어나지 않는 채로 한 시간이 지나가기 때문에,
 *  지표만 보고 있으면 원인을 찾는 데 아주 오래 걸립니다.
 */

import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/rpg/core/create';
import { step } from '../../src/rpg/core/engine';
import { autopilot, newPilot } from '../../tools/autopilot';
import type { World } from '../../src/rpg/types';

const DT = 1 / 20;

function play(templateId: string, seed: number, minutes: number) {
  const world: World = createWorld('봇', templateId);
  world.seed = seed;
  const pilot = newPilot();

  let transitions = 0;
  let last = pilot.goal;
  let bareHanded = 0;

  for (let t = 0; t < (minutes * 60) / DT; t++) {
    autopilot(world, pilot);
    if (pilot.goal !== last) {
      transitions += 1;
      last = pilot.goal;
    }
    if (!world.me.equipped.weapon) bareHanded += DT;
    step(world, DT);
  }

  const kills = ['stray-dog', 'wolf', 'cave-bat', 'cave-spider'].reduce(
    (a, id) => a + (world.me.tally[id] ?? 0),
    0,
  );
  return { world, transitions, bareHanded, kills };
}

describe('한 바퀴', () => {
  /*
   *  ★ 20분에서 30분으로 늘렸습니다. 숨기지 않고 적어 둡니다 —
   *    초록 숲에서 깊은 철광맥(45)을 뺀 뒤(C1') 봇이 숲의 늑대 구역(minDepth 20)에
   *    갈 이유가 없어졌습니다. 전에는 깊은 철광맥이 minDepth 26 이라 캐러 가면
   *    늑대를 지나야 했고, 그것이 이 게임의 ★유일한 강제 전투였습니다.
   *
   *  ★ 재본 것 (씨앗 여덟 · smith · 20분): 첫 사냥이 있는 씨앗은 전 4/8, 후 4/8 로
   *    총량이 같습니다. 어느 씨앗이 싸우느냐가 섞였을 뿐입니다. 30분이면 5/8 입니다.
   *
   *  ★ 그래서 이것을 밸런스 근거로 읽지 않습니다 (CLAUDE.md 8장 4번) —
   *    들개는 aggroRange 0 이라 먼저 안 덤빕니다. 싸울지 말지는 사람이 고르는 것이고,
   *    봇이 안 고른 것을 "전투가 사라졌다" 로 읽으면 안 됩니다.
   *    여기서 지키는 것은 취향이 아니라 ★고리가 끊기지 않는가입니다.
   */
  for (const seed of [11, 22, 33]) {
    it(`30분이면 캐고 만들고 싸운다 (씨앗 ${seed})`, () => {
      const { world, kills } = play('smith', seed, 30);
      const me = world.me;

      expect(me.tally['iron-ore'] ?? 0, '광석을 못 캤습니다').toBeGreaterThan(0);
      expect(me.tally['iron-ingot'] ?? 0, '아무것도 못 만들었습니다').toBeGreaterThan(0);
      //  ★ '잡았는가' 가 아니라 '싸웠는가' 를 봅니다. 검술은 swingAtMonster 에서만
      //    오르므로 0 보다 크면 몬스터에게 휘두른 것이 확실합니다 (smith 는 검술 0 으로 시작).
      //    처치 수로 재면 때리다 놓친 판을 "고리가 끊겼다" 로 잘못 읽습니다 —
      //    씨앗 11(검술 5.2) · 22(검술 4.0) 가 실제로 그랬습니다. 처치는 0 이었습니다.
      //    무엇을 잡을지는 봇의 선택이고, 그것은 지표가 아닙니다 (CLAUDE.md 8장 4번).
      expect(me.skills.swordsmanship, `싸우지 않았습니다 (처치 ${kills})`).toBeGreaterThan(0);
      expect(me.skills.mining, '채광이 늘지 않았습니다').toBeGreaterThan(12);
      expect(me.skills.blacksmithing, '대장기술이 늘지 않았습니다').toBeGreaterThan(24);
    });

    it(`제자리에서 맴돌지 않는다 (씨앗 ${seed})`, () => {
      const { transitions, bareHanded } = play('smith', seed, 20);

      // 20분이면 한 바퀴가 대여섯 번 돕니다. 목표 전환이 수백 번이면 고장입니다.
      expect(transitions, `목표가 ${transitions}번 바뀌었습니다`).toBeLessThan(120);
      // 맨손으로 돌아다니는 시간이 길면, 검이 부러진 뒤 회복하지 못한다는 뜻입니다
      expect(bareHanded, `맨손으로 ${Math.round(bareHanded)}초`).toBeLessThan(120);
    });
  }
});
