import React from 'react';
import { Point2D, Dimension } from '../types/cad';
import {
  calculateLinearDimensionLayout,
  calculateRadialDimensionLayout
} from '../core/2d/DimensionEngine';

interface DimensionRendererProps {
  dimensions: Dimension[];
  worldToScreen: (pt: Point2D) => Point2D;
  onEditDimension: (dim: Dimension) => void;
}

export const DimensionRenderer: React.FC<DimensionRendererProps> = ({
  dimensions,
  worldToScreen,
  onEditDimension,
}) => {
  if (!dimensions || dimensions.length === 0) return null;

  return (
    <g id="cad-dimensions-layer" className="select-none">
      {dimensions.map((dim) => {
        if (!dim.points || dim.points.length === 0) return null;

        try {
          if (dim.type === 'linear') {
            if (dim.points.length < 2) return null;
            const p1 = dim.points[0];
            const p2 = dim.points[1];
            
            // 將世界座標轉換為螢幕座標，使標註在縮放時維持一致的像素外觀尺寸
            const sP1 = worldToScreen(p1);
            const sP2 = worldToScreen(p2);
            const sText = worldToScreen(dim.textPosition);

            // 判斷是否為對齊標註（若 dim 屬性中有指定，否則自動分析）
            const isAligned = (dim as any).isAligned !== false;

            // 計算標註幾何佈局 (使用預設的箭頭與間距像素值)
            const layout = calculateLinearDimensionLayout(
              sP1,
              sP2,
              sText,
              isAligned,
              7.0,             // 箭頭長度
              Math.PI / 6,     // 箭頭夾角 (30度)
              3.0,             // gap 間距
              4.0              // extend 伸出量
            );

            const displayValue = layout.value / (dim as any).scaleFactor || layout.value;
            // 實體長度計算 (世界座標距離)
            const physicalLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const textStr = `${physicalLen.toFixed(1)} mm`;

            // 計算膠囊背景尺寸
            const charCount = textStr.length;
            const rectWidth = charCount * 7.5 + 12;
            const rectHeight = 18;
            const rx = layout.textCenter.x - rectWidth / 2;
            const ry = layout.textCenter.y - rectHeight / 2;

            return (
              <g key={dim.id} id={`dimension-linear-${dim.id}`}>
                {/* 1. 尺寸界線 (Extension Lines) */}
                <line
                  x1={layout.extension1.start.x}
                  y1={layout.extension1.start.y}
                  x2={layout.extension1.end.x}
                  y2={layout.extension1.end.y}
                  stroke="#10b981"
                  strokeWidth="1"
                  className="pointer-events-none"
                />
                <line
                  x1={layout.extension2.start.x}
                  y1={layout.extension2.start.y}
                  x2={layout.extension2.end.x}
                  y2={layout.extension2.end.y}
                  stroke="#10b981"
                  strokeWidth="1"
                  className="pointer-events-none"
                />

                {/* 2. 尺寸線 (Dimension Line) */}
                <line
                  x1={layout.dimensionLine.start.x}
                  y1={layout.dimensionLine.start.y}
                  x2={layout.dimensionLine.end.x}
                  y2={layout.dimensionLine.end.y}
                  stroke="#10b981"
                  strokeWidth="1"
                  className="pointer-events-none"
                />

                {/* 3. 箭頭 (Arrowheads) - 實心三角 */}
                <polygon
                  points={`${layout.arrow1.tip.x},${layout.arrow1.tip.y} ${layout.arrow1.wing1.x},${layout.arrow1.wing1.y} ${layout.arrow1.wing2.x},${layout.arrow1.wing2.y}`}
                  fill="#10b981"
                  className="pointer-events-none"
                />
                <polygon
                  points={`${layout.arrow2.tip.x},${layout.arrow2.tip.y} ${layout.arrow2.wing1.x},${layout.arrow2.wing1.y} ${layout.arrow2.wing2.x},${layout.arrow2.wing2.y}`}
                  fill="#10b981"
                  className="pointer-events-none"
                />

                {/* 4. 文字標籤 (帶有暗色膠囊背景，避免線條穿透) */}
                <g
                  transform={`rotate(${(layout.textRotation * 180) / Math.PI}, ${layout.textCenter.x}, ${layout.textCenter.y})`}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEditDimension(dim);
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x={rx}
                    y={ry}
                    width={rectWidth}
                    height={rectHeight}
                    rx="4"
                    fill="#1e293b"
                    stroke="#10b981"
                    strokeWidth="1"
                    opacity="0.95"
                  />
                  <text
                    x={layout.textCenter.x}
                    y={layout.textCenter.y}
                    fill="#34d399"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {textStr}
                  </text>
                </g>
              </g>
            );
          } else if (dim.type === 'radial') {
            const center = dim.points[0];
            const edge = dim.points[1] || { x: center.x + 10, y: center.y };
            const radius = Math.hypot(edge.x - center.x, edge.y - center.y);

            // 世界座標與半徑
            const sCenter = worldToScreen(center);
            const sRadius = radius * Math.hypot(worldToScreen({ x: 1, y: 0 }).x - worldToScreen({ x: 0, y: 0 }).x, worldToScreen({ x: 1, y: 0 }).y - worldToScreen({ x: 0, y: 0 }).y);
            const sText = worldToScreen(dim.textPosition);

            // 判斷是直徑標註還是半徑標註
            const isDiameter = !!(dim as any).isDiameter;

            const layout = calculateRadialDimensionLayout(
              sCenter,
              radius * (sRadius / radius), // 使用計算後的螢幕半徑
              sText,
              isDiameter,
              7.0, // 箭頭長度
              Math.PI / 6, // 箭頭夾角 (30度)
              10.0 // 折線長度
            );

            // 文字內容
            const textStr = isDiameter
              ? `Ø ${(radius * 2).toFixed(1)} mm`
              : `R ${radius.toFixed(1)} mm`;

            // 計算膠囊背景尺寸
            const charCount = textStr.length;
            const rectWidth = charCount * 7.5 + 12;
            const rectHeight = 18;
            const rx = layout.textCenter.x - rectWidth / 2;
            const ry = layout.textCenter.y - rectHeight / 2;

            // 組合引線頂點為 SVG points 字串
            const polylinePoints = layout.leaderPoints
              .map((p) => `${p.x},${p.y}`)
              .join(' ');

            return (
              <g key={dim.id} id={`dimension-radial-${dim.id}`}>
                {/* 1. 徑向引線 */}
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1"
                  className="pointer-events-none"
                />

                {/* 2. 水平折線 (Landing Line) */}
                {layout.landingLine && (
                  <line
                    x1={layout.landingLine.start.x}
                    y1={layout.landingLine.start.y}
                    x2={layout.landingLine.end.x}
                    y2={layout.landingLine.end.y}
                    stroke="#10b981"
                    strokeWidth="1"
                    className="pointer-events-none"
                  />
                )}

                {/* 3. 箭頭 1 */}
                {layout.arrow1 && (
                  <polygon
                    points={`${layout.arrow1.tip.x},${layout.arrow1.tip.y} ${layout.arrow1.wing1.x},${layout.arrow1.wing1.y} ${layout.arrow1.wing2.x},${layout.arrow1.wing2.y}`}
                    fill="#10b981"
                    className="pointer-events-none"
                  />
                )}

                {/* 4. 箭頭 2 (僅在直徑時存在) */}
                {layout.arrow2 && (
                  <polygon
                    points={`${layout.arrow2.tip.x},${layout.arrow2.tip.y} ${layout.arrow2.wing1.x},${layout.arrow2.wing1.y} ${layout.arrow2.wing2.x},${layout.arrow2.wing2.y}`}
                    fill="#10b981"
                    className="pointer-events-none"
                  />
                )}

                {/* 5. 文字標籤 (帶有暗色膠囊背景，避免線條穿透) */}
                <g
                  transform={`rotate(${(layout.textRotation * 180) / Math.PI}, ${layout.textCenter.x}, ${layout.textCenter.y})`}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEditDimension(dim);
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x={rx}
                    y={ry}
                    width={rectWidth}
                    height={rectHeight}
                    rx="4"
                    fill="#1e293b"
                    stroke="#10b981"
                    strokeWidth="1"
                    opacity="0.95"
                  />
                  <text
                    x={layout.textCenter.x}
                    y={layout.textCenter.y}
                    fill="#34d399"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {textStr}
                  </text>
                </g>
              </g>
            );
          }
        } catch (err) {
          console.error(`Error rendering dimension ${dim.id}:`, err);
        }
        return null;
      })}
    </g>
  );
};
