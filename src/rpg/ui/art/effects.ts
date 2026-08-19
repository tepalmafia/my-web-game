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

import { CRAFT, TILE } from '../../balance';
import { itemDef } from '../../content/items';

/** 바닥에 떨어진 물건의 색 — 종류만 구분되면 충분합니다 */
const ITEM_TINT: Record<string, string> = {
  weapon: '#c3cbd6',
  armor: '#9aa6b4',
  helmet: '#9aa6b4',
  tool: '#c9a227',
  resource: '#a08a6a',
  potion: '#c2352f',
};
import { monsterDef } from '../../content/monsters';
import { veinDef } from '../../content/veins';
import { nearForge } from '../../core/action';
import { tileCenter } from '../../core/world';
import type { GroundItem, Monster, Npc, Vein, World } from '../../types';
import { LIGHT, alpha, darken, lighten } from './palette';
import { drawShadow } from './actors';

/* ------------------------------------------------------------------ 글자 */

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 11,
  weight = 700,
): void {
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
  label(
    ctx,
    me.dead ? `${me.name} — 쓰러짐` : me.name,
    me.pos.x,
    me.pos.y - 34,
    me.dead ? '#e88a86' : '#efe6d2',
  );
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
  const fading = item.life < 6 ? 0.35 + 0.45 * Math.abs(Math.sin(world.time * 7)) : 1;

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

const NPC_ROLE: Record<string, string> = {
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
export function drawForge(ctx: CanvasRenderingContext2D, world: World, tx: number, ty: number): void {
  const x = tileCenter(tx);
  const y = tileCenter(ty);
  // 숯불은 일정하게 타지 않습니다 — 느린 흔들림 두 개를 겹쳐 불규칙하게 보이게 합니다
  const glow = 0.55 + 0.28 * Math.sin(world.time * 2.7) + 0.17 * Math.sin(world.time * 6.1 + 1.3);

  drawShadow(ctx, x, y + 9, 17);

  const stone = '#584f47';

  ctx.save();

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

  // 숯불
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 + glow * 0.4;
  ctx.fillStyle = '#ff7a2a';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 6.5, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5 + glow * 0.5;
  ctx.fillStyle = '#ffd487';
  ctx.beginPath();
  ctx.ellipse(x, y + 1.5, 3.4, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 아궁이가 바깥으로 흘리는 빛
  ctx.globalAlpha = 0.18 + glow * 0.22;
  const spill = ctx.createRadialGradient(x, y, 2, x, y, 34);
  spill.addColorStop(0, 'rgba(255,150,60,0.85)');
  spill.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = spill;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 34, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 굴뚝에서 오르는 불티 — 움직이는 것이 있어야 눈에 걸립니다
  for (let i = 0; i < 4; i++) {
    const phase = (world.time * 0.55 + i * 0.25) % 1;
    ctx.globalAlpha = (1 - phase) * 0.6;
    ctx.fillStyle = i % 2 === 0 ? '#ffb35c' : '#ff8a3d';
    ctx.fillRect(x + 8 + Math.sin(i * 2.3 + world.time * 1.7) * 3, y - 36 - phase * 22, 2, 2);
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
}

/**
 *  화로 둘레의 원.
 *
 *  ★ 이 원 안에 서야 만들 수 있습니다 — core/action.ts 의 nearForge 가 재는 바로 그 거리입니다.
 *    보이지 않는 규칙을 눈에 보이게 만드는 것이 이 원의 전부입니다.
 *    안에 들어가면 원이 밝아집니다.
 */
export function drawForgeRing(ctx: CanvasRenderingContext2D, world: World, tx: number, ty: number): void {
  const x = tileCenter(tx);
  const y = tileCenter(ty);
  const inside = nearForge(world);

  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.lineDashOffset = -world.time * 9;
  ctx.lineWidth = inside ? 2 : 1.2;
  ctx.strokeStyle = inside ? 'rgba(255,176,92,0.85)' : 'rgba(255,150,70,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, CRAFT.reach, CRAFT.reach * 0.58, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (inside) {
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#ff9a45';
    ctx.fill();
  }
  ctx.restore();
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

