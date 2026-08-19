/** 제목 화면과 게임 화면을 오가는 가장 바깥 껍데기 */

import { useState } from 'react';
import { createWorld } from '../core/create';
import { clearSave, hasSave, loadWorld, saveWorld } from '../core/save';
import type { ClassId, World } from '../types';
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
        onStart={(name: string, classId: ClassId) => {
          clearSave();
          const fresh = createWorld(name, classId);
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
