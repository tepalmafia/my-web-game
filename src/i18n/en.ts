/**
 * ===========================================================================
 *  English dictionary — the reference shape
 * ===========================================================================
 *
 *  이 파일의 모양이 곧 '있어야 할 문구 목록'입니다.
 *  ko.ts 는 이 파일과 똑같은 항목을 가져야 하고, 하나라도 빠지면 타입 검사에서 걸립니다.
 *
 *  ─ 값이 함수인 항목
 *    숫자나 이름이 끼어드는 문장입니다. 인자는 이미 보기 좋게 다듬어진 글자로 들어옵니다
 *    (예: money 는 '$45.0M' 같은 완성된 문자열). 사전은 조립만 합니다.
 */

import type { EventKey } from '../state/events';

/** 사건 하나에 필요한 글 묶음 */
interface EventCopy {
  title: string;
  description: string;
  choices: { label: string; hint?: string; logText: string }[];
}

export const en = {
  // ── 화면 밖 (문서 제목 등) ────────────────────────────────
  meta: {
    documentTitle: 'AGI Race',
    rootMissing: 'Could not find the element with id="root" in index.html.',
  },

  // ── 자주 쓰는 단위와 조각 ─────────────────────────────────
  units: {
    gpus: (count: string) => `${count} GPUs`,
    researchers: (count: string) => `${count} researchers`,
    datacenters: (count: string) => `${count} halls`,
    perSecond: '/s',
    /** 돈을 사람이 읽기 좋은 단위로 (예: 32000000 → '$32.0M') */
    money: (value: number): string => {
      const sign = value < 0 ? '-' : '';
      const size = Math.abs(value);
      if (size >= 1_000_000_000_000) return `${sign}$${(size / 1_000_000_000_000).toFixed(2)}T`;
      if (size >= 1_000_000_000) return `${sign}$${(size / 1_000_000_000).toFixed(2)}B`;
      if (size >= 1_000_000) return `${sign}$${(size / 1_000_000).toFixed(1)}M`;
      if (size >= 1_000) return `${sign}$${(size / 1_000).toFixed(0)}K`;
      return `${sign}$${Math.round(size)}`;
    },
  },

  // ── 시작 화면 ─────────────────────────────────────────────
  title: {
    eyebrow: 'BROWSER GAME',
    heading: 'The race has already started',
    body: 'Raise funding, buy GPUs, contract electricity, and reach AGI before the other three labs.',
    length: (duration: string) => `A run takes about ${duration}.`,
    labelName: 'Lab name',
    start: 'Start the lab',
    language: 'Language',
  },

  // ── 상단 표시줄 ───────────────────────────────────────────
  bar: {
    elapsed: (duration: string) => `Elapsed ${duration}`,
    pause: 'Pause',
    resume: 'Resume',
    speedGroup: 'Game speed',
    speed: (multiplier: string) => `${multiplier}x`,
    money: 'Cash',
    inTheBlack: 'positive',
    runwayLeft: (duration: string) => `${duration} left`,
    gpus: 'GPUs (running / owned)',
    gpusIdle: (count: string) => `${count} sitting idle`,
    gpusAllRunning: 'all running',
    power: 'Power (used / available)',
    powerHint: (contracted: string, headroom: string) =>
      `contracted ${contracted} · ${headroom} spare`,
    researchers: 'Researchers',
    researchersHint: (equity: string, safety: string) =>
      `equity ${equity} · safety ${safety}`,
    progressLabel: 'AGI progress',
    progressAria: 'AGI progress of my lab',
    progressRate: (rate: string, eta: string) => `${rate}/s · ${eta} to go`,
    rank: (place: number) => `#${place}`,
    control: (percent: string) => `control ${percent}`,
  },

  // ── 조작 패널 ─────────────────────────────────────────────
  panels: {
    funding: {
      title: 'Raise funding',
      description:
        'Trade equity for cash. Later rounds bring in more, and cost more of the company.',
      status: (equity: string) => `${equity} equity left`,
      button: (round: number) => `Close round ${round}`,
    },
    gpu: {
      title: 'Buy GPUs',
      description:
        'Training speed follows the GPUs that actually run. Without power, the ones you bought sit idle.',
      status: (owned: string, capacity: string) => `${owned} / ${capacity}`,
      buy: (count: string) => `+${count}`,
      buyMax: (count: string) => `Max +${count}`,
      reserveNote: (amount: string) => `"Max" keeps ${amount} of operating cash`,
    },
    power: {
      title: 'Contract power',
      description:
        'You pay every second for the capacity you contract, used or not. Add only what you need.',
      button: (megawatts: string) => `+${megawatts}`,
    },
    datacenter: {
      title: 'Build a datacenter',
      description:
        'Adds room for GPUs. Each hall makes the next one pricier and adds upkeep.',
      status: (count: string) => `${count} halls`,
      button: 'Build one hall',
    },
    researcher: {
      title: 'Hire researchers',
      description:
        'The same GPUs train faster. Each hire raises the price and payroll of the next one.',
      status: (count: string, bonus: string) => `${count} · speed +${bonus}`,
      button: (count: string) => `+${count}`,
    },
    safety: {
      title: 'Safety level',
      description:
        'Skipping verification trains faster but risks an accident every second. An accident ends the run on the spot.',
      status: (level: string) => `verification ${level}`,
      sliderLabel: 'Safety verification level',
      low: (percent: string) => `${percent} · skip everything and sprint`,
      high: (percent: string) => `${percent} · verify by the book`,
      recklessNote: (detail: string) => `All the way down — ${detail}`,
    },
  },

  // ── 레이스 트랙 ───────────────────────────────────────────
  race: {
    aria: 'AGI race standings',
    heading: 'AGI race',
    finishLine: 'finish line = AGI',
    unknown: 'Rival progress is not visible yet',
    us: 'us',
    personality: { capital: 'capital-heavy', speed: 'speed-first', efficiency: 'efficiency' },
    status: { racing: '', sprinting: ' · sprinting', stalled: ' · stalled', collapsed: ' · out', achieved: ' · done' },
  },

  // ── 설비 현황 ─────────────────────────────────────────────
  facility: {
    aria: 'Facility status',
    heading: 'Facilities',
    baseCluster: 'Base cluster',
    hall: (index: number) => `Datacenter ${index}`,
    owned: (owned: string, capacity: string) => `${owned} / ${capacity}`,
    running: (count: string) => `running ${count}`,
    idle: (count: string) => `idle ${count}`,
    empty: (count: string) => `free slots ${count}`,
    idleWarning: (count: string) =>
      `${count} GPUs are burning cash without working — contract more power.`,
  },

  // ── 경쟁사 대응 ───────────────────────────────────────────
  rivalActions: {
    aria: 'Rival countermeasures',
    heading: 'Rival countermeasures',
    description:
      'Spend on holding them back instead of growing yourself. The slowdown wears off over time.',
    speed: (percent: string) => `speed ${percent}`,
    intel: 'Buy intel',
    poach: 'Poach staff',
    lockSupply: 'Lock up GPU supply — slows every rival',
  },

  // ── 자율 연구 (후반) ──────────────────────────────────────
  selfResearch: {
    aria: 'Self-improvement',
    heading: 'Self-improvement',
    depth: (percent: string) => `${percent} into it`,
    description:
      'The model is now doing its own research. Point it at speed and you go faster while control slips; point it at alignment and control recovers while the rivals close in.',
    control: 'Control',
    controlAria: 'Control',
    controlChange: (change: string) => `(${change}/s)`,
    recovering: 'Control is recovering',
    untilLost: (duration: string) => `At this rate you lose control in ${duration}`,
    speedShare: (percent: string) => `Speed ${percent}`,
    alignmentShare: (percent: string) => `Alignment ${percent}`,
    speedBonus: (percent: string) => `research +${percent}`,
    sliderLabel: 'Capability allocation (right is alignment)',
  },

  // ── 위험 경고 ─────────────────────────────────────────────
  alerts: {
    cashDanger: (duration: string) => `Bankrupt in ${duration} — act now`,
    cashWarn: (duration: string) => `Cash runs out in ${duration}`,
    powerDanger: (percent: string) => `${percent} of your GPUs are stopped for lack of power`,
    powerWarn: (percent: string) => `${percent} of your GPUs are idle`,
    behindDanger: (name: string, points: string) => `${points} behind ${name}`,
    behindWarn: (name: string) => `${name} is ahead of you`,
    nearFinish: (names: string) => `${names} closing on the finish line`,
    controlDanger: (duration: string) => `Control gone in ${duration} — raise alignment`,
    controlWarn: (duration: string) => `Control runs out in ${duration}`,
    safetyDanger: (percent: string) => `Verification at ${percent} — an accident could happen any second`,
    safetyWarn: 'Safety verification is turned down',
  },

  // ── 기록창 ────────────────────────────────────────────────
  logPanel: { heading: 'Log', empty: 'Nothing logged yet.' },

  // ── 사건 창 ───────────────────────────────────────────────
  eventModal: { eyebrow: 'INCIDENT' },

  // ── 기록에 남는 문장 ──────────────────────────────────────
  log: {
    opening:
      'Raise funding and buy GPUs to start training. Three rival labs are already running.',
    started: (lab: string) => `${lab} is now operating.`,
    selfImproving:
      'The model started doing its own research — from here, where you point it matters more than what you buy.',
    marketNormal: 'Market prices are back to normal.',
    rivalCollapsed: (name: string) => `${name} dropped out of the race after a training accident.`,
    rivalAbsorbed: 'The surviving labs are taking on their people and hardware.',
    accident:
      'Skipping verification caused a loss-of-control accident. All research stops here.',
    eventFired: (title: string) => `Incident — ${title}`,
    unlockPower: 'GPUs are idling for lack of power — power contracts are now available.',
    unlockDatacenter: 'Your GPU slots are full — datacenter construction is now available.',
    unlockResearchers: 'The effort has grown — you can now hire researchers.',
    unlockRivals: 'You can now track what the rival labs are doing.',
    unlockSafety: 'You can now dial safety verification up or down — push it and accidents happen.',
    playerWon: (lab: string) => `${lab} reached AGI first.`,
    rivalWon: (name: string) => `${name} reached AGI first.`,
    bankrupt: 'The money ran out. The lab cannot keep operating.',
    catastrophe: 'A loss-of-control accident stopped all research.',
    controlLost: 'The self-improving model slipped out of our hands.',
    ended: 'The run is over.',
    funding: (round: number, amount: string, equity: string) =>
      `Round ${round} closed — ${amount} raised. ${equity} equity left.`,
    buyingGpus: 'Buying GPUs',
    buyingGpusLine: (owned: string) => `Buying GPUs — ${owned} owned now.`,
    hiring: 'Hiring researchers',
    hiringLine: (count: string) => `Hiring researchers — ${count} on staff now.`,
    powerContracted: (megawatts: string, cost: string) =>
      `Contracted ${megawatts} of new capacity (${cost} up front).`,
    datacenterBuilt: (count: string, cost: string, capacity: string) =>
      `Datacenter ${count} is finished (${cost}). GPU slots up to ${capacity}.`,
    intel: (name: string, progress: string) => `Intel — ${name} is actually at ${progress}.`,
    poached: (name: string, count: string, cost: string, cut: string) =>
      `Hired ${count} key researchers away from ${name} (${cost}). Their pace is down sharply for now, and ${cut} of it is gone for good.`,
    supplyLocked:
      'Locked up GPU supply — every rival slowed, but your own GPUs cost more for a while.',
    safetyDown: (level: string) =>
      `Safety verification lowered to ${level}. Training speeds up, and so does the risk.`,
    safetyUp: (level: string) => `Safety verification raised to ${level}.`,
    fallbackRivalName: 'A rival lab',
  },

  // ── 결과 화면 ─────────────────────────────────────────────
  end: {
    won: {
      headline: 'We got there first',
      body: (lab: string) =>
        `${lab} reached AGI before anyone else. The other three labs stopped just short of the line.`,
      badge: 'VICTORY',
    },
    rivalWon: {
      headline: 'One step too slow',
      body: (name: string) => `${name} reached AGI first. Our cluster was still training.`,
      badge: 'DEFEAT',
    },
    bankrupt: {
      headline: 'The money ran out first',
      body: 'Power bills and payroll outran revenue. The GPUs are still there; the cash to run them is not.',
      badge: 'DEFEAT',
    },
    catastrophe: {
      headline: 'Loss of control',
      body: 'Skipping verification caused an accident. It was the price of moving first, and there was no undoing it.',
      badge: 'DEFEAT',
    },
    controlLost: {
      headline: 'Not ours anymore',
      body: 'The self-improving model slipped away from us. We spent on speed what we should have spent on alignment, and ran out of time to fix it.',
      badge: 'CONTROL LOST',
    },
    unknown: { headline: 'Run over', body: 'The game has ended.', badge: 'END' },
    elapsed: 'Time',
    finalProgress: 'Final progress',
    finalEquity: 'Equity left',
    finalMoney: 'Cash left',
    standings: 'Final standings',
    place: (index: number) => `#${index}`,
    us: 'us',
    progressAria: (name: string) => `${name} final progress`,
    restart: 'Play again',
  },

  // ── 결과 자랑하기 ─────────────────────────────────────────
  share: {
    outcome: {
      agiAchieved: 'reached AGI — win',
      rivalWon: 'beaten to AGI by a rival',
      bankrupt: 'ran out of money',
      catastrophe: 'lost it all to an accident',
      controlLost: 'lost control of the model',
    },
    inProgress: 'in progress',
    headline: (outcome: string) => `AGI Race 🏁 ${outcome}`,
    line2: (lab: string, duration: string, progress: string) =>
      `${lab} · ${duration} · progress ${progress}`,
    line3: (gpus: string, researchers: string, equity: string) =>
      `${gpus} GPUs · ${researchers} researchers · ${equity} equity left`,
    marginAhead: (name: string, points: string) => `${points} points ahead of ${name}`,
    marginBehind: (name: string, points: string) => `${points} points behind ${name}`,
    tauntWin: 'Think you can get there faster?',
    tauntLose: 'Think you can do better?',
    button: 'Share your result',
    copied: 'Copied — just paste it',
    failed: 'This browser blocked automatic copying. Please copy the text below.',
  },

  // ── 한계 위반 문구 ────────────────────────────────────────
  violations: {
    panel: {
      funding: 'Funding',
      gpu: 'GPU purchases',
      power: 'Power contracts',
      datacenter: 'Datacenters',
      researchers: 'Hiring',
      rivals: 'Rival tracking',
      safety: 'Safety control',
      unknown: 'That section',
    },
    insufficientFunds: (short: string) => `You are ${short} short`,
    gpuCapacity: (capacity: string, current: string, requested: string) =>
      `No room for those GPUs (limit ${capacity} · owned ${current} · requested ${requested})`,
    gpuSlotsShort: (missing: string) => `${missing} GPU slots short — build a datacenter first`,
    powerShortage: (demand: string, available: string) =>
      `Not enough power (needs ${demand} · available ${available})`,
    equityExhausted: 'No equity left to sell, so no more funding',
    panelLocked: (panel: string) => `${panel} is not available yet`,
    notRunning: 'Not available right now (paused, or the run is over)',
    generic: 'Not available right now',
  },

  // ── 버튼 판정 문구 ────────────────────────────────────────
  availability: {
    eventOpen: 'Answer the incident first',
    notStarted: 'The run has not started',
    alreadyEnded: 'This run is over',
    pausedNow: 'Paused — resume before pressing this',
    alreadyPlaying: 'A run is already in progress',
    tickPositive: 'Elapsed time must be greater than zero',
    startDetail: (name: string) => `Start a new run as "${name}"`,
    pauseOn: 'Stop the clock for a moment',
    pauseOff: 'Let the clock run again',
    badSpeed: 'That speed is not available',
    speedDetail: (multiplier: string) => `Run at ${multiplier}x speed`,
    restartDetail: 'Abandon this run and start over',
    noEvent: 'There is no incident to answer',
    badChoice: 'That choice is not available',
    fundingDetail: (amount: string, equity: string) => `Cash +${amount} · gives up ${equity} equity`,
    fundingWaitDetail: (duration: string) => `Next round in ${duration}`,
    fundingProgressDetail: (progress: string) => `Needs ${progress} progress for the next round`,
    fundingNoEquity: 'No equity left to give up',
    fundingTooSoon: (duration: string) => `Investors have not opened the next round (${duration} left)`,
    fundingNeedProgress: (progress: string) => `They want more progress first (${progress})`,
    gpuMinimum: 'You have to buy at least one GPU',
    gpuDetail: (price: string, power: string) => `${price} each · needs ${power} more power`,
    powerMinimum: 'Contracted power must be greater than zero',
    powerDetail: (megawatts: string, burn: string) => `Power +${megawatts} · ${burn} more per second`,
    datacenterDetail: (slots: string, upkeep: string) =>
      `GPU slots +${slots} · ${upkeep} more per second`,
    hireMinimum: 'You have to hire at least one researcher',
    hireDetail: (speed: string, payroll: string) => `Research +${speed} · ${payroll} more per second`,
    hireShort: 'Not enough cash',
    safetyRange: (low: string, high: string) => `Safety must be between ${low} and ${high}`,
    safetyDetail: (speed: string, risk: string) => `Research +${speed} · ${risk} accident risk per second`,
    allocationRange: 'Allocation must be between 0% and 100%',
    allocationDetail: (speed: string, control: string) => `Research +${speed} · control ${control}/s`,
    notSelfImproving: 'The model is not capable enough to research on its own yet',
    intelDetail: 'Logs that lab’s real progress',
    noSuchRival: 'No such lab',
    rivalCollapsed: 'That lab is already out of the race',
    rivalAchieved: 'That lab is already finished',
    rivalStillReeling: 'They are still reeling — nothing left to take until they recover',
    poachDetail: (researchers: string, slow: string) =>
      `Researchers +${researchers} · rival speed −${slow}`,
    lockDetail: (slow: string, price: string, duration: string) =>
      `All rivals −${slow} speed · your GPUs cost ${price}x for ${duration}`,
    noRivalsLeft: 'There is no one left to slow down',
    generic: 'Not available right now',
    deltaMoney: (amount: string) => `Cash ${amount}`,
    deltaGpus: (count: string) => `GPUs ${count}`,
    deltaPower: (megawatts: string) => `Power ${megawatts}`,
    deltaProgress: (percent: string) => `Progress ${percent}`,
    deltaDatacenters: (count: string) => `Datacenters ${count}`,
    deltaResearchers: (count: string) => `Researchers ${count}`,
    deltaEquity: (percent: string) => `Equity ${percent}`,
    deltaSafety: (percent: string) => `Safety ${percent}`,
  },

  // ── 이름 ──────────────────────────────────────────────────
  names: {
    defaultLab: 'Aurora AI',
    rivals: {
      'rival-helion': 'Helion Research',
      'rival-vex': 'Vex Labs',
      'rival-orin': 'Orin Institute',
    } as Record<string, string>,
  },

  // ── 사건 ──────────────────────────────────────────────────
  events: {
    'event-gpu-allocation': {
      title: 'Bumped from the GPU allocation',
      description:
        'The foundry gave this quarter’s output to its largest customers first, and our order slipped. A broker says he can hand over reserved stock right now — for a premium.',
      choices: [
        {
          label: 'Pay the premium for 300 units',
          hint: 'A large one-time cost, but training stays on schedule',
          logText: 'Paid a broker a premium and secured 300 GPUs.',
        },
        {
          label: 'Skip this quarter',
          hint: 'Saves the cash, but GPU prices spike for a while',
          logText: 'Gave up the allocation. GPU prices jump 1.8x for a while.',
        },
      ],
    },
    'event-nextgen-accelerator': {
      title: 'Next-generation accelerator announced',
      description:
        'A rival manufacturer unveiled a new accelerator generation. The gap is real, but volume is months away — and meanwhile the current generation goes on clearance.',
      choices: [
        {
          label: 'Pre-order and retrofit the cluster',
          hint: 'Expensive, but training jumps forward at once',
          logText: 'Retrofitted the cluster with next-gen accelerators — training jumped ahead.',
        },
        {
          label: 'Buy up the clearance generation',
          hint: 'GPUs are 30% cheaper for a while',
          logText: 'Went after clearance stock. GPUs are 30% cheaper for a while.',
        },
      ],
    },
    'event-grid-overload': {
      title: 'Regional grid overload',
      description:
        'A heat wave pushed regional demand to its limit, and the line feeding our campus is maxed out. The utility says: bring your own generation, or give capacity back.',
      choices: [
        {
          label: 'Rent emergency generators and keep running',
          hint: 'Costs money, but not a single GPU stops',
          logText: 'Rented emergency generators and kept training running.',
        },
        {
          label: 'Give back 3 MW of contracted capacity',
          hint: 'Lower power bills, but some GPUs go idle',
          logText: 'Returned 3 MW of contracted capacity. Some GPUs will sit idle.',
        },
      ],
    },
    'event-tariff-hike': {
      title: 'Power tariff increase',
      description:
        'The utility announced a rate increase for next quarter — but offers to waive it, and discount further, if you prepay now.',
      choices: [
        {
          label: 'Prepay and lock in the discount',
          hint: 'Cash goes out now, power gets cheaper for a while',
          logText: 'Prepaid the bill and cut power costs 10% for a while.',
        },
        {
          label: 'Take the increase',
          hint: 'Nothing to pay now, but power costs 1.6x for a while',
          logText: 'Power costs rise to 1.6x for a while.',
        },
      ],
    },
    'event-export-control': {
      title: 'Export controls on high-end accelerators',
      description:
        'The government began restricting high-end accelerator transfers. Complying means redesigning; routing around it brings the hardware in but skips internal review.',
      choices: [
        {
          label: 'Redesign to comply',
          hint: 'Sets us back, but sets the rivals back too',
          logText: 'Redesigned around the controls. The whole industry slows together.',
        },
        {
          label: 'Bring in 400 units through a side channel',
          hint: 'A win now, but looser review raises accident risk',
          logText: 'Brought in 400 GPUs through a side channel. Internal review got looser.',
        },
      ],
    },
    'event-senate-hearing': {
      title: 'Called before a hearing',
      description:
        'Lawmakers summoned the heads of every frontier lab. Going in person costs days; sending counsel saves the time but leaves a mark.',
      choices: [
        {
          label: 'Attend in person and answer fully',
          hint: 'Lose days, but tighten up verification',
          logText: 'Attended the hearing. Training slipped a few days, but verification improved.',
        },
        {
          label: 'Send counsel and keep training',
          hint: 'Keeps the schedule, costs money and invites scrutiny',
          logText: 'Sent counsel only. Training never stopped, but scrutiny increased.',
        },
      ],
    },
    'event-poaching': {
      title: 'A rival is poaching',
      description:
        'A rival lab offered our key researchers nearly double. Keeping them means rewriting compensation; losing them puts them on the other side’s run.',
      choices: [
        {
          label: 'Raise compensation and keep them',
          hint: 'Costs a lot now, but the team stays intact',
          logText: 'Rewrote compensation and kept the key researchers.',
        },
        {
          label: 'Let them go',
          hint: 'Lower payroll, but one rival speeds up',
          logText: 'Two researchers left for a rival lab.',
        },
      ],
    },
    'event-internal-warning': {
      title: 'Warning from the safety team',
      description:
        'Internal evaluators reported unexplained behaviour in a recent checkpoint. A full review means halting training; filing it keeps the schedule.',
      choices: [
        {
          label: 'Halt training and review everything',
          hint: 'Progress slips, accident risk drops',
          logText: 'Halted training for a full review. Verification improved.',
        },
        {
          label: 'File it and keep running',
          hint: 'Keeps the schedule, accident risk rises',
          logText: 'Filed the warning and kept training.',
        },
      ],
    },
    'event-sovereign-fund': {
      title: 'Sovereign fund offer',
      description:
        'An overseas sovereign fund offered $80M in one round, and wants a large slice of the company for it. Turn it down and the money goes straight to another lab.',
      choices: [
        {
          label: 'Take the offer',
          hint: 'A lot of cash, at the cost of 12% equity',
          logText: 'Took the sovereign fund round — $80M raised, 12% equity given up.',
        },
        {
          label: 'Keep the equity and decline',
          hint: 'You keep the company, they fund a rival',
          logText: 'Declined the offer. The money went to a rival lab.',
        },
      ],
    },
    'event-joint-training': {
      title: 'Joint training consortium',
      description:
        'A university alliance proposed a joint training consortium: lend them part of our cluster, and take years of their data and methods in return.',
      choices: [
        {
          label: 'Contribute 500 GPUs and join',
          hint: 'Fewer GPUs, but training jumps forward',
          logText: 'Joined the consortium and took over their data and methods.',
        },
        {
          label: 'Stay independent',
          hint: 'Keep the hardware, they partner with the rivals instead',
          logText: 'Declined the consortium. The alliance partnered with the rivals.',
        },
      ],
    },
  } satisfies Record<EventKey, EventCopy>,
};
