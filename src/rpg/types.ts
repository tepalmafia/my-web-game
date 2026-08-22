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

import type { TemperId } from './balance';

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

/** 세 길 — 전체설계 6.1. 총합 상한은 이 축들 위에서 걸립니다 */
export type AxisId = 'gather' | 'craft' | 'combat';

/** 칭호 — content/titles.ts 의 id */
export type TitleId = string;

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
  /**
   *  만들 때 고른 벼림.
   *  ★ 한 번 정해지면 안 바뀝니다 — 수리해도, 팔았다 사도 그대로입니다.
   *  ★ 없으면 평범한 물건입니다 (상점에서 산 것, 벼림이 생기기 전의 기록).
   */
  temper?: TemperId;
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
  /**
   *  한 번 휘두를 때 곡괭이가 닳는 양. 없으면 DURABILITY.toolPerUse (=1).
   *
   *  ★ 3층의 성격이 이 숫자입니다 (전체설계 7.2). 2층이 **무겁다** 였고
   *    3층은 **연장이 남아나지 않는다** 입니다 — 축이 짐이 아니라 소모품입니다.
   *  ★ 그래서 곡괭이를 몇 자루 지고 갈지, 어느 벼림으로 벼릴지가 판단이 됩니다.
   *    「단단하게」가 처음으로 정답이 되는 자리입니다.
   */
  toolWear?: number;
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
 *  4.5 마을 성장 — 판 것이 마을을 키운다
 * ======================================================================== */

/**
 *  내가 판 것과, 자랄 때 고른 갈래.
 *
 *  ★ 고른 것은 못 바꿉니다. 고르지 않은 쪽은 이 인물에서 영영 안 열립니다.
 */
export interface TownState {
  /**
   *  지금까지 판 것의 누계 (아이템 id → 개수).
   *  ★ 절대 깎지 않습니다. 이 인물이 판 것의 기록이고, 나중에 여기에 기록 축이 앉습니다.
   */
  sold: Record<string, number>;
  /**
   *  이미 지나간 단계가 먹은 몫 (아이템 id → 개수).
   *  ★ 지금 단계의 진행은 sold - spent 입니다. 이게 없으면 예전에 판 것이
   *    다음 단계를 미리 채워두고, 플레이어는 그게 차오르는 것을 못 봅니다.
   */
  spent: Record<string, number>;
  /** 단계마다 고른 갈래 id. ★ 길이가 곧 지금 단계입니다 */
  chosen: string[];
}

/**
 *  쓰러진 자리에 남긴 짐.
 *
 *  ★ 하나뿐입니다. 두 번 죽으면 앞의 것이 사라집니다 — 시체 밭이 되면
 *    되찾으러 가는 긴장이 사라지고 그냥 창고가 됩니다.
 *  ★ 세계가 아니라 인물에 붙습니다. 그래서 지역을 옮기거나 껐다 켜도 남습니다.
 *  ★ 수명은 바닥에 놓아둔 것과 같은 값(LOOT.placedLifetime)을 씁니다.
 */
export interface Corpse {
  mapId: MapId;
  pos: Vec2;
  items: ItemStack[];
  /** 사라질 세계 시각 */
  until: Seconds;
}

/* ===========================================================================
 *  5. 몬스터
 * ======================================================================== */

export type MonsterShape = 'beast' | 'bat' | 'spider';

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
export type MapTheme = 'town' | 'forest' | 'cave' | 'river';

/**
 *  문에 걸린 조건.
 *
 *  ★ 이 칸이 있으면 그냥 걸어 들어갈 수 없습니다. 여는 조건은 core/world.ts 의
 *    portalProblem() 이 판정합니다 — 문마다 판정을 흩어놓지 않습니다.
 *
 *  ★ 광산 아래층으로 내려가는 문들이 이 자리를 그대로 씁니다.
 *    그때 여기에 칸이 늘고 portalProblem 에 갈래가 늡니다.
 *    지금 만들어 둔 것(문이 조건을 들고 있고, 엔진이 한 함수에 물어보고,
 *    화면이 닫힌 문을 다르게 그리고, 봇이 못 지나가는 것)은 그대로 쓰입니다.
 */
export interface PortalNeeds {
  /**
   *  아직 아무도 못 엽니다. 조건이 없으니 **말할 것도 없습니다** (전체설계 4.3).
   */
  sealed?: true;
  /**
   *  입은 것의 합산이 이 값 이상이어야 열립니다.
   *
   *  ★ 한 칸을 지정하지 않습니다. 긴 칼을 고른 사람은 무기로, 갑옷을 고른 사람은
   *    갑옷으로 채웁니다 — 한쪽만 열리면 갈림길이 아니라 함정입니다 (7.3 불변식).
   */
  gear?: number;
  /**
   *  들어가면 이 문으로는 못 돌아옵니다.
   *
   *  ★ 조용히 가두지 않습니다. `portalWarning()` 이 먼저 묻고, 사람이 답해야
   *    들어갑니다 (전체설계 0장 — 잃는 것은 분명해야 하고 왜 잃었는지는 보여야 한다).
   */
  oneWay?: true;
  /** 못 열었을 때의 한 줄. 부족한 수치는 core 가 따로 붙입니다 */
  closed: string;
}

export interface Portal {
  tx: number;
  ty: number;
  to: MapId;
  toTx: number;
  toTy: number;
  label: string;
  /** 없으면 그냥 걸어 들어갑니다 */
  needs?: PortalNeeds;
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
  /**
   *  그 자리에 처음부터 놓여 있는 것 (이야기-기획안 2.3의 발도르).
   *
   *  ★ 처음 그 지역에 들어갈 때 한 번만 놓입니다 — discovered 가 그것을 압니다.
   *    안 주웠으면 바닥에 그대로 있고, world.stash 가 저장합니다.
   *    그래서 새로 저장할 것이 없습니다.
   */
  relics?: { defId: string; tx: number; ty: number }[];
  portals: Portal[];
  npcs: Npc[];
  /** 화로와 모루가 있는 자리 (제작은 여기서만) */
  forge?: { tx: number; ty: number };
  /**
   *  지도를 세로로 가르는 물길.
   *
   *  ★ 물은 못 지나갑니다(FLOOR 가 아닌 칸은 전부 막힘). 그래서 건너는 자리를
   *    ★ 데이터로 못 박습니다 — 길찾기가 알아서 뚫어주기를 기다리지 않습니다.
   */
  river?: {
    /** 물길이 지나는 세로선 (타일) */
    x: number;
    /** 좌우로 굽이치는 폭 */
    wobble: number;
    /** 물길의 두께 (타일) */
    width: number;
    /** 걸어서 건너는 여울의 y 좌표 */
    fordY: number;
  };
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
  /**
   *  제작일 때 고른 벼림.
   *  ★ 여기 실어둬야 반복 제작 중에도 고른 것이 안 풀립니다.
   */
  temper?: TemperId;
}

export interface Character {
  name: string;

  /* --- 능력치 --- */
  str: number;
  dex: number;
  int: number;
  /** 총합 상한에 닿았을 때 어느 능력치를 내릴지 정하는 순서 (가장 오래 안 쓴 것) */
  statTouched: Record<StatId, Seconds>;

  /**
   *  내가 키운 마을.
   *
   *  ★ 캐릭터에 묶습니다. 세계에 묶으면 두 번째 인물이 이미 자란 마을에서 시작해
   *    "팔아서 키울까, 써서 나를 키울까" 라는 선택이 소진된 채로 시작합니다.
   *    (나중에 넣을 ② 기록은 반대로 세계에 묶습니다)
   *
   *  ★ 지금 단계는 여기 없습니다. chosen.length 가 곧 단계입니다 —
   *    셀 수 있는 값을 따로 저장하지 않습니다.
   */
  town: TownState;
  /** 쓰러진 자리에 남긴 짐. 되찾거나, 시간이 지나거나, 다시 죽으면 없어집니다 */
  corpse: Corpse | null;

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
  /**
   *  얻은 칭호 전부. 한 번 얻은 것은 사라지지 않습니다.
   *  ★ 지금 단 것은 하나뿐입니다 (wearing) — 목적지-기획안 2.3.
   */
  titles: TitleId[];
  /** 이름 옆에 붙는 칭호. 없으면 null */
  wearing: TitleId | null;
  /**
   *  한 번 연 문.
   *
   *  ★ 문을 매번 검사하면 조건을 채운 장비를 팔았을 때 도로 닫힙니다.
   *    "층을 뚫으면 그 길이 열린 채로 남는다" (목적지-기획안 3.2) 가 그것을 금합니다.
   *    문 id 는 `${mapId}:${tx},${ty}` 입니다 — 문에 이름을 새로 붙이지 않습니다.
   */
  opened: string[];
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
  /**
   *  사라질 세계 시각. null 이면 안 사라집니다 (안전지대에 놓아둔 것).
   *
   *  ★ 남은 시간이 아니라 ★시각입니다. 다른 지역에 가 있는 동안에도 시간이
   *    흘러야 하는데, 남은 시간으로 세면 지금 보고 있는 지역만 줄어듭니다.
   */
  until: Seconds | null;
  /**
   *  사람이 일부러 놓은 것.
   *  ★ 밟아도 저절로 줍지 않습니다 — 놓고 가려는데 되집으면 놓을 수가 없습니다.
   *    가져갈 때는 눌러서 가져갑니다.
   */
  placed?: true;
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
  /**
   *  다른 지역 바닥에 놓여 있는 것들 (지역 id → 물건).
   *  ★ 지금 있는 지역의 바닥은 ground 에 있고, 나갈 때 여기로 옮겨집니다.
   *    이게 없으면 지역을 옮기는 순간 놓아둔 것이 사라져서,
   *    "돌아왔을 때 남아 있을까" 가 언제나 '아니오' 가 됩니다.
   */
  stash: Record<MapId, GroundItem[]>;
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
  /**
   *  들어가면 못 돌아오는 문 앞에 섰습니다 — 답을 기다립니다.
   *  ★ 저장하지 않습니다. "지금 문 앞에 서 있다" 는 기록할 것이 아닙니다.
   */
  pendingPortal: Portal | null;
  toast: { text: string; tone: 'good' | 'bad' | 'epic'; life: Seconds } | null;

  seed: number;

  /* --- 그림용 --- */
  meAnim: Seconds;
  meMoving: boolean;
  meSwing: Seconds;
}
