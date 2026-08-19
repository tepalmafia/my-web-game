/** 시작 화면 — 이름을 짓고 직업을 고릅니다 */

import { useState } from 'react';

import { SKILLS } from '../content/skills';
import { TEMPLATES } from '../core/create';
import type { SkillId, World } from '../types';
import { SaveCodePanel } from './SaveCodePanel';

export function TitleScreen({
  onStart, onContinue, onImported, hasSave,
}: {
  onStart: (name: string, templateId: string) => void;
  onContinue: () => void;
  onImported: (world: World) => void;
  hasSave: boolean;
}) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0]!.id);

  return (
    <div
      className="min-h-dvh bg-ink-900 text-parch-100"
      style={{
        background:
          'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(201,162,39,0.14), rgba(0,0,0,0) 70%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(164,30,34,0.12), rgba(0,0,0,0) 70%), #0b0908',
      }}
    >
      <div className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center gap-7 px-5 py-12">
        <header className="text-center">
          <p className="eyebrow mb-2">스킬로 자라는 샌드박스 RPG</p>
          <h1
            className="display text-5xl font-bold tracking-tight sm:text-6xl"
            style={{
              background: 'linear-gradient(180deg,#f7dd9a 0%,#e0b23a 55%,#8a6f1c 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              textShadow: '0 2px 30px rgba(224,178,58,0.18)',
            }}
          >
            아덴의 그림자
          </h1>
          <div className="rule mx-auto mt-4 w-64" />
          <p className="mt-3 text-sm text-parch-300">
            캐고, 만들고, 싸운다. <b className="text-parch-100">레벨은 없습니다.</b>
          </p>
        </header>

        {hasSave && (
          <button type="button" onClick={onContinue} className="btn btn-brass mx-auto w-full max-w-md rounded-sm px-5 py-3.5 text-base">
            이어서 하기
          </button>
        )}

        <section className="panel studded rounded-sm p-5">
          <label className="eyebrow block" htmlFor="name">
            이름
          </label>
          <input
            id="name"
            value={name}
            maxLength={12}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름을 지어주세요"
            className="socket mt-1.5 w-full rounded-sm px-3 py-2.5 text-sm text-parch-100 outline-none placeholder:text-parch-400/60 focus:ring-1 focus:ring-brass-500"
          />

          <h2 className="eyebrow mb-2 mt-5">시작 자리</h2>
          <p className="mb-2 text-[11px] text-parch-400">
            직업이 아닙니다. 처음 스킬을 어디에 조금 얹어줄지만 정합니다 —
            그 뒤로는 <b className="text-parch-200">무엇을 하든 자유입니다.</b>
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {TEMPLATES.map((cls) => {
              const id = cls.id;
              const selected = id === templateId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTemplateId(id)}
                  className={`relative overflow-hidden rounded-sm border p-3 text-left transition ${
                    selected ? 'border-brass-400' : 'border-ink-500 hover:border-brass-500/50'
                  }`}
                  style={{
                    background: selected
                      ? `radial-gradient(ellipse at 50% 0%, ${cls.color}22, #14100c 65%)`
                      : 'linear-gradient(180deg,#1b1611,#13100c)',
                  }}
                >
                  <div className="display text-lg font-bold" style={{ color: cls.color }}>
                    {cls.name}
                  </div>
                  <div className="text-[11px] font-semibold text-parch-300">{cls.tagline}</div>
                  <p className="mt-1 text-[11px] leading-snug text-parch-400">{cls.desc}</p>

                  <dl className="tabular mt-2.5 space-y-0.5 text-[10px] text-parch-400">
                    {Object.entries(cls.skills).map(([skill, value]) => (
                      <div key={skill} className="flex justify-between">
                        <dt>{SKILLS[skill as SkillId].name}</dt>
                        <dd className="text-parch-200">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onStart(name, templateId)}
            className="btn btn-brass mt-5 w-full rounded-sm px-5 py-3.5 text-base"
          >
            {hasSave ? '새로 시작하기 (기존 기록은 지워집니다)' : '모험 시작'}
          </button>
        </section>

        <SaveCodePanel hasSave={hasSave} onImported={onImported} />

        <section className="grid gap-x-8 gap-y-4 text-[13px] leading-relaxed text-parch-300 sm:grid-cols-2">
          <div>
            <h3 className="display mb-1 text-[15px] font-bold text-parch-100">어떻게 하나요</h3>
            <p>
              땅을 누르면 걷고, 몬스터를 누르면 다가가 때리고, <b className="text-parch-200">바위에 비치는 광맥을
              누르면 캡니다.</b> Q 로 물약, S·I·C 로 실력·가방·대장간.
            </p>
          </div>
          <div>
            <h3 className="display mb-1 text-[15px] font-bold text-parch-100">무엇이 중요한가요</h3>
            <p>
              <b className="text-brass-300">무게</b>입니다. 철광석 한 덩이가 10 스톤이라 금방 발이 무거워지고,
              그래서 광산과 마을을 오가게 됩니다. 그 왕복이 이 게임의 리듬입니다.
            </p>
          </div>
          <div>
            <h3 className="display mb-1 text-[15px] font-bold text-parch-100">죽으면요</h3>
            <p>
              골드의 10%만 잃고 마을에서 깨어납니다. <b className="text-parch-200">배운 것은 그대로입니다</b> —
              스킬은 해본 만큼 남습니다.
            </p>
          </div>
          <div>
            <h3 className="display mb-1 text-[15px] font-bold text-parch-100">끝이 있나요</h3>
            <p>
              없습니다. 검을 만들고, 닳으면 고치고, 결국 다시 만듭니다. 광산 깊은 곳의
              <b className="text-[#e88a86]"> 구리 광맥</b>까지 갈 수 있게 되는 것이 지금의 목표입니다.
            </p>
          </div>
        </section>

        <footer className="text-center text-[11px] text-parch-400/70">
          기록은 이 브라우저에만 저장됩니다. 서버도, 가입도 없습니다.
        </footer>
      </div>
    </div>
  );
}
