/**
 * ===========================================================================
 *  render — 플레이어가 보는 모든 것 (이 폴더의 정문)
 * ===========================================================================
 *
 *  이 폴더는 화면만 그립니다. 게임 규칙을 스스로 판단하는 곳이 한 군데도 없습니다.
 *
 *      숫자와 계산  → constraints 폴더
 *      버튼 판정    → input 폴더 (누를 수 있는가 / 얼마인가 / 왜 안 되는가)
 *      상태 변경    → state 폴더 (reducer)
 *      밸런스 숫자  → balance.ts
 *
 *  화면이 하는 일은 그 결과를 보기 좋게 늘어놓고, 눌린 버튼을 신호로 바꿔
 *  reducer 에게 넘기는 것뿐입니다. 덕분에 밸런스를 고쳐도 이 폴더는 손댈 일이 없습니다.
 *
 *  바깥에서는 App 하나만 가져다 쓰면 됩니다.
 *      import { App } from './render';
 */

export { App } from './App';

// 아래는 화면을 손볼 때 개별로 가져다 쓸 수 있게 함께 열어둔 것들입니다
export { Dashboard } from './Dashboard';
export { TitleScreen } from './TitleScreen';
export { EndScreen } from './EndScreen';
export { ShareResult, buildShareText } from './ShareResult';
export { EventModal } from './EventModal';
export { LogPanel } from './LogPanel';
export { RaceTrack, rivalStyle, rivalDisplayProgress } from './RaceTrack';
export { RivalActionPanel } from './RivalActionPanel';
export { SelfResearchPanel } from './SelfResearchPanel';
export { DatacenterView } from './DatacenterView';
export { AlertStrip, DangerVignette, collectAlerts } from './DangerOverlay';
export type { Alert } from './DangerOverlay';
export { ResourceBar } from './ResourceBar';
export { ProgressBar } from './ProgressBar';
export {
  ActionButton,
  DatacenterPanel,
  FundingPanel,
  GpuPanel,
  Panel,
  PowerPanel,
  ResearcherPanel,
  SafetyPanel,
} from './ActionPanel';
export type { PanelProps } from './ActionPanel';
