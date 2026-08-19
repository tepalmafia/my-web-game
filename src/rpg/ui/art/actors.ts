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

import { CLASSES } from '../../content/classes';
import { itemDef } from '../../content/items';
import { monsterDef } from '../../content/monsters';
import type { Monster, MonsterShape, World } from '../../types';
import { BLADE, GEAR_GLOW, GEAR_TINT, MATERIAL, alpha, darken, lighten, mix } from './palette';
import { flame } from './terrain';

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
 *  내 캐릭터
 * ======================================================================== */

const SKIN = '#e8b98c';
const SKIN_SHADE = '#c2916a';

export function drawPlayer(ctx: CanvasRenderingContext2D, world: World): void {
  const player = world.player;
  const cls = CLASSES[player.classId];
  const { x, y } = player.pos;

  if (player.dead) {
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

  // 입고 있는 것에서 색을 가져옵니다
  const weapon = player.equipped.weapon;
  const armor = player.equipped.armor;
  const helmet = player.equipped.helmet;
  const armorDef = armor ? itemDef(armor.defId) : null;
  const weaponDef = weapon ? itemDef(weapon.defId) : null;

  // 몸통은 재질 색, 등급 색은 장식에만 (파란 판금보다 강철빛 판금이 갑옷처럼 보입니다)
  const armorTint = armorDef ? GEAR_TINT[armorDef.grade]! : '#7c848f';
  const material = armorDef ? MATERIAL[armorDef.id] ?? '#8a8f96' : '#6b6155';
  const bodyColor = mix(material, cls.color, 0.14);
  const weaponTint = weaponDef ? GEAR_TINT[weaponDef.grade]! : '#9aa0a6';
  const bladeColor = mix(BLADE[cls.weaponFamily]!, weaponTint, weaponDef ? 0.35 : 0.1);
  const glow = Math.max(
    weaponDef ? GEAR_GLOW[weaponDef.grade]! : 0,
    armorDef ? GEAR_GLOW[armorDef.grade]! : 0,
  );
  const plus = Math.max(weapon?.plus ?? 0, armor?.plus ?? 0);

  const facing = player.facing;
  const facingUp = Math.sin(facing) < -0.35;
  const walk = world.playerMoving ? Math.sin(world.playerAnim) : 0;
  const bob = world.playerMoving ? Math.abs(Math.sin(world.playerAnim * 2)) * 1.6 : Math.sin(world.time * 2) * 0.7;

  drawShadow(ctx, x, y + 11, 12);

  // 강화가 높거나 좋은 장비면 발밑이 은은하게 빛납니다
  if (glow > 0.2 || plus >= 7) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 + glow * 0.2 + Math.max(0, plus - 6) * 0.02;
    ctx.fillStyle = plus >= 7 ? '#ffd166' : weaponTint;
    ctx.beginPath();
    ctx.ellipse(x, y + 11, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y - bob);

  const body = shades(bodyColor);

  // 망토·로브는 몸 뒤에
  if (player.classId === 'knight') {
    ctx.fillStyle = darken(armorTint, 0.2);
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.quadraticCurveTo(-11 + walk * 2, 2, -6, 12);
    ctx.lineTo(6, 12);
    ctx.quadraticCurveTo(11 + walk * 2, 2, 8, -12);
    ctx.closePath();
    ctx.fill();
  } else if (player.classId === 'wizard') {
    // 발까지 내려오는 로브 — 걸으면 자락이 흔들립니다
    const hem = darken(bodyColor, 0.18);
    ctx.fillStyle = hem;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.quadraticCurveTo(-12, 6, -10 + walk * 1.5, 15);
    ctx.quadraticCurveTo(0, 17, 10 + walk * 1.5, 15);
    ctx.quadraticCurveTo(12, 6, 7, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = alpha(lighten(bodyColor, 0.3), 0.5); // 왼쪽 자락에 빛
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.quadraticCurveTo(-12, 6, -10 + walk * 1.5, 15);
    ctx.lineTo(-3, 15);
    ctx.lineTo(-2, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = alpha(armorTint, 0.8); // 밑단 장식
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-9.5 + walk, 13);
    ctx.quadraticCurveTo(0, 15, 9.5 + walk, 13);
    ctx.stroke();
  }

  // 다리
  if (player.classId !== 'wizard') {
    ctx.fillStyle = darken(bodyColor, 0.55);
    ctx.fillRect(-5.5, 4, 4.5, 9 + walk * 2.4);
    ctx.fillRect(1, 4, 4.5, 9 - walk * 2.4);
    ctx.fillStyle = '#2a2320'; // 신발
    ctx.fillRect(-6, 12 + walk * 2.4, 5.5, 3);
    ctx.fillRect(0.5, 12 - walk * 2.4, 5.5, 3);
  }

  // 위를 볼 때는 무기가 등 뒤로 가야 머리를 가리지 않습니다
  if (facingUp) drawArmedHand(ctx, world, bladeColor);

  // 몸통 — 어깨가 넓고 허리로 좁아집니다
  ctx.fillStyle = body.base;
  ctx.beginPath();
  ctx.moveTo(-7.5, -10);
  ctx.lineTo(7.5, -10);
  ctx.lineTo(5.5, 6);
  ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = body.light; // 왼쪽 위 빛
  ctx.beginPath();
  ctx.moveTo(-7.5, -10);
  ctx.lineTo(-1, -10);
  ctx.lineTo(-2, 6);
  ctx.lineTo(-5.5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha(body.dark, 0.85); // 오른쪽 아래 그늘
  ctx.beginPath();
  ctx.moveTo(4, -10);
  ctx.lineTo(7.5, -10);
  ctx.lineTo(5.5, 6);
  ctx.lineTo(3, 6);
  ctx.closePath();
  ctx.fill();

  // 어깨 갑옷 — 여기에만 등급 색을 씁니다
  ctx.fillStyle = lighten(armorTint, 0.1);
  ctx.beginPath();
  ctx.ellipse(-7, -9, 3.6, 3, -0.3, 0, Math.PI * 2);
  ctx.ellipse(7, -9, 3.6, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();

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
    const helmTint = MATERIAL[helmDef.id] ?? GEAR_TINT[helmDef.grade]!;
    ctx.fillStyle = helmTint;
    ctx.beginPath();
    ctx.arc(0, headY - 0.5, 6.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = darken(helmTint, 0.3);
    ctx.fillRect(-6.4, headY - 1, 12.8, 2.2);
    ctx.fillStyle = lighten(helmTint, 0.45);
    ctx.beginPath();
    ctx.arc(-2.4, headY - 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // 등급이 높으면 볏이 섭니다
    if (GEAR_GLOW[helmDef.grade]! > 0.1) {
      ctx.fillStyle = GEAR_TINT[helmDef.grade]!;
      ctx.beginPath();
      ctx.moveTo(-1.5, headY - 6);
      ctx.quadraticCurveTo(0, headY - 12, 4, headY - 9);
      ctx.quadraticCurveTo(1.5, headY - 7, 1.5, headY - 5.5);
      ctx.closePath();
      ctx.fill();
    }
  } else if (player.classId === 'wizard') {
    ctx.fillStyle = darken(bodyColor, 0.1); // 뾰족 모자
    ctx.beginPath();
    ctx.moveTo(-7, headY - 2);
    ctx.lineTo(1, headY - 14);
    ctx.lineTo(7, headY - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = alpha('#ffffff', 0.18);
    ctx.beginPath();
    ctx.moveTo(-7, headY - 2);
    ctx.lineTo(1, headY - 14);
    ctx.lineTo(-1, headY - 1);
    ctx.closePath();
    ctx.fill();
  } else if (player.classId === 'elf') {
    ctx.fillStyle = '#e8d9a8'; // 밝은 머리카락
    ctx.beginPath();
    ctx.arc(0, headY - 1, 6.2, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.fillStyle = SKIN_SHADE; // 뾰족 귀
    ctx.beginPath();
    ctx.moveTo(-5.5, headY - 1);
    ctx.lineTo(-8.5, headY - 5);
    ctx.lineTo(-4.5, headY + 2);
    ctx.closePath();
    ctx.moveTo(5.5, headY - 1);
    ctx.lineTo(8.5, headY - 5);
    ctx.lineTo(4.5, headY + 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#4a3524';
    ctx.beginPath();
    ctx.arc(0, headY - 1, 6.2, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
  }

  // 얼굴 (앞을 볼 때만)
  if (!facingUp) {
    ctx.fillStyle = '#2a2018';
    ctx.beginPath();
    ctx.arc(-2.2, headY + 0.6, 0.9, 0, Math.PI * 2);
    ctx.arc(2.2, headY + 0.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
    drawArmedHand(ctx, world, bladeColor);
  }

  ctx.restore();
}

/**
 * 무기를 든 팔.
 * 어깨에서 뻗어 나오고, 쉴 때는 아래로 늘어뜨렸다가 때릴 때만 앞으로 휘두릅니다.
 * (몸 한가운데에서 방향대로 뻗게 했더니 머리를 뚫고 나오는 창처럼 보였습니다.)
 */
function drawArmedHand(ctx: CanvasRenderingContext2D, world: World, bladeColor: string): void {
  const player = world.player;
  const cls = CLASSES[player.classId];
  const weapon = player.equipped.weapon;
  const weaponDef = weapon ? itemDef(weapon.defId) : null;
  const glow = weaponDef ? GEAR_GLOW[weaponDef.grade]! : 0;

  const swing = world.playerSwing > 0 ? Math.sin((1 - world.playerSwing / 0.28) * Math.PI) : 0;
  const aim = Math.cos(player.facing) < 0 ? Math.PI - player.facing : player.facing;
  const rest = cls.projectile === 'none' ? 0.75 : 0.15;

  ctx.save();
  ctx.translate(7, -6); // 오른쪽 어깨
  if (cls.projectile === 'none') {
    // 근접: 평소엔 아래로, 휘두르면 겨냥한 쪽으로 크게 돕니다
    ctx.rotate(rest + swing * (aim - rest - 1.2));
  } else {
    // 원거리: 늘 겨냥한 쪽을 향합니다
    ctx.rotate(aim * 0.85 + rest);
  }
  drawWeapon(ctx, cls.weaponFamily, bladeColor, weapon?.plus ?? 0, glow, swing);
  ctx.restore();
}

/** 손에 든 무기 — 이미 회전된 좌표계에서 오른쪽(+x)이 앞입니다 */
function drawWeapon(
  ctx: CanvasRenderingContext2D,
  family: 'sword' | 'bow' | 'staff',
  blade: string,
  plus: number,
  glow: number,
  swing: number,
): void {
  // 팔
  ctx.fillStyle = SKIN;
  ctx.fillRect(4, -1.8, 6, 3.6);

  if (glow > 0.25 || plus >= 7) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + glow * 0.3;
    ctx.fillStyle = plus >= 7 ? '#ffd166' : blade;
    ctx.beginPath();
    ctx.ellipse(18, 0, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (family === 'sword') {
    ctx.fillStyle = '#3a2c20'; // 손잡이
    ctx.fillRect(9, -1.4, 5, 2.8);
    ctx.fillStyle = '#c9a227'; // 코등이
    ctx.fillRect(13.5, -4.5, 2.4, 9);
    // 날
    ctx.fillStyle = lighten(blade, 0.4);
    ctx.beginPath();
    ctx.moveTo(16, -2.6);
    ctx.lineTo(28 + plus * 0.5, -1.2);
    ctx.lineTo(28 + plus * 0.5, 1.2);
    ctx.lineTo(16, 2.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = alpha(darken(blade, 0.35), 0.9);
    ctx.beginPath();
    ctx.moveTo(16, 0.4);
    ctx.lineTo(28 + plus * 0.5, 0.6);
    ctx.lineTo(28 + plus * 0.5, 1.2);
    ctx.lineTo(16, 2.6);
    ctx.closePath();
    ctx.fill();
    if (swing > 0.2) {
      // 휘두른 자국
      ctx.strokeStyle = alpha('#ffffff', swing * 0.5);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(6, 0, 26, -0.7, 0.7);
      ctx.stroke();
    }
  } else if (family === 'bow') {
    ctx.strokeStyle = lighten(blade, 0.15);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(12, 0, 11, -1.35, 1.35);
    ctx.stroke();
    ctx.strokeStyle = alpha('#f8fafc', 0.85); // 시위
    ctx.lineWidth = 0.9;
    const pull = swing * 4;
    ctx.beginPath();
    ctx.moveTo(12 + Math.cos(-1.35) * 11, Math.sin(-1.35) * 11);
    ctx.lineTo(12 - pull, 0);
    ctx.lineTo(12 + Math.cos(1.35) * 11, Math.sin(1.35) * 11);
    ctx.stroke();
    if (swing > 0.05) {
      ctx.strokeStyle = '#e8d9a8'; // 화살
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(10 - pull, 0);
      ctx.lineTo(24, 0);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#5a4326'; // 자루
    ctx.fillRect(8, -1.3, 20, 2.6);
    ctx.fillStyle = alpha('#000000', 0.25);
    ctx.fillRect(8, 0.4, 20, 1.2);
    // 구슬
    const orb = lighten(blade, 0.45);
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(30, 0, 4.4 + swing, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4 + swing * 0.5;
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(30, 0, 9 + swing * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = alpha('#ffffff', 0.75);
    ctx.beginPath();
    ctx.arc(28.6, -1.4, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
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

  drawShadow(ctx, x, y + size * 0.78, size * 0.82, def.boss ? 0.42 : 0.32);

  if (def.boss) {
    // 보스 발밑의 기운
    const pulse = 0.6 + 0.4 * Math.sin(world.time * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.14 * pulse;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.7, size * 2.1, size * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x + Math.cos(monster.facing) * lunge * size * 0.25, y + idle);

  // 왼쪽을 볼 때는 좌우를 뒤집습니다
  if (Math.cos(monster.facing) < 0) ctx.scale(-1, 1);

  const tone = shades(def.color);
  drawMonsterBody(ctx, def.shape, size, tone, walk, world.time + monster.id, def.boss === true);

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
  boss: boolean,
): void {
  switch (shape) {
    /* ------------------------------------------------------------ 슬라임 */
    case 'blob': {
      const squash = 1 + Math.sin(t * 3) * 0.1;
      ctx.fillStyle = alpha(tone.base, 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * squash, (s * 0.95) / squash, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha(tone.dark, 0.5);
      ctx.beginPath();
      ctx.ellipse(s * 0.25, s * 0.3, s * 0.6, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha('#ffffff', 0.5); // 물방울 반사
      ctx.beginPath();
      ctx.ellipse(-s * 0.32, -s * 0.38, s * 0.26, s * 0.18, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101418'; // 눈
      ctx.beginPath();
      ctx.arc(-s * 0.28, -s * 0.05, s * 0.12, 0, Math.PI * 2);
      ctx.arc(s * 0.28, -s * 0.05, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

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
      if (boss) crown(ctx, s, tone);
      break;
    }

    /* ---------------------------------------------------- 언데드 광부 */
    case 'undead': {
      ctx.fillStyle = darken(tone.dark, 0.2);
      ctx.fillRect(-s * 0.4, s * 0.3, s * 0.28, s * 0.6 + walk * s * 0.14);
      ctx.fillRect(s * 0.12, s * 0.3, s * 0.28, s * 0.6 - walk * s * 0.14);
      // 해진 외투
      ctx.fillStyle = tone.dark;
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.4);
      ctx.lineTo(s * 0.55, -s * 0.4);
      ctx.lineTo(s * 0.45, s * 0.5);
      ctx.lineTo(s * 0.2, s * 0.3);
      ctx.lineTo(0, s * 0.55);
      ctx.lineTo(-s * 0.2, s * 0.3);
      ctx.lineTo(-s * 0.45, s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = alpha(tone.base, 0.8);
      ctx.fillRect(-s * 0.55, -s * 0.4, s * 0.4, s * 0.9);
      // 뼈만 남은 팔
      ctx.strokeStyle = '#cdc4b0';
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.25);
      ctx.lineTo(-s * 0.85, s * 0.35);
      ctx.moveTo(s * 0.6, -s * 0.25);
      ctx.lineTo(s * 0.95, s * 0.1);
      ctx.stroke();
      // 곡괭이
      ctx.strokeStyle = '#5a4326';
      ctx.lineWidth = s * 0.13;
      ctx.beginPath();
      ctx.moveTo(s * 0.95, s * 0.1);
      ctx.lineTo(s * 1.15, -s * 0.9);
      ctx.stroke();
      ctx.strokeStyle = '#8a8f96';
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(s * 0.8, -s * 0.75);
      ctx.quadraticCurveTo(s * 1.15, -s * 1.05, s * 1.5, -s * 0.72);
      ctx.stroke();
      // 해골
      ctx.fillStyle = '#e2dccb';
      ctx.beginPath();
      ctx.arc(0, -s * 0.75, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha('#000000', 0.2);
      ctx.beginPath();
      ctx.arc(s * 0.12, -s * 0.68, s * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5ee0ff'; // 빛나는 눈
      ctx.beginPath();
      ctx.arc(-s * 0.15, -s * 0.78, s * 0.09, 0, Math.PI * 2);
      ctx.arc(s * 0.15, -s * 0.78, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#5ee0ff';
      ctx.beginPath();
      ctx.arc(-s * 0.15, -s * 0.78, s * 0.22, 0, Math.PI * 2);
      ctx.arc(s * 0.15, -s * 0.78, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2a2620'; // 이빨
      ctx.fillRect(-s * 0.16, -s * 0.56, s * 0.32, s * 0.08);
      break;
    }

    /* -------------------------------------------------------- 석상 골렘 */
    case 'golem': {
      const stomp = Math.abs(walk) * s * 0.12;
      // 다리
      ctx.fillStyle = tone.dark;
      ctx.fillRect(-s * 0.6, s * 0.5, s * 0.44, s * 0.5 - stomp);
      ctx.fillRect(s * 0.16, s * 0.5, s * 0.44, s * 0.5 + stomp);
      // 몸통 — 돌덩이를 쌓아 올린 모양
      ctx.fillStyle = tone.base;
      ctx.fillRect(-s * 0.85, -s * 0.7, s * 1.7, s * 1.25);
      ctx.fillStyle = alpha(tone.light, 0.75);
      ctx.fillRect(-s * 0.85, -s * 0.7, s * 0.5, s * 1.25);
      ctx.fillStyle = alpha(tone.dark, 0.7);
      ctx.fillRect(s * 0.45, -s * 0.7, s * 0.4, s * 1.25);
      // 갈라진 틈
      ctx.strokeStyle = alpha('#000000', 0.4);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.7);
      ctx.lineTo(-s * 0.12, -s * 0.1);
      ctx.lineTo(-s * 0.34, s * 0.55);
      ctx.stroke();
      // 팔
      ctx.fillStyle = tone.base;
      ctx.fillRect(-s * 1.25, -s * 0.5, s * 0.4, s * 1);
      ctx.fillRect(s * 0.85, -s * 0.5, s * 0.4, s * 1);
      // 머리
      ctx.fillStyle = tone.light;
      ctx.fillRect(-s * 0.45, -s * 1.15, s * 0.9, s * 0.5);
      // 핵
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#f59e0b';
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 3);
      ctx.beginPath();
      ctx.arc(0, -s * 0.1, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(-s * 0.2, -s * 0.9, s * 0.1, 0, Math.PI * 2);
      ctx.arc(s * 0.2, -s * 0.9, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      if (boss) crown(ctx, s, tone);
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

    /* -------------------------------------------------------- 화염 정령 */
    case 'elemental': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = tone.base;
      ctx.beginPath();
      ctx.arc(0, -s * 0.2, s * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      flame(ctx, t * 9, 0, s * 0.5, s * 1.9, tone.base, lighten(tone.base, 0.5));
      flame(ctx, t * 11 + 2, -s * 0.5, s * 0.6, s * 1.1, alpha(tone.dark, 0.9), lighten(tone.base, 0.3));
      flame(ctx, t * 12 + 4, s * 0.5, s * 0.6, s * 1.0, alpha(tone.dark, 0.9), lighten(tone.base, 0.3));

      ctx.fillStyle = '#fff3c4'; // 핵
      ctx.beginPath();
      ctx.arc(0, -s * 0.25, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1408'; // 눈
      ctx.beginPath();
      ctx.arc(-s * 0.16, -s * 0.3, s * 0.08, 0, Math.PI * 2);
      ctx.arc(s * 0.16, -s * 0.3, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    /* -------------------------------------------- 드레이크 · 고룡 */
    case 'dragon': {
      const flap = Math.sin(t * 3.5);
      // 뒤쪽 날개
      ctx.fillStyle = tone.dark;
      wing(ctx, s, -1, flap);
      // 꼬리
      ctx.strokeStyle = tone.base;
      ctx.lineWidth = s * 0.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, s * 0.1);
      ctx.quadraticCurveTo(-s * 1.7, s * 0.3 + flap * s * 0.2, -s * 2.1, -s * 0.4);
      ctx.stroke();
      ctx.lineCap = 'butt';
      // 다리
      ctx.fillStyle = tone.dark;
      ctx.fillRect(-s * 0.45, s * 0.4, s * 0.3, s * 0.55 + walk * s * 0.12);
      ctx.fillRect(s * 0.25, s * 0.4, s * 0.3, s * 0.55 - walk * s * 0.12);
      // 몸통
      ctx.fillStyle = tone.base;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.95, s * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha(tone.light, 0.6);
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, -s * 0.22, s * 0.6, s * 0.3, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha('#f8e3c0', 0.55); // 배
      ctx.beginPath();
      ctx.ellipse(s * 0.1, s * 0.3, s * 0.5, s * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      // 앞쪽 날개
      ctx.fillStyle = tone.base;
      wing(ctx, s, 1, flap);
      // 목과 머리
      ctx.strokeStyle = tone.base;
      ctx.lineWidth = s * 0.42;
      ctx.beginPath();
      ctx.moveTo(s * 0.5, -s * 0.2);
      ctx.quadraticCurveTo(s * 1.1, -s * 0.7, s * 1.3, -s * 0.85);
      ctx.stroke();
      ctx.fillStyle = tone.base;
      ctx.beginPath();
      ctx.ellipse(s * 1.45, -s * 0.9, s * 0.46, s * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tone.dark; // 뿔
      ctx.beginPath();
      ctx.moveTo(s * 1.3, -s * 1.1);
      ctx.lineTo(s * 1.5, -s * 1.75);
      ctx.lineTo(s * 1.55, -s * 1.05);
      ctx.closePath();
      ctx.fill();
      if (boss) {
        ctx.beginPath();
        ctx.moveTo(s * 1.05, -s * 1.05);
        ctx.lineTo(s * 1.0, -s * 1.8);
        ctx.lineTo(s * 1.3, -s * 1.1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#fde047'; // 눈
      ctx.beginPath();
      ctx.arc(s * 1.6, -s * 0.98, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha('#ffb04a', 0.85); // 콧김
      ctx.beginPath();
      ctx.arc(s * 1.9, -s * 0.82, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

/** 날개 한 짝 */
function wing(ctx: CanvasRenderingContext2D, s: number, layer: number, flap: number): void {
  const lift = flap * s * 0.55 * layer;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.2);
  ctx.quadraticCurveTo(-s * 0.9, -s * 1.4 - lift, -s * 1.75, -s * 1.0 - lift * 0.6);
  ctx.quadraticCurveTo(-s * 1.1, -s * 0.5, -s * 0.5, s * 0.1);
  ctx.closePath();
  ctx.fill();
}

/** 보스의 뿔 장식 */
function crown(ctx: CanvasRenderingContext2D, s: number, tone: { light: string; dark: string; base: string }): void {
  ctx.fillStyle = '#e0b23a';
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, -s * 1.05);
  ctx.lineTo(-s * 0.3, -s * 1.45);
  ctx.lineTo(-s * 0.12, -s * 1.12);
  ctx.lineTo(0, -s * 1.55);
  ctx.lineTo(s * 0.12, -s * 1.12);
  ctx.lineTo(s * 0.3, -s * 1.45);
  ctx.lineTo(s * 0.45, -s * 1.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha(tone.dark, 0.4);
  ctx.fillRect(-s * 0.45, -s * 1.08, s * 0.9, s * 0.08);
}
