import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCADStore } from '../store/cadStore';
import { useViewport } from '../hooks/useViewport';
import { CADGrid } from './CADGrid';
import { EntityRenderer } from './EntityRenderer';
import { Point2D, SketchFeature } from '../types/cad';
import { useDrawMachine } from '../hooks/useDrawMachine';
import { RubberbandPreview } from './RubberbandPreview';

export const CADSketchCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mouseWorldPos, setMouseWorldPos] = useState<Point2D>({ x: 0, y: 0 });

  const { currentTool, activeSketchId, document, selectedEntityIds } = useCADStore();

  const {
    drawSession,
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

  // 處理滑鼠移動時更新世界座標與繪圖狀態
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
      handleDrawPointerMove(worldPt);
    },
    [viewportHandlers, screenToWorld, handleDrawPointerMove]
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

  // 初始時如果視圖大小準備好，將 pan 移到中間
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0 && pan.x === 0 && pan.y === 0) {
      // 此處略過自動置中，維持預設 {0, 0} 以符合一般的數學原點。
    }
  }, [dimensions.width, dimensions.height, pan.x, pan.y]);

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
        </svg>
      )}

      {/* AutoCAD 風格的黑色半透明狀態列 */}
      <div className="absolute bottom-0 right-0 m-4 px-4 py-2 bg-black bg-opacity-70 text-green-400 font-mono text-sm rounded pointer-events-none select-none flex gap-6">
        <div>
          {drawSession.isDrawing
            ? `Drawing: ${currentTool} (Pick next point or ESC to exit)`
            : 'Ready'}
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
