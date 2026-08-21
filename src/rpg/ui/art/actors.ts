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
import { flinchFlash, flinchOffset } from '../flinch';
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

/**
 *  왼쪽을 보고 있는가.
 *
 *  ★ 그냥 cos(facing) < 0 으로 가르면 위아래로 곧게 걸을 때 cos 가 0 언저리를 떠돌아
 *    좌우가 프레임마다 뒤집힙니다. 그래서 확실히 넘었을 때만 바꾸고, 그 사이에는
 *    마지막으로 본 쪽을 그대로 둡니다. 규칙이 아니라 그림의 기억이라 저장하지 않습니다.
 */
let facedLeft = false;

function facingLeft(facing: number): boolean {
  const side = Math.cos(facing);
  if (side < -0.12) facedLeft = true;
  else if (side > 0.12) facedLeft = false;
  return facedLeft;
}

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
  const flip = facingLeft(me.facing);
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

  // 맞은 순간 몸만 뒤로 밀립니다 — 그림자는 제자리에 남아 발이 붙어 있는 것처럼 보입니다
  const shove = flinchOffset();

  ctx.save();
  ctx.translate(x + shove.x, y - bob + shove.y);
  // ★ 왼쪽으로 갈 때는 여기 한 곳에서 통째로 뒤집습니다.
  //   몸·팔·검이 모두 이 안에 있으므로 따로 돌 수가 없습니다 —
  //   예전에 팔만 겨냥 각도로 돌리다가 방향마다 검이 제각각을 가리켰던 일이
  //   구조적으로 되풀이될 수 없게 하려는 것입니다. 각도가 아니라 거울입니다.
  if (flip) ctx.scale(-1, 1);

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

  // 맞은 순간의 번쩍임 — 몸 위에만 얹습니다 (몬스터와 같은 방식)
  const flash = flinchFlash();
  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = flash * 0.8;
    ctx.fillStyle = '#ffd6cf';
    ctx.beginPath();
    ctx.ellipse(0, -6, 11, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  void weapon;
}

/* ===========================================================================
 *  손에 든 무기
 * ======================================================================== */

/**
 *  무기 하나하나의 생김새.
 *
 *  ★ 만드는 게임이므로 **만든 것이 무엇인지 한눈에 보여야** 합니다.
 *    길이만 다르면 단검과 장검이 같은 물건으로 보이고, 제작의 보람이 줄어듭니다.
 *    그래서 자루 길이 · 코등이 크기 · 날의 폭과 색으로 실루엣을 갈랐습니다.
 */
interface WeaponLook {
  /** 자루 길이 */
  grip: number;
  /** 코등이 반높이 (클수록 십자가 크게) */
  guard: number;
  /** 날 밑동 반너비 */
  width: number;
  /** 날 끝 반너비 (작을수록 뾰족) */
  tip: number;
  /** 길이 배수 */
  reach: number;
  blade: string;
  metal: string;
}

const IRON = '#c3cbd6';
const BRASS = '#c9a227';

/**
 *  무기 하나하나의 생김새.
 *
 *  ★ 여기 키는 아이템 id 입니다. id 가 그냥 string 이라 컴파일이 지켜주지 못합니다.
 *    무기를 늘리고 여기를 잊으면 조용히 기본 실루엣으로 떨어집니다 —
 *    그래서 tests/rpg/art.test.ts 가 밖에서 맞춰봅니다.
 */
export const WEAPON_LOOK: Record<string, WeaponLook> = {
  // 짧고 넓다. 코등이는 거의 없다시피
  'iron-dagger': { grip: 4, guard: 2.4, width: 2.7, tip: 1, reach: 0.72, blade: IRON, metal: '#9c8f79' },
  // 낡아서 날이 탁하다
  'rusty-sword': { grip: 5, guard: 3.2, width: 2.4, tip: 1.1, reach: 0.9, blade: '#9c968b', metal: '#7d6a4a' },
  'iron-sword': { grip: 5, guard: 4.4, width: 2.8, tip: 1.1, reach: 1, blade: IRON, metal: BRASS },
  // 자루가 길어 두 손으로 쥔다. 가늘고 길다
  'iron-longsword': { grip: 7.5, guard: 5.6, width: 2.5, tip: 0.9, reach: 1.16, blade: '#cfd6df', metal: BRASS },
  // 구릿빛. 코등이가 넓고 날이 두껍다
  'copper-sword': { grip: 5.5, guard: 5.2, width: 3.3, tip: 1.4, reach: 1.04, blade: '#c98f5e', metal: '#8a5a30' },
  // 빛을 거의 되쏘지 않는다. 넓고 길고 무겁다 — 지금 가장 큰 칼
  'dark-iron-sword': { grip: 6.5, guard: 6, width: 3.6, tip: 1.5, reach: 1.12, blade: '#6a6572', metal: '#3f3a48' },
};

const DEFAULT_LOOK: WeaponLook = {
  grip: 5, guard: 4, width: 2.6, tip: 1.1, reach: 1, blade: IRON, metal: BRASS,
};

/** engine 이 정해 두는 휘두르는 시간. 값은 core 의 것을 따라 읽기만 합니다 */
const SWING_TIME = 0.28;

/**
 *  대기 자세 — 검을 앞·위로 세워 듭니다 (약 -54°).
 *  ★ 예전에는 아래로 늘어뜨렸는데, 어깨가 회전 중심이라 손이 위·칼끝이 아래로 가서
 *    거꾸로 쥔 것처럼 보였습니다.
 */
const GUARD_ANGLE = -0.85;

/**
 *  때린 순간의 자세 — 앞·아래로 베어 내린 곳 (약 +36°).
 *
 *  ★ 임팩트는 **애니메이션 0프레임**입니다. engine 이 world.meSwing 을 세우는 바로
 *    그 순간에 피해·소리·히트스톱이 함께 일어나기 때문입니다(engine.ts playerAttack).
 *    그래서 '치켜들었다가 내려친다'의 치켜드는 쪽은 앞선 공격의 **복귀 동작**이
 *    맡습니다 — 대기 자세가 곧 치켜든 자세입니다.
 */
const STRIKE_ANGLE = 0.62;

/** 때린 자세를 잠깐 머물렀다가 부드럽게 돌아옵니다 */
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * 무기를 든 팔.
 *
 * 어깨를 중심으로 팔 → 주먹 → 자루 → 코등이 → 날 순서로 바깥을 향해 뻗습니다.
 * (몸 한가운데에서 바라보는 방향대로 뻗게 했더니 머리를 뚫는 창처럼 보였습니다.
 *  그래서 방향과 무관하게 어깨 옆에서만 움직입니다 — 겨냥은 칼자국 효과가 알립니다.)
 */
function drawArmedHand(ctx: CanvasRenderingContext2D, world: World): void {
  const me = world.me;
  const weapon = me.equipped.weapon;
  const weaponDef = weapon ? itemDef(weapon.defId) : null;

  // 0 = 때린 순간, 1 = 다 돌아옴
  const phase = world.meSwing > 0 ? 1 - world.meSwing / SWING_TIME : 1;
  const angle = STRIKE_ANGLE + (GUARD_ANGLE - STRIKE_ANGLE) * smoothstep(phase);

  const armed = !!weaponDef && weaponDef.minDamage !== undefined;
  const look = armed ? WEAPON_LOOK[weaponDef!.id] ?? DEFAULT_LOOK : DEFAULT_LOOK;
  const reach = armed ? (14 + (weaponDef!.maxDamage ?? 8) * 0.5) * look.reach : 0;

  ctx.save();
  ctx.translate(7, -6);

  // 지나간 자리 — 실제로 칼끝이 훑고 간 호를 그대로 그립니다
  if (armed && phase < 0.55) {
    ctx.save();
    ctx.strokeStyle = alpha('#ffffff', (1 - phase / 0.55) * 0.45);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 12 + reach * 0.8, angle, STRIKE_ANGLE);
    ctx.stroke();
    ctx.restore();
  }

  ctx.rotate(angle);

  // 팔
  ctx.fillStyle = SKIN;
  ctx.fillRect(4, -1.8, 6, 3.6);

  if (armed) {
    const blade = weapon?.quality === 'fine' ? lighten(look.blade, 0.25) : look.blade;
    const gripEnd = 10 + look.grip;
    const guardX = gripEnd + 0.5;
    const bladeX = guardX + 2.4;

    //  ★ 벼림이 눈에 보여야 합니다. 고른 것이 화면에 안 나타나면
    //    이름표에만 있는 설정이 됩니다.
    //      날 선   — 얇고 길게      단단한 — 두껍고 짧게      가벼운 — 얇고 짧게
    const temper = weapon?.temper;
    const thick =
      temper === 'tough' ? 1.45
      : temper === 'sharp' ? 0.72
      : temper === 'light' ? 0.78
      : 1;
    const long =
      temper === 'sharp' ? 1.12
      : temper === 'tough' ? 0.94
      : temper === 'light' ? 0.9
      : 1;

    // 자루 — 손보다 안쪽에서 시작해 손에 물립니다
    ctx.fillStyle = '#3a2c20';
    ctx.fillRect(9, -1.5, look.grip + 1, 3);
    // 자루끝
    ctx.fillStyle = look.metal;
    ctx.fillRect(8, -2, 1.6, 4);

    // ★ 쥔 주먹. 어디를 잡았는지 보이지 않으면 어느 쪽이 손잡이인지 알 수 없습니다
    ctx.fillStyle = SKIN_SHADE;
    ctx.beginPath();
    ctx.arc(11, 0, 2.7, 0, Math.PI * 2);
    ctx.fill();

    // 코등이
    ctx.fillStyle = look.metal;
    ctx.fillRect(guardX, -look.guard, 2.4, look.guard * 2);

    // 날
    const width = look.width * thick;
    const tip = look.tip * thick;
    const span = reach * long;
    ctx.fillStyle = lighten(blade, 0.3);
    ctx.beginPath();
    ctx.moveTo(bladeX, -width);
    ctx.lineTo(bladeX + span, -tip);
    ctx.lineTo(bladeX + span + tip * 2.2, 0);
    ctx.lineTo(bladeX + span, tip);
    ctx.lineTo(bladeX, width);
    ctx.closePath();
    ctx.fill();
    // 아래쪽 그늘 — 빛은 언제나 왼쪽 위에서
    ctx.fillStyle = alpha(darken(blade, 0.4), 0.9);
    ctx.beginPath();
    ctx.moveTo(bladeX, 0.3);
    ctx.lineTo(bladeX + span, 0.2);
    ctx.lineTo(bladeX + span, tip);
    ctx.lineTo(bladeX, width);
    ctx.closePath();
    ctx.fill();
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

/**
 *  쓰러지는 데 걸리는 시간.
 *
 *  ★ 규칙이 아니라 그림입니다. core 는 몬스터를 죽는 즉시 'dead' 로 두고
 *    respawnIn 을 세기 시작할 뿐이고, 이 파일이 그 셈에서 경과를 되읽습니다.
 *    core 는 이 연출이 있는지 모릅니다 (monsterFlash 와 같은 방식).
 */
export const DEATH_SECONDS = 0.4;

/**
 *  쓰러지는 중이면 0~1, 아니면 null.
 *
 *  respawnIn 은 def.respawn 에서 줄어들므로 그 차가 죽은 뒤 지난 시간입니다.
 *  가장 짧은 되살아남이 50초라 0.4초와 겹칠 일이 없습니다.
 */
export function deathProgress(monster: Monster): number | null {
  if (monster.state !== 'dead') return null;
  const elapsed = monsterDef(monster.defId).respawn - monster.respawnIn;
  if (elapsed < 0 || elapsed >= DEATH_SECONDS) return null;
  return elapsed / DEATH_SECONDS;
}

export function drawMonster(ctx: CanvasRenderingContext2D, world: World, monster: Monster): void {
  const def = monsterDef(monster.defId);
  const { x, y } = monster.pos;
  const size = def.size;
  const walk = monster.moving ? Math.sin(monster.anim) : 0;
  const idle = Math.sin(world.time * 2.2 + monster.id) * 0.5;
  const lunge = monster.swing > 0 ? Math.sin((1 - monster.swing / 0.3) * Math.PI) : 0;

  const dying = deathProgress(monster);
  const foot = y + size * 0.78;

  if (dying === null) {
    drawShadow(ctx, x, foot, size * 0.82, 0.32);
  } else {
    // 넘어가면서 그림자가 길어지고 옅어집니다 — 누운 것은 바닥을 더 넓게 덮습니다
    const fall = fallEase(dying);
    drawShadow(ctx, x, foot, size * 0.82 * (1 + fall * 0.45), 0.32 * (1 - dying) * (1 - fall * 0.3));
  }

  ctx.save();
  if (dying !== null) {
    const fall = fallEase(dying);
    // 마지막 0.16초에 스러집니다. 그 전에는 또렷하게 쓰러지는 것이 보여야 합니다
    ctx.globalAlpha = dying < 0.6 ? 1 : 1 - (dying - 0.6) / 0.4;
    // 맞은 쪽 반대로 넘어갑니다 — 몬스터는 나를 보고 있으므로 등 뒤로 눕습니다
    const away = Math.cos(monster.facing) >= 0 ? -1 : 1;
    ctx.translate(x, foot);
    ctx.rotate(away * fall * 1.48);
    ctx.translate(-x, -foot);
  }

  ctx.translate(
    x + Math.cos(monster.facing) * lunge * size * 0.25 - (dying === null ? 0 : Math.cos(monster.facing) * knock(dying) * size * 0.3),
    y + (dying === null ? idle : 0),
  );

  // 왼쪽을 볼 때는 좌우를 뒤집습니다
  if (Math.cos(monster.facing) < 0) ctx.scale(-1, 1);

  const tone = shades(def.color);
  // 쓰러지는 동안에는 걷지도 숨쉬지도 않습니다
  drawMonsterBody(ctx, def.shape, size, tone, dying === null ? walk : 0, dying === null ? world.time + monster.id : 0);

  ctx.restore();

  // 맞은 순간의 번쩍임 — 마지막 일격의 번쩍임은 쓰러지는 몸과 함께 식습니다
  const flash = monsterFlash(monster, world.time);
  if (flash > 0) {
    ctx.save();
    if (dying !== null) ctx.globalAlpha = 1 - dying;
    ctx.globalCompositeOperation = 'lighter';
    // 하얗게 터졌다가 붉은 잔광으로 식습니다 — 흰색만으로는 0.12초가 눈에 안 걸렸습니다
    ctx.globalAlpha *= flash * 0.95;
    ctx.fillStyle = flash > 0.55 ? '#ffffff' : '#ff8a72';
    ctx.beginPath();
    ctx.arc(x, y, size * (1.0 + (1 - flash) * 0.35), 0, Math.PI * 2);
    ctx.fill();
    // 터지는 순간에만 테두리 한 겹 — 여러 마리가 엉켜 있을 때 누가 맞았는지 갈립니다
    if (flash > 0.55) {
      ctx.globalAlpha = (dying === null ? 1 : 1 - dying) * ((flash - 0.55) / 0.45);
      ctx.strokeStyle = '#fff2e0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, size * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 *  몬스터의 번쩍임 세기 (0~1).
 *
 *  ★ core 의 monster.hitFlash 는 0.12초짜리라 눈에 안 걸렸습니다.
 *    규칙 값을 늘리는 대신, 번쩍이 시작된 때를 그림 쪽에서 기억해 두고
 *    조금 더 길게 보여줍니다 — core 는 이 표가 있는지도 모릅니다.
 */
/**
 *  넘어가는 곡선 — 처음엔 천천히, 그다음 빨라지고, 바닥에 닿으면 멈춥니다.
 *  등속으로 눕히면 쓰러지는 게 아니라 회전하는 것으로 보입니다.
 */
function fallEase(t: number): number {
  const landed = Math.min(1, t / 0.72);
  return landed * landed;
}

/** 맞은 순간 뒤로 밀리는 정도 — 앞쪽 0.25 동안만 */
function knock(t: number): number {
  return Math.min(1, t / 0.25);
}

const FLASH_SECONDS = 0.26;
const flashStart = new Map<number, number>();

function monsterFlash(monster: Monster, now: number): number {
  //  ★ 죽으면 core 가 hitFlash 를 더 깎지 않습니다. 그대로 두면 마지막 일격의
  //    0.12 가 얼어붙어 매 프레임 다시 세워지고, 시체가 영원히 하얗게 탑니다.
  if (monster.state !== 'dead' && monster.hitFlash > 0.11) flashStart.set(monster.id, now);
  const began = flashStart.get(monster.id);
  if (began === undefined) return 0;
  const elapsed = now - began;
  if (elapsed < 0 || elapsed > FLASH_SECONDS) {
    if (elapsed > FLASH_SECONDS) flashStart.delete(monster.id);
    return 0;
  }
  return 1 - elapsed / FLASH_SECONDS;
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


