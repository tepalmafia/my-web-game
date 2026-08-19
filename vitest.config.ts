/**
 *  테스트 설정.
 *
 *  게임 빌드 설정(vite.config.ts)과 일부러 떼어놨습니다.
 *  테스트는 브라우저도 tailwind 도 필요 없이 node 위에서 규칙만 돌리기 때문입니다.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // 통합 테스트는 몇 분 치를 돌리므로 기본 5초로는 모자랍니다
    testTimeout: 30_000,
  },
});
