import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCADStore } from '../store/cadStore';
import { useViewport } from '../hooks/useViewport';
import { CADGrid } from './CADGrid';
import { EntityRenderer } from './EntityRenderer';
import { ProfileRenderer } from './ProfileRenderer';
import { Point2D, SketchFeature } from '../types/cad';
import { useDrawMachine } from '../hooks/useDrawMachine';
import { RubberbandPreview } from './RubberbandPreview';
import { SnapMarker } from './SnapMarker';

export const CADSketchCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mouseWorldPos, setMouseWorldPos] = useState<Point2D>({ x: 0, y: 0 });

  const {
    currentTool,
    activeSketchId,
    document,
    selectedEntityIds,
    osnapEnabled,
    selectEntity,
    clearSelection,
  } = useCADStore();

  const handleSelectEntity = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (currentTool === 'SELECT') {
        if (!e.shiftKey) {
          clearSelection();
        }
        selectEntity(id);
      }
    },
    [currentTool, clearSelection, selectEntity]
  );

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

  // 取得目前草圖內的 entities, profiles, constraints 與 solverState
  let currentEntities: any[] = [];
  let currentProfiles: any[] = [];
  let currentConstraints: any[] = [];
  let currentSolverState: any = 'UnderDefined';
  if (activeSketchId) {
    const sketch = document.featureTree.find(
      (f) => f.id === activeSketchId && f.type === 'SKETCH'
    ) as SketchFeature | undefined;
    if (sketch) {
      currentEntities = sketch.entities;
      currentProfiles = sketch.profiles || [];
      currentConstraints = sketch.constraints || [];
      currentSolverState = sketch.solverState;
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
          {/* 封閉面渲染層 (置於線條與節點下方) */}
          <ProfileRenderer
            profiles={currentProfiles}
            worldToScreen={worldToScreen}
          />
          <g style={{ pointerEvents: 'all' }}>
            <EntityRenderer
              entities={currentEntities}
              selectedIds={selectedEntityIds}
              worldToScreen={worldToScreen}
              scale={scale}
              solverState={currentSolverState}
              onSelectEntity={handleSelectEntity}
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
          {/* 固定點 (Fix Constraint) 標記層 (金黃色微型鎖頭圖示) */}
          {currentConstraints
            .filter((c: any) => c.type === 'fix' && c.entityIds?.length > 0)
            .map((c: any) => {
              const entityId = c.entityIds[0];
              const ptIdx = c.pointIndices?.[0] ?? 0;
              const entity = currentEntities.find((e: any) => e.id === entityId);
              if (!entity) return null;

              let worldPt: Point2D | null = null;
              if (entity.type === 'line') {
                worldPt = ptIdx === 1 ? entity.end : entity.start;
              } else if (entity.type === 'circle' || entity.type === 'arc') {
                worldPt = entity.center;
              } else if (entity.type === 'polyline') {
                worldPt = entity.points?.[ptIdx] || entity.points?.[0] || null;
              }

              if (!worldPt) return null;
              const screenPt = worldToScreen(worldPt);

              return (
                <g
                  key={c.id}
                  transform={`translate(${screenPt.x}, ${screenPt.y})`}
                  className="pointer-events-none select-none"
                >
                  {/* 背景微光圈 */}
                  <circle cx="0" cy="0" r="8" fill="#18181b" stroke="#eab308" strokeWidth="1.2" opacity="0.95" />
                  {/* 鎖扣 (Lock Shackle) */}
                  <path
                    d="M -2.5 -1 L -2.5 -3.2 A 2.5 2.5 0 0 1 2.5 -3.2 L 2.5 -1"
                    fill="none"
                    stroke="#facc15"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  {/* 鎖身 (Lock Body) */}
                  <rect
                    x="-3.5"
                    y="-1"
                    width="7"
                    height="5.5"
                    rx="1"
                    fill="#facc15"
                  />
                  {/* 鎖孔 (Keyhole) */}
                  <circle cx="0" cy="1.6" r="0.6" fill="#18181b" />
                </g>
              );
            })}
        </svg>
      )}

      {/* AutoCAD 風格的黑色半透明狀態列 */}
      <div className="absolute bottom-0 right-0 m-4 px-4 py-2 bg-black bg-opacity-70 text-green-400 font-mono text-sm rounded pointer-events-none select-none flex gap-6 items-center">
        <div>
          {drawSession.isDrawing
            ? `Drawing: ${currentTool} (Pick next point or ESC to exit)`
            : 'Ready'}
        </div>
        <div className="text-sky-300 font-bold">
          {currentProfiles.length > 0
            ? `Profiles: ${currentProfiles.length} (${currentProfiles
                .reduce((acc, p) => acc + p.area, 0)
                .toFixed(1)} mm²)`
            : 'Profiles: 0 (Open)'}
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
