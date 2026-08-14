/**
 * ===========================================================================
 *  위험 연출 — 숫자를 안 보고 있어도 위험을 느끼게
 * ===========================================================================
 *
 *  이 게임은 볼 곳이 많습니다. 자금·전력·경쟁사·안전을 동시에 지켜보다 보면
 *  정작 통장이 마르는 걸 놓치고, 알아챘을 때는 이미 손쓸 수 없습니다.
 *
 *  그래서 위험을 두 겹으로 알립니다.
 *      1) 화면 가장자리가 붉게 물듭니다 — 어디를 보고 있든 시야에 들어옵니다
 *      2) 무엇이 위험한지 한 줄씩 띄웁니다 — 붉어진 이유를 바로 알 수 있게
 *
 *  기준선은 전부 balance.ts 의 ALERT 에 있습니다. 늘 빨간 화면이 되면 경고가
 *  의미를 잃으므로, 정말 손써야 할 때만 켜지도록 맞춰져 있습니다.
 *
 *  ※ 움직임에 민감한 사람을 위해, 맥동은 motion-safe 일 때만 켜집니다.
 *    (운영체제에서 '동작 줄이기'를 켜두면 색만 바뀌고 깜빡이지 않습니다)
 */

import { ALERT } from '../balance';
import { computeDerived, isSelfImproving, secondsUntilControlLost } from '../constraints';
import { rivalName, s } from '../i18n';
import type { GameState } from '../types';

/** 위험 한 건 */
export interface Alert {
  id: string;
  /** warn = 조심, danger = 지금 손써야 함 */
  level: 'warn' | 'danger';
  /** 화면에 뜨는 한 줄 */
  text: string;
}

/**
 * 지금 걸려 있는 위험들을 모읍니다.
 *
 * 아직 열리지 않은 영역의 위험은 알리지 않습니다.
 * (경쟁사 상황판이 열리기 전에 '추격당하고 있다'고 하면 무슨 소린지 알 수 없습니다)
 */
export function collectAlerts(state: GameState): Alert[] {
  if (state.phase !== 'playing') return [];

  const derived = computeDerived(state);
  const alerts: Alert[] = [];

  // ── 자금이 마르고 있다 ──────────────────────────────────
  const runway = derived.runwaySeconds;
  if (runway !== null) {
    const minutes = Math.max(0, Math.floor(runway / 60));
    const seconds = Math.max(0, Math.floor(runway % 60));
    const left = `${minutes}:${String(seconds).padStart(2, '0')}`;
    if (runway <= ALERT.runwayDangerSeconds) {
      alerts.push({ id: 'cash', level: 'danger', text: s().alerts.cashDanger(left) });
    } else if (runway <= ALERT.runwayWarnSeconds) {
      alerts.push({ id: 'cash', level: 'warn', text: s().alerts.cashWarn(left) });
    }
  }

  // ── 전력이 모자라 GPU가 놀고 있다 ───────────────────────
  const owned = state.player.gpus;
  if (owned > 0) {
    const idleRatio = Math.max(0, owned - derived.activeGpus) / owned;
    if (idleRatio >= ALERT.idleGpuDangerRatio) {
      alerts.push({
        id: 'power',
        level: 'danger',
        text: s().alerts.powerDanger(`${Math.round(idleRatio * 100)}%`),
      });
    } else if (idleRatio >= ALERT.idleGpuWarnRatio) {
      alerts.push({
        id: 'power',
        level: 'warn',
        text: s().alerts.powerWarn(`${Math.round(idleRatio * 100)}%`),
      });
    }
  }

  // ── 경쟁사에게 밀리고 있다 (상황판이 열린 뒤에만) ───────
  if (state.unlocks.rivals) {
    const leader = derived.leadingRival;
    if (leader !== null) {
      const behind = -derived.leadMargin;
      if (behind >= ALERT.behindDangerMargin) {
        alerts.push({
          id: 'behind',
          level: 'danger',
          text: s().alerts.behindDanger(rivalName(leader), `${Math.round(behind * 100)}%p`),
        });
      } else if (behind >= ALERT.behindWarnMargin) {
        alerts.push({
          id: 'behind',
          level: 'warn',
          text: s().alerts.behindWarn(rivalName(leader)),
        });
      }
    }

    const closing = state.rivals.filter(
      (rival) => rival.status !== 'collapsed' && rival.reportedProgress >= ALERT.rivalNearGoal,
    );
    if (closing.length > 0) {
      const names = closing.map((rival) => rivalName(rival)).join(', ');
      alerts.push({
        id: 'finish',
        level: 'danger',
        text: s().alerts.nearFinish(names),
      });
    }
  }

  // ── 자기개선하는 모델을 놓치기 직전이다 (후반 단계에서만) ──
  if (isSelfImproving(state)) {
    const untilLost = secondsUntilControlLost(state);
    if (untilLost !== null) {
      const minutes = Math.floor(untilLost / 60);
      const seconds = Math.floor(untilLost % 60);
      const left = `${minutes}:${String(seconds).padStart(2, '0')}`;
      if (untilLost <= ALERT.controlDangerSeconds) {
        alerts.push({
          id: 'control',
          level: 'danger',
          text: s().alerts.controlDanger(left),
        });
      } else if (untilLost <= ALERT.controlWarnSeconds) {
        alerts.push({ id: 'control', level: 'warn', text: s().alerts.controlWarn(left) });
      }
    }
  }

  // ── 안전을 낮춰 사고 위험을 안고 있다 (안전 조절이 열린 뒤에만) ──
  if (state.unlocks.safety) {
    const safety = state.player.safety;
    if (safety < ALERT.safetyDangerLevel) {
      alerts.push({
        id: 'safety',
        level: 'danger',
        text: s().alerts.safetyDanger(`${Math.round(safety * 100)}%`),
      });
    } else if (safety < ALERT.safetyWarnLevel) {
      alerts.push({ id: 'safety', level: 'warn', text: s().alerts.safetyWarn });
    }
  }

  return alerts;
}

/** 가장 높은 위험 등급 */
function worstLevel(alerts: Alert[]): 'none' | 'warn' | 'danger' {
  if (alerts.some((a) => a.level === 'danger')) return 'danger';
  if (alerts.length > 0) return 'warn';
  return 'none';
}

/**
 * 화면 가장자리를 물들이는 붉은 테두리.
 *
 * 화면 위에 덮이지만 클릭을 가로채지 않습니다(pointer-events-none).
 * 눈으로만 전달하는 장치라 스크린리더에서는 숨깁니다 — 같은 내용을
 * 아래 AlertStrip 이 글자로 읽어주기 때문입니다.
 */
export function DangerVignette({ state }: { state: GameState }) {
  const level = worstLevel(collectAlerts(state));
  if (level === 'none') return null;

  const color = level === 'danger' ? 'rgba(244,63,94,0.45)' : 'rgba(251,191,36,0.28)';
  const spread = level === 'danger' ? '90px' : '60px';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-40 ${
        level === 'danger' ? 'motion-safe:animate-pulse' : ''
      }`}
      style={{ boxShadow: `inset 0 0 ${spread} ${color}` }}
    />
  );
}

/**
 * 무엇이 위험한지 한 줄씩 보여주는 띠.
 * 화면이 왜 붉어졌는지 알려주는 역할이라 가장자리 연출과 항상 함께 다닙니다.
 */
export function AlertStrip({ state }: { state: GameState }) {
  const alerts = collectAlerts(state);
  if (alerts.length === 0) return null;

  return (
    <div role="status" aria-live="polite" className="flex flex-wrap gap-1.5">
      {alerts.map((alert) => (
        <span
          key={alert.id}
          className={`rounded border px-2 py-0.5 text-[11px] ${
            alert.level === 'danger'
              ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
          }`}
        >
          {alert.text}
        </span>
      ))}
    </div>
  );
}
