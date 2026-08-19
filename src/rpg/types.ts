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
 *  ★ 이 세계에는 레벨이 없습니다.
 *    할 수 있는 일은 스킬이 정하고, 스킬은 그 일을 해야만 오릅니다.
 *    경험치도, 직업도, 착용 레벨 제한도 없습니다.
 */

/* ===========================================================================
 *  0. 단위 이름표
 * ======================================================================== */

/** 초 단위 시간 */
export type Seconds = number;
/** 월드 픽셀 좌표 (타일 하나 = TILE 픽셀) */
export type Px = number;
/** 골드 */
export type Gold = number;
/** 비율 (0 = 0%, 1 = 100%) */
export type Ratio = number;
/** 무게 단위 — 스톤. 철광석 한 덩이가 12 스톤입니다 */
export type Stones = number;

export interface Vec2 {
  x: Px;
  y: Px;
}

/* ===========================================================================
 *  1. 스킬과 능력치
 * ======================================================================== */

/**
 *  Phase 1 의 스킬은 넷뿐입니다.
 *  이 넷으로 "캐고 → 만들고 → 싸우고 → 닳으면 다시 만든다" 한 바퀴가 도는지 먼저 확인합니다.
 */
export type SkillId = 'mining' | 'blacksmithing' | 'swordsmanship' | 'defense';

/** 0.0 ~ 100.0 (소수 첫째 자리까지). 100 = 최고 경지 */
export type SkillValue = number;

/** 능력치 세 가지. 총합에 상한이 있어 하나를 키우면 다른 하나를 포기하게 됩니다 */
export type StatId = 'str' | 'dex' | 'int';

/**
 *  난이도 (0~100).
 *  광맥·제작법·몬스터가 저마다 하나씩 가지고 있으며, 스킬 성장의 기준이 됩니다.
 *  자기 스킬보다 한참 쉬운 일에서는 아무것도 배우지 못합니다.
 */
export type Difficulty = number;

/* ===========================================================================
 *  2. 아이템
 * ======================================================================== */

export type EquipSlot = 'weapon' | 'armor' | 'helmet';

export type ItemKind =
  | 'weapon'
  | 'armor'
  | 'helmet'
  /** 곡괭이·망치처럼 쓰면 닳는 연장 */
  | 'tool'
  /** 광석·주괴 */
  | 'resource'
  | 'potion';

/** 제작 품질 — 두 단계뿐입니다 */
export type Quality = 'normal' | 'fine';

/** 연장의 종류 */
export type ToolKind = 'pickaxe' | 'hammer';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  desc: string;

  /** 무게. 이 게임에서 가장 자주 부딪히는 제약입니다 */
  weight: Stones;
  /** 여러 개가 한 칸에 쌓이는가 (광석·주괴·물약) */
  stackable?: boolean;

  /** 장비일 때 어느 칸에 들어가는가 */
  slot?: EquipSlot;

  /* --- 무기 --- */
  minDamage?: number;
  maxDamage?: number;
  /** 한 번 휘두르는 데 걸리는 시간(초). 민첩이 이 값을 줄여줍니다 */
  swing?: Seconds;

  /* --- 방어구 --- */
  /** 방어값. ★ 높을수록 좋습니다 */
  defense?: number;

  /* --- 닳는 것 --- */
  /** 최대 내구도. 없으면 닳지 않는 물건입니다 */
  durability?: number;

  /* --- 연장 --- */
  tool?: ToolKind;

  /* --- 물약 --- */
  healHp?: number;

  /** 상점 구매가. 0 이면 상점에서 팔지 않습니다 */
  price: Gold;
  /** 상점에 되팔 때 받는 값 */
  sell: Gold;
}

/** 내가 실제로 가진 물건 한 칸 */
export interface ItemStack {
  uid: number;
  defId: string;
  count: number;

  /** 닳는 물건일 때 남은 내구도 */
  durability?: number;
  /**
   * 지금의 최대 내구도.
   * ★ 수리할 때마다 이 값이 줄어듭니다 — 그래서 장비는 결국 죽고, 다시 만들어야 합니다.
   */
  maxDurability?: number;
  /** 제작 품질 */
  quality?: Quality;
}

/* ===========================================================================
 *  3. 채집 — 광맥
 * ======================================================================== */

export interface VeinDef {
  id: string;
  name: string;
  /** 이 광맥을 캐는 난이도. 스킬 성장의 기준 */
  difficulty: Difficulty;
  /** 나오는 광석 */
  yields: string;
  /** 한 번 성공할 때 나오는 개수 */
  amountMin: number;
  amountMax: number;
  /** 다 캐낼 때까지의 횟수 */
  capacity: number;
  /** 고갈된 뒤 다시 차오르기까지 */
  respawn: Seconds;
  color: string;
}

/** 지금 지도 위에 있는 광맥 하나 */
export interface Vein {
  id: number;
  defId: string;
  pos: Vec2;
  /** 남은 채굴 횟수. 0 이면 고갈 */
  remaining: number;
  /** 고갈 상태에서 남은 회복 시간 */
  respawnIn: Seconds;
}

/* ===========================================================================
 *  4. 제작
 * ======================================================================== */

export interface RecipeDef {
  id: string;
  name: string;
  /** 만들어지는 물건 */
  makes: string;
  /** 몇 개가 나오는가 */
  makesCount: number;
  /** 재료 (아이템 id → 개수) */
  needs: { defId: string; count: number }[];
  /** 난이도. 성공 확률과 스킬 성장의 기준 */
  difficulty: Difficulty;
  /** 한 번 시도에 걸리는 시간 */
  seconds: Seconds;
  /** 화로가 필요한가 (제련·제작은 모두 필요, 나중에 야외 제작이 생기면 false 가 생깁니다) */
  needsForge: boolean;
}

/* ===========================================================================
 *  5. 몬스터
 * ======================================================================== */

export type MonsterShape = 'beast' | 'bat' | 'spider' | 'humanoid';

export interface MonsterDef {
  id: string;
  name: string;
  /** ★ 레벨이 아니라 난이도입니다. 명중 계산과 스킬 성장에 함께 쓰입니다 */
  difficulty: Difficulty;
  hp: number;
  minDamage: number;
  maxDamage: number;
  /** 방어값 (높을수록 단단함) */
  defense: number;
  attackRange: Px;
  attackInterval: Seconds;
  moveSpeed: number;
  /** 이 거리 안에 들어오면 먼저 덤빕니다. 0 이면 건드리기 전엔 가만히 있습니다 */
  aggroRange: Px;
  shape: MonsterShape;
  color: string;
  size: number;
  goldMin: Gold;
  goldMax: Gold;
  drops: { defId: string; chance: Ratio; min?: number; max?: number }[];
  respawn: Seconds;
}

export interface Monster {
  id: number;
  defId: string;
  pos: Vec2;
  home: Vec2;
  hp: number;
  maxHp: number;
  state: 'idle' | 'chase' | 'attack' | 'return' | 'dead';
  attackCooldown: Seconds;
  hitFlash: Seconds;
  aggroUntil: Seconds;
  respawnIn: Seconds;
  wanderTarget: Vec2 | null;
  wanderTimer: Seconds;
  /** 몬스터도 길을 찾습니다 — 지형이 무적 방패가 되지 않도록 */
  path: Vec2[];
  pathTimer: Seconds;

  /* --- 그림용 (규칙과 무관하고 저장하지 않습니다) --- */
  anim: Seconds;
  moving: boolean;
  swing: Seconds;
  facing: number;
}

/* ===========================================================================
 *  6. 지역
 * ======================================================================== */

export type MapId = string;
export type MapTheme = 'town' | 'forest' | 'cave';

export interface Portal {
  tx: number;
  ty: number;
  to: MapId;
  toTx: number;
  toTy: number;
  label: string;
}

/** 마을에 서 있는 사람들 */
export type NpcKind = 'shop' | 'smith';

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
  /** 입구에서 이만큼 떨어진 곳부터 나타납니다 (깊이 = 위험) */
  minDepth: number;
}

export interface MapVeins {
  veinId: string;
  count: number;
  minDepth: number;
}

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  theme: MapTheme;
  width: number;
  height: number;
  /** 안전지대인가 (몬스터가 없고 체력이 빨리 찹니다) */
  safe: boolean;
  /** 지형을 만드는 씨앗 — 같은 값이면 언제나 같은 지형 */
  seed: number;
  /** 장애물이 막는 칸의 비율 */
  clutter: number;
  spawns: MapSpawn[];
  veins: MapVeins[];
  portals: Portal[];
  npcs: Npc[];
  /** 화로와 모루가 있는 자리 (제작은 여기서만) */
  forge?: { tx: number; ty: number };
  entryTx: number;
  entryTy: number;
}

export interface MapRuntime {
  def: MapDef;
  /** 0 = 바닥, 1 = 벽, 2 = 나무·바위, 3 = 물 */
  tiles: Uint8Array;
}

/* ===========================================================================
 *  7. 사람 — 내 캐릭터
 * ======================================================================== */

/** 시간이 걸리는 행동. 움직이거나 맞으면 끊깁니다 */
export interface ActionState {
  kind: 'mine' | 'craft' | 'repair';
  /** 광맥 번호 또는 제작법 id 또는 수리할 물건의 uid */
  targetId: string;
  /** 한 번 완료까지 남은 시간 */
  remaining: Seconds;
  /** 한 번에 걸리는 전체 시간 (진행 막대를 그리는 데 씁니다) */
  total: Seconds;
  /** 끝나면 다시 시작할 것인가 */
  repeat: boolean;
}

export interface Character {
  name: string;

  /* --- 능력치 --- */
  str: number;
  dex: number;
  int: number;
  /** 총합 상한에 닿았을 때 어느 능력치를 내릴지 정하는 순서 (가장 오래 안 쓴 것) */
  statTouched: Record<StatId, Seconds>;

  hp: number;

  /* --- 스킬 --- */
  skills: Record<SkillId, SkillValue>;

  /* --- 위치와 행동 --- */
  pos: Vec2;
  facing: number;
  moveTarget: Vec2 | null;
  targetId: number | null;
  action: ActionState | null;
  attackCooldown: Seconds;
  potionCooldown: Seconds;

  /* --- 소지품 --- */
  equipped: Record<EquipSlot, ItemStack | null>;
  backpack: ItemStack[];
  gold: Gold;

  /* --- 기록 --- */
  dead: boolean;
  deadFor: Seconds;
  discovered: MapId[];
  playSeconds: Seconds;
  deaths: number;
  /** 무엇을 몇 개 캐고 만들고 잡았는가 (봇 지표와 기록창) */
  tally: Record<string, number>;
}

/* ===========================================================================
 *  8. 화면에 잠깐 떴다 사라지는 것들
 * ======================================================================== */

export interface Floater {
  id: number;
  text: string;
  pos: Vec2;
  life: Seconds;
  maxLife: Seconds;
  kind: 'damage' | 'crit' | 'taken' | 'heal' | 'gain' | 'miss' | 'info';
}

export interface Vfx {
  id: number;
  kind: 'slash' | 'projectile' | 'impact' | 'spark' | 'ring' | 'levelup';
  pos: Vec2;
  to?: Vec2;
  life: Seconds;
  maxLife: Seconds;
  color: string;
  radius?: Px;
}

export interface GroundItem {
  id: number;
  defId: string;
  count: number;
  pos: Vec2;
  life: Seconds;
}

export interface LogLine {
  id: number;
  text: string;
  tone: 'normal' | 'good' | 'bad' | 'epic';
}

/* ===========================================================================
 *  9. 세계
 * ======================================================================== */

export type PanelId = 'skills' | 'pack' | 'craft' | 'shop';

export interface World {
  me: Character;
  mapId: MapId;
  map: MapRuntime;
  monsters: Monster[];
  veins: Vein[];
  ground: GroundItem[];
  floaters: Floater[];
  vfx: Vfx[];
  log: LogLine[];

  time: Seconds;
  nextId: number;
  camera: Vec2;
  shake: Seconds;

  /** 걸어가는 길 (저장하지 않는 임시 상태) */
  path: Vec2[];
  pathTimer: Seconds;

  panel: PanelId | null;
  pendingNpc: NpcKind | null;
  toast: { text: string; tone: 'good' | 'bad' | 'epic'; life: Seconds } | null;

  seed: number;

  /* --- 그림용 --- */
  meAnim: Seconds;
  meMoving: boolean;
  meSwing: Seconds;
}
