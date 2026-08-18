/** 시작 화면 — 이름을 짓고 직업을 고릅니다 */

import { useState } from 'react';
import { CLASSES, CLASS_ORDER } from '../content/classes';
import type { ClassId } from '../types';

export function TitleScreen({
  onStart, onContinue, hasSave,
}: {
  onStart: (name: string, classId: ClassId) => void;
  onContinue: () => void;
  hasSave: boolean;
}) {
  const [name, setName] = useState('');
  const [classId, setClassId] = useState<ClassId>('knight');

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center gap-6 px-5 py-10">
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-amber-300 sm:text-5xl">아덴의 그림자</h1>
          <p className="mt-2 text-sm text-slate-400">
            사냥하고, 모으고, 강화하는 옛날식 온라인 RPG — 혼자서, 브라우저에서.
          </p>
        </header>

        {hasSave && (
          <button type="button" onClick={onContinue}
            className="mx-auto w-full max-w-md rounded-lg bg-amber-500 px-5 py-3 text-base font-black text-slate-950 transition hover:bg-amber-400">
            이어서 하기
          </button>
        )}

        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <label className="block text-xs font-bold text-slate-400" htmlFor="name">이름</label>
          <input id="name" value={name} maxLength={12}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름을 지어주세요"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
          />

          <h2 className="mb-2 mt-4 text-xs font-bold text-slate-400">직업</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {CLASS_ORDER.map((id) => {
              const cls = CLASSES[id];
              const selected = id === classId;
              return (
                <button key={id} type="button" onClick={() => setClassId(id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    selected ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                  }`}>
                  <div className="text-base font-black" style={{ color: cls.color }}>{cls.name}</div>
                  <div className="text-[11px] font-semibold text-slate-400">{cls.tagline}</div>
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{cls.desc}</p>
                  <dl className="mt-2 space-y-0.5 text-[10px] text-slate-500">
                    <div className="flex justify-between"><dt>체력</dt><dd className="text-slate-300">{cls.baseHp} (+{cls.hpPerLevel}/Lv)</dd></div>
                    <div className="flex justify-between"><dt>사거리</dt><dd className="text-slate-300">{cls.attackRange >= 150 ? '원거리' : '근접'}</dd></div>
                    <div className="flex justify-between"><dt>공격 속도</dt><dd className="text-slate-300">{cls.attackInterval.toFixed(2)}초</dd></div>
                  </dl>
                </button>
              );
            })}
          </div>

          <button type="button" onClick={() => onStart(name, classId)}
            className="mt-4 w-full rounded-lg bg-slate-100 px-5 py-3 text-base font-black text-slate-950 transition hover:bg-white">
            {hasSave ? '새로 시작하기 (기존 기록은 지워집니다)' : '시작하기'}
          </button>
        </section>

        <section className="grid gap-3 text-[13px] leading-relaxed text-slate-400 sm:grid-cols-2">
          <div>
            <h3 className="font-bold text-slate-200">어떻게 하나요</h3>
            <p className="mt-1">
              땅을 누르면 걷고, 몬스터를 누르면 다가가 알아서 때립니다. 1·2·3 으로 스킬, Q·W 로 물약,
              Space 로 자동 사냥. 휴대폰에서는 아래 단추로 같은 일을 합니다.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-slate-200">무엇이 중요한가요</h3>
            <p className="mt-1">
              <b className="text-amber-300">강화</b>입니다. +3 까지는 공짜지만 그 위로는 실패하면 장비가 부서집니다.
              +7 짜리 무기 한 자루가 레벨 다섯보다 셉니다. 그래서 다들 주문서를 모읍니다.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-slate-200">죽으면요</h3>
            <p className="mt-1">
              지금 레벨에서 모은 경험치의 30%와 골드의 8%를 잃고 마을에서 깨어납니다.
              부활 주문서를 사두면 그 절반을 되찾습니다.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-slate-200">끝이 있나요</h3>
            <p className="mt-1">
              용의 둥지의 <b className="text-rose-300">고룡 카르나스</b>를 잡으면 한 바퀴가 끝납니다.
              4분마다 다시 나타나므로, 몇 번이고 다시 도전할 수 있습니다.
            </p>
          </div>
        </section>

        <footer className="text-center text-[11px] text-slate-600">
          기록은 이 브라우저에만 저장됩니다. 서버도, 가입도 없습니다.
        </footer>
      </div>
    </div>
  );
}
