import React from 'react';
import { Point2D } from '../types/cad';
import { DrawSession } from '../types/sketchInteraction';

export interface RubberbandPreviewProps {
  session: DrawSession;
  tool: string;
  worldToScreen: (pt: Point2D) => Point2D;
  scale: number;
}

export const RubberbandPreview: React.FC<RubberbandPreviewProps> = ({
  session,
  tool,
  worldToScreen,
  scale,
}) => {
  if (!session.isDrawing || !session.startPoint || !session.currentCursor) {
    return null;
  }

  const startScreen = worldToScreen(session.startPoint);
  const cursorScreen = worldToScreen(session.currentCursor);

  const strokeColor = '#f59e0b';
  const strokeWidth = 1.5;
  const strokeDasharray = '5,5';

  if (tool === 'LINE') {
    return (
      <line
        x1={startScreen.x}
        y1={startScreen.y}
        x2={cursorScreen.x}
        y2={cursorScreen.y}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
      />
    );
  }

  if (tool === 'CIRCLE') {
    const radius = Math.hypot(
      cursorScreen.x - startScreen.x,
      cursorScreen.y - startScreen.y
    );
    return (
      <circle
        cx={startScreen.x}
        cy={startScreen.y}
        r={radius}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
      />
    );
  }

  if (tool === 'POLYLINE') {
    const basePoints =
      session.polylinePoints && session.polylinePoints.length > 0
        ? session.polylinePoints
        : [session.startPoint];

    const allPoints = [...basePoints, session.currentCursor];
    const pointsString = allPoints
      .map(worldToScreen)
      .map((p) => `${p.x},${p.y}`)
      .join(' ');

    return (
      <polyline
        points={pointsString}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
      />
    );
  }

  return null;
};
