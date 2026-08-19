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

import { TILE } from '../../balance';
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
import { tileCenter } from '../../core/world';
import type { GroundItem, Monster, Npc, World } from '../../types';
import { alpha, darken, lighten } from './palette';
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
  enhance: '대장간',
  teleport: '순간이동',
  guide: '의뢰',
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

