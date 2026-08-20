/**
 *  벼림 셋 — 만들 때 고르는 것.
 *
 *  ★ 이 파일은 표입니다. 숫자는 balance.ts 의 TEMPER 에 있고, 여기에는 이름과
 *    말만 둡니다. 밸런스를 고치는 사람이 이 파일을 안 읽어도 되도록.
 *
 *  ★ gives / gives_up 을 나눠 적습니다. 무엇을 버리는지 모르고 고르는 것은
 *    선택이 아니라 제비뽑기입니다 — 화면이 셋을 나란히 보여줍니다.
 */

import type { TemperId } from '../balance';

export interface TemperDef {
  id: TemperId;
  name: string;
  /** 만들어진 물건 이름 앞에 붙습니다 */
  prefix: string;
  /** 무엇을 얻는가 */
  gives: string;
  /** 무엇을 버리는가 */
  givesUp: string;
  desc: string;
}

export const TEMPERS: Record<TemperId, TemperDef> = {
  sharp: {
    id: 'sharp',
    name: '날카롭게',
    prefix: '날 선',
    gives: '더 아프게 벤다',
    givesUp: '빨리 상한다',
    desc: '날을 얇게 세웁니다. 잘 들지만 그만큼 잘 무뎌집니다.',
  },
  tough: {
    id: 'tough',
    name: '단단하게',
    prefix: '단단한',
    gives: '오래 간다',
    givesUp: '덜 아프다',
    desc: '두껍게 벼립니다. 오래 쓰지만 날이 무딥니다.',
  },
  light: {
    id: 'light',
    name: '가볍게',
    prefix: '가벼운',
    gives: '짐이 준다',
    givesUp: '둘 다 조금씩 손해',
    desc: '쇠를 아껴 얇게 폅니다. 지고 다니기 좋지만 어느 쪽도 뛰어나지 않습니다.',
  },
};

/** 화면에 늘 같은 차례로 나오도록 */
export const TEMPER_ORDER: TemperId[] = ['sharp', 'tough', 'light'];

export function temperDef(id: TemperId): TemperDef {
  return TEMPERS[id];
}
