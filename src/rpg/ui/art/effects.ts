/**
 * ===========================================================================
 *  화면에 잠깐 떴다 사라지는 것들
 * ===========================================================================
 *
 *  칼자국, 화살, 폭발, 떠오르는 숫자, 이름표, 바닥의 전리품, 마을 사람.
 *
 *  전투에서 플레이어가 실제로 읽는 정보는 대부분 여기 있습니다.
 *  그래서 예쁜 것보다 ★ 눈에 잘 띄는 것을 우선했습니다 —
 *  숫자에는 검은 테두리를 두르고, 치명타는 크고 노랗게, 내가 맞은 피해는 붉게.
 */

import { CRAFT, GATHER, TILE } from '../../balance';
import { itemDef } from '../../content/items';

/**
 *  바닥에 떨어진 물건의 색 — 종류만 구분되면 충분합니다.
 *
 *  ★ Record<string, …> 이 아니라 Record<ItemKind, …> 입니다.
 *    종류를 하나 늘리면 여기를 채울 때까지 컴파일이 통과하지 않습니다.
 */
export const ITEM_TINT: Record<ItemKind, string> = {
  weapon: '#c3cbd6',
  armor: '#9aa6b4',
  helmet: '#9aa6b4',
  tool: '#c9a227',
  resource: '#a08a6a',
  potion: '#c2352f',
};
import { monsterDef } from '../../content/monsters';
import { veinDef } from '../../content/veins';
import { stageOf } from '../../content/town';
import { nearForge } from '../../core/action';
import { displayName } from '../../core/titles';
import { tileCenter } from '../../core/world';
import type { GroundItem, ItemKind, Monster, Npc, NpcKind, Seconds, Vein, World } from '../../types';
import { LIGHT, alpha, darken, lighten } from './palette';
import { drawShadow } from './actors';
import { drawSprite, spriteFor } from './sprites';

/* ------------------------------------------------------------------ 글자 */

/**
 *  이름표를 그리지 않을 자리 (월드 좌표).
 *
 *  ★ 작은 지도는 화면 좌표에, 이름표는 월드 좌표에 그려집니다. 지도가 나중에 그려지므로
 *    그 밑에 깔린 이름표는 반쯤 지워진 글자로 남았습니다 — 읽을 수도 없고 지저분합니다.
 *    지도를 반투명하게 하면 지도까지 읽기 어려워지므로, ★ 가려질 이름표를 아예 접습니다.
 *    한 걸음만 걸으면 다시 나옵니다.
 *
 *  draw() 가 매 프레임 한 번 정해 주고, 이 파일의 모든 이름표가 그것을 따릅니다.
 */
export interface Box { x0: number; y0: number; x1: number; y1: number }

let blockout: Box | null = null;

export function setLabelBlockout(box: Box | null): void {
  blockout = box;
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 11,
  weight = 700,
): void {
  if (blockout) {
    // 글자는 x 를 가운데로 놓고 그려집니다. 한글은 글자당 폭이 크기와 거의 같습니다.
    const halfWidth = (text.length * size) / 2;
    // 글자가 차지하는 네모와 가림 상자가 겹치면 접습니다
    const overlaps =
      x + halfWidth > blockout.x0 &&
      x - halfWidth < blockout.x1 &&
      y + size * 0.3 > blockout.y0 &&
      y - size < blockout.y1;
    if (overlaps) return;
  }

  ctx.save();
  ctx.font = `${weight} ${size}px "Gothic A1", ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(4,3,2,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* --------------------------------------------------------------- 사거리 원 */

/**
 *  "여기 안에 서야 된다" 는 거리를 바닥에 그립니다.
 *
 *  ★ core/ 가 재는 바로 그 거리를 그대로 받습니다 (화로는 CRAFT.reach, 광맥은 GATHER.reach).
 *    여기서 따로 계산하지 않습니다 — 계산하는 순간 규칙과 그림이 갈라집니다.
 *    안에 들어가면 원이 밝아지고 속이 옅게 찹니다.
 */
export function reachRing(
  ctx: CanvasRenderingContext2D,
  world: World,
  x: number,
  y: number,
  radius: number,
  inside: boolean,
  color: string,
): void {
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.lineDashOffset = -world.time * 9;
  ctx.lineWidth = inside ? 2 : 1.2;
  ctx.strokeStyle = inside ? alpha(lighten(color, 0.3), 0.85) : alpha(color, 0.3);
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.58, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (inside) {
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

/* --------------------------------------------------------------- 체력 막대 */

function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  ratio: number,
  color: string,
): void {
  const height = 4.5;
  ctx.save();
  ctx.fillStyle = 'rgba(4,3,2,0.8)';
  ctx.fillRect(x - width / 2 - 1.5, y - 1.5, width + 3, height + 3);
  ctx.fillStyle = '#1b1512';
  ctx.fillRect(x - width / 2, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), height);
  ctx.fillStyle = alpha(lighten(color, 0.5), 0.6);
  ctx.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 1.4);
  ctx.restore();
}

/** 몬스터 머리 위의 이름표와 체력 — 다른 것에 가리지 않도록 맨 마지막에 그립니다 */
export function drawNameplates(ctx: CanvasRenderingContext2D, world: World): void {
  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    const def = monsterDef(monster.defId);
    const targeted = world.me.targetId === monster.id;
    const hurt = monster.hp < monster.maxHp;
    if (!hurt && !targeted) continue;

    const top = monster.pos.y - def.size - 11;
    bar(ctx, monster.pos.x, top, 34, monster.hp / monster.maxHp, '#c2352f');

    if (targeted) {
      label(ctx, def.name, monster.pos.x, top - 6, '#f5d9d0', 11);
    }
  }

  const me = world.me;
  //  ★ 칭호가 붙으면 이름표부터 달라집니다 — 세계가 알아본 것이 눈에 보이는 자리입니다
  const shown = displayName(me);
  label(
    ctx,
    me.dead ? `${shown} — 쓰러짐` : shown,
    me.pos.x,
    me.pos.y - 34,
    me.dead ? '#e88a86' : '#efe6d2',
  );
}

/* --------------------------------------------------------------- 위협 표시 */

/**
 *  이 몬스터가 먼저 덤비는 놈인가.
 *
 *  ★ 여기서 규칙을 만들지 않습니다. content/monsters.ts 의 aggroRange 를 그대로 읽습니다.
 *    0 이면 건드리지 않는 한 가만히 있는 놈(들개), 0 보다 크면 나를 보면 달려드는 놈(늑대·거미)입니다.
 *  ★ 숫자는 화면에 내지 않습니다. 사냥감인지 위험한 놈인지만 알면 됩니다.
 */
function hunts(monster: Monster): boolean {
  return monsterDef(monster.defId).aggroRange > 0;
}

/** 지금 나를 쫓고 있는가 */
function chasing(monster: Monster): boolean {
  return monster.state === 'chase' || monster.state === 'attack';
}

/** 이 거리 안의 몬스터에만 표시를 붙입니다 — 화면 가득 고리가 뜨면 아무것도 안 보입니다 */
const THREAT_RANGE = 300;

/**
 *  몬스터 발밑의 고리.
 *
 *  ★ 도망칠지 싸울지가 이 게임의 유일한 순간 판단인데, 그 판단에 필요한 것이 화면에 없었습니다.
 *    UI 는 다섯 가지 state 중 'dead' 하나만 보고 있었습니다.
 *
 *      옅은 청록 고리   — 먼저 덤비지 않습니다. 내가 고르면 사냥감입니다
 *      어두운 붉은 고리 — 먼저 덤빕니다. 아직 나를 못 봤습니다
 *      밝은 붉은 고리 + 두근거림 — ★ 지금 나를 쫓고 있습니다
 *
 *  몸통보다 먼저(=발밑에) 그립니다.
 */
export function drawThreatRings(ctx: CanvasRenderingContext2D, world: World): void {
  const me = world.me;

  for (const monster of world.monsters) {
    if (monster.state === 'dead') continue;
    if (Math.hypot(monster.pos.x - me.pos.x, monster.pos.y - me.pos.y) > THREAT_RANGE) continue;

    const def = monsterDef(monster.defId);
    const onMe = chasing(monster);
    const danger = hunts(monster);
    // 쫓아올 때만 두근거립니다 — 움직이는 것에 눈이 갑니다
    const pulse = onMe ? 0.5 + 0.5 * Math.sin(world.time * 5.5 + monster.id) : 0;
    const radius = def.size + 8 + pulse * 3;

    ctx.save();
    ctx.translate(monster.pos.x, monster.pos.y + def.size * 0.5);
    ctx.scale(1, 0.45);
    // ★ 색만으로 가르지 않습니다 — 폰에서 작게 보이고, 색을 못 가리는 사람도 있습니다.
    //   먼저 덤비는 놈은 끊긴 고리, 사냥감은 이어진 고리입니다.
    if (danger && !onMe) ctx.setLineDash([9, 7]);
    ctx.lineWidth = onMe ? 3.4 : 1.8;
    ctx.strokeStyle =
      onMe ? `rgba(255,${70 + pulse * 40},60,${0.75 + pulse * 0.25})`
      : danger ? 'rgba(214,66,56,0.6)'
      : 'rgba(126,196,178,0.34)';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (onMe) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.1 + pulse * 0.1;
      ctx.fillStyle = '#ff4a3c';
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 *  쫓고 있는 놈의 머리 위 느낌표와 이름.
 *
 *  ★ 폰 세로(0.85배)에서도 보여야 하므로 크게 그립니다 — 작은 표시는 안 보입니다.
 *  ★ 이름을 같이 띄웁니다. 무엇이 오는지(들개인지 늑대인지) 알아야 도망칠지 정할 수 있습니다.
 */
export function drawThreatMarks(ctx: CanvasRenderingContext2D, world: World): void {
  const me = world.me;

  for (const monster of world.monsters) {
    if (monster.state === 'dead' || !chasing(monster)) continue;
    if (Math.hypot(monster.pos.x - me.pos.x, monster.pos.y - me.pos.y) > THREAT_RANGE) continue;

    const def = monsterDef(monster.defId);
    const bob = Math.abs(Math.sin(world.time * 5.5 + monster.id)) * 3;
    const x = monster.pos.x;
    const y = monster.pos.y - def.size - 26 - bob;

    ctx.save();
    ctx.fillStyle = 'rgba(190,32,26,0.95)';
    ctx.strokeStyle = 'rgba(255,214,160,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 느낌표
    ctx.fillStyle = '#ffeacb';
    ctx.fillRect(x - 1.4, y - 5, 2.8, 6.2);
    ctx.beginPath();
    ctx.arc(x, y + 4, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    label(ctx, def.name, x, y - 15, '#ffb4ac', 12);
  }
}

/** 노리고 있는 대상 발밑의 표식 */
export function drawTargetMark(ctx: CanvasRenderingContext2D, world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);
  const spin = world.time * 1.4;
  const r = def.size + 9;

  ctx.save();
  ctx.translate(monster.pos.x, monster.pos.y + def.size * 0.55);
  ctx.scale(1, 0.45);
  ctx.rotate(spin);
  ctx.strokeStyle = alpha('#e0453f', 0.9);
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, r, (i * Math.PI) / 2 + 0.25, (i * Math.PI) / 2 + 1.05);
    ctx.stroke();
  }
  ctx.restore();
}

/* --------------------------------------------------------------- 바닥의 것 */

export function drawGroundItem(ctx: CanvasRenderingContext2D, world: World, item: GroundItem): void {
  const def = itemDef(item.defId);
  const color = ITEM_TINT[def.kind] ?? '#cbd5e1';
  const bob = Math.sin(world.time * 3.5 + item.id) * 2.2;
  // 사라지기 직전에는 깜빡입니다. 안 사라지는 것(놓아둔 것)은 깜빡이지 않습니다
  const left = item.until === null ? Infinity : item.until - world.time;
  const fading = left < 6 ? 0.35 + 0.45 * Math.abs(Math.sin(world.time * 7)) : 1;

  ctx.save();
  ctx.globalAlpha = fading;
  drawShadow(ctx, item.pos.x, item.pos.y + 5, 7, 0.3);

  if (def.kind === 'weapon' || def.kind === 'armor' || def.kind === 'potion') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fading * (0.2 + 0.12 * Math.sin(world.time * 4 + item.id));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(item.pos.x, item.pos.y - 2 + bob, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 보석 모양 — 왼쪽 위가 밝습니다
  const y = item.pos.y - 3 + bob;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(item.pos.x, y - 7);
  ctx.lineTo(item.pos.x + 5.5, y);
  ctx.lineTo(item.pos.x, y + 7);
  ctx.lineTo(item.pos.x - 5.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha('#ffffff', 0.6);
  ctx.beginPath();
  ctx.moveTo(item.pos.x, y - 7);
  ctx.lineTo(item.pos.x - 5.5, y);
  ctx.lineTo(item.pos.x - 1.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha(darken(color, 0.5), 0.7);
  ctx.beginPath();
  ctx.moveTo(item.pos.x, y + 7);
  ctx.lineTo(item.pos.x + 5.5, y);
  ctx.lineTo(item.pos.x + 1.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* --------------------------------------------------------------- 마을 사람 */

/** 마을 사람의 머리 위에 적는 역할 — 종류를 늘리면 컴파일이 막습니다 */
export const NPC_ROLE: Record<NpcKind, string> = {
  shop: '상점',
  smith: '대장간',
};

export function drawNpc(ctx: CanvasRenderingContext2D, world: World, npc: Npc): void {
  const x = tileCenter(npc.tx);
  const y = tileCenter(npc.ty);
  const bob = Math.sin(world.time * 1.8 + npc.tx) * 1.4;

  drawShadow(ctx, x, y + 11, 11);

  ctx.save();
  ctx.translate(x, y - bob);

  // 긴 옷
  ctx.fillStyle = npc.color;
  ctx.beginPath();
  ctx.moveTo(-7, -10);
  ctx.lineTo(7, -10);
  ctx.lineTo(9, 12);
  ctx.lineTo(-9, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha(lighten(npc.color, 0.35), 0.75);
  ctx.beginPath();
  ctx.moveTo(-7, -10);
  ctx.lineTo(-1, -10);
  ctx.lineTo(-3, 12);
  ctx.lineTo(-9, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha(darken(npc.color, 0.5), 0.7);
  ctx.fillRect(4, -10, 5, 22);

  ctx.fillStyle = '#3a2c20'; // 허리끈
  ctx.fillRect(-7.5, 0, 15, 2.5);

  ctx.fillStyle = '#e8b98c'; // 머리
  ctx.beginPath();
  ctx.arc(0, -16, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2c20';
  ctx.beginPath();
  ctx.arc(0, -17, 5.8, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2018';
  ctx.beginPath();
  ctx.arc(-2, -15.4, 0.8, 0, Math.PI * 2);
  ctx.arc(2, -15.4, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // 무엇을 하는 사람인지 머리 위로
  ctx.restore();

  const mark = 0.5 + 0.5 * Math.sin(world.time * 2.5 + npc.tx);
  ctx.save();
  ctx.globalAlpha = 0.75 + mark * 0.25;
  label(ctx, npc.name, x, y - 28, '#f2c14e', 11);
  label(ctx, NPC_ROLE[npc.kind] ?? '', x, y - 40, '#cbb99a', 10, 600);
  ctx.restore();
}

/* --------------------------------------------------------------- 지역의 문 */

/**
 *  닫힌 문.
 *
 *  ★ 보이기는 해야 합니다 — 숨기면 궁금할 수 없습니다 (전체설계 3.4).
 *    그래서 열린 문과 같은 자리에 같은 크기로 서 있되, 빛이 없습니다.
 *    파란 마법진 대신 돌문과 쇠빗장을 그립니다. 가까이 가야 할 것처럼 보이지만
 *    가면 안 열리는 것 — 그게 이 문이 하는 일의 전부입니다.
 */
export function drawSealedPortal(
  ctx: CanvasRenderingContext2D,
  world: World,
  tx: number,
  ty: number,
  text: string,
): void {
  const x = tileCenter(tx);
  const y = tileCenter(ty);
  const stone = '#4a453f';

  ctx.save();
  // 문틀 — 바닥에서 솟은 돌 아치
  ctx.fillStyle = darken(stone, 0.45);
  ctx.beginPath();
  ctx.moveTo(x - 17, y + 8);
  ctx.lineTo(x - 15, y - 20);
  ctx.arc(x, y - 20, 15, Math.PI, 0);
  ctx.lineTo(x + 17, y + 8);
  ctx.closePath();
  ctx.fill();

  // 문짝 — 안쪽은 더 어둡습니다
  ctx.fillStyle = '#221d19';
  ctx.beginPath();
  ctx.moveTo(x - 11, y + 7);
  ctx.lineTo(x - 10, y - 18);
  ctx.arc(x, y - 18, 10, Math.PI, 0);
  ctx.lineTo(x + 11, y + 7);
  ctx.closePath();
  ctx.fill();

  // 쇠빗장 둘 — 닫혀 있다는 것이 한눈에 읽혀야 합니다
  ctx.fillStyle = '#6b6259';
  for (const dy of [-12, -2]) {
    ctx.fillRect(x - 13, y + dy, 26, 3.5);
    ctx.fillStyle = lighten('#6b6259', 0.2);
    ctx.fillRect(x - 13, y + dy, 26, 1);
    ctx.fillStyle = '#6b6259';
  }
  // 빗장을 잠근 자물쇠
  ctx.fillStyle = '#8a7f70';
  ctx.fillRect(x - 3, y - 9, 6, 6);

  // 문틈으로 새는 아주 약한 냉기 — 뒤에 무언가 있다는 것만
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.06 + 0.04 * Math.sin(world.time * 1.1);
  ctx.fillStyle = '#7fa8c8';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  label(ctx, text, x, y - TILE * 1.1, '#9a8f82', 11);
}

/**
 *  쓰러진 자리에 두고 온 짐.
 *
 *  ★ 어디서 죽었는지 모르면 되찾을 수 없습니다. 그래서 둘 다 합니다 —
 *    ①물건 자체를 눈에 띄게 그리고, ②작은 지도에도 표시합니다(ui/draw.ts).
 *    바닥에 떨어진 전리품과 헷갈리면 안 되므로, 크게 그리고 이름을 답니다.
 *  ★ 사라질 때가 가까우면 깜빡입니다.
 */
export function drawCorpse(
  ctx: CanvasRenderingContext2D,
  world: World,
  x: number,
  y: number,
  left: Seconds,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(world.time * 2.2);
  const fading = left < 60 ? 0.4 + 0.6 * Math.abs(Math.sin(world.time * 5)) : 1;

  ctx.save();
  ctx.globalAlpha = fading;

  drawShadow(ctx, x, y + 7, 15);

  // 바닥에 번지는 빛 — 멀리서도 "저기 뭐가 있다" 가 보여야 합니다
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (0.16 + pulse * 0.16) * fading;
  ctx.fillStyle = '#e8b45c';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 22, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 묶어놓은 봇짐
  ctx.fillStyle = '#6b5335';
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6b44';
  ctx.beginPath();
  ctx.ellipse(x - 2, y - 4, 8, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 묶은 끈
  ctx.strokeStyle = '#3d2f1d';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - 11, y - 1);
  ctx.lineTo(x + 11, y - 1);
  ctx.stroke();
  // 삐져나온 자루
  ctx.strokeStyle = '#9a8058';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x + 6, y - 6);
  ctx.lineTo(x + 13, y - 14);
  ctx.stroke();

  ctx.restore();
  label(ctx, '내 짐', x, y - TILE * 0.72, '#f0c674', 11);
}

export function drawPortal(
  ctx: CanvasRenderingContext2D,
  world: World,
  tx: number,
  ty: number,
  text: string,
): void {
  const x = tileCenter(tx);
  const y = tileCenter(ty);
  const pulse = 0.5 + 0.5 * Math.sin(world.time * 2.4);

  ctx.save();
  // 바닥의 마법진
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.25 + pulse * 0.25;
  ctx.fillStyle = '#5eb8ff';
  ctx.beginPath();
  ctx.ellipse(x, y, TILE * 0.62, TILE * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = alpha('#a5dcff', 0.85);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y, TILE * (0.62 - i * 0.18), TILE * (0.34 - i * 0.1), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 솟아오르는 빛줄기
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const phase = (world.time * 0.7 + i * 0.2) % 1;
    ctx.globalAlpha = (1 - phase) * 0.5;
    ctx.fillStyle = '#7dd3fc';
    const px = x + Math.sin(i * 2.1 + world.time) * TILE * 0.4;
    ctx.fillRect(px, y - phase * 34, 2, 6);
  }
  ctx.restore();

  label(ctx, text, x, y - TILE * 0.85, '#cdeaff', 11);
}


/* --------------------------------------------------------------- 화로 */

/** 이 거리 안에 들어오면 이름표가 뜹니다 (광맥과 같은 규칙) */
const FORGE_LABEL_RANGE = 220;

/**
 *  화로.
 *
 *  ★ 광맥과 똑같은 문제가 여기에도 있었습니다 — 거리 판정(core/action.ts 의 nearForge)만
 *    있고 그리는 코드가 없어서, "화로 앞에 서야 만들 수 있습니다" 라는 안내를 읽어도
 *    어디로 가야 하는지 화면에 없었습니다.
 *
 *  숯불을 품은 돌 화덕으로 그립니다. 불빛은 화로 자신이 내므로, 다른 것들과 달리
 *  왼쪽 위가 아니라 ★ 아궁이 쪽이 가장 밝습니다.
 */
/**
 *  단계별 화로 크기.
 *
 *  ★ 상한이 있어야 합니다. 예전 식(1 + 단계 × 0.22)은 4단계면 1.88 배인데,
 *    굴뚝이 화로 중심에서 36px 위에서 시작하므로 68px 위 — 두 칸(64px) 위에 서 있는
 *    두린의 발끝을 4px 넘어섭니다. 굴뚝이 대장장이 다리를 뚫고 올라갑니다.
 *  ★ 0~2단계는 예전 값 그대로입니다. 이미 나가 있는 그림을 바꾸지 않으려고요.
 *    (검사: tests/rpg/art.test.ts — 36 × 최대배율 < 64)
 */
export const FORGE_GROWN = [1, 1.22, 1.44, 1.56, 1.66];

/**
 *  화로 그림 — **어느 것을 그릴지 여기 한 곳에서만 정합니다.**
 *
 *  ★★ **이 함수의 입력은 통째로 바뀝니다.** 지금은 마을 단계(`stageOf`)로 고르는데,
 *    마을 성장 사다리는 폐기 예정입니다 (전체설계 8.1 — 「마을 5단계 표는 폐기한다」).
 *    그래서 **마을 단계를 스프라이트 계약 안에 넣지 않았습니다** — 계약은 아래
 *    `ForgeLook` 이고, 단계는 그것을 고르는 이 함수 안에만 있습니다.
 *    사다리가 없어지면 이 함수의 몸만 갈아끼우면 되고, 부르는 쪽은 안 바뀝니다.
 *
 *  ★ 이것은 ③(세계가 변한다)을 구현하는 것이 아닙니다.
 *    나중에 ③을 시각으로 보여줄 **자리를 미리 만드는 것**입니다.
 */
interface ForgeLook {
  /** SPRITES 의 키. 없으면 도형으로 떨어집니다 */
  key: string;
  /** 아궁이 불이 있는 자리 — **그림에서 재서 넣은 값**입니다 (화로 원점 기준 월드 오프셋) */
  fire: { x: number; y: number };
  /** 굴뚝 꼭대기 — 불티가 나오는 자리 */
  chimney: { x: number; y: number };
}

/**
 *  도형으로 떨어졌을 때의 자리 — 아래 `drawForge` 가 그리는 도형의 실제 좌표입니다.
 *  그림이 빠져도 불과 불티가 엉뚱한 데서 나지 않게 하려고 따로 둡니다.
 */
const FORGE_SHAPE = { fire: { x: 0, y: 1 }, chimney: { x: 8, y: -36 } };

/**  불·굴뚝 자리는 상상하지 않고 파일에서 쟀습니다 (팔레트의 숯불색 픽셀 무게중심) */
const FORGE_SMALL: ForgeLook = {
  key: 'forge',
  //  ★ 굴뚝을 오른쪽으로 다시 뽑고 재잰 값입니다. 도형도 x+5 에 굴뚝이 있어서
  //    이제 그림과 도형이 같은 쪽입니다 — 빛이 왼쪽 위에서 오는데 굴뚝만
  //    반대편에 있으면 어색합니다.
  fire: { x: 2.1, y: 0.6 },
  chimney: { x: 5.3, y: -28.0 },
};
const FORGE_LARGE: ForgeLook = {
  key: 'forge-large',
  fire: { x: 0, y: -5.1 },
  chimney: { x: -0.2, y: -38.0 },
};

export function forgeLook(world: World): ForgeLook {
  //  ★ 여기가 바뀔 한 줄입니다. 지금은 「구리 대장간이 선 뒤」가 큰 화로입니다 —
  //    아래 모루가 하나 더 서는 조건(stage >= 2)과 같은 자리에 맞췄습니다.
  return stageOf(world.me.town) >= 2 ? FORGE_LARGE : FORGE_SMALL;
}

/**  그림은 월드 1px = 그림 3px 로 뽑습니다 (.claude/rules/sprites.md 4절) */
const FORGE_PX_PER_WORLD = 3;

/**  도형 화로의 몸통 폭 — 월드 32 (아래 도형이 x-16..+16 을 그립니다) */
const FORGE_SHAPE_WIDTH = 32;

export function drawForge(ctx: CanvasRenderingContext2D, world: World, tx: number, ty: number): void {
  const x = tileCenter(tx);
  const y = tileCenter(ty);
  // 숯불은 일정하게 타지 않습니다 — 느린 흔들림 두 개를 겹쳐 불규칙하게 보이게 합니다
  const glow = 0.55 + 0.28 * Math.sin(world.time * 2.7) + 0.17 * Math.sin(world.time * 6.1 + 1.3);

  //  ★ 마을이 자라면 화로도 자랍니다. 숫자로만 바뀌면 아무 일도 안 일어난 것과 같습니다.
  //
  //  ★ 다만 계속 곱하면 안 됩니다. 예전 식(1 + 단계 × 0.22)은 상한이 없어서
  //    4단계면 1.88 배가 되고, 굴뚝이 y-36 에서 시작하므로 68px 위 —
  //    두 칸 위(21,9)에 서 있는 두린을 뚫고 올라갑니다.
  //    그래서 3단계부터 걸음을 줄이고 1.66 에서 멈춥니다.
  //    0~2단계 값은 예전 그대로입니다 (이미 나가 있는 그림을 바꾸지 않으려고).
  const stage = stageOf(world.me.town);
  const grown = FORGE_GROWN[Math.min(stage, FORGE_GROWN.length - 1)]!;

  //  ★ 그림이 있으면 그림으로. 없으면 아래 도형이 그대로 나옵니다 (CLAUDE.md 5장).
  //  ★ 그리는 폭을 **파일에서 냅니다** — 숫자를 코드에 박으면 그림을 다시 뽑을 때
  //    조용히 어긋납니다. 월드 1px = 그림 3px 이므로 naturalWidth / 3 입니다.
  const look = forgeLook(world);
  const forgeImg = spriteFor(look.key);
  const bodyW = forgeImg ? forgeImg.naturalWidth / FORGE_PX_PER_WORLD : FORGE_SHAPE_WIDTH;
  //  불과 불티는 **실제로 그려진 것**의 자리를 따라갑니다. 도형으로 떨어지면 도형 자리로.
  const spot = forgeImg ? look : FORGE_SHAPE;

  //  그림자도 몸통 폭을 따릅니다 — 32 × 0.53 = 17 로 예전 값과 같습니다
  drawShadow(ctx, x, y + 9 * grown, bodyW * 0.53 * grown);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(grown, grown);
  ctx.translate(-x, -y);

  const stone = '#584f47';

  ctx.save();

  if (forgeImg) {
    //  ★ 발밑은 **그림의 아래 끝**입니다. 화로의 밑동이 y+9 에 닿습니다 —
    //    바로 위 drawShadow 가 쓰는 것과 같은 값입니다.
    drawSprite(ctx, forgeImg, x, y + 9, bodyW);
  } else {
    // 굴뚝 — 화덕보다 뒤에 있으므로 먼저
    ctx.fillStyle = darken(stone, 0.35);
    ctx.fillRect(x + 5, y - 34, 9, 18);
    ctx.fillStyle = darken(stone, 0.55);
    ctx.fillRect(x + 5, y - 36, 9, 3);

    // 화덕 몸통
    ctx.fillStyle = darken(stone, 0.2);
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 9);
    ctx.lineTo(x - 14, y - 16);
    ctx.lineTo(x + 14, y - 16);
    ctx.lineTo(x + 16, y + 9);
    ctx.closePath();
    ctx.fill();
    // 빛 받는 윗면
    ctx.fillStyle = lighten(stone, 0.16);
    ctx.beginPath();
    ctx.ellipse(x, y - 16, 14, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 돌 이음매 — 몇 줄이면 벽돌로 읽힙니다
    ctx.strokeStyle = alpha('#1b1613', 0.5);
    ctx.lineWidth = 1;
    for (const dy of [-8, 0]) {
      ctx.beginPath();
      ctx.moveTo(x - 15, y + dy);
      ctx.lineTo(x + 15, y + dy);
      ctx.stroke();
    }

    // 아궁이 — 안쪽이 뚫린 아치
    ctx.fillStyle = '#140d09';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 7);
    ctx.lineTo(x - 8, y - 5);
    ctx.arc(x, y - 5, 8, Math.PI, 0);
    ctx.lineTo(x + 8, y + 7);
    ctx.closePath();
    ctx.fill();
  }

  //  ★ 불은 **언제나 코드가 그립니다.** 그림에 구우면 안 흔들립니다 —
  //    아궁이는 이 게임에서 유일하게 살아 움직이는 빛입니다.
  //    자리는 `spot` 이 정합니다 (그림이면 재서 넣은 값, 도형이면 도형의 자리).
  const fx = x + spot.fire.x;
  const fy = y + spot.fire.y;

  // 숯불
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 + glow * 0.4;
  ctx.fillStyle = '#ff7a2a';
  ctx.beginPath();
  ctx.ellipse(fx, fy, 6.5, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5 + glow * 0.5;
  ctx.fillStyle = '#ffd487';
  ctx.beginPath();
  ctx.ellipse(fx, fy + 0.5, 3.4, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 아궁이가 바깥으로 흘리는 빛
  ctx.globalAlpha = 0.18 + glow * 0.22;
  const spill = ctx.createRadialGradient(fx, fy - 1, 2, fx, fy - 1, 34);
  spill.addColorStop(0, 'rgba(255,150,60,0.85)');
  spill.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = spill;
  ctx.beginPath();
  ctx.ellipse(fx, fy + 1, 34, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 굴뚝에서 오르는 불티 — 움직이는 것이 있어야 눈에 걸립니다
  for (let i = 0; i < 4; i++) {
    const phase = (world.time * 0.55 + i * 0.25) % 1;
    ctx.globalAlpha = (1 - phase) * 0.6;
    ctx.fillStyle = i % 2 === 0 ? '#ffb35c' : '#ff8a3d';
    ctx.fillRect(
      x + spot.chimney.x + Math.sin(i * 2.3 + world.time * 1.7) * 3,
      y + spot.chimney.y - phase * 22,
      2, 2,
    );
  }
  ctx.restore();

  // 모루 — 화로 옆에 하나. "여기가 물건을 만드는 자리"라는 표시입니다
  ctx.save();
  ctx.fillStyle = '#3b3b40';
  ctx.fillRect(x - 30, y + 2, 11, 5);
  ctx.beginPath();
  ctx.moveTo(x - 33, y - 3);
  ctx.lineTo(x - 16, y - 3);
  ctx.lineTo(x - 20, y + 2);
  ctx.lineTo(x - 30, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a5a62';
  ctx.fillRect(x - 33, y - 4.5, 17, 1.8);
  ctx.restore();

  // 두 번째 모루와 담금질 통 — 구리 대장간이 서면 자리가 늘어납니다
  if (stage >= 2) {
    ctx.save();
    ctx.fillStyle = '#3b3b40';
    ctx.fillRect(x + 22, y + 4, 10, 5);
    ctx.beginPath();
    ctx.moveTo(x + 19, y - 1);
    ctx.lineTo(x + 35, y - 1);
    ctx.lineTo(x + 31, y + 4);
    ctx.lineTo(x + 22, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a5a62';
    ctx.fillRect(x + 19, y - 2.5, 16, 1.8);
    // 담금질 통
    ctx.fillStyle = '#4a3a28';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 16, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha('#2a6a86', 0.85);
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 15, 5.4, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/**
 *  화로 둘레의 원.
 *
 *  ★ 이 원 안에 서야 만들 수 있습니다 — core/action.ts 의 nearForge 가 재는 바로 그 거리입니다.
 *    보이지 않는 규칙을 눈에 보이게 만드는 것이 이 원의 전부입니다.
 *    안에 들어가면 원이 밝아집니다.
 */
export function drawForgeRing(ctx: CanvasRenderingContext2D, world: World, tx: number, ty: number): void {
  reachRing(ctx, world, tileCenter(tx), tileCenter(ty), CRAFT.reach, nearForge(world), '#ff9a45');
}

/** 가까이 가면 이름표가 붙습니다. 원 안에 들어오면 문구가 바뀝니다. */
export function drawForgeLabel(ctx: CanvasRenderingContext2D, world: World): void {
  const forge = world.map.def.forge;
  if (!forge) return;

  const x = tileCenter(forge.tx);
  const y = tileCenter(forge.ty);
  if (Math.hypot(x - world.me.pos.x, y - world.me.pos.y) > FORGE_LABEL_RANGE) return;

  const inside = nearForge(world);
  label(ctx, inside ? '화로 — 여기서 만듭니다' : '화로', x, y - 44, inside ? '#ffd9a0' : '#e0a86a', 10);
}

/* --------------------------------------------------------------- 광맥 */

/** 이 거리 안에 들어오면 이름표가 뜹니다 — "저건 눌러도 되는 것"이라는 신호 */
const VEIN_LABEL_RANGE = 190;

/**
 *  광맥.
 *
 *  ★ 이걸 그리지 않던 동안 광맥은 화면에 아예 없었습니다. 클릭 판정만 있었고,
 *    처음 하는 사람은 무엇을 눌러야 하는지 알 길이 없었습니다.
 *
 *  바위에서 광석이 비어져 나온 모양으로 그립니다. 빛은 다른 것들과 마찬가지로
 *  왼쪽 위에서 오고, 광석 알갱이만 반짝여서 배경 바위와 구별되게 했습니다.
 */
export function drawVein(ctx: CanvasRenderingContext2D, world: World, vein: Vein): void {
  const def = veinDef(vein.defId);
  const x = vein.pos.x;
  const y = vein.pos.y;
  const empty = vein.remaining <= 0;

  drawShadow(ctx, x, y + 7, 13);

  ctx.save();
  if (empty) ctx.globalAlpha = 0.45;

  //  ★ 남은 양이 화면에 보여야 합니다 (③). 바닥난 광맥은 돌만 남으므로
  //    광맥 종류를 안 가리고 한 장을 같이 씁니다 — 색으로 갈리던 것이 사라지니까요.
  const img = empty ? spriteFor('vein/empty') : spriteFor(`vein/${vein.defId}`, 'vein');
  if (img) {
    drawSprite(ctx, img, x, y + 12, 32);
    ctx.restore();
    return;
  }

  // 바위 덩이 — 광석이 박혀 있는 바탕. 광석이 도드라지도록 어둡게 깔았습니다
  const rock = '#463f38';
  ctx.fillStyle = darken(rock, 0.25);
  ctx.beginPath();
  ctx.ellipse(x, y, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(x - 14, y + 5);
  ctx.lineTo(x - 9, y - 8);
  ctx.lineTo(x + 2, y - 11);
  ctx.lineTo(x + 12, y - 4);
  ctx.lineTo(x + 14, y + 5);
  ctx.closePath();
  ctx.fill();
  // 빛은 언제나 왼쪽 위에서
  ctx.fillStyle = lighten(rock, 0.3);
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 8);
  ctx.lineTo(x + 2, y - 11);
  ctx.lineTo(x + 1, y - 4);
  ctx.lineTo(x - 7, y - 1);
  ctx.closePath();
  ctx.fill();

  // 박혀 있는 광석 — 이 색이 광맥의 종류입니다
  const seeds: Array<[number, number, number]> = [
    [-6, -4, 3.2],
    [1, -7, 2.6],
    [6, -2, 3],
    [-2, 1, 2.4],
    [9, 2, 2],
  ];
  for (const [dx, dy, r] of seeds) {
    ctx.fillStyle = lighten(def.color, 0.22);
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, r, r * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alpha(lighten(def.color, 0.75), 0.95);
    ctx.beginPath();
    ctx.ellipse(x + dx + LIGHT.x * r * 0.4, y + dy + LIGHT.y * r * 0.4, r * 0.4, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 한 알만 천천히 반짝입니다 — 움직이는 것에 눈이 갑니다
  if (!empty) {
    const twinkle = 0.5 + 0.5 * Math.sin(world.time * 2 + vein.id);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + twinkle * 0.45;
    ctx.fillStyle = lighten(def.color, 0.7);
    ctx.beginPath();
    ctx.ellipse(x + 1, y - 7, 3.4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 *  광맥의 사거리 원 — 화로와 같은 코드(reachRing)를 씁니다.
 *
 *  ★ core/action.ts 가 재는 GATHER.reach 를 그대로 받습니다.
 *    "눌렀는데 왜 안 캐지지" 의 답이 이 원입니다 — 원 안에 들어가야 곡괭이가 나갑니다.
 *    이름표가 붙는 거리 안에 있는 광맥에만 그립니다. 다 그리면 화면이 지저분해집니다.
 */
export function drawVeinRings(ctx: CanvasRenderingContext2D, world: World): void {
  const me = world.me;
  const mining = me.action?.kind === 'mine' ? Number(me.action.targetId) : null;

  for (const vein of world.veins) {
    if (vein.remaining <= 0) continue;
    const distance = Math.hypot(vein.pos.x - me.pos.x, vein.pos.y - me.pos.y);
    if (distance > VEIN_LABEL_RANGE && mining !== vein.id) continue;
    reachRing(ctx, world, vein.pos.x, vein.pos.y, GATHER.reach, distance <= GATHER.reach, veinDef(vein.defId).color);
  }
}

/**
 * 가까이 간 광맥에 이름과 남은 양을 붙입니다.
 * 캐는 중인 광맥에는 진행 막대가 함께 뜹니다 — 눌렸는지 알 수 있도록.
 */
export function drawVeinLabels(ctx: CanvasRenderingContext2D, world: World): void {
  const me = world.me;
  const mining = me.action?.kind === 'mine' ? Number(me.action.targetId) : null;

  for (const vein of world.veins) {
    const near = Math.hypot(vein.pos.x - me.pos.x, vein.pos.y - me.pos.y) <= VEIN_LABEL_RANGE;
    const working = mining === vein.id;
    if (!near && !working) continue;

    const def = veinDef(vein.defId);
    const top = vein.pos.y - 20;

    if (vein.remaining <= 0) {
      label(ctx, `${def.name} (바닥남)`, vein.pos.x, top, '#8b8377', 10);
      continue;
    }

    if (working && me.action) {
      bar(ctx, vein.pos.x, top - 4, 34, 1 - me.action.remaining / me.action.total, def.color);
      label(ctx, '캐는 중', vein.pos.x, top - 10, '#f0e3c8', 10);
    } else {
      label(ctx, def.name, vein.pos.x, top, lighten(def.color, 0.45), 10);
    }
  }
}

/* --------------------------------------------------------------- 효과 */

export function drawVfx(ctx: CanvasRenderingContext2D, world: World): void {
  for (const effect of world.vfx) {
    const progress = 1 - effect.life / effect.maxLife;
    ctx.save();

    switch (effect.kind) {
      case 'slash': {
        if (!effect.to) break;
        const angle = Math.atan2(effect.to.y - effect.pos.y, effect.to.x - effect.pos.x);
        ctx.translate(effect.pos.x, effect.pos.y);
        ctx.rotate(angle);
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 5 * (1 - progress * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(20, 0, 24, -0.85 + progress * 1.7, 0.5 + progress * 1.7);
        ctx.stroke();
        ctx.globalAlpha = (1 - progress) * 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        break;
      }
      case 'projectile': {
        if (!effect.to) break;
        const px = effect.pos.x + (effect.to.x - effect.pos.x) * progress;
        const py = effect.pos.y + (effect.to.y - effect.pos.y) * progress;
        const angle = Math.atan2(effect.to.y - effect.pos.y, effect.to.x - effect.pos.x);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = alpha('#ffffff', 0.85);
        ctx.beginPath();
        ctx.ellipse(2, 0, 3, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'impact': {
        ctx.globalAlpha = 1 - progress;
        const r = (effect.radius ?? 12) * (0.4 + progress * 1.1);
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 3 * (1 - progress);
        ctx.beginPath();
        ctx.arc(effect.pos.x, effect.pos.y, r, 0, Math.PI * 2);
        ctx.stroke();
        // 튀는 불티
        ctx.fillStyle = effect.color;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + effect.id;
          ctx.globalAlpha = (1 - progress) * 0.8;
          ctx.beginPath();
          ctx.arc(effect.pos.x + Math.cos(a) * r * 1.2, effect.pos.y + Math.sin(a) * r * 1.2, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'ring':
      case 'levelup': {
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = (effect.kind === 'levelup' ? 4 : 2.5) * (1 - progress * 0.6);
        ctx.beginPath();
        ctx.ellipse(
          effect.pos.x,
          effect.pos.y,
          (effect.radius ?? 40) * (0.3 + progress * 1.2),
          (effect.radius ?? 40) * (0.3 + progress * 1.2) * 0.45,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        if (effect.kind === 'levelup') {
          // 위로 솟는 빛기둥
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - progress) * 0.55;
          ctx.fillStyle = effect.color;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const rr = 26 * (1 - progress);
            ctx.fillRect(effect.pos.x + Math.cos(a) * rr, effect.pos.y - progress * 60 + Math.sin(a) * rr * 0.4, 3, 12);
          }
        }
        break;
      }
    }
    ctx.restore();
  }
}

/* --------------------------------------------------------------- 떠오르는 숫자 */

export function drawFloaters(ctx: CanvasRenderingContext2D, world: World): void {
  for (const floater of world.floaters) {
    const progress = 1 - floater.life / floater.maxLife;
    const rise = progress * 8;

    let color = '#f5efe0';
    let size = 13;
    let weight = 800;

    if (floater.kind === 'crit') {
      color = '#ffd23f';
      size = 20;
    } else if (floater.kind === 'taken') {
      color = '#ff6b5e';
      size = 15;
    } else if (floater.kind === 'heal') {
      color = '#7ee08a';
    } else if (floater.kind === 'gain') {
      color = '#9db4ff';
      size = 12;
      weight = 700;
    } else if (floater.kind === 'miss') {
      color = '#9a9186';
      size = 11;
      weight = 600;
    } else if (floater.kind === 'info') {
      color = '#f2c14e';
      size = 12;
    }

    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - progress) * 2.2);
    if (floater.kind === 'crit') {
      ctx.translate(floater.pos.x, floater.pos.y - rise);
      ctx.scale(1 + (1 - progress) * 0.25, 1 + (1 - progress) * 0.25);
      label(ctx, floater.text, 0, 0, color, size, weight);
    } else {
      label(ctx, floater.text, floater.pos.x, floater.pos.y - rise, color, size, weight);
    }
    ctx.restore();
  }
}

