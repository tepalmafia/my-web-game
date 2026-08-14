/**
 * ===========================================================================
 *  프로그램의 시작점
 * ===========================================================================
 *
 *  브라우저가 페이지를 열면 가장 먼저 실행되는 파일입니다.
 *  하는 일은 딱 하나 — index.html 안의 <div id="root"> 를 찾아
 *  그 자리에 게임 화면(App)을 붙이는 것입니다.
 *
 *  게임 내용은 전부 src/render 폴더에 있으므로 이 파일은 앞으로 거의 바뀌지 않습니다.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { App } from './render';

const container = document.getElementById('root');

if (!container) {
  // index.html 에서 <div id="root"> 를 지우지 않는 한 여기로 올 일은 없습니다.
  throw new Error('index.html 에서 id="root" 인 요소를 찾지 못했습니다.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
