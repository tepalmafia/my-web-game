/**
 *  마을을 실제로 자라게 하는 곳.
 *
 *  ★ content/town.ts 는 표입니다. 이 파일이 그 표를 읽어 세계를 바꿉니다.
 *
 *  ★ 여기 있는 이유: 마을은 두 갈래로 자랍니다.
 *      갈림길이 있는 단계 — 화면에서 사람이 고른다 (core/commands.ts)
 *      갈림길이 없는 단계 — 조건이 차는 순간 저절로 오른다 (core/inventory.ts 의 판매)
 *    둘이 같은 일을 해야 하는데, commands 가 inventory 를 부르고 있어서
 *    inventory 가 commands 를 되부를 수 없습니다. 그래서 둘 다 여기를 봅니다.
 */

import { itemDef } from '../content/items';
import { recipeDef } from '../content/recipes';
import { choiceById, nextStage, stageReady } from '../content/town';
import { log, toast } from './feedback';
import type { World } from '../types';

/**
 *  단계를 하나 올립니다. 부르기 전에 조건이 찼는지 확인하는 것은 부르는 쪽 몫입니다.
 *
 *  choiceId 가 null 이면 갈림길 없는 단계입니다 — 고를 것이 없으니 그냥 오릅니다.
 */
export function advanceTown(world: World, choiceId: string | null): void {
  const town = world.me.town;
  const stage = nextStage(town);
  if (!stage) return;

  //  ★ 장부를 정리합니다. sold 는 깎지 않습니다 —
  //    그것은 이 인물이 판 것의 기록이고, 나중에 기록 축이 여기 앉습니다.
  //
  //  ① 이 단계가 요구한 물건 — 요구한 만큼만 먹습니다.
  //     40 이 필요한데 45 를 팔았다면 5 는 다음 단계로 넘어가고, 화면에 바로 보입니다.
  //     눈에 보이는 막대를 넘겨서 판 몫이니 가져가는 것이 맞습니다.
  //
  //  ② 아무도 요구하지 않은 물건 — 여기서 전부 얼립니다.
  //     ★ 이게 없으면 예전에 판 것이 다음 단계를 미리 채워둡니다.
  //       실제로 그랬습니다 — 구릿돌을 두 시간 팔다가 단계를 올린 그 순간
  //       다음 단계가 이미 25/25 로 차 있었고, 플레이어는 그것이 차오르는 것을
  //       한 번도 못 봤습니다. 안 보이는 곳에서 차는 막대는 선택이 아닙니다.
  const asked = new Set(stage.needs.map((n) => n.defId));
  for (const defId of Object.keys(town.sold)) {
    if (asked.has(defId)) continue;
    town.spent[defId] = town.sold[defId] ?? 0;
  }
  for (const need of stage.needs) {
    town.spent[need.defId] = (town.spent[need.defId] ?? 0) + need.count;
  }

  //  ★ chosen 의 길이가 곧 단계입니다. 고를 것이 없는 단계도 한 칸을 채워야
  //    다음 단계로 넘어갑니다. 그래서 단계 이름을 그대로 넣습니다.
  town.chosen.push(choiceId ?? stage.id);

  const chosen = choiceId ? choiceById(choiceId) : null;
  toast(world, stage.name, 'epic');
  log(
    world,
    chosen ? `마을이 자랐습니다 — ${stage.name}: ${chosen.name}` : `마을이 자랐습니다 — ${stage.name}`,
    'epic',
  );
  for (const id of [...(chosen?.recipes ?? []), ...stage.opens.recipes]) {
    log(world, `이제 ${recipeDef(id).name}을(를) 만들 수 있습니다`, 'good');
  }
  for (const id of stage.opens.stock) {
    log(world, `상인이 ${itemDef(id).name}을(를) 들여놓았습니다`, 'good');
  }
}

/**
 *  판 것 때문에 마을이 자랄 때가 됐는지 봅니다. 판매가 끝날 때마다 부릅니다.
 *
 *  ★ 갈림길이 없는 단계는 여기서 저절로 오릅니다 —
 *    "첫 번째는 고르는 게 아니라 겪는 것" 이기 때문입니다 (전체설계 3.2).
 *  ★ 갈림길이 있는 단계는 두린이 부르기만 합니다. 고르는 것은 사람이 합니다.
 */
export function townDidGrow(world: World): void {
  const town = world.me.town;
  const stage = nextStage(town);
  if (!stage || !stageReady(town)) return;

  if (stage.choices === null) {
    advanceTown(world, null);
    return;
  }
  toast(world, `대장장이 두린이\n부른다`, 'epic');
  log(world, `두린이 할 말이 있다고 합니다 — 대장간으로 가보세요`, 'epic');
}

