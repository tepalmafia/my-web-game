/**
 * ===========================================================================
 *  살아 있는 것들 — 내 캐릭터와 몬스터
 * ===========================================================================
 *
 *  그림 파일이 없으므로 전부 도형으로 세웁니다. 대신 규칙을 지킵니다.
 *
 *    · 실루엣이 먼저다 — 작게 줄여도 무엇인지 알아볼 수 있어야 합니다
 *    · 빛은 왼쪽 위 — 어느 몸통이든 왼쪽 위가 밝고 오른쪽 아래가 어둡습니다
 *    · 움직이면 움직인 티가 난다 — 걸으면 다리가 나가고, 때리면 팔이 돌아갑니다
 *    · 입은 것이 보인다 — 무기 계열과 장비 등급이 그대로 그림에 나옵니다
 *
 *  마지막 항목이 이 게임에서 특히 중요합니다. 강화한 장비를 남에게 보여줄 수 없는
 *  혼자 하는 게임이라면, 적어도 내 눈에는 보여야 하기 때문입니다.
 */

import { itemDef } from '../../content/items';
import { monsterDef } from '../../content/monsters';
import type { Monster, MonsterShape, World } from '../../types';
import { MATERIAL, alpha, darken, lighten } from './palette';

/** 한 색에서 밝은 면·기본·어두운 면을 만듭니다 */
function shades(color: string): { light: string; base: string; dark: string } {
  return { light: lighten(color, 0.3), base: color, dark: darken(color, 0.42) };
}

/** 발밑 그림자 */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, strength = 0.34): void {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${strength})`;
  ctx.beginPath();
  ctx.ellipse(x + r * 0.16, y, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ===========================================================================
 *  내 사람
 *  ---------------------------------------------------------------------------
 *  ★ 직업이 없으므로 그림도 '입은 것'만 보고 그립니다.
 *    갑옷의 재질이 몸통 색이 되고, 투구를 썼으면 머리가 가려지고,
 *    손에 든 것이 검이면 검을, 아무것도 없으면 맨손을 그립니다.
 * ======================================================================== */

const SKIN = '#e8b98c';
const SKIN_SHADE = '#c2916a';

export function drawPlayer(ctx: CanvasRenderingContext2D, world: World): void {
  const me = world.me;
  const { x, y } = me.pos;

  if (me.dead) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawShadow(ctx, x, y + 8, 15, 0.4);
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 15, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const armor = me.equipped.armor;
  const helmet = me.equipped.helmet;
  const weapon = me.equipped.weapon;

  const armorDef = armor ? itemDef(armor.defId) : null;
  const material = armorDef ? MATERIAL[armorDef.id] ?? '#8a8f96' : '#9c8f79';
  const bodyColor = armor?.quality === 'fine' ? lighten(material, 0.12) : material;
  const heavyArmor = (armorDef?.defense ?? 0) >= 14;

  const facingUp = Math.sin(me.facing) < -0.35;
  const walk = world.meMoving ? Math.sin(world.meAnim) : 0;
  const bob = world.meMoving ? Math.abs(Math.sin(world.meAnim * 2)) * 1.6 : Math.sin(world.time * 2) * 0.7;

  drawShadow(ctx, x, y + 11, 12);

  // 무언가 만들거나 캐는 중이면 발밑에 고리가 돕니다
  if (me.action) {
    const spin = world.time * 3;
    ctx.save();
    ctx.strokeStyle = alpha('#e0b23a', 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 16, 7, 0, spin % (Math.PI * 2), (spin % (Math.PI * 2)) + Math.PI * 1.3);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y - bob);

  const body = shades(bodyColor);

  // 무거운 갑옷을 입으면 등 뒤가 두툼해 보입니다
  if (heavyArmor) {
    ctx.fillStyle = darken(material, 0.25);
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.quadraticCurveTo(-11 + walk * 2, 2, -6, 12);
    ctx.lineTo(6, 12);
    ctx.quadraticCurveTo(11 + walk * 2, 2, 8, -12);
    ctx.closePath();
    ctx.fill();
  }

  // 다리
  ctx.fillStyle = darken(bodyColor, 0.55);
  ctx.fillRect(-5.5, 4, 4.5, 9 + walk * 2.4);
  ctx.fillRect(1, 4, 4.5, 9 - walk * 2.4);
  ctx.fillStyle = '#2a2320';
  ctx.fillRect(-6, 12 + walk * 2.4, 5.5, 3);
  ctx.fillRect(0.5, 12 - walk * 2.4, 5.5, 3);

  if (facingUp) drawArmedHand(ctx, world);

  // 몸통
  ctx.fillStyle = body.base;
  ctx.beginPath();
  ctx.moveTo(-7.5, -10);
  ctx.lineTo(7.5, -10);
  ctx.lineTo(5.5, 6);
  ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = body.light;
  ctx.beginPath();
  ctx.moveTo(-7.5, -10);
  ctx.lineTo(-1, -10);
  ctx.lineTo(-2, 6);
  ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha(body.dark, 0.85);
  ctx.beginPath();
  ctx.moveTo(4, -10);
  ctx.lineTo(7.5, -10);
  ctx.lineTo(5.5, 6);
  ctx.lineTo(3, 6);
  ctx.closePath();
  ctx.fill();

  // 어깨 — 갑옷을 입었을 때만
  if (armorDef) {
    ctx.fillStyle = lighten(material, 0.15);
    ctx.beginPath();
    ctx.ellipse(-7, -9, 3.6, 3, -0.3, 0, Math.PI * 2);
    ctx.ellipse(7, -9, 3.6, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 허리띠
  ctx.fillStyle = '#3a2c20';
  ctx.fillRect(-6, 2, 12, 2.6);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(-1.2, 2, 2.4, 2.6);

  // 뒤쪽 팔
  ctx.fillStyle = body.dark;
  ctx.fillRect(-9.5, -8, 3.2, 10);

  // 머리
  const headY = -16;
  ctx.fillStyle = facingUp ? SKIN_SHADE : SKIN;
  ctx.beginPath();
  ctx.arc(0, headY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha('#000000', 0.18);
  ctx.beginPath();
  ctx.arc(1.6, headY + 1.2, 5.2, 0, Math.PI * 2);
  ctx.fill();

  if (helmet) {
    const helmDef = itemDef(helmet.defId);
    const helmColor = MATERIAL[helmDef.id] ?? '#7c848f';
    ctx.fillStyle = helmColor;
    ctx.beginPath();
    ctx.arc(0, headY - 0.5, 6.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = darken(helmColor, 0.3);
    ctx.fillRect(-6.4, headY - 1, 12.8, 2.2);
    ctx.fillStyle = lighten(helmColor, 0.45);
    ctx.beginPath();
    ctx.arc(-2.4, headY - 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#4a3524';
    ctx.beginPath();
    ctx.arc(0, headY - 1, 6.2, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
  }

  if (!facingUp) {
    ctx.fillStyle = '#2a2018';
    ctx.beginPath();
    ctx.arc(-2.2, headY + 0.6, 0.9, 0, Math.PI * 2);
    ctx.arc(2.2, headY + 0.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
    drawArmedHand(ctx, world);
  }

  ctx.restore();
  void weapon;
}

/**
 * 무기를 든 팔. 쉴 때는 아래로 늘어뜨렸다가 때릴 때만 앞으로 휘두릅니다.
 * (몸 한가운데에서 방향대로 뻗게 했더니 머리를 뚫는 창처럼 보였습니다)
 */
function drawArmedHand(ctx: CanvasRenderingContext2D, world: World): void {
  const me = world.me;
  const weapon = me.equipped.weapon;
  const weaponDef = weapon ? itemDef(weapon.defId) : null;

  const swing = world.meSwing > 0 ? Math.sin((1 - world.meSwing / 0.28) * Math.PI) : 0;
  const aim = Math.cos(me.facing) < 0 ? Math.PI - me.facing : me.facing;
  const rest = 0.75;

  ctx.save();
  ctx.translate(7, -6);
  ctx.rotate(rest + swing * (aim - rest - 1.2));

  // 팔
  ctx.fillStyle = SKIN;
  ctx.fillRect(4, -1.8, 6, 3.6);

  if (weaponDef && weaponDef.minDamage !== undefined) {
    const blade = weapon?.quality === 'fine' ? '#dfe6ee' : '#c3cbd6';
    const reach = 14 + (weaponDef.maxDamage ?? 8) * 0.5;

    ctx.fillStyle = '#3a2c20';
    ctx.fillRect(9, -1.4, 5, 2.8);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(13.5, -4.5, 2.4, 9);
    ctx.fillStyle = lighten(blade, 0.35);
    ctx.beginPath();
    ctx.moveTo(16, -2.6);
    ctx.lineTo(16 + reach, -1.2);
    ctx.lineTo(16 + reach, 1.2);
    ctx.lineTo(16, 2.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = alpha(darken(blade, 0.35), 0.9);
    ctx.beginPath();
    ctx.moveTo(16, 0.4);
    ctx.lineTo(16 + reach, 0.6);
    ctx.lineTo(16 + reach, 1.2);
    ctx.lineTo(16, 2.6);
    ctx.closePath();
    ctx.fill();

    if (swing > 0.2) {
      ctx.strokeStyle = alpha('#ffffff', swing * 0.5);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(6, 0, 26, -0.7, 0.7);
      ctx.stroke();
    }
  } else {
    // 맨손 — 주먹만
    ctx.fillStyle = SKIN_SHADE;
    ctx.beginPath();
    ctx.arc(11, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ===========================================================================
 *  몬스터
 * ======================================================================== */

export function drawMonster(ctx: CanvasRenderingContext2D, world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);
  const { x, y } = monster.pos;
  const size = def.size;
  const walk = monster.moving ? Math.sin(monster.anim) : 0;
  const idle = Math.sin(world.time * 2.2 + monster.id) * 0.5;
  const lunge = monster.swing > 0 ? Math.sin((1 - monster.swing / 0.3) * Math.PI) : 0;

  drawShadow(ctx, x, y + size * 0.78, size * 0.82, 0.32);

  ctx.save();
  ctx.translate(x + Math.cos(monster.facing) * lunge * size * 0.25, y + idle);

  // 왼쪽을 볼 때는 좌우를 뒤집습니다
  if (Math.cos(monster.facing) < 0) ctx.scale(-1, 1);

  const tone = shades(def.color);
  drawMonsterBody(ctx, def.shape, size, tone, walk, world.time + monster.id);

  ctx.restore();

  // 맞은 순간의 번쩍임
  if (monster.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.75, monster.hitFlash * 6);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, size * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMonsterBody(
  ctx: CanvasRenderingContext2D,
  shape: MonsterShape,
  s: number,
  tone: { light: string; base: string; dark: string },
  walk: number,
  t: number,
): void {
  switch (shape) {

    /* -------------------------------------------------------- 들쥐·들개 */
    case 'beast': {
      // 다리
      ctx.fillStyle = tone.dark;
      ctx.fillRect(-s * 0.7, s * 0.35, s * 0.28, s * 0.5 + walk * s * 0.15);
      ctx.fillRect(s * 0.3, s * 0.35, s * 0.28, s * 0.5 - walk * s * 0.15);
      // 꼬리
      ctx.strokeStyle = tone.dark;
      ctx.lineWidth = s * 0.18;
      ctx.beginPath();
      ctx.moveTo(-s * 0.95, -s * 0.1);
      ctx.quadraticCurveTo(-s * 1.5, -s * 0.5 + walk * s * 0.2, -s * 1.3, -s * 0.9);
      ctx.stroke();
      // 몸통
      ctx.fillStyle = tone.base;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.1, s * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha(tone.light, 0.65);
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, -s * 0.24, s * 0.72, s * 0.3, -0.15, 0, Math.PI * 2);
      ctx.fill();
      // 머리
      ctx.fillStyle = tone.base;
      ctx.beginPath();
      ctx.arc(s * 0.92, -s * 0.24, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tone.light;
      ctx.beginPath();
      ctx.arc(s * 0.82, -s * 0.4, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
      // 귀
      ctx.fillStyle = tone.dark;
      ctx.beginPath();
      ctx.moveTo(s * 0.7, -s * 0.6);
      ctx.lineTo(s * 0.92, -s * 1.2);
      ctx.lineTo(s * 1.14, -s * 0.55);
      ctx.closePath();
      ctx.fill();
      // 주둥이와 눈
      ctx.fillStyle = tone.light;
      ctx.beginPath();
      ctx.ellipse(s * 1.34, -s * 0.16, s * 0.24, s * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101418';
      ctx.beginPath();
      ctx.arc(s * 1.5, -s * 0.18, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8d34a';
      ctx.beginPath();
      ctx.arc(s * 1.02, -s * 0.35, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    /* --------------------------------------------------- 고블린·오크 */
    case 'humanoid': {
      // 다리
      ctx.fillStyle = tone.dark;
      ctx.fillRect(-s * 0.45, s * 0.35, s * 0.32, s * 0.6 + walk * s * 0.18);
      ctx.fillRect(s * 0.12, s * 0.35, s * 0.32, s * 0.6 - walk * s * 0.18);
      // 몸통
      ctx.fillStyle = tone.base;
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.35);
      ctx.lineTo(s * 0.6, -s * 0.35);
      ctx.lineTo(s * 0.45, s * 0.45);
      ctx.lineTo(-s * 0.45, s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = alpha(tone.light, 0.7);
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.35);
      ctx.lineTo(-s * 0.1, -s * 0.35);
      ctx.lineTo(-s * 0.15, s * 0.45);
      ctx.lineTo(-s * 0.45, s * 0.45);
      ctx.closePath();
      ctx.fill();
      // 허리 가죽
      ctx.fillStyle = '#4a3524';
      ctx.fillRect(-s * 0.5, s * 0.15, s, s * 0.2);
      // 팔
      ctx.fillStyle = tone.dark;
      ctx.fillRect(-s * 0.85, -s * 0.3, s * 0.28, s * 0.7);
      ctx.fillRect(s * 0.6, -s * 0.3 + walk * s * 0.12, s * 0.28, s * 0.7);
      // 머리
      ctx.fillStyle = tone.base;
      ctx.beginPath();
      ctx.arc(0, -s * 0.75, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha(tone.light, 0.8);
      ctx.beginPath();
      ctx.arc(-s * 0.14, -s * 0.86, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      // 귀
      ctx.fillStyle = tone.dark;
      ctx.beginPath();
      ctx.moveTo(-s * 0.38, -s * 0.82);
      ctx.lineTo(-s * 0.78, -s * 1.02);
      ctx.lineTo(-s * 0.34, -s * 0.6);
      ctx.closePath();
      ctx.moveTo(s * 0.38, -s * 0.82);
      ctx.lineTo(s * 0.78, -s * 1.02);
      ctx.lineTo(s * 0.34, -s * 0.6);
      ctx.closePath();
      ctx.fill();
      // 눈과 엄니
      ctx.fillStyle = '#f8d34a';
      ctx.beginPath();
      ctx.arc(-s * 0.15, -s * 0.78, s * 0.08, 0, Math.PI * 2);
      ctx.arc(s * 0.15, -s * 0.78, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      if (s > 13) {
        ctx.fillStyle = '#e8e2d0';
        ctx.beginPath();
        ctx.moveTo(-s * 0.16, -s * 0.62);
        ctx.lineTo(-s * 0.1, -s * 0.44);
        ctx.lineTo(-s * 0.04, -s * 0.62);
        ctx.closePath();
        ctx.moveTo(s * 0.16, -s * 0.62);
        ctx.lineTo(s * 0.1, -s * 0.44);
        ctx.lineTo(s * 0.04, -s * 0.62);
        ctx.closePath();
        ctx.fill();
      }
      // 손에 든 몽둥이
      ctx.fillStyle = '#5a4326';
      ctx.save();
      ctx.translate(s * 0.8, -s * 0.1);
      ctx.rotate(-0.5 + walk * 0.2);
      ctx.fillRect(0, -s * 0.1, s * 0.9, s * 0.2);
      ctx.fillStyle = '#3f2e1c';
      ctx.fillRect(s * 0.6, -s * 0.2, s * 0.36, s * 0.4);
      ctx.restore();
      break;
    }



    /* -------------------------------------------------------- 광산 박쥐 */
    case 'bat': {
      const flap = Math.sin(t * 14);
      ctx.fillStyle = tone.base;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(dir * s * 1.2, -s * (0.4 + flap * 0.5), dir * s * 1.9, s * (0.2 - flap * 0.3));
        ctx.quadraticCurveTo(dir * s * 1.1, s * 0.35, dir * s * 0.5, s * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = alpha(tone.dark, 0.55);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 1.0, -s * (0.3 + flap * 0.4), s * 1.7, s * (0.25 - flap * 0.25));
      ctx.quadraticCurveTo(s * 0.9, s * 0.3, s * 0.4, s * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = tone.base; // 몸
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.45, s * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tone.dark; // 귀
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.5);
      ctx.lineTo(-s * 0.42, -s * 1.05);
      ctx.lineTo(-s * 0.05, -s * 0.55);
      ctx.closePath();
      ctx.moveTo(s * 0.3, -s * 0.5);
      ctx.lineTo(s * 0.42, -s * 1.05);
      ctx.lineTo(s * 0.05, -s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(-s * 0.16, -s * 0.2, s * 0.1, 0, Math.PI * 2);
      ctx.arc(s * 0.16, -s * 0.2, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    /* -------------------------------------------------------- 동굴 거미 */
    case 'spider': {
      const step = Math.sin(walk * 2) * s * 0.18;
      // 다리 여덟 — 걸을 때 앞뒤로 엇갈립니다
      ctx.strokeStyle = tone.dark;
      ctx.lineWidth = s * 0.13;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const spread = -0.7 + i * 0.45;
        const lift = i % 2 === 0 ? step : -step;
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(dir * s * 0.3, 0);
          ctx.quadraticCurveTo(
            dir * s * (1.1 + i * 0.1),
            -s * 0.5 + lift,
            dir * s * (1.5 + i * 0.12),
            s * 0.5 + spread * s * 0.3,
          );
          ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
      // 배와 가슴
      ctx.fillStyle = tone.base;
      ctx.beginPath();
      ctx.ellipse(-s * 0.45, 0, s * 0.7, s * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha(tone.light, 0.5);
      ctx.beginPath();
      ctx.ellipse(-s * 0.55, -s * 0.2, s * 0.35, s * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tone.dark;
      ctx.beginPath();
      ctx.ellipse(s * 0.4, 0, s * 0.5, s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      // 눈 여덟 개 중 앞의 넷만
      ctx.fillStyle = '#ff5a5a';
      for (const [ex, ey, er] of [[0.75, -0.16, 0.1], [0.75, 0.16, 0.1], [0.6, -0.3, 0.07], [0.6, 0.3, 0.07]] as const) {
        ctx.beginPath();
        ctx.arc(s * ex, s * ey, s * er, 0, Math.PI * 2);
        ctx.fill();
      }
      // 이빨
      ctx.fillStyle = '#e8e2d0';
      ctx.beginPath();
      ctx.moveTo(s * 0.85, -s * 0.1);
      ctx.lineTo(s * 1.05, s * 0.05);
      ctx.lineTo(s * 0.85, s * 0.12);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}


