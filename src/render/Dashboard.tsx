/**
 * ===========================================================================
 *  본 화면 — 게임을 하는 동안 계속 보게 되는 단 하나의 화면
 * ===========================================================================
 *
 *  탭도 없고 페이지 이동도 없습니다. 위에는 자원 표시줄, 가운데는 조작 패널들,
 *  오른쪽에는 기록창. 이 배치가 25분 내내 바뀌지 않습니다.
 *
 *  ★ 점진적 해금
 *    처음에는 '투자 유치'와 'GPU 구매' 두 패널만 있습니다.
 *    나머지는 state.unlocks 가 열렸다고 알려줄 때 비로소 화면에 나타납니다.
 *    이때 흐리게 놓아두는 것이 아니라 아예 없다가 생깁니다.
 *    → 첫 화면이 버튼 두 개뿐이어야 처음 하는 사람이 무엇을 눌러야 할지 헤매지 않습니다.
 *
 *    새로 나타난 패널에는 잠깐 동안 NEW 딱지가 붙습니다.
 *    (화면이 갑자기 늘어났을 때 '어디가 새로 생겼는지'를 놓치지 않도록)
 */

import { useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { GameAction, GameState, PanelId, UnlockState } from '../types';
import {
  DatacenterPanel,
  FundingPanel,
  GpuPanel,
  PowerPanel,
  ResearcherPanel,
  SafetyPanel,
} from './ActionPanel';
import { LogPanel } from './LogPanel';
import { ResourceBar } from './ResourceBar';
import { RivalBoard } from './RivalBoard';

/** 패널이 화면에 놓이는 순서 (게임 규칙이 아니라 화면 배치라 여기 있습니다) */
const PANEL_ORDER: PanelId[] = [
  'funding',
  'gpu',
  'power',
  'datacenter',
  'researchers',
  'rivals',
  'safety',
];

/** NEW 딱지가 붙어 있는 시간(밀리초). 눈에 띄되 거슬리지는 않을 만큼만 */
const NEW_BADGE_MS = 8000;

/**
 * 방금 열린 패널이 어느 것인지 알려주는 도구를 만듭니다.
 *
 * state.unlocks 는 '열렸다/안 열렸다'만 알려줄 뿐 '방금 열렸다'는 알려주지 않습니다.
 * 그래서 직전 값을 기억해두었다가 false → true 로 바뀐 패널을 잠시 기억해 둡니다.
 * 정해진 시간이 지나면 딱지를 스스로 뗍니다.
 */
function useFreshPanels(unlocks: UnlockState): (panel: PanelId) => boolean {
  const previous = useRef<UnlockState | null>(null);
  const [fresh, setFresh] = useState<PanelId[]>([]);

  useEffect(() => {
    const before = previous.current;
    previous.current = unlocks;

    // 게임에 처음 들어온 순간은 '새로 열림'이 아닙니다 (원래 열려 있던 것들이라서)
    if (before === null) return;

    const opened = PANEL_ORDER.filter((panel) => unlocks[panel] && !before[panel]);
    if (opened.length === 0) return;

    setFresh((current) => [...current, ...opened]);

    const timer = setTimeout(() => {
      setFresh((current) => current.filter((panel) => !opened.includes(panel)));
    }, NEW_BADGE_MS);

    return () => clearTimeout(timer);
  }, [unlocks]);

  return (panel: PanelId) => fresh.includes(panel);
}

interface DashboardProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

/**
 * 플레이 중 화면 전체를 그립니다.
 *
 * 넓은 화면에서는 '패널들 | 기록창' 두 단으로, 휴대폰 크기에서는 위아래로 쌓입니다.
 * (md 기준점 아래에서는 한 줄에 하나씩 놓여 390px 폭에서도 글자가 잘리지 않습니다)
 */
export function Dashboard({ state, dispatch }: DashboardProps) {
  const isNew = useFreshPanels(state.unlocks);
  const unlocks = state.unlocks;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ResourceBar state={state} dispatch={dispatch} />

      <main className="mx-auto grid max-w-6xl gap-3 p-3 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-4 md:p-4">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {unlocks.funding && (
            <FundingPanel state={state} dispatch={dispatch} isNew={isNew('funding')} />
          )}
          {unlocks.gpu && <GpuPanel state={state} dispatch={dispatch} isNew={isNew('gpu')} />}
          {unlocks.power && <PowerPanel state={state} dispatch={dispatch} isNew={isNew('power')} />}
          {unlocks.datacenter && (
            <DatacenterPanel state={state} dispatch={dispatch} isNew={isNew('datacenter')} />
          )}
          {unlocks.researchers && (
            <ResearcherPanel state={state} dispatch={dispatch} isNew={isNew('researchers')} />
          )}
          {unlocks.safety && (
            <SafetyPanel state={state} dispatch={dispatch} isNew={isNew('safety')} />
          )}
          {unlocks.rivals && <RivalBoard state={state} isNew={isNew('rivals')} />}
        </div>

        <LogPanel log={state.log} />
      </main>
    </div>
  );
}
