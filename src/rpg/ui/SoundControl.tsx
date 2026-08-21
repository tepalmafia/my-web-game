/**
 *  소리 끄기와 크기 (사운드-설계.md §5).
 *
 *  ★ 소리를 못 내는 환경(오래된 브라우저, 서버 렌더)에서는 아예 나타나지 않습니다.
 *  ★ 끈 상태와 크기는 bus 가 localStorage 에 넣어두므로 새로고침해도 그대로입니다.
 */

import { useState } from 'react';

import { getSettings, setMuted, setVolume, supported } from '../audio/bus';

export function SoundControl({ className = '' }: { className?: string }) {
  const [settings, setSettings] = useState(() => getSettings());
  const [open, setOpen] = useState(false);

  if (!supported()) return null;

  const mute = (next: boolean) => {
    setMuted(next);
    setSettings(getSettings());
  };
  const volume = (next: number) => {
    setVolume(next);
    setSettings(getSettings());
  };

  const percent = Math.round(settings.volume * 100);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => mute(!settings.muted)}
        onDoubleClick={() => setOpen((v) => !v)}
        aria-label={settings.muted ? '소리 켜기' : '소리 끄기'}
        aria-pressed={settings.muted}
        title={settings.muted ? '소리 켜기' : '소리 끄기'}
        className="btn flex h-11 w-11 items-center justify-center rounded-sm text-base text-parch-300"
      >
        {settings.muted ? '🔇' : '🔊'}
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="소리 크기"
        className="btn tabular flex h-11 min-w-11 items-center justify-center rounded-sm px-2 text-[11px] text-parch-400"
      >
        {settings.muted ? '꺼짐' : `${percent}%`}
      </button>

      {open && (
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          aria-label="소리 크기"
          onChange={(event) => volume(Number(event.target.value) / 100)}
          className="h-11 w-24 accent-[#c9a227]"
        />
      )}
    </div>
  );
}
