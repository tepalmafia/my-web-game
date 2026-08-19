/**
 *  프로그램의 시작점.
 *  index.html 안의 <div id="root"> 를 찾아 그 자리에 게임을 붙입니다.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './rpg.css';
import { App } from './ui/App';

const container = document.getElementById('root');
if (!container) throw new Error('index.html 에 <div id="root"> 가 없습니다');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
