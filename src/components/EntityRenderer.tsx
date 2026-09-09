import React from 'react';
import { Point2D, CADEntity2D } from '../types/cad';

export interface EntityRendererProps {
  entities: CADEntity2D[];
  selectedIds: string[];
  worldToScreen: (pt: Point2D) => Point2D;
  scale: number;
}

export const EntityRenderer: React.FC<EntityRendererProps> = ({
  entities,
  selectedIds,
  worldToScreen,
  scale,
}) => {
  const renderEntity = (entity: CADEntity2D) => {
    // 處理不可見的圖元
    if (entity.visible === false) return null;

    const isSelected = selectedIds.includes(entity.id);
    
    // 樣式規則：被選取則高亮為 #38bdf8，否則為圖層顏色或 #ffffff
    const strokeColor = isSelected ? '#38bdf8' : (entity.color || '#ffffff');
    const strokeWidth = isSelected ? 3 : (entity.lineWidth || 1.5);

    const commonProps = {
      stroke: strokeColor,
      strokeWidth,
      fill: 'none',
      style: { cursor: 'pointer' },
      className: `cad-entity cad-entity-${entity.type}`,
    };

    switch (entity.type) {
      case 'line': {
        const start = worldToScreen(entity.start);
        const end = worldToScreen(entity.end);
        return (
          <line
            key={entity.id}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            {...commonProps}
          />
        );
      }
      
      case 'circle': {
        const center = worldToScreen(entity.center);
        return (
          <circle
            key={entity.id}
            cx={center.x}
            cy={center.y}
            r={entity.radius * scale}
            {...commonProps}
          />
        );
      }
      
      case 'arc': {
        // 計算世界座標的起終點
        const worldStart = {
          x: entity.center.x + entity.radius * Math.cos(entity.startAngle),
          y: entity.center.y + entity.radius * Math.sin(entity.startAngle),
        };
        const worldEnd = {
          x: entity.center.x + entity.radius * Math.cos(entity.endAngle),
          y: entity.center.y + entity.radius * Math.sin(entity.endAngle),
        };
        
        // 轉換為螢幕座標
        const start = worldToScreen(worldStart);
        const end = worldToScreen(worldEnd);
        const screenRadius = entity.radius * scale;
        
        // 計算夾角以決定是否為大弧 (Large Arc)
        let diff = entity.endAngle - entity.startAngle;
        while (diff < 0) diff += 2 * Math.PI;
        while (diff >= 2 * Math.PI) diff -= 2 * Math.PI;
        
        const largeArcFlag = diff > Math.PI ? 1 : 0;
        
        // 繪製方向 (Sweep Flag)
        // CAD 中角度遞增為逆時針 (Y 軸朝上)，
        // SVG 中 Y 軸朝下，為維持相同的視覺方向（逆時針），
        // 需設定 SVG sweep-flag 為 0 (代表往負角度方向繪製)
        const sweepFlag = 0; 
        
        const pathData = `M ${start.x} ${start.y} A ${screenRadius} ${screenRadius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
        
        return <path key={entity.id} d={pathData} {...commonProps} />;
      }
      
      case 'polyline': {
        if (entity.points.length === 0) return null;

        const pointsStr = entity.points
          .map(pt => worldToScreen(pt))
          .map(p => `${p.x},${p.y}`)
          .join(' ');
        
        if (entity.closed) {
          return <polygon key={entity.id} points={pointsStr} {...commonProps} />;
        }
        return <polyline key={entity.id} points={pointsStr} {...commonProps} />;
      }
      
      default:
        return null;
    }
  };

  return (
    <g className="entity-layer">
      {entities.map(renderEntity)}
    </g>
  );
};
