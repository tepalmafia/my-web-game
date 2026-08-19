/**
 * ===========================================================================
 *  아덴의 그림자 — 데이터 구조 확정본
 * ===========================================================================
 *
 *  게임에 등장하는 "모든 정보의 설계도"입니다.
 *
 *  ─ 여기 들어가는 것    : 어떤 정보가 존재하고, 어떤 형태인가
 *  ─ 여기 들어가지 않는 것: 실제 숫자(balance.ts), 계산 방법(core/), 화면(ui/)
 *
 *  숫자를 아무리 고쳐도 이 파일은 그대로입니다.
 *  이 파일이 바뀐다는 건 "게임에 없던 개념이 새로 생겼다"는 뜻입니다.
 */

/* ===========================================================================
 *  0. 단위 이름표 — 전부 그냥 숫자지만 이름을 붙여두면 실수가 줄어듭니다
 * ======================================================================== */

/** 초 단위 시간 */
export type Seconds = number;
/** 화면/월드 픽셀 좌표 (타일 하나 = TILE 픽셀) */
export type Px = number;
/** 골드 (이 세계의 돈) */
export type Gold = number;
/** 비율 (0 = 0%, 1 = 100%) */
export type Ratio = number;

/** 월드 위의 한 점 */
export interface Vec2 {
  x: Px;
  y: Px;
}

/* ===========================================================================
 *  1. 직업
 * ======================================================================== */

/** 기사(근접 탱커) · 요정(활 사수) · 마법사(원거리 마법) */
export type ClassId = 'knight' | 'elf' | 'wizard';

/** 직업이 태어날 때 가지는 능력치와 성장치 */
export interface ClassDef {
  id: ClassId;
  name: string;
  /** 한 줄 소개 (직업 선택 화면) */
  tagline: string;
  /** 어떤 식으로 싸우는지 설명 */
  desc: string;
  /** 화면에 그릴 때 쓰는 대표 색 */
  color: string;
  baseHp: number;
  baseMp: number;
  /** 레벨 1 오를 때마다 늘어나는 양 */
  hpPerLevel: number;
  mpPerLevel: number;
  /** 맨손 기본 피해 (무기가 없어도 이만큼은 때립니다) */
  baseMinDamage: number;
  baseMaxDamage: number;
  damagePerLevel: number;
  /** 초당 자연 회복량 */
  hpRegen: number;
  mpRegen: number;
  /** 한 번 때리는 데 걸리는 시간(초). 작을수록 빠릅니다 */
  attackInterval: Seconds;
  /** 기본 공격 사거리 (픽셀) */
  attackRange: Px;
  /** 기본 공격이 날아가는 것인지 (요정·마법사) */
  projectile: 'none' | 'arrow' | 'bolt';
  /** 이동 속도 (초당 픽셀) */
  moveSpeed: number;
  /** 명중 보정 */
  hit: number;
  /** 치명타 확률 */
  crit: Ratio;
  /** 이 직업이 들 수 있는 무기 계열 */
  weaponFamily: WeaponFamily;
  /** 마법 피해가 지팡이 마력에 비례하는가 (마법사만 true) */
  usesMagic: boolean;
}

/** 검 / 활 / 지팡이 — 직업마다 들 수 있는 계열이 다릅니다 */
export type WeaponFamily = 'sword' | 'bow' | 'staff';

/* ===========================================================================
 *  2. 아이템
 * ======================================================================== */

export type EquipSlot = 'weapon' | 'armor' | 'helmet' | 'ring';
export type ItemKind = EquipSlot | 'potion' | 'scroll' | 'misc';
export type ItemGrade = 'common' | 'rare' | 'epic' | 'legend';

/** 주문서의 종류 */
export type ScrollKind =
  /** 마법 주문서 — 강화 성공 시 +1, 실패하면 아이템이 부서집니다 */
  | 'enhance'
  /** 축복받은 마법 주문서 — 실패해도 부서지지 않고 +0 으로 돌아갑니다 */
  | 'blessedEnhance'
  /** 귀환 주문서 — 어디서든 마을로 */
  | 'return'
  /** 부활 주문서 — 죽었을 때 잃은 경험치의 절반을 되돌립니다 */
  | 'resurrect';

/**
 * 아이템의 원형(설계도). 게임에 존재하는 아이템 종류마다 하나씩 있고,
 * 절대 변하지 않습니다. 내가 가진 실물은 ItemStack 입니다.
 */
export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  grade: ItemGrade;
  desc: string;

  /** 장비일 때 — 어느 칸에 들어가는가 */
  slot?: EquipSlot;
  /** 장비일 때 — 필요 레벨 */
  reqLevel?: number;
  /** 무기일 때 — 계열 (직업 제한이 여기서 나옵니다) */
  family?: WeaponFamily;

  /** 무기 피해 */
  minDamage?: number;
  maxDamage?: number;
  /** 지팡이의 마력 — 마법사의 공격·마법 피해가 여기 비례합니다 */
  magicPower?: number;

  /** 방어구의 AC. 낮을수록(음수일수록) 좋습니다 */
  ac?: number;

  /** 부가 능력치 */
  bonusHp?: number;
  bonusMp?: number;
  bonusDamage?: number;
  bonusCrit?: Ratio;
  /** 준 피해의 몇 %를 체력으로 흡수하는가 */
  lifesteal?: Ratio;

  /** 물약일 때 회복량 */
  healHp?: number;
  healMp?: number;

  /** 주문서일 때 종류 */
  scroll?: ScrollKind;

  /** 여러 장이 한 칸에 쌓이는가 (물약·주문서·재료) */
  stackable?: boolean;
  /** 마법 주문서로 강화할 수 있는가 */
  enhanceable?: boolean;

  /** 상점 구매가. 0 이면 상점에서 팔지 않습니다 (드랍 전용) */
  price: Gold;
  /** 상점에 되팔 때 받는 값 */
  sell: Gold;
}

/** 내가 실제로 가진 아이템 한 칸 */
export interface ItemStack {
  /** 이 실물만의 고유 번호 (같은 종류라도 서로 다릅니다) */
  uid: number;
  defId: string;
  /** 강화 수치. 0 이면 강화 안 한 상태 */
  plus: number;
  /** 겹쳐진 개수 (겹칠 수 없는 장비는 항상 1) */
  count: number;
}

/** 몬스터가 떨어뜨릴 확률표의 한 줄 */
export interface DropEntry {
  defId: string;
  chance: Ratio;
  /** 몇 개 나오는가 (안 적으면 1개) */
  min?: number;
  max?: number;
}

/* ===========================================================================
 *  3. 몬스터
 * ======================================================================== */

/** 화면에 어떤 모양으로 그릴지 */
export type MonsterShape =
  | 'blob'
  | 'beast'
  | 'humanoid'
  | 'undead'
  | 'golem'
  | 'bat'
  | 'elemental'
  | 'dragon';

export interface MonsterDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  exp: number;
  /** AC — 낮을수록 단단합니다 */
  ac: number;
  minDamage: number;
  maxDamage: number;
  hit: number;
  moveSpeed: number;
  attackRange: Px;
  attackInterval: Seconds;
  /** 이 거리 안에 들어오면 먼저 덤빕니다. 0 이면 때리기 전엔 가만히 있습니다 */
  aggroRange: Px;
  /** 원거리 공격인가 */
  ranged: boolean;
  /** 그리기용 */
  shape: MonsterShape;
  color: string;
  /** 반지름 (픽셀) */
  size: number;
  goldMin: Gold;
  goldMax: Gold;
  drops: DropEntry[];
  /** 죽고 다시 나타나기까지 걸리는 시간 */
  respawn: Seconds;
  /** 보스인가 (이름표가 크게 뜨고, 리스폰 시계가 화면에 뜹니다) */
  boss?: boolean;
  /** 광역 공격을 쓰는가 (보스·주술사) */
  aoe?: {
    radius: Px;
    damageMul: number;
    /** 시전에 걸리는 시간 — 이 동안 바닥에 붉은 원이 보입니다 */
    castTime: Seconds;
    cooldown: Seconds;
  };
}

/** 지금 이 순간 맵 위에 서 있는 몬스터 한 마리 */
export interface Monster {
  id: number;
  defId: string;
  pos: Vec2;
  /** 처음 태어난 자리. 너무 멀어지면 여기로 돌아갑니다 */
  home: Vec2;
  hp: number;
  maxHp: number;
  state: 'idle' | 'chase' | 'attack' | 'return' | 'dead';
  attackCooldown: Seconds;
  /** 맞았을 때 하얗게 번쩍이는 시간 */
  hitFlash: Seconds;
  /** 이 시각까지는 플레이어를 쫓습니다 */
  aggroUntil: Seconds;
  /** 죽어 있는 동안 남은 부활 시간 */
  respawnIn: Seconds;
  /** 하는 일 없이 서성일 다음 목적지 */
  wanderTarget: Vec2 | null;
  wanderTimer: Seconds;
  /** 광역기 시전에 남은 시간 (0 이면 시전 중이 아님) */
  castTimer: Seconds;
  aoeCooldown: Seconds;
}

/* ===========================================================================
 *  4. 스킬
 * ======================================================================== */

export type SkillKind =
  /** 강한 한 방 */
  | 'strike'
  /** 여러 번 연타 */
  | 'multi'
  /** 나를 중심으로 한 광역 */
  | 'aoe'
  /** 체력 회복 */
  | 'heal'
  /** 일정 시간 능력 상승 */
  | 'buff';

export interface SkillDef {
  id: string;
  name: string;
  classId: ClassId;
  reqLevel: number;
  mpCost: number;
  cooldown: Seconds;
  kind: SkillKind;
  /** 기본 공격 대비 피해 배율 (1.0 = 평타와 같음) */
  power: number;
  /** 연타 횟수 (multi) */
  hits?: number;
  /** 광역 반경 (aoe) */
  radius?: Px;
  /** 회복량 계수 (heal) — 최대 체력의 몇 % */
  healRatio?: Ratio;
  /** 지속 시간 (buff) */
  duration?: Seconds;
  /** 버프 효과 */
  buff?: BuffEffects;
  /** 사거리 (안 적으면 기본 공격 사거리) */
  range?: Px;
  desc: string;
  color: string;
}

/** 버프가 실제로 바꿔주는 값들 */
export interface BuffEffects {
  damageMul?: number;
  attackSpeedMul?: number;
  moveSpeedMul?: number;
  /** AC 를 이만큼 빼줍니다 (더 단단해집니다) */
  acBonus?: number;
}

/** 지금 걸려 있는 버프 하나 */
export interface Buff {
  id: string;
  name: string;
  /** 이 시각이 되면 사라집니다 */
  until: Seconds;
  color: string;
  effects: BuffEffects;
}

/* ===========================================================================
 *  5. 지역(맵)
 * ======================================================================== */

export type MapId = string;
export type MapTheme = 'town' | 'field' | 'canyon' | 'cave' | 'fortress' | 'volcano';

/** 다른 지역으로 넘어가는 문 */
export interface Portal {
  /** 타일 좌표 */
  tx: number;
  ty: number;
  to: MapId;
  /** 도착 지점 (타일 좌표) */
  toTx: number;
  toTy: number;
  label: string;
  /** 권장 레벨 — 낮으면 경고가 뜹니다 (막지는 않습니다) */
  recommendLevel: number;
}

/** 마을에 서 있는 사람들 */
export type NpcKind = 'shop' | 'enhance' | 'teleport' | 'guide';

export interface Npc {
  tx: number;
  ty: number;
  kind: NpcKind;
  name: string;
  color: string;
}

export interface MapSpawn {
  monsterId: string;
  count: number;
}

export interface MapDef {
  id: MapId;
  name: string;
  theme: MapTheme;
  /** 타일 개수 */
  width: number;
  height: number;
  /** 안전지대인가 (몬스터가 없고 체력이 빨리 찹니다) */
  safe: boolean;
  /** 지형을 만들 때 쓰는 씨앗 — 같은 값이면 항상 같은 지형이 나옵니다 */
  seed: number;
  /** 장애물이 얼마나 빽빽한가 (0~1) */
  clutter: number;
  spawns: MapSpawn[];
  portals: Portal[];
  npcs: Npc[];
  /** 처음 들어갈 때 서는 자리 (타일 좌표) */
  entryTx: number;
  entryTy: number;
  /** 이 지역의 분위기 한 줄 */
  subtitle: string;
}

/** 지형까지 만들어진, 실제로 돌아다닐 수 있는 지역 */
export interface MapRuntime {
  def: MapDef;
  /** 타일 한 칸의 상태: 0 = 바닥, 1 = 벽, 2 = 나무·바위 (막힘), 3 = 물·용암 (막힘) */
  tiles: Uint8Array;
}

/* ===========================================================================
 *  6. 퀘스트
 * ======================================================================== */

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  /** 잡아야 할 몬스터와 마릿수 */
  monsterId: string;
  count: number;
  rewardExp: number;
  rewardGold: Gold;
  /** 보상 아이템 (아이템id, 개수) */
  rewardItems: { defId: string; count: number }[];
  /** 다음에 가야 할 곳 안내 */
  hint: string;
}

/* ===========================================================================
 *  7. 플레이어
 * ======================================================================== */

export interface Player {
  name: string;
  classId: ClassId;
  level: number;
  exp: number;
  hp: number;
  mp: number;
  gold: Gold;

  pos: Vec2;
  /** 마지막으로 향한 방향 (라디안) — 그림 그릴 때 씁니다 */
  facing: number;
  /** 클릭으로 찍은 목적지 */
  moveTarget: Vec2 | null;
  /** 지금 노리고 있는 몬스터 */
  targetId: number | null;

  attackCooldown: Seconds;
  skillCooldowns: Record<string, Seconds>;
  buffs: Buff[];

  equipped: Record<EquipSlot, ItemStack | null>;
  inventory: ItemStack[];

  dead: boolean;
  /** 죽고 나서 흐른 시간 */
  deadFor: Seconds;
  /** 마지막 죽음에서 잃은 경험치 (부활 주문서로 절반을 되찾습니다) */
  lostExp: number;

  /** 자동 사냥 켜짐 */
  auto: boolean;
  /** 체력이 이 비율 아래로 내려가면 물약을 자동으로 마십니다 */
  autoPotionAt: Ratio;
  /** 물약 연속 사용 제한 */
  potionCooldown: Seconds;

  /** 몬스터별 누적 처치 수 (퀘스트와 도감에 씁니다) */
  kills: Record<string, number>;
  /** 지금 진행 중인 퀘스트 번호 (퀘스트 목록의 index) */
  questIndex: number;
  /** 지금 퀘스트를 받은 뒤로 잡은 마릿수 */
  questKills: number;
  /** 순간이동으로 갈 수 있게 된 지역들 */
  discovered: MapId[];

  playSeconds: Seconds;
  deaths: number;
  bossKills: number;
}

/* ===========================================================================
 *  8. 화면에 잠깐 떴다 사라지는 것들
 * ======================================================================== */

/** 머리 위로 떠오르는 숫자 */
export interface Floater {
  id: number;
  text: string;
  pos: Vec2;
  life: Seconds;
  maxLife: Seconds;
  kind: 'damage' | 'crit' | 'taken' | 'heal' | 'exp' | 'miss' | 'info';
}

/** 칼자국, 화살, 폭발 같은 효과 */
export interface Vfx {
  id: number;
  kind: 'slash' | 'projectile' | 'impact' | 'aoe' | 'levelup' | 'warn' | 'ring';
  pos: Vec2;
  to?: Vec2;
  life: Seconds;
  maxLife: Seconds;
  color: string;
  radius?: Px;
}

/** 바닥에 떨어진 전리품 */
export interface GroundItem {
  id: number;
  defId: string;
  plus: number;
  count: number;
  pos: Vec2;
  life: Seconds;
}

/** 왼쪽 아래 기록 한 줄 */
export interface LogLine {
  id: number;
  text: string;
  tone: 'normal' | 'good' | 'bad' | 'epic';
}

/* ===========================================================================
 *  9. 세계 — 지금 이 순간의 게임 전체
 * ======================================================================== */

/** 오른쪽에 열려 있는 창 */
export type PanelId = 'inventory' | 'character' | 'shop' | 'enhance' | 'quest' | 'teleport';

export interface World {
  player: Player;
  mapId: MapId;
  map: MapRuntime;
  monsters: Monster[];
  ground: GroundItem[];
  floaters: Floater[];
  vfx: Vfx[];
  log: LogLine[];

  /** 게임이 시작된 뒤 흐른 초 */
  time: Seconds;
  /** 새 물건에 번호를 매길 때 쓰는 카운터 */
  nextId: number;
  /** 화면 중앙이 보고 있는 월드 좌표 */
  camera: Vec2;
  /**
   * 지금 걸어가고 있는 길 (남은 꺾이는 지점들).
   * 나무와 바위를 돌아가기 위해 매번 다시 구하며, 저장하지 않습니다.
   */
  path: Vec2[];
  /** 길을 다시 구하기까지 남은 시간 — 매 프레임 다시 구할 필요는 없습니다 */
  pathTimer: Seconds;
  /** 화면이 흔들리는 남은 시간 */
  shake: Seconds;

  /** 보스가 다시 나타나는 시각 (몬스터 id → time). 없으면 지금 살아 있습니다 */
  bossRespawnAt: Record<string, Seconds>;

  /** 열려 있는 창 */
  panel: PanelId | null;
  /** 말을 걸려고 걸어가는 중인 NPC — 가까워지면 창이 열립니다 */
  pendingNpc: NpcKind | null;
  /** 화면 가운데 잠깐 뜨는 큰 글씨 */
  toast: { text: string; tone: 'good' | 'bad' | 'epic'; life: Seconds } | null;
  /** 강화창에서 지금 고른 장비 */
  enhanceUid: number | null;
  /** 마지막 강화 결과 (강화창에 보여줍니다) */
  enhanceResult: { text: string; tone: 'good' | 'bad' | 'epic'; life: Seconds } | null;

  /** 난수 씨앗 (저장/복원용) */
  seed: number;
}
