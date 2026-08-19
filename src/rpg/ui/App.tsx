/** 제목 화면과 게임 화면을 오가는 가장 바깥 껍데기 */

import { useState } from 'react';
import { createWorld } from '../core/create';
import { clearSave, hasSave, loadWorld, newSlot, saveWorld } from '../core/save';
import type { World } from '../types';
import { GameScreen } from './GameScreen';
import { TitleScreen } from './TitleScreen';

export function App() {
  const [world, setWorld] = useState<World | null>(null);
  const [saveExists, setSaveExists] = useState(() => hasSave());

  if (!world) {
    return (
      <TitleScreen
        hasSave={saveExists}
        onContinue={() => {
          const loaded = loadWorld();
          if (loaded) setWorld(loaded);
          else setSaveExists(false);
        }}
        onImported={(imported: World) => {
          // readSaveCode 가 이미 읽어본 세계입니다 — 그대로 저장하고 바로 들어갑니다
          saveWorld(imported);
          setSaveExists(true);
          setWorld(imported);
        }}
        onStart={(name: string, templateId: string) => {
          clearSave();
          newSlot();
          const fresh = createWorld(name, templateId);
          saveWorld(fresh);
          setSaveExists(true);
          setWorld(fresh);
        }}
      />
    );
  }

  return (
    <GameScreen
      world={world}
      onQuit={() => {
        saveWorld(world);
        setSaveExists(true);
        setWorld(null);
      }}
    />
  );
}
