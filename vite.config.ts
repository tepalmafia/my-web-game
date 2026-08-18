import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages 는 https://<계정>.github.io/<저장소이름>/ 주소로 서비스되므로
// base 에 저장소 이름을 넣어줘야 화면이 깨지지 않습니다.
// 이 저장소에는 게임이 둘 있습니다.
//   index.html      → 아덴의 그림자 (RPG)
//   agi-race.html   → AGI 경주 (기존 경영 시뮬레이션)
// 아래 input 에 적힌 html 파일마다 하나씩 따로 빌드됩니다.
export default defineConfig({
  base: '/my-web-game/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        agiRace: new URL('./agi-race.html', import.meta.url).pathname,
      },
    },
  },
});
