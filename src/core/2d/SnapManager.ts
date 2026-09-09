import { CADEntity2D, Point2D } from '../../types/cad';

export type SnapType = 'endpoint' | 'midpoint' | 'center';

export interface SnapResult {
  point: Point2D;
  type: SnapType;
  entityId: string;
}

function getDistance(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getMidpoint(p1: Point2D, p2: Point2D): Point2D {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

export function findSnapPoint(
  mouseWorld: Point2D,
  entities: CADEntity2D[],
  scale: number,
  screenThreshold: number = 15
): SnapResult | null {
  const worldThreshold = screenThreshold / scale;
  let closestSnap: SnapResult | null = null;
  let minDistance = worldThreshold;

  const checkSnap = (point: Point2D, type: SnapType, entityId: string) => {
    const dist = getDistance(mouseWorld, point);
    if (dist <= minDistance) {
      minDistance = dist;
      closestSnap = { point, type, entityId };
    }
  };

  for (const entity of entities) {
    if (entity.type === 'line') {
      checkSnap(entity.start, 'endpoint', entity.id);
      checkSnap(entity.end, 'endpoint', entity.id);
      checkSnap(getMidpoint(entity.start, entity.end), 'midpoint', entity.id);
    } else if (entity.type === 'circle' || entity.type === 'arc') {
      checkSnap(entity.center, 'center', entity.id);
    } else if (entity.type === 'polyline') {
      // endpoints
      for (const point of entity.points) {
        checkSnap(point, 'endpoint', entity.id);
      }
      
      // midpoints
      const len = entity.points.length;
      if (len > 1) {
        const segmentsCount = entity.closed ? len : len - 1;
        for (let i = 0; i < segmentsCount; i++) {
          const p1 = entity.points[i];
          const p2 = entity.points[(i + 1) % len];
          checkSnap(getMidpoint(p1, p2), 'midpoint', entity.id);
        }
      }
    }
  }

  return closestSnap;
}
