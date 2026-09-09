import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCADStore } from '../store/cadStore';
import { useViewport } from '../hooks/useViewport';
import { CADGrid } from './CADGrid';
import { EntityRenderer } from './EntityRenderer';
import { Point2D, SketchFeature } from '../types/cad';
import { useDrawMachine } from '../hooks/useDrawMachine';
import { RubberbandPreview } from './RubberbandPreview';
import { SnapMarker } from './SnapMarker';

export const CADSketchCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mouseWorldPos, setMouseWorldPos] = useState<Point2D>({ x: 0, y: 0 });

  const { currentTool, activeSketchId, document, selectedEntityIds, osnapEnabled } = useCADStore();

  const {
    drawSession,
    currentSnap,
    handlePointerMove: handleDrawPointerMove,
    handleCanvasClick,
  } = useDrawMachine();

  const {
    pan,
    scale,
    worldToScreen,
    screenToWorld,
    handlers: viewportHandlers,
  } = useViewport({ initialPan: { x: 0, y: 0 }, initialScale: 1.0 });

  // 處理 Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 處理滑鼠移動時更新世界座標與繪圖狀態 (包含 scale 以進行鎖點計算)
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      viewportHandlers.onPointerMove(e);

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const screenPt = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      
      const worldPt = screenToWorld(screenPt);
      setMouseWorldPos(worldPt);
      handleDrawPointerMove(worldPt, scale);
    },
    [viewportHandlers, screenToWorld, handleDrawPointerMove, scale]
  );

  // 處理滑鼠點擊 (過濾掉中鍵平移與右鍵)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      viewportHandlers.onPointerDown(e);
      
      // 僅左鍵點擊 (button 0) 才觸發繪圖事件
      if (e.button === 0) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const screenPt = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        const worldPt = screenToWorld(screenPt);
        handleCanvasClick(worldPt);
      }
    },
    [viewportHandlers, screenToWorld, handleCanvasClick]
  );

  // 取得目前草圖內的 entities
  let currentEntities: any[] = [];
  if (activeSketchId) {
    const sketch = document.featureTree.find(
      (f) => f.id === activeSketchId && f.type === 'SKETCH'
    ) as SketchFeature | undefined;
    if (sketch) {
      currentEntities = sketch.entities;
    }
  }

  // 格式化鎖點類型名稱
  const snapLabel = currentSnap
    ? `SNAP: [${currentSnap.type.charAt(0).toUpperCase() + currentSnap.type.slice(1)}]`
    : osnapEnabled
    ? 'SNAP: FREE'
    : 'SNAP: OFF';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#1E1E1E]"
      onWheel={viewportHandlers.onWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={viewportHandlers.onPointerUp}
      onPointerCancel={viewportHandlers.onPointerCancel}
      style={{ touchAction: 'none' }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <CADGrid
          pan={pan}
          scale={scale}
          width={dimensions.width}
          height={dimensions.height}
          screenToWorld={screenToWorld}
        />
      )}

      {dimensions.width > 0 && dimensions.height > 0 && (
        <svg
          width={dimensions.width}
          height={dimensions.height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <g style={{ pointerEvents: 'all' }}>
            <EntityRenderer
              entities={currentEntities}
              selectedIds={selectedEntityIds}
              worldToScreen={worldToScreen}
              scale={scale}
            />
          </g>
          {/* 疊加繪圖預覽層 */}
          <RubberbandPreview
            session={drawSession}
            tool={currentTool}
            worldToScreen={worldToScreen}
            scale={scale}
          />
          {/* 疊加鎖點標記層 (地位於圖元與預覽層上方) */}
          <SnapMarker
            snap={currentSnap}
            worldToScreen={worldToScreen}
          />
        </svg>
      )}

      {/* AutoCAD 風格的黑色半透明狀態列 */}
      <div className="absolute bottom-0 right-0 m-4 px-4 py-2 bg-black bg-opacity-70 text-green-400 font-mono text-sm rounded pointer-events-none select-none flex gap-6">
        <div>
          {drawSession.isDrawing
            ? `Drawing: ${currentTool} (Pick next point or ESC to exit)`
            : 'Ready'}
        </div>
        <div className={currentSnap ? 'text-emerald-400 font-bold' : 'text-green-400'}>
          {snapLabel}
        </div>
        <div>
          X: {mouseWorldPos.x.toFixed(2)}, Y: {mouseWorldPos.y.toFixed(2)}
        </div>
        <div>
          Scale: {scale.toFixed(2)}x
        </div>
      </div>
    </div>
  );
};
