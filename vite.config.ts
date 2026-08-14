import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages 는 https://<계정>.github.io/<저장소이름>/ 주소로 서비스되므로
// base 에 저장소 이름을 넣어줘야 화면이 깨지지 않습니다.
export default defineConfig({
  base: '/my-web-game/',
  plugins: [react(), tailwindcss()],
});
