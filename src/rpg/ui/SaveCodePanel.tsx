/**
 *  기록을 글자로 뽑고, 글자에서 되살리는 곳.
 *
 *  ★ 기록은 이 브라우저 안에만 있습니다. 브라우저를 비우거나 기기를 바꾸면 사라집니다.
 *    그래서 한 줄짜리 글자로 뽑아 어딘가에 붙여둘 수 있게 합니다.
 *
 *  ★ 불러오기는 되돌릴 수 없습니다. 그래서 두 걸음으로 나눕니다 —
 *    먼저 글자를 읽어보고(여기서 틀리면 왜 틀렸는지 말해줍니다),
 *    무엇이 들어오고 무엇이 사라지는지 보여준 뒤에야 덮어씁니다.
 */

import { useState } from 'react';

import { exportSave, loadWorld, readSaveCode } from '../core/save';
import type { World } from '../types';

type Stage =
  | { at: 'closed' }
  | { at: 'idle' }
  /** 읽어보니 멀쩡하다 — 덮어쓸지 묻는 중 */
  | { at: 'confirm'; code: string; incoming: World };

export function SaveCodePanel({ hasSave, onImported }: { hasSave: boolean; onImported: (world: World) => void }) {
  const [stage, setStage] = useState<Stage>({ at: 'closed' });
  const [code, setCode] = useState('');
  const [paste, setPaste] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);

  if (stage.at === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setStage({ at: 'idle' })}
        className="btn mx-auto w-full max-w-md rounded-sm px-4 py-3 text-[13px] text-parch-300"
      >
        기록 백업 · 옮기기
      </button>
    );
  }

  const pull = () => {
    setCopied(null);
    setProblem(null);
    const world = loadWorld();
    if (!world) {
      setCode('');
      setProblem('아직 저장된 기록이 없습니다. 한 번 놀고 나서 다시 오세요.');
      return;
    }
    setCode(exportSave(world));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('yes');
    } catch {
      // 브라우저가 막는 경우가 있습니다 — 그때는 직접 고르라고 알려줍니다
      setCopied('no');
    }
  };

  const check = () => {
    setProblem(null);
    const result = readSaveCode(paste);
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    setStage({ at: 'confirm', code: paste, incoming: result.world });
  };

  return (
    <section className="panel studded rounded-sm p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="eyebrow">기록 백업 · 옮기기</h2>
        <button
          type="button"
          onClick={() => { setStage({ at: 'closed' }); setProblem(null); }}
          className="btn rounded-sm px-3 py-1.5 text-[11px] text-parch-400"
        >
          닫기
        </button>
      </div>

      {stage.at === 'confirm' ? (
        /* ------------------------------------------------- 덮어쓰기 확인 */
        <div className="rounded-sm border border-[#e88a86]/60 bg-[#3a1512]/50 p-3">
          <p className="text-[13px] font-bold text-[#e88a86]">지금 기록을 덮어씁니다. 되돌릴 수 없습니다.</p>

          <dl className="mt-2.5 space-y-1 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt className="text-parch-400">들어올 인물</dt>
              <dd className="text-parch-100">
                {stage.incoming.me.name} · {stage.incoming.map.def.name}
                <span className="tabular text-parch-400"> · 골드 {Math.floor(stage.incoming.me.gold)}</span>
              </dd>
            </div>
            {hasSave && (
              <div className="flex justify-between gap-2">
                <dt className="text-parch-400">사라질 기록</dt>
                <dd className="text-[#e88a86]">이 브라우저에 저장된 지금 인물</dd>
              </div>
            )}
          </dl>

          {hasSave && (
            <p className="mt-2 text-[11px] leading-snug text-parch-400">
              아깝다면 먼저 <b className="text-parch-200">닫기 → 다시 열어 “지금 기록 뽑기”</b> 로
              지금 것을 받아두세요.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setStage({ at: 'idle' })}
              className="btn h-11 flex-1 rounded-sm text-[13px] text-parch-300"
            >
              그만두기
            </button>
            <button
              type="button"
              onClick={() => onImported(stage.incoming)}
              className="btn h-11 flex-1 rounded-sm text-[13px] font-bold"
              style={{ borderColor: 'rgba(194,53,47,0.7)', color: '#e88a86' }}
            >
              덮어쓰고 시작
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ------------------------------------------------- 내보내기 */}
          <div>
            <h3 className="mb-1.5 text-[13px] font-bold text-parch-100">내보내기</h3>
            <p className="mb-2 text-[11px] leading-snug text-parch-400">
              지금 기록을 한 덩이 글자로 뽑습니다. 메모장이든 메신저든 어디든 붙여두세요.
            </p>
            <button type="button" onClick={pull} className="btn h-11 w-full rounded-sm text-[13px] text-parch-200">
              지금 기록 뽑기
            </button>

            {code && (
              <>
                <textarea
                  readOnly
                  value={code}
                  rows={3}
                  onFocus={(event) => event.currentTarget.select()}
                  aria-label="내보낸 기록 글자"
                  className="socket mt-2 w-full resize-none break-all rounded-sm px-2 py-2 font-mono text-[10px] leading-tight text-parch-300 outline-none"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={copy} className="btn h-11 flex-1 rounded-sm text-[13px] text-parch-200">
                    복사
                  </button>
                  <span className="text-[11px] text-parch-400">
                    {copied === 'yes' && <b className="text-[#8fcf8a]">복사했습니다</b>}
                    {copied === 'no' && '복사가 막혔습니다 — 글자를 눌러 직접 복사하세요'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="rule" />

          {/* ------------------------------------------------- 불러오기 */}
          <div>
            <h3 className="mb-1.5 text-[13px] font-bold text-parch-100">불러오기</h3>
            <p className="mb-2 text-[11px] leading-snug text-parch-400">
              뽑아둔 글자를 붙여넣으세요. <b className="text-[#e88a86]">지금 기록을 덮어씁니다.</b>
            </p>
            <textarea
              value={paste}
              onChange={(event) => { setPaste(event.target.value); setProblem(null); }}
              rows={3}
              placeholder="여기에 붙여넣기"
              aria-label="불러올 기록 글자"
              className="socket w-full resize-none break-all rounded-sm px-2 py-2 font-mono text-[10px] leading-tight text-parch-100 outline-none placeholder:font-sans placeholder:text-[11px] placeholder:text-parch-400/60 focus:ring-1 focus:ring-brass-500"
            />
            <button type="button" onClick={check} className="btn mt-2 h-11 w-full rounded-sm text-[13px] text-parch-200">
              읽어보기
            </button>
          </div>

          {problem && (
            <p className="rounded-sm border border-[#e88a86]/50 bg-[#3a1512]/40 px-3 py-2 text-[12px] leading-snug text-[#e88a86]">
              {problem}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
