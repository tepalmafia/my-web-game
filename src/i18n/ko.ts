/**
 * ===========================================================================
 *  한국어 사전
 * ===========================================================================
 *
 *  en.ts 와 똑같은 모양이어야 합니다. 항목이 하나라도 빠지거나 인자 개수가 다르면
 *  타입 검사에서 걸립니다 — 번역이 조용히 누락되는 일이 구조적으로 불가능합니다.
 *
 *  ※ 이름 뒤에 붙는 '이/가' 같은 조사는 withParticle 로 앞말에 맞춰 고릅니다.
 *    영어 사전에는 그런 처리가 필요 없어서, 문장 조립을 사전 쪽에 둔 것이 여기서 이득이 됩니다.
 */

import type { Dict } from './index';
import { withParticle } from './particle';

/** 큰 수에 세 자리마다 쉼표를 넣습니다 */
function commas(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const [whole, fraction] = String(rounded).split('.');
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export const ko: Dict = {
  meta: {
    documentTitle: 'AGI 경주',
    rootMissing: 'index.html 에서 id="root" 인 요소를 찾지 못했습니다.',
  },

  units: {
    gpus: (count) => `GPU ${count}장`,
    researchers: (count) => `연구원 ${count}명`,
    datacenters: (count) => `${count}동`,
    perSecond: '/초',
    money: (value) => {
      const sign = value < 0 ? '-' : '';
      const size = Math.abs(value);
      if (size >= 1_000_000_000_000) return `${sign}${commas(size / 1_000_000_000_000)}조 달러`;
      if (size >= 100_000_000) return `${sign}${commas(size / 100_000_000)}억 달러`;
      if (size >= 10_000) return `${sign}${commas(Math.round(size / 10_000))}만 달러`;
      return `${sign}${commas(Math.round(size))} 달러`;
    },
  },

  title: {
    eyebrow: '브라우저 게임',
    heading: '경주는 이미 시작됐다',
    body: '투자를 받고 GPU를 사고 전기를 계약해, 경쟁 연구소 세 곳보다 먼저 AGI에 도달하세요.',
    length: (duration) => `한 판은 대략 ${duration} 입니다.`,
    labelName: '연구소 이름',
    start: '연구소 가동',
    language: '언어',
  },

  bar: {
    elapsed: (duration) => `경과 ${duration}`,
    pause: '일시정지',
    resume: '재개',
    speedGroup: '게임 속도',
    speed: (multiplier) => `${multiplier}배속`,
    money: '자금',
    inTheBlack: '흑자',
    runwayLeft: (duration) => `${duration} 남음`,
    gpus: 'GPU (가동 / 보유)',
    gpusIdle: (count) => `${count}장이 놀고 있음`,
    gpusAllRunning: '전부 가동 중',
    power: '전력 (사용 / 가용)',
    powerHint: (contracted, headroom) => `계약 ${contracted} · 여유 ${headroom}`,
    researchers: '연구원',
    researchersHint: (equity, safety) => `지분 ${equity} · 안전 ${safety}`,
    progressLabel: 'AGI 진행도',
    progressAria: '내 연구소의 AGI 진행도',
    progressRate: (rate, eta) => `${rate}/초 · 완성까지 ${eta}`,
    rank: (place) => `${place}위`,
    control: (percent) => `통제 ${percent}`,
  },

  panels: {
    funding: {
      title: '투자 유치',
      description: '지분을 내주고 자금을 받습니다. 라운드가 올라갈수록 들어오는 돈도, 내주는 지분도 커집니다.',
      status: (equity) => `남은 지분 ${equity}`,
      button: (round) => `${round}차 투자 받기`,
    },
    gpu: {
      title: 'GPU 구매',
      description: "훈련 속도는 '실제로 돌아가는' GPU 수에 비례합니다. 전력이 모자라면 사둔 GPU가 놉니다.",
      status: (owned, capacity) => `${owned} / ${capacity}장`,
      buy: (count) => `+${count}장`,
      buyMax: (count) => `최대 +${count}장`,
      reserveNote: (amount) => `'최대'는 운영자금 ${amount}를 남깁니다`,
    },
    power: {
      title: '전력 계약',
      description: '계약한 용량만큼 매초 요금이 나갑니다. 실제로 쓰지 않아도 나가니 필요한 만큼만 늘리세요.',
      button: (megawatts) => `+${megawatts}`,
    },
    datacenter: {
      title: '데이터센터 건설',
      description: 'GPU를 둘 자리를 늘립니다. 한 동 지을 때마다 다음 건설비가 비싸지고 유지비도 늘어납니다.',
      status: (count) => `${count}동`,
      button: '한 동 짓기',
    },
    researcher: {
      title: '연구원 채용',
      description: '같은 GPU로도 훈련이 빨라집니다. 대신 한 명 뽑을 때마다 다음 사람의 몸값과 인건비가 올라갑니다.',
      status: (count, bonus) => `${count}명 · 속도 +${bonus}`,
      button: (count) => `+${count}명`,
    },
    safety: {
      title: '안전 조절',
      description: '검증을 건너뛰면 훈련이 빨라지지만 매초 사고 위험이 생깁니다. 사고가 나면 그 자리에서 게임이 끝납니다.',
      status: (level) => `검증 수준 ${level}`,
      sliderLabel: '안전 검증 수준',
      low: (percent) => `${percent} · 전부 건너뛰고 질주`,
      high: (percent) => `${percent} · 원칙대로 검증`,
      recklessNote: (detail) => `끝까지 낮추면 — ${detail}`,
    },
  },

  race: {
    aria: 'AGI 도달 경주 현황',
    heading: 'AGI 경주',
    finishLine: '결승선 = AGI 달성',
    unknown: '경쟁 상황은 아직 파악되지 않았습니다',
    us: '우리',
    personality: { capital: '자금력형', speed: '속도형', efficiency: '효율형' },
    status: {
      racing: '',
      sprinting: ' · 스퍼트',
      stalled: ' · 정체',
      collapsed: ' · 탈락',
      achieved: ' · 달성',
    },
  },

  facility: {
    aria: '설비 현황',
    heading: '설비 현황',
    baseCluster: '기본 클러스터',
    hall: (index) => `데이터센터 ${index}동`,
    owned: (owned, capacity) => `${owned} / ${capacity}장`,
    running: (count) => `가동 ${count}`,
    idle: (count) => `노는 중 ${count}`,
    empty: (count) => `빈 자리 ${count}`,
    idleWarning: (count) => `전력이 모자라 ${count}장이 돈만 먹고 놀고 있습니다 — 전력을 더 계약하세요.`,
  },

  rivalActions: {
    aria: '경쟁사 대응',
    heading: '경쟁사 대응',
    description: '내 설비를 키우는 대신 상대를 늦추는 데 돈을 씁니다. 늦춘 효과는 시간이 지나면 풀립니다.',
    speed: (percent) => `속도 ${percent}`,
    intel: '첩보',
    poach: '인재 빼오기',
    lockSupply: 'GPU 물량 선점 — 경쟁사 전체를 늦춥니다',
  },

  selfResearch: {
    aria: '자율 연구',
    heading: '자율 연구',
    depth: (percent) => `자기개선 ${percent} 진입`,
    description:
      '모델이 스스로 연구를 돕고 있습니다. 그 힘을 가속에 쓸수록 빨라지지만 통제력이 깎이고, 정렬에 쓸수록 통제력이 회복되지만 경쟁사에 뒤처집니다.',
    control: '통제력',
    controlAria: '통제력',
    controlChange: (change) => `(${change}/초)`,
    recovering: '통제력이 회복되고 있습니다',
    untilLost: (duration) => `이대로면 ${duration} 뒤 통제를 잃습니다`,
    speedShare: (percent) => `가속 ${percent}`,
    alignmentShare: (percent) => `정렬 ${percent}`,
    speedBonus: (percent) => `연구 속도 +${percent}`,
    sliderLabel: '자율 연구력 배분 (오른쪽으로 갈수록 정렬)',
  },

  alerts: {
    cashDanger: (duration) => `자금 고갈까지 ${duration} — 곧 파산합니다`,
    cashWarn: (duration) => `자금이 ${duration} 뒤에 바닥납니다`,
    powerDanger: (percent) => `GPU의 ${percent}가 전력이 없어 멈춰 있습니다`,
    powerWarn: (percent) => `GPU의 ${percent}가 놀고 있습니다`,
    behindDanger: (name, points) => `${name}에 ${points} 뒤처졌습니다`,
    behindWarn: (name) => `${withParticle(name, '이', '가')} 앞서 있습니다`,
    nearFinish: (names) => `${withParticle(names, '이', '가')} 결승선에 근접했습니다`,
    controlDanger: (duration) => `통제력 소진까지 ${duration} — 정렬 배분을 올리세요`,
    controlWarn: (duration) => `통제력이 ${duration} 뒤에 바닥납니다`,
    safetyDanger: (percent) => `안전 검증 ${percent} — 언제 사고가 나도 이상하지 않습니다`,
    safetyWarn: '안전 검증을 줄인 상태입니다',
  },

  logPanel: { heading: '기록', empty: '아직 기록이 없습니다.' },

  eventModal: { eyebrow: '사건 발생' },

  log: {
    opening: '투자를 유치하고 GPU를 사서 훈련을 시작하세요. 경쟁 연구소 세 곳이 이미 달리고 있습니다.',
    started: (lab) => `${lab} 가동을 시작합니다.`,
    selfImproving:
      '모델이 스스로 연구를 돕기 시작했습니다 — 이제부터는 무엇을 사느냐보다 그 힘을 어디에 쓰느냐가 승패를 가릅니다.',
    marketNormal: '시장 가격이 평상시 수준으로 돌아왔습니다.',
    rivalCollapsed: (name) => `${withParticle(name, '이', '가')} 훈련 사고로 경주에서 이탈했습니다.`,
    accident: '검증을 건너뛴 훈련에서 통제 불능 사고가 발생했습니다. 모든 연구가 여기서 멈춥니다.',
    eventFired: (title) => `사건 발생 — ${title}`,
    unlockPower: '전력이 모자라 GPU 일부가 놀고 있습니다 — 전력 계약 항목이 열렸습니다.',
    unlockDatacenter: 'GPU를 둘 자리가 가득 찼습니다 — 데이터센터 건설 항목이 열렸습니다.',
    unlockResearchers: '연구 규모가 커졌습니다 — 연구원 채용 항목이 열렸습니다.',
    unlockRivals: '경쟁사 동향을 파악할 수 있게 되었습니다 — 경쟁사 상황판이 열렸습니다.',
    unlockSafety: '안전 검증 수준을 조절할 수 있게 되었습니다 — 무리하면 사고가 납니다.',
    playerWon: (lab) => `${withParticle(lab, '이', '가')} 가장 먼저 AGI에 도달했습니다.`,
    rivalWon: (name) => `${withParticle(name, '이', '가')} 먼저 AGI에 도달했습니다.`,
    bankrupt: '자금이 바닥나 연구소를 더 이상 운영할 수 없습니다.',
    catastrophe: '통제 불능 사고로 연구가 중단되었습니다.',
    controlLost: '자기개선에 들어간 모델이 우리 손을 벗어났습니다.',
    ended: '게임이 끝났습니다.',
    funding: (round, amount, equity) => `${round}차 투자 유치 — ${amount}를 확보했습니다. 남은 지분 ${equity}.`,
    buyingGpus: 'GPU를 사들이는 중',
    buyingGpusLine: (owned) => `GPU를 사들이는 중 — 현재 ${owned}장 보유.`,
    hiring: '연구원을 늘리는 중',
    hiringLine: (count) => `연구원을 늘리는 중 — 현재 ${count}명.`,
    powerContracted: (megawatts, cost) => `전력 ${megawatts}를 새로 계약했습니다 (설치비 ${cost}).`,
    datacenterBuilt: (count, cost, capacity) =>
      `데이터센터 ${count}동째를 완공했습니다 (${cost}). GPU 자리가 ${capacity}장으로 늘었습니다.`,
    intel: (name, progress) => `첩보 입수 — ${name}의 실제 진행도는 ${progress}입니다.`,
    poached: (name, count, cost, cut) =>
      `${name}의 핵심 연구원 ${count}명을 영입했습니다 (${cost}). 한동안 크게 느려지고, 그중 ${cut}는 영구히 돌아오지 않습니다.`,
    supplyLocked: 'GPU 물량을 선점했습니다 — 경쟁사 전체가 느려졌지만 당분간 내 GPU 값도 오릅니다.',
    safetyDown: (level) => `안전 검증 수준을 ${level}로 낮췄습니다. 훈련이 빨라지는 대신 사고 위험이 올라갑니다.`,
    safetyUp: (level) => `안전 검증 수준을 ${level}로 올렸습니다.`,
    fallbackRivalName: '경쟁 연구소',
  },

  end: {
    won: {
      headline: '우리가 먼저 도달했다',
      body: (lab) =>
        `${withParticle(lab, '이', '가')} 세계 최초로 AGI에 도달했습니다. 경쟁 연구소 세 곳은 결승선을 눈앞에 두고 멈춰 섰습니다.`,
      badge: '승리',
    },
    rivalWon: {
      headline: '한발 늦었다',
      body: (name) => `${withParticle(name, '이', '가')} 먼저 AGI에 도달했습니다. 우리 클러스터는 아직 훈련 중이었습니다.`,
      badge: '패배',
    },
    bankrupt: {
      headline: '통장이 먼저 말랐다',
      body: '전기 요금과 인건비가 매출을 앞질렀습니다. GPU는 그대로 있지만 더 이상 돌릴 돈이 없습니다.',
      badge: '패배',
    },
    catastrophe: {
      headline: '통제 불능',
      body: '검증을 건너뛴 훈련에서 사고가 났습니다. 앞서 나가기 위해 치른 대가였고, 되돌릴 방법은 없었습니다.',
      badge: '패배',
    },
    controlLost: {
      headline: '더 이상 우리 것이 아니다',
      body: '자기개선에 들어간 모델이 우리 손을 벗어났습니다. 가속에 쏟은 만큼 정렬에 쏟지 않았고, 되돌릴 시간은 남아 있지 않았습니다.',
      badge: '통제 상실',
    },
    unknown: { headline: '판이 끝났다', body: '게임이 종료되었습니다.', badge: '종료' },
    elapsed: '경과 시간',
    finalProgress: '최종 진행도',
    finalEquity: '최종 지분',
    finalMoney: '남은 자금',
    standings: '최종 순위',
    place: (index) => `${index}위`,
    us: '우리',
    progressAria: (name) => `${name} 최종 진행도`,
    restart: '다시 하기',
  },

  share: {
    outcome: {
      agiAchieved: 'AGI 달성 — 승리',
      rivalWon: '경쟁 연구소에 선수를 빼앗김',
      bankrupt: '자금이 바닥나 연구소 폐쇄',
      catastrophe: '안전을 무시하다 사고 발생',
      controlLost: '자기개선하는 모델을 놓침',
    },
    inProgress: '진행 중',
    headline: (outcome) => `AGI 경주 🏁 ${outcome}`,
    line2: (lab, duration, progress) => `${lab} · ${duration} · 진행도 ${progress}`,
    line3: (gpus, researchers, equity) => `GPU ${gpus}장 · 연구원 ${researchers}명 · 남은 지분 ${equity}`,
    tauntWin: '더 빨리 도달할 수 있나요?',
    tauntLose: '당신은 더 잘할 수 있나요?',
    button: '결과 자랑하기',
    copied: '복사했습니다 — 붙여넣기만 하면 됩니다',
    failed: '이 브라우저에서는 자동 복사가 막혀 있습니다. 아래 글을 직접 복사해 주세요.',
  },

  violations: {
    panel: {
      funding: '투자 유치',
      gpu: 'GPU 구매',
      power: '전력 계약',
      datacenter: '데이터센터',
      researchers: '연구원',
      rivals: '경쟁사 상황판',
      safety: '안전 조절',
      unknown: '해당 항목',
    },
    insufficientFunds: (short) => `자금이 ${short} 부족합니다`,
    gpuCapacity: (capacity, current, requested) =>
      `GPU를 둘 자리가 없습니다 (한도 ${capacity}장 · 보유 ${current}장 · 요청 ${requested}장)`,
    gpuSlotsShort: (missing) => `GPU 자리가 ${missing}장 모자랍니다 (데이터센터를 먼저 지으세요)`,
    powerShortage: (demand, available) => `전력이 부족합니다 (필요 ${demand} · 사용 가능 ${available})`,
    equityExhausted: '남은 지분이 없어 더 이상 투자를 받을 수 없습니다',
    panelLocked: (panel) => `${panel} 조건을 아직 만족하지 못했습니다`,
    notRunning: '지금은 진행할 수 없습니다 (일시정지 중이거나 게임이 끝났습니다)',
    generic: '지금은 할 수 없습니다',
  },

  availability: {
    eventOpen: '먼저 사건 창에서 결정을 내려 주세요',
    notStarted: '아직 게임을 시작하지 않았습니다',
    alreadyEnded: '이미 끝난 판입니다',
    pausedNow: '일시정지 중입니다. 재개한 뒤에 눌러 주세요',
    alreadyPlaying: '이미 게임이 진행 중입니다',
    tickPositive: '흐른 시간은 0보다 커야 합니다',
    startDetail: (name) => `'${name}' 이름으로 새 판을 시작합니다`,
    pauseOn: '시간을 잠시 멈춥니다',
    pauseOff: '멈췄던 시간을 다시 흐르게 합니다',
    badSpeed: '고를 수 없는 속도입니다',
    speedDetail: (multiplier) => `${multiplier}배 속도로 진행합니다`,
    restartDetail: '지금 판을 접고 처음부터 다시 시작합니다',
    noEvent: '지금은 답해야 할 사건이 없습니다',
    badChoice: '고를 수 없는 선택지입니다',
    fundingDetail: (amount, equity) => `자금 +${amount} · 지분 ${equity} 내줌`,
    fundingWaitDetail: (duration) => `다음 라운드까지 ${duration} 남음`,
    fundingProgressDetail: (progress) => `진행도 ${progress} 이상이어야 다음 투자를 받습니다`,
    fundingNoEquity: '더 내줄 지분이 남지 않았습니다',
    fundingTooSoon: (duration) => `투자자들이 아직 다음 라운드를 열지 않았습니다 (${duration} 남음)`,
    fundingNeedProgress: (progress) => `성과가 더 필요합니다 (진행도 ${progress} 이상)`,
    gpuMinimum: 'GPU는 한 장 이상부터 살 수 있습니다',
    gpuDetail: (price, power) => `장당 ${price} · 전력 ${power} 더 필요`,
    powerMinimum: '계약할 전력은 0보다 커야 합니다',
    powerDetail: (megawatts, burn) => `전력 +${megawatts} · 초당 ${burn} 추가`,
    datacenterDetail: (slots, upkeep) => `GPU 자리 +${slots}장 · 초당 ${upkeep} 추가`,
    hireMinimum: '연구원은 한 명 이상부터 뽑을 수 있습니다',
    hireDetail: (speed, payroll) => `연구 속도 +${speed} · 초당 ${payroll} 추가`,
    hireShort: '자금이 부족합니다',
    safetyRange: (low, high) => `안전 수준은 ${low} ~ ${high} 사이에서만 정할 수 있습니다`,
    safetyDetail: (speed, risk) => `연구 속도 +${speed} · 매초 사고 위험 ${risk}`,
    allocationRange: '배분은 0% ~ 100% 사이에서만 정할 수 있습니다',
    allocationDetail: (speed, control) => `연구 속도 +${speed} · 통제력 ${control}/초`,
    notSelfImproving: '아직 모델이 스스로 연구할 만큼 성장하지 않았습니다',
    intelDetail: '그 연구소의 실제 진행도를 기록에 남깁니다',
    noSuchRival: '그런 연구소가 없습니다',
    rivalCollapsed: '이미 경주에서 빠진 곳입니다',
    rivalAchieved: '이미 끝난 상대입니다',
    poachDetail: (researchers, slow) => `연구원 +${researchers}명 · 상대 속도 ${slow} 감소`,
    lockDetail: (slow, price, duration) => `경쟁사 전체 속도 ${slow} 감소 · 내 GPU 값 ${price}배 (${duration})`,
    noRivalsLeft: '늦출 상대가 남아 있지 않습니다',
    generic: '지금은 할 수 없습니다',
    deltaMoney: (amount) => `자금 ${amount}`,
    deltaGpus: (count) => `GPU ${count}장`,
    deltaPower: (megawatts) => `전력 ${megawatts}`,
    deltaProgress: (percent) => `진행도 ${percent}`,
    deltaDatacenters: (count) => `데이터센터 ${count}동`,
    deltaResearchers: (count) => `연구원 ${count}명`,
    deltaEquity: (percent) => `지분 ${percent}`,
    deltaSafety: (percent) => `안전 ${percent}`,
  },

  names: {
    defaultLab: '아우로라 AI',
    rivals: {
      'rival-helion': '헬리온 리서치',
      'rival-vex': '벡스 랩스',
      'rival-orin': '오린 인스티튜트',
    },
  },

  events: {
    'event-gpu-allocation': {
      title: 'GPU 물량 배정에서 밀렸다',
      description:
        '파운드리가 이번 분기 생산분을 대형 고객들에게 먼저 배정했습니다. 우리 주문은 뒤로 밀렸습니다. 한 중개상이 웃돈을 얹으면 확보해둔 물량을 지금 바로 넘기겠다고 연락해왔습니다.',
      choices: [
        {
          label: '웃돈을 주고 300장을 확보한다',
          hint: '큰돈이 한 번에 나가지만 훈련 일정은 지킵니다',
          logText: '중개상에게 웃돈을 주고 GPU 300장을 확보했습니다.',
        },
        {
          label: '이번 분기는 건너뛴다',
          hint: '돈은 아끼지만 한동안 GPU 값이 크게 뜁니다',
          logText: '물량 확보를 포기했습니다. 당분간 GPU 값이 1.8배로 뜁니다.',
        },
      ],
    },
    'event-nextgen-accelerator': {
      title: '차세대 가속기 공개',
      description:
        '경쟁 제조사가 새 세대 가속기를 공개했습니다. 성능 차이는 분명하지만 물량이 풀리려면 시간이 걸립니다. 그 사이 현행 세대는 재고 정리에 들어갑니다.',
      choices: [
        {
          label: '선주문하고 클러스터를 개조한다',
          hint: '큰돈이 나가는 대신 훈련이 단번에 앞으로 갑니다',
          logText: '차세대 가속기로 클러스터를 개조해 훈련이 크게 앞당겨졌습니다.',
        },
        {
          label: '재고 정리에 들어간 현행 세대를 노린다',
          hint: '한동안 GPU를 30% 싸게 살 수 있습니다',
          logText: '현행 세대 재고를 노립니다. 당분간 GPU 값이 30% 싸집니다.',
        },
      ],
    },
    'event-grid-overload': {
      title: '지역 송전망 과부하',
      description:
        '무더위로 지역 전체 수요가 몰리면서 우리 단지에 걸린 송전망이 한계에 닿았습니다. 전력회사는 자체 발전 설비를 마련하든지 계약 용량을 반납하든지 택하라고 통보했습니다.',
      choices: [
        {
          label: '비상 발전기를 임대해 그대로 돌린다',
          hint: '돈은 나가지만 GPU를 한 장도 세우지 않습니다',
          logText: '비상 발전기를 임대해 훈련을 멈추지 않았습니다.',
        },
        {
          label: '계약 전력 3MW를 반납한다',
          hint: '전기 요금은 줄지만 GPU 일부가 놀게 됩니다',
          logText: '계약 전력 3MW를 반납했습니다. GPU 일부가 놀게 됩니다.',
        },
      ],
    },
    'event-tariff-hike': {
      title: '전력 요금 인상 통보',
      description:
        '전력회사가 다음 분기 요금 인상을 통보했습니다. 다만 지금 한 번에 선납하면 인상분을 면제하고 오히려 할인가를 적용해주겠다고 제안합니다.',
      choices: [
        {
          label: '선납해서 할인가를 확보한다',
          hint: '지금 돈이 나가지만 한동안 전기 요금이 싸집니다',
          logText: '요금을 선납해 한동안 전기 요금을 10% 깎았습니다.',
        },
        {
          label: '선납하지 않고 인상분을 감수한다',
          hint: '지금은 안 쓰지만 한동안 전기 요금이 1.6배가 됩니다',
          logText: '전기 요금이 한동안 1.6배로 오릅니다.',
        },
      ],
    },
    'event-export-control': {
      title: '고성능 가속기 수출 통제 발효',
      description:
        '정부가 고성능 가속기의 반출입을 통제하기 시작했습니다. 규정을 지키려면 설계를 다시 손봐야 하고, 우회 경로를 쓰면 물량은 들어오지만 내부 검증 절차를 건너뛰게 됩니다.',
      choices: [
        {
          label: '규정에 맞춰 설계를 다시 한다',
          hint: '우리가 밀리지만 경쟁사도 같이 밀립니다',
          logText: '통제 규정에 맞춰 설계를 고쳤습니다. 업계 전체가 함께 느려집니다.',
        },
        {
          label: '우회 조달 경로로 400장을 들여온다',
          hint: '지금은 이득이지만 검증이 헐거워져 사고 위험이 올라갑니다',
          logText: '우회 경로로 GPU 400장을 들여왔습니다. 내부 검증 절차가 헐거워졌습니다.',
        },
      ],
    },
    'event-senate-hearing': {
      title: '의회 청문회 소환',
      description:
        '의회가 프런티어 모델을 만드는 연구소 대표들을 불러세웠습니다. 직접 나가면 며칠을 통째로 쓰게 되고, 대리인만 보내면 시간은 아끼지만 곱지 않은 시선이 남습니다.',
      choices: [
        {
          label: '대표가 직접 출석해 성실히 답한다',
          hint: '며칠을 잃는 대신 검증 체계를 정비합니다',
          logText: '청문회에 직접 출석했습니다. 훈련은 며칠 밀렸지만 검증 체계를 정비했습니다.',
        },
        {
          label: '법무 대리인만 보내고 훈련을 계속한다',
          hint: '일정은 지키지만 돈이 나가고 감시가 심해집니다',
          logText: '대리인만 보냈습니다. 훈련은 멈추지 않았지만 감시가 심해졌습니다.',
        },
      ],
    },
    'event-poaching': {
      title: '경쟁사의 스카웃 공세',
      description:
        '경쟁 연구소가 우리 핵심 연구원들에게 두 배에 가까운 조건을 제시했습니다. 붙잡으려면 보상 체계를 다시 짜야 하고, 놓치면 그들은 곧장 상대편 훈련에 투입됩니다.',
      choices: [
        {
          label: '보상을 올려 붙잡는다',
          hint: '지금 큰돈이 나가지만 인력을 그대로 지킵니다',
          logText: '보상 체계를 다시 짜서 핵심 연구원들을 붙잡았습니다.',
        },
        {
          label: '보내주고 남은 인원으로 간다',
          hint: '인건비는 줄지만 경쟁사 한 곳이 빨라집니다',
          logText: '연구원 2명이 경쟁사로 떠났습니다.',
        },
      ],
    },
    'event-internal-warning': {
      title: '내부 안전팀의 경고',
      description:
        '내부 평가팀이 최근 체크포인트에서 설명되지 않는 행동을 발견했다고 보고했습니다. 전면 점검을 하려면 훈련을 세워야 하고, 기록만 남기고 넘어가면 일정은 지킬 수 있습니다.',
      choices: [
        {
          label: '훈련을 세우고 전면 점검한다',
          hint: '진행이 밀리는 대신 사고 확률이 내려갑니다',
          logText: '훈련을 세우고 전면 점검했습니다. 검증 수준이 올라갔습니다.',
        },
        {
          label: '기록만 남기고 계속 돌린다',
          hint: '일정은 지키지만 사고 확률이 올라갑니다',
          logText: '경고를 기록만 남기고 훈련을 계속합니다.',
        },
      ],
    },
    'event-sovereign-fund': {
      title: '국부펀드의 대형 투자 제안',
      description:
        '해외 국부펀드가 한 번에 8,000만 달러를 넣겠다고 제안했습니다. 대신 지분을 상당히 요구합니다. 거절하면 그 돈은 곧장 다른 연구소로 갈 것입니다.',
      choices: [
        {
          label: '제안을 받아들인다',
          hint: '자금이 크게 들어오지만 지분 12%를 내줍니다',
          logText: '국부펀드 투자를 받아 8,000만 달러를 확보했습니다. 지분 12%를 넘겼습니다.',
        },
        {
          label: '지분을 지키고 거절한다',
          hint: '지분은 지키지만 그 자금이 경쟁사로 갑니다',
          logText: '투자를 거절했습니다. 그 자금은 경쟁사 한 곳으로 흘러갔습니다.',
        },
      ],
    },
    'event-joint-training': {
      title: '공동 훈련 컨소시엄 제안',
      description:
        '대학 연합이 공동 훈련 컨소시엄을 제안했습니다. 우리 클러스터 일부를 내주는 대신 그들이 몇 년간 쌓은 데이터와 방법론을 통째로 넘겨받습니다.',
      choices: [
        {
          label: 'GPU 500장을 내주고 참여한다',
          hint: '설비는 줄지만 훈련이 크게 앞으로 갑니다',
          logText: '컨소시엄에 참여해 데이터와 방법론을 넘겨받았습니다.',
        },
        {
          label: '단독 노선을 유지한다',
          hint: '설비는 지키지만 연합이 경쟁사들과 손을 잡습니다',
          logText: '컨소시엄 참여를 거절했습니다. 연합은 경쟁사들과 손을 잡았습니다.',
        },
      ],
    },
  },
};
