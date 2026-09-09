import { useState, useCallback, useEffect } from 'react';
import { useCADStore } from '../store/cadStore';
import { Point2D, LineEntity, CircleEntity, ArcEntity, SketchFeature, CADEntity2D } from '../types/cad';
import { DrawSession, createInitialDrawSession } from '../types/sketchInteraction';
import { findSnapPoint, SnapResult } from '../core/2d/SnapManager';
import { calculate3PointArc } from '../core/2d/GeometryMath';

export function useDrawMachine() {
  const currentTool = useCADStore((state) => state.currentTool);
  const activeSketchId = useCADStore((state) => state.activeSketchId);
  const document = useCADStore((state) => state.document);
  const osnapEnabled = useCADStore((state) => state.osnapEnabled);
  const addEntity = useCADStore((state) => state.addEntity);
  const addConstraint = useCADStore((state) => state.addConstraint);

  const [drawSession, setDrawSession] = useState<DrawSession>(createInitialDrawSession());
  const [currentSnap, setCurrentSnap] = useState<SnapResult | null>(null);
  const [firstEntityId, setFirstEntityId] = useState<string | null>(null);
  const [lastEntityId, setLastEntityId] = useState<string | null>(null);
  const [snapCenter, setSnapCenter] = useState<SnapResult | null>(null);
  const [snapP1, setSnapP1] = useState<SnapResult | null>(null);
  const [snapP2, setSnapP2] = useState<SnapResult | null>(null);

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
    setFirstEntityId(null);
    setLastEntityId(null);
    setSnapCenter(null);
    setSnapP1(null);
    setSnapP2(null);
  }, []);

  // 當工具切換時，將 lastEntityId 與 firstEntityId 徹底重置，並取消繪圖操作
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

            // 判斷是否命中第一條線段起點或兩點極近形成閉合
            const firstLine = currentEntities.find((e) => e.id === firstEntityId) as LineEntity | undefined;
            const isNearFirstStart =
              firstLine && firstLine.type === 'line'
                ? Math.hypot(clickPt.x - firstLine.start.x, clickPt.y - firstLine.start.y) < 0.5
                : false;

            const isClosing = Boolean(
              firstEntityId && (
                (currentSnap && currentSnap.entityId === firstEntityId) ||
                isNearFirstStart
              )
            );

            if (!lastEntityId) {
              // 第一段線段生成時：記錄 firstEntityId 與 lastEntityId
              setFirstEntityId(newLine.id);
              setLastEntityId(newLine.id);
            } else {
              // 連續繪製後續線段時：建立與上一段的重合約束 (lastEntityId 終點 index 1, newLine 起點 index 0)
              addConstraint({
                id: crypto.randomUUID(),
                type: 'coincident',
                entityIds: [lastEntityId, newLine.id],
                pointIndices: [1, 0],
              });
              setLastEntityId(newLine.id);
            }

            // 當閉合點擊時：建立首尾閉合約束 (newLine 終點 index 1, firstEntityId 起點 index 0) 並安全結束
            if (isClosing && firstEntityId) {
              addConstraint({
                id: crypto.randomUUID(),
                type: 'coincident',
                entityIds: [newLine.id, firstEntityId],
                pointIndices: [1, 0],
              });
              cancelDrawing();
              return;
            }
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
      } else if (currentTool === 'RECTANGLE') {
        if (!drawSession.isDrawing) {
          setDrawSession({
            isDrawing: true,
            startPoint: clickPt,
            currentCursor: clickPt,
            step: 1,
          });
        } else if (drawSession.startPoint) {
          const p1 = drawSession.startPoint;
          const p2 = clickPt;
          const width = Math.abs(p2.x - p1.x);
          const height = Math.abs(p2.y - p1.y);

          if (width > 0.5 && height > 0.5) {
            const minX = Math.min(p1.x, p2.x);
            const maxX = Math.max(p1.x, p2.x);
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);

            // 生成 4 條 LineEntity：頂、底、左、右邊
            // 頂邊 (Top Edge): (maxX, maxY) -> (minX, maxY)
            const topLine: LineEntity = {
              id: crypto.randomUUID(),
              layerId: 'layer-0',
              visible: true,
              locked: false,
              type: 'line',
              start: { x: maxX, y: maxY },
              end: { x: minX, y: maxY },
            };

            // 底邊 (Bottom Edge): (minX, minY) -> (maxX, minY)
            const bottomLine: LineEntity = {
              id: crypto.randomUUID(),
              layerId: 'layer-0',
              visible: true,
              locked: false,
              type: 'line',
              start: { x: minX, y: minY },
              end: { x: maxX, y: minY },
            };

            // 左邊 (Left Edge): (minX, maxY) -> (minX, minY)
            const leftLine: LineEntity = {
              id: crypto.randomUUID(),
              layerId: 'layer-0',
              visible: true,
              locked: false,
              type: 'line',
              start: { x: minX, y: maxY },
              end: { x: minX, y: minY },
            };

            // 右邊 (Right Edge): (maxX, minY) -> (maxX, maxY)
            const rightLine: LineEntity = {
              id: crypto.randomUUID(),
              layerId: 'layer-0',
              visible: true,
              locked: false,
              type: 'line',
              start: { x: maxX, y: minY },
              end: { x: maxX, y: maxY },
            };

            // 調用 addEntity 寫入草圖
            addEntity(bottomLine);
            addEntity(rightLine);
            addEntity(topLine);
            addEntity(leftLine);

            // 自動為相鄰頂點注入 4 個 coincident 重合約束（首尾相連封閉）
            // 1. 底邊終點 -> 右邊起點
            addConstraint({
              id: crypto.randomUUID(),
              type: 'coincident',
              entityIds: [bottomLine.id, rightLine.id],
              pointIndices: [1, 0],
            });
            // 2. 右邊終點 -> 頂邊起點
            addConstraint({
              id: crypto.randomUUID(),
              type: 'coincident',
              entityIds: [rightLine.id, topLine.id],
              pointIndices: [1, 0],
            });
            // 3. 頂邊終點 -> 左邊起點
            addConstraint({
              id: crypto.randomUUID(),
              type: 'coincident',
              entityIds: [topLine.id, leftLine.id],
              pointIndices: [1, 0],
            });
            // 4. 左邊終點 -> 底邊起點
            addConstraint({
              id: crypto.randomUUID(),
              type: 'coincident',
              entityIds: [leftLine.id, bottomLine.id],
              pointIndices: [1, 0],
            });

            // 自動注入 2 個 horizontal 約束（上下邊）
            addConstraint({
              id: crypto.randomUUID(),
              type: 'horizontal',
              entityIds: [topLine.id],
            });
            addConstraint({
              id: crypto.randomUUID(),
              type: 'horizontal',
              entityIds: [bottomLine.id],
            });

            // 自動注入 2 個 vertical 約束（左右邊）
            addConstraint({
              id: crypto.randomUUID(),
              type: 'vertical',
              entityIds: [leftLine.id],
            });
            addConstraint({
              id: crypto.randomUUID(),
              type: 'vertical',
              entityIds: [rightLine.id],
            });
          }

          // 呼叫 cancelDrawing() 結束工作階段
          cancelDrawing();
        }
      } else if (currentTool === 'ARC_3P' || currentTool === 'ARC') {
        if (!drawSession.isDrawing || drawSession.step === 0) {
          // 第 1 點定起點
          setDrawSession({
            isDrawing: true,
            startPoint: clickPt,
            secondPoint: null,
            currentCursor: clickPt,
            step: 1,
          });
          setSnapP1(currentSnap ? { ...currentSnap } : null);
          setSnapP2(null);
        } else if (drawSession.step === 1 && drawSession.startPoint) {
          // 第 2 點定終點
          const p1 = drawSession.startPoint;
          const dist = Math.hypot(clickPt.x - p1.x, clickPt.y - p1.y);
          if (dist > 0.5) {
            setDrawSession((prev) => ({
              ...prev,
              secondPoint: clickPt,
              currentCursor: clickPt,
              step: 2,
            }));
            setSnapP2(currentSnap ? { ...currentSnap } : null);
          }
        } else if (drawSession.step === 2 && drawSession.startPoint && drawSession.secondPoint) {
          // 第 3 點定弧上通過點，完成後產生 ArcEntity
          const p1 = drawSession.startPoint;
          const p2 = drawSession.secondPoint;
          const p3 = clickPt;

          const arcData = calculate3PointArc(p1, p2, p3);
          if (arcData && arcData.radius > 0.5) {
            const newArc: ArcEntity = {
              id: crypto.randomUUID(),
              layerId: 'layer-0',
              visible: true,
              locked: false,
              type: 'arc',
              center: arcData.center,
              radius: arcData.radius,
              startAngle: arcData.startAngle,
              endAngle: arcData.endAngle,
            };

            addEntity(newArc);

            // 若起點或終點有鎖點吸附，自動注入 coincident 重合約束
            // 計算 newArc 的起點 (startAngle) 與終點 (endAngle) 座標
            const arcStart = {
              x: newArc.center.x + newArc.radius * Math.cos(newArc.startAngle),
              y: newArc.center.y + newArc.radius * Math.sin(newArc.startAngle),
            };
            const arcEnd = {
              x: newArc.center.x + newArc.radius * Math.cos(newArc.endAngle),
              y: newArc.center.y + newArc.radius * Math.sin(newArc.endAngle),
            };

            const dStartP1 = Math.hypot(arcStart.x - p1.x, arcStart.y - p1.y);
            const dEndP1 = Math.hypot(arcEnd.x - p1.x, arcEnd.y - p1.y);
            const p1Index = dStartP1 <= dEndP1 ? 0 : 1;
            const p2Index = p1Index === 0 ? 1 : 0;

            if (snapP1) {
              addConstraint({
                id: crypto.randomUUID(),
                type: 'coincident',
                entityIds: [newArc.id, snapP1.entityId],
                pointIndices: [p1Index, snapP1.pointIndex ?? 0],
              });
            }

            if (snapP2) {
              addConstraint({
                id: crypto.randomUUID(),
                type: 'coincident',
                entityIds: [newArc.id, snapP2.entityId],
                pointIndices: [p2Index, snapP2.pointIndex ?? 0],
              });
            }
          }

          // 呼叫 cancelDrawing() 結束工作階段
          cancelDrawing();
        }
      } else if (currentTool === 'ARC_CENTER') {
        if (!drawSession.isDrawing || drawSession.step === 0) {
          // 點擊第 1 點：設定圓心 C
          setDrawSession({
            isDrawing: true,
            startPoint: clickPt,
            secondPoint: null,
            currentCursor: clickPt,
            step: 1,
          });
          setSnapCenter(currentSnap ? { ...currentSnap } : null);
          setSnapP1(null);
          setSnapP2(null);
        } else if (drawSession.step === 1 && drawSession.startPoint) {
          // 點擊第 2 點：設定半徑與起始角度 P_start（R=dist(C,P_start)，startAngle=atan2(dy,dx)）
          const C = drawSession.startPoint;
          const dist = Math.hypot(clickPt.x - C.x, clickPt.y - C.y);
          if (dist > 0.5) {
            setDrawSession((prev) => ({
              ...prev,
              secondPoint: clickPt,
              currentCursor: clickPt,
              step: 2,
            }));
            setSnapP1(currentSnap ? { ...currentSnap } : null);
          }
        } else if (drawSession.step === 2 && drawSession.startPoint && drawSession.secondPoint) {
          // 點擊第 3 點：鎖定終止角度 endAngle，生成 ArcEntity 並寫入狀態
          const C = drawSession.startPoint;
          const P_start = drawSession.secondPoint;
          const radius = Math.hypot(P_start.x - C.x, P_start.y - C.y);

          if (radius > 0.5) {
            const startAngle = Math.atan2(P_start.y - C.y, P_start.x - C.x);
            const endAngle = Math.atan2(clickPt.y - C.y, clickPt.x - C.x);

            const newArc: ArcEntity = {
              id: crypto.randomUUID(),
              layerId: 'layer-0',
              visible: true,
              locked: false,
              type: 'arc',
              center: C,
              radius: radius,
              startAngle: startAngle,
              endAngle: endAngle,
            };

            addEntity(newArc);

            // 若圓心有鎖點吸附，自動建立 coincident 約束 (pointIndex 2 為圓心)
            if (snapCenter) {
              addConstraint({
                id: crypto.randomUUID(),
                type: 'coincident',
                entityIds: [newArc.id, snapCenter.entityId],
                pointIndices: [2, snapCenter.pointIndex ?? 0],
              });
            }

            // 若起點有鎖點吸附，自動建立 coincident 約束 (pointIndex 0 為起點)
            if (snapP1) {
              addConstraint({
                id: crypto.randomUUID(),
                type: 'coincident',
                entityIds: [newArc.id, snapP1.entityId],
                pointIndices: [0, snapP1.pointIndex ?? 0],
              });
            }

            // 若終點有鎖點吸附，自動建立 coincident 約束 (pointIndex 1 為終點)
            if (currentSnap) {
              addConstraint({
                id: crypto.randomUUID(),
                type: 'coincident',
                entityIds: [newArc.id, currentSnap.entityId],
                pointIndices: [1, currentSnap.pointIndex ?? 0],
              });
            }
          }

          // 呼叫 cancelDrawing() 結束工作階段
          cancelDrawing();
        }
      }
    },
    [
      activeSketchId,
      currentSnap,
      currentTool,
      drawSession,
      currentEntities,
      firstEntityId,
      lastEntityId,
      snapCenter,
      snapP1,
      snapP2,
      addEntity,
      addConstraint,
      cancelDrawing,
    ]
  );

  return {
    drawSession,
    currentSnap,
    handlePointerMove,
    handleCanvasClick,
    cancelDrawing,
  };
}

