/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useCADStore } from './store/cadStore';
import { useCadShortcuts } from './hooks/useCadShortcuts';
import { CADSketchCanvas } from './components/CADSketchCanvas';
import { MousePointer2, Pencil, Undo2, Redo2, Maximize, Circle, Magnet } from 'lucide-react';

export default function App() {
  // 啟用全域快速鍵
  useCadShortcuts();

  const {
    currentTool,
    setTool,
    viewMode,
    undo,
    redo,
    canUndo,
    canRedo,
    osnapEnabled,
    toggleOsnap,
  } = useCADStore();

  return (
    <div className="w-full h-screen flex flex-col bg-neutral-900 text-white overflow-hidden">
      {/* Top Toolbar */}
      <header className="h-14 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="font-bold text-lg mr-4">AI Studio CAD</div>
          
          {/* Tools */}
          <div className="flex bg-neutral-900 p-1 rounded-md border border-neutral-800 items-center gap-0.5">
            <button
              onClick={() => setTool('SELECT')}
              className={`p-1.5 rounded ${
                currentTool === 'SELECT' ? 'bg-neutral-800 text-blue-400' : 'text-neutral-400 hover:text-white'
              }`}
              title="Select (S)"
            >
              <MousePointer2 size={18} />
            </button>
            <button
              onClick={() => setTool('LINE')}
              className={`p-1.5 rounded ${
                currentTool === 'LINE' ? 'bg-neutral-800 text-blue-400' : 'text-neutral-400 hover:text-white'
              }`}
              title="Line (L)"
            >
              <Pencil size={18} />
            </button>
            <button
              onClick={() => setTool('CIRCLE')}
              className={`p-1.5 rounded ${
                currentTool === 'CIRCLE' ? 'bg-neutral-800 text-blue-400' : 'text-neutral-400 hover:text-white'
              }`}
              title="Circle (C)"
            >
              <Circle size={18} />
            </button>

            <div className="w-px h-5 bg-neutral-800 mx-1" />

            <button
              onClick={toggleOsnap}
              className={`p-1.5 rounded transition-colors ${
                osnapEnabled
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Object Snap [F3]"
            >
              <Magnet size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={18} />
            </button>
          </div>

          <div className="h-6 w-px bg-neutral-800 mx-1"></div>

          <div className="flex items-center bg-neutral-900 px-3 py-1 rounded text-sm font-mono border border-neutral-800 text-neutral-300">
            <Maximize size={14} className="mr-2" />
            {viewMode} Mode
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 relative">
        <CADSketchCanvas />
      </main>
    </div>
  );
}
