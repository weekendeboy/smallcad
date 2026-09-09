import { useState, useCallback, useEffect } from 'react';
import { useCADStore } from '../store/cadStore';
import { Point2D, LineEntity, CircleEntity, SketchFeature, CADEntity2D } from '../types/cad';
import { DrawSession, createInitialDrawSession } from '../types/sketchInteraction';
import { findSnapPoint, SnapResult } from '../core/2d/SnapManager';

export function useDrawMachine() {
  const currentTool = useCADStore((state) => state.currentTool);
  const activeSketchId = useCADStore((state) => state.activeSketchId);
  const document = useCADStore((state) => state.document);
  const osnapEnabled = useCADStore((state) => state.osnapEnabled);
  const addEntity = useCADStore((state) => state.addEntity);

  const [drawSession, setDrawSession] = useState<DrawSession>(createInitialDrawSession());
  const [currentSnap, setCurrentSnap] = useState<SnapResult | null>(null);

  // 取得目前草圖內的 entities
  let currentEntities: CADEntity2D[] = [];
  if (activeSketchId) {
    const sketch = document.featureTree.find(
      (f) => f.id === activeSketchId && f.type === 'SKETCH'
    ) as SketchFeature | undefined;
    if (sketch) {
      currentEntities = sketch.entities;
    }
  }

  const cancelDrawing = useCallback(() => {
    setDrawSession(createInitialDrawSession());
    setCurrentSnap(null);
  }, []);

  // 當工具切換時，如果有未完成的繪圖操作則自動取消
  useEffect(() => {
    cancelDrawing();
  }, [currentTool, cancelDrawing]);

  // 監聽 Escape 鍵，按下時自動調用 cancelDrawing() 清除暫態
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelDrawing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelDrawing]);

  const handlePointerMove = useCallback(
    (worldPt: Point2D, scale: number = 1.0) => {
      let snap: SnapResult | null = null;
      if (osnapEnabled) {
        snap = findSnapPoint(worldPt, currentEntities, scale);
      }
      setCurrentSnap(snap);

      const finalPt = snap ? snap.point : worldPt;

      setDrawSession((prev) => {
        if (!prev.isDrawing) return prev;
        return {
          ...prev,
          currentCursor: finalPt,
        };
      });
    },
    [osnapEnabled, currentEntities]
  );

  const handleCanvasClick = useCallback(
    (worldPt: Point2D) => {
      if (!activeSketchId) return;

      const clickPt = currentSnap ? currentSnap.point : worldPt;

      if (currentTool === 'LINE') {
        if (!drawSession.isDrawing) {
          setDrawSession({
            isDrawing: true,
            startPoint: clickPt,
            currentCursor: clickPt,
            step: 1,
          });
        } else if (drawSession.startPoint) {
          const dx = clickPt.x - drawSession.startPoint.x;
          const dy = clickPt.y - drawSession.startPoint.y;
          const distance = Math.hypot(dx, dy);

          if (distance > 0.5) {
            const newLine: LineEntity = {
              id: crypto.randomUUID(),
              layerId: 'layer-0',
              visible: true,
              locked: false,
              type: 'line',
              start: drawSession.startPoint,
              end: clickPt,
            };
            addEntity(newLine);
          }

          // 連續畫線：將當前點作為下一次的起點
          setDrawSession({
            isDrawing: true,
            startPoint: clickPt,
            currentCursor: clickPt,
            step: 1,
          });
        }
      } else if (currentTool === 'CIRCLE') {
        if (!drawSession.isDrawing) {
          setDrawSession({
            isDrawing: true,
            startPoint: clickPt,
            currentCursor: clickPt,
            step: 1,
          });
        } else if (drawSession.startPoint) {
          const dx = clickPt.x - drawSession.startPoint.x;
          const dy = clickPt.y - drawSession.startPoint.y;
          const radius = Math.hypot(dx, dy);

          if (radius > 0.5) {
            const newCircle: CircleEntity = {
              id: crypto.randomUUID(),
              layerId: 'layer-0',
              visible: true,
              locked: false,
              type: 'circle',
              center: drawSession.startPoint,
              radius: radius,
            };
            addEntity(newCircle);
          }

          // 圓形畫完直接結束
          cancelDrawing();
        }
      }
    },
    [currentTool, drawSession, activeSketchId, addEntity, cancelDrawing, currentSnap]
  );

  return {
    drawSession,
    currentSnap,
    handlePointerMove,
    handleCanvasClick,
    cancelDrawing,
  };
}
