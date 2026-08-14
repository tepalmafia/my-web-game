/**
 * ===========================================================================
 *  App — 화면 전체의 뿌리이자 게임의 시계
 * ===========================================================================
 *
 *  이 파일이 하는 일은 딱 세 가지입니다.
 *
 *    1) 게임 상태를 하나 들고 있습니다 (useReducer).
 *       상태를 바꾸는 계산은 전부 state 폴더의 reducer 가 하고,
 *       여기서는 그 결과를 받아 화면에 넘겨줄 뿐입니다.
 *
 *    2) 시계를 돌립니다.
 *       balance.ts 의 TICK_SECONDS 마다 한 번씩 '시간이 흘렀다' 신호를 보냅니다.
 *       배속(state.speed)은 흘려보내는 시간에 곱해서 반영합니다.
 *       — 타이머를 더 빨리 돌리는 게 아니라 한 번에 더 많은 시간을 보내는 방식입니다.
 *         그래야 4배속에서도 계산 횟수가 늘지 않아 휴대폰에서 버벅이지 않습니다.
 *       화면에서 사라질 때는 반드시 타이머를 정리합니다.
 *
 *    3) 지금 어느 국면인지에 따라 화면을 고릅니다.
 *       title → 시작 화면 / playing → 본 화면 / ended → 결과 화면
 *       사건이 떠 있으면 본 화면 위에 사건 창을 덮어씌웁니다.
 *
 *  ※ 시간이 흐르지 않는 상황(시작 화면·일시정지·사건 창)에서도 신호는 계속 보냅니다.
 *    reducer 가 그런 신호를 받으면 '아무 일도 없었다'며 같은 상태를 그대로 돌려주기 때문에
 *    화면은 다시 그려지지 않습니다. 그래서 따로 타이머를 껐다 켰다 할 필요가 없습니다.
 */

import { useEffect, useReducer } from 'react';
import { TICK_SECONDS } from '../balance';
import { s } from '../i18n';
import { createInitialState, reducer } from '../state';
import { Dashboard } from './Dashboard';
import { EndScreen } from './EndScreen';
import { EventModal } from './EventModal';
import { useLocale } from './LanguagePicker';
import { TitleScreen } from './TitleScreen';

/**
 * 앱이 켜졌을 때의 첫 상태를 만듭니다.
 * 아직 '시작 화면' 상태이고, 이름과 씨앗은 시작 버튼을 누를 때 다시 정해집니다.
 */
function createBootState() {
  return createInitialState(s().names.defaultLab, Date.now());
}

/**
 * 게임 전체를 감싸는 최상위 화면입니다.
 * 다른 곳에서는 이 App 하나만 가져다 쓰면 됩니다.
 */
export function App() {
  const [state, dispatch] = useReducer(reducer, null, createBootState);

  // 언어가 바뀌면 이 아래 화면 전체가 새 언어로 다시 그려집니다
  useLocale();

  const speed = state.speed;

  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: 'tick', deltaSeconds: TICK_SECONDS * speed });
    }, TICK_SECONDS * 1000);

    // 화면이 사라지거나 배속이 바뀌면 이전 타이머를 반드시 멈춥니다
    return () => clearInterval(timer);
  }, [speed]);

  /**
   * 실수로 탭을 닫거나 새로고침하는 사고를 막습니다.
   *
   * 이 게임은 저장 기능이 없어서 새로고침하면 20분짜리 판이 통째로 사라집니다.
   * 그래서 '플레이 중'일 때만 브라우저에 확인창을 띄워 달라고 부탁합니다.
   *
   * 시작 화면과 결과 화면에서는 붙이지 않습니다 — 잃을 게 없는데 확인창이 뜨면
   * 성가시기만 합니다. (브라우저가 문구를 직접 정하므로 우리가 쓸 수는 없습니다)
   */
  const isPlaying = state.phase === 'playing';
  useEffect(() => {
    if (!isPlaying) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 오래된 브라우저는 preventDefault 만으로는 확인창을 띄우지 않습니다
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isPlaying]);

  switch (state.phase) {
    case 'title':
      return <TitleScreen state={state} dispatch={dispatch} />;

    case 'ended':
      return <EndScreen state={state} dispatch={dispatch} />;

    case 'playing':
    default:
      return (
        <>
          <Dashboard state={state} dispatch={dispatch} />
          {state.activeEvent !== null && (
            <EventModal state={state} dispatch={dispatch} event={state.activeEvent} />
          )}
        </>
      );
  }
}
