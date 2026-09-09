import { useState, useCallback, useEffect } from 'react';
import { useCADStore } from '../store/cadStore';
import { Point2D, LineEntity, CircleEntity } from '../types/cad';
import { DrawSession, createInitialDrawSession } from '../types/sketchInteraction';

export function useDrawMachine() {
  const currentTool = useCADStore((state) => state.currentTool);
  const activeSketchId = useCADStore((state) => state.activeSketchId);
  const addEntity = useCADStore((state) => state.addEntity);

  const [drawSession, setDrawSession] = useState<DrawSession>(createInitialDrawSession());

  const cancelDrawing = useCallback(() => {
    setDrawSession(createInitialDrawSession());
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

  const handlePointerMove = useCallback((worldPt: Point2D) => {
    setDrawSession((prev) => {
      if (!prev.isDrawing) return prev;
      return {
        ...prev,
        currentCursor: worldPt,
      };
    });
  }, []);

  const handleCanvasClick = useCallback(
    (worldPt: Point2D) => {
      if (!activeSketchId) return;

      if (currentTool === 'LINE') {
        if (!drawSession.isDrawing) {
          setDrawSession({
            isDrawing: true,
            startPoint: worldPt,
            currentCursor: worldPt,
            step: 1,
          });
        } else if (drawSession.startPoint) {
          const dx = worldPt.x - drawSession.startPoint.x;
          const dy = worldPt.y - drawSession.startPoint.y;
          const distance = Math.hypot(dx, dy);

          if (distance > 0.5) {
            const newLine: LineEntity = {
              id: crypto.randomUUID(),
              layerId: 'layer-0',
              visible: true,
              locked: false,
              type: 'line',
              start: drawSession.startPoint,
              end: worldPt,
            };
            addEntity(newLine);
          }

          // 連續畫線：將當前點作為下一次的起點
          setDrawSession({
            isDrawing: true,
            startPoint: worldPt,
            currentCursor: worldPt,
            step: 1,
          });
        }
      } else if (currentTool === 'CIRCLE') {
        if (!drawSession.isDrawing) {
          setDrawSession({
            isDrawing: true,
            startPoint: worldPt,
            currentCursor: worldPt,
            step: 1,
          });
        } else if (drawSession.startPoint) {
          const dx = worldPt.x - drawSession.startPoint.x;
          const dy = worldPt.y - drawSession.startPoint.y;
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
    [currentTool, drawSession, activeSketchId, addEntity, cancelDrawing]
  );

  return {
    drawSession,
    handlePointerMove,
    handleCanvasClick,
    cancelDrawing,
  };
}
