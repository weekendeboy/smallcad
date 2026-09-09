import { CADEntity2D, Constraint, Point2D } from '../../types/cad';
import { SolverResult, SketchDofState, SOLVER_MAX_ITERATIONS, SOLVER_TOLERANCE } from './solverTypes';

export type { SolverResult, SketchDofState };

/**
 * Deep clones a CADEntity2D to ensure immutable operations.
 */
function cloneEntity(entity: CADEntity2D): CADEntity2D {
  if (entity.type === 'line') {
    return {
      ...entity,
      start: { ...entity.start },
      end: { ...entity.end },
    };
  }
  if (entity.type === 'circle') {
    return {
      ...entity,
      center: { ...entity.center },
    };
  }
  if (entity.type === 'arc') {
    return {
      ...entity,
      center: { ...entity.center },
    };
  }
  if (entity.type === 'polyline') {
    return {
      ...entity,
      points: entity.points.map((p) => ({ ...p })),
    };
  }
  return JSON.parse(JSON.stringify(entity));
}

/**
 * Gets a reference to a point on an entity based on index.
 */
function getEntityPoint(entity: CADEntity2D, pointIndex: number = 0): Point2D | null {
  if (entity.type === 'line') {
    return pointIndex === 1 ? entity.end : entity.start;
  }
  if (entity.type === 'circle' || entity.type === 'arc') {
    return entity.center;
  }
  if (entity.type === 'polyline') {
    return entity.points[pointIndex] || entity.points[0] || null;
  }
  return null;
}

/**
 * Updates a point on an entity based on index.
 */
function setEntityPoint(entity: CADEntity2D, pointIndex: number, newPoint: Point2D): void {
  if (entity.type === 'line') {
    if (pointIndex === 1) {
      entity.end = { ...newPoint };
    } else {
      entity.start = { ...newPoint };
    }
  } else if (entity.type === 'circle' || entity.type === 'arc') {
    entity.center = { ...newPoint };
  } else if (entity.type === 'polyline') {
    if (entity.points[pointIndex]) {
      entity.points[pointIndex] = { ...newPoint };
    }
  }
}

/**
 * Finds all line entity IDs that simultaneously have both horizontal and vertical constraints.
 */
function findConflictingLineEntityIds(entities: CADEntity2D[], constraints: Constraint[]): string[] {
  const lineIds = new Set(entities.filter((e) => e.type === 'line').map((e) => e.id));
  const horizontalEntities = new Set<string>();
  const verticalEntities = new Set<string>();

  for (const c of constraints) {
    if (c.type === 'horizontal') {
      for (const id of c.entityIds) {
        if (lineIds.has(id)) {
          horizontalEntities.add(id);
        }
      }
    } else if (c.type === 'vertical') {
      for (const id of c.entityIds) {
        if (lineIds.has(id)) {
          verticalEntities.add(id);
        }
      }
    }
  }

  const conflictIds: string[] = [];
  for (const id of lineIds) {
    if (horizontalEntities.has(id) && verticalEntities.has(id)) {
      conflictIds.push(id);
    }
  }
  return conflictIds;
}

/**
 * Applies a single constraint to the working entity array and returns the maximum displacement.
 */
function applyConstraint(entitiesMap: Map<string, CADEntity2D>, constraint: Constraint): number {
  let maxDisp = 0;

  switch (constraint.type) {
    case 'coincident': {
      if (constraint.entityIds.length >= 2) {
        const e1 = entitiesMap.get(constraint.entityIds[0]);
        const e2 = entitiesMap.get(constraint.entityIds[1]);
        if (!e1 || !e2) break;

        const idx1 = constraint.pointIndices?.[0] ?? 0;
        const idx2 = constraint.pointIndices?.[1] ?? 0;
        const p1 = getEntityPoint(e1, idx1);
        const p2 = getEntityPoint(e2, idx2);

        if (p1 && p2) {
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;

          const disp1 = Math.hypot(p1.x - midX, p1.y - midY);
          const disp2 = Math.hypot(p2.x - midX, p2.y - midY);

          setEntityPoint(e1, idx1, { x: midX, y: midY });
          setEntityPoint(e2, idx2, { x: midX, y: midY });

          maxDisp = Math.max(disp1, disp2);
        }
      } else if (constraint.entityIds.length === 1 && constraint.pointIndices && constraint.pointIndices.length >= 2) {
        const e1 = entitiesMap.get(constraint.entityIds[0]);
        if (!e1) break;

        const idx1 = constraint.pointIndices[0];
        const idx2 = constraint.pointIndices[1];
        const p1 = getEntityPoint(e1, idx1);
        const p2 = getEntityPoint(e1, idx2);

        if (p1 && p2) {
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;

          const disp1 = Math.hypot(p1.x - midX, p1.y - midY);
          const disp2 = Math.hypot(p2.x - midX, p2.y - midY);

          setEntityPoint(e1, idx1, { x: midX, y: midY });
          setEntityPoint(e1, idx2, { x: midX, y: midY });

          maxDisp = Math.max(disp1, disp2);
        }
      }
      break;
    }

    case 'horizontal': {
      if (constraint.entityIds.length === 1) {
        const e1 = entitiesMap.get(constraint.entityIds[0]);
        if (!e1) break;

        if (e1.type === 'line') {
          const avgY = (e1.start.y + e1.end.y) / 2;
          const disp1 = Math.abs(e1.start.y - avgY);
          const disp2 = Math.abs(e1.end.y - avgY);

          e1.start.y = avgY;
          e1.end.y = avgY;

          maxDisp = Math.max(disp1, disp2);
        }
      } else if (constraint.entityIds.length >= 2) {
        const e1 = entitiesMap.get(constraint.entityIds[0]);
        const e2 = entitiesMap.get(constraint.entityIds[1]);
        if (!e1 || !e2) break;

        const idx1 = constraint.pointIndices?.[0] ?? 0;
        const idx2 = constraint.pointIndices?.[1] ?? 0;
        const p1 = getEntityPoint(e1, idx1);
        const p2 = getEntityPoint(e2, idx2);

        if (p1 && p2) {
          const avgY = (p1.y + p2.y) / 2;
          const disp1 = Math.abs(p1.y - avgY);
          const disp2 = Math.abs(p2.y - avgY);

          setEntityPoint(e1, idx1, { x: p1.x, y: avgY });
          setEntityPoint(e2, idx2, { x: p2.x, y: avgY });

          maxDisp = Math.max(disp1, disp2);
        }
      }
      break;
    }

    case 'vertical': {
      if (constraint.entityIds.length === 1) {
        const e1 = entitiesMap.get(constraint.entityIds[0]);
        if (!e1) break;

        if (e1.type === 'line') {
          const avgX = (e1.start.x + e1.end.x) / 2;
          const disp1 = Math.abs(e1.start.x - avgX);
          const disp2 = Math.abs(e1.end.x - avgX);

          e1.start.x = avgX;
          e1.end.x = avgX;

          maxDisp = Math.max(disp1, disp2);
        }
      } else if (constraint.entityIds.length >= 2) {
        const e1 = entitiesMap.get(constraint.entityIds[0]);
        const e2 = entitiesMap.get(constraint.entityIds[1]);
        if (!e1 || !e2) break;

        const idx1 = constraint.pointIndices?.[0] ?? 0;
        const idx2 = constraint.pointIndices?.[1] ?? 0;
        const p1 = getEntityPoint(e1, idx1);
        const p2 = getEntityPoint(e2, idx2);

        if (p1 && p2) {
          const avgX = (p1.x + p2.x) / 2;
          const disp1 = Math.abs(p1.x - avgX);
          const disp2 = Math.abs(p2.x - avgX);

          setEntityPoint(e1, idx1, { x: avgX, y: p1.y });
          setEntityPoint(e2, idx2, { x: avgX, y: p2.y });

          maxDisp = Math.max(disp1, disp2);
        }
      }
      break;
    }

    case 'length':
    case 'distance': {
      const targetVal = constraint.value;
      if (targetVal === undefined || targetVal <= 0) break;

      if (constraint.entityIds.length === 1) {
        const e1 = entitiesMap.get(constraint.entityIds[0]);
        if (!e1) break;

        if (e1.type === 'line') {
          let dx = e1.end.x - e1.start.x;
          let dy = e1.end.y - e1.start.y;
          let len = Math.hypot(dx, dy);

          if (len === 0) {
            dx = 1;
            dy = 0;
            len = 1;
          }

          const midX = (e1.start.x + e1.end.x) / 2;
          const midY = (e1.start.y + e1.end.y) / 2;
          const dirX = dx / len;
          const dirY = dy / len;
          const halfVal = targetVal / 2;

          const newStartX = midX - dirX * halfVal;
          const newStartY = midY - dirY * halfVal;
          const newEndX = midX + dirX * halfVal;
          const newEndY = midY + dirY * halfVal;

          const disp1 = Math.hypot(e1.start.x - newStartX, e1.start.y - newStartY);
          const disp2 = Math.hypot(e1.end.x - newEndX, e1.end.y - newEndY);

          e1.start = { x: newStartX, y: newStartY };
          e1.end = { x: newEndX, y: newEndY };

          maxDisp = Math.max(disp1, disp2);
        } else if (e1.type === 'circle' || e1.type === 'arc') {
          const disp = Math.abs(e1.radius - targetVal);
          e1.radius = targetVal;
          maxDisp = disp;
        }
      } else if (constraint.entityIds.length >= 2) {
        const e1 = entitiesMap.get(constraint.entityIds[0]);
        const e2 = entitiesMap.get(constraint.entityIds[1]);
        if (!e1 || !e2) break;

        const idx1 = constraint.pointIndices?.[0] ?? 0;
        const idx2 = constraint.pointIndices?.[1] ?? 0;
        const p1 = getEntityPoint(e1, idx1);
        const p2 = getEntityPoint(e2, idx2);

        if (p1 && p2) {
          let dx = p2.x - p1.x;
          let dy = p2.y - p1.y;
          let len = Math.hypot(dx, dy);

          if (len === 0) {
            dx = 1;
            dy = 0;
            len = 1;
          }

          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const dirX = dx / len;
          const dirY = dy / len;
          const halfVal = targetVal / 2;

          const newP1X = midX - dirX * halfVal;
          const newP1Y = midY - dirY * halfVal;
          const newP2X = midX + dirX * halfVal;
          const newP2Y = midY + dirY * halfVal;

          const disp1 = Math.hypot(p1.x - newP1X, p1.y - newP1Y);
          const disp2 = Math.hypot(p2.x - newP2X, p2.y - newP2Y);

          setEntityPoint(e1, idx1, { x: newP1X, y: newP1Y });
          setEntityPoint(e2, idx2, { x: newP2X, y: newP2Y });

          maxDisp = Math.max(disp1, disp2);
        }
      }
      break;
    }

    default:
      break;
  }

  return maxDisp;
}

/**
 * Solves geometric constraints using relaxation loop.
 * Pure function returning new solved entities, conflict entities, and convergence metrics.
 */
export function solveConstraints(
  entities: CADEntity2D[],
  constraints: Constraint[]
): SolverResult {
  const clonedEntities = entities.map(cloneEntity);
  const entitiesMap = new Map<string, CADEntity2D>();
  for (const entity of clonedEntities) {
    entitiesMap.set(entity.id, entity);
  }

  // 1. 約束衝突 / 過定義檢查
  const conflictEntityIds = findConflictingLineEntityIds(clonedEntities, constraints);
  const conflictSet = new Set(conflictEntityIds);

  // 若發生衝突，過濾衝突圖元的 horizontal 與 vertical 約束，避免起終點被平均成一個點而退化
  const activeConstraints = constraints.filter((c) => {
    if (c.type === 'horizontal' || c.type === 'vertical') {
      return !c.entityIds.some((id) => conflictSet.has(id));
    }
    return true;
  });

  let totalIterations = 0;
  let lastMaxDisp = 0;
  let converged = false;

  for (let iter = 0; iter < SOLVER_MAX_ITERATIONS; iter++) {
    totalIterations = iter + 1;
    let iterationMaxDisp = 0;

    for (const constraint of activeConstraints) {
      const disp = applyConstraint(entitiesMap, constraint);
      if (disp > iterationMaxDisp) {
        iterationMaxDisp = disp;
      }
    }

    lastMaxDisp = iterationMaxDisp;

    if (iterationMaxDisp < SOLVER_TOLERANCE) {
      converged = true;
      break;
    }
  }

  // 若存在約束衝突，標記為未收斂
  if (conflictEntityIds.length > 0) {
    converged = false;
  }

  return {
    entities: clonedEntities,
    iterations: totalIterations,
    maxDisp: lastMaxDisp,
    converged,
    conflictEntityIds,
  };
}

/**
 * Analyzes Degrees of Freedom (DOF) for a sketch given its entities and constraints.
 */
export function analyzeSketchDOF(
  entities: CADEntity2D[],
  constraints: Constraint[]
): SketchDofState {
  let initialDof = 0;
  const entityInitialDof: Record<string, number> = {};
  const entityDofReductions: Record<string, number> = {};

  for (const entity of entities) {
    let dof = 0;
    if (entity.type === 'line') {
      dof = 4;
    } else if (entity.type === 'circle') {
      dof = 3;
    } else if (entity.type === 'arc') {
      dof = 4;
    } else if (entity.type === 'polyline') {
      dof = entity.points.length * 2;
    }
    entityInitialDof[entity.id] = dof;
    entityDofReductions[entity.id] = 0;
    initialDof += dof;
  }

  let dofReduction = 0;

  for (const constraint of constraints) {
    let constraintDof = 0;
    switch (constraint.type) {
      case 'horizontal':
        constraintDof = 1;
        break;
      case 'vertical':
        constraintDof = 1;
        break;
      case 'coincident':
        constraintDof = 2;
        break;
      case 'length':
      case 'distance':
        constraintDof = 1;
        break;
      case 'fix':
        constraintDof = 2;
        break;
      case 'parallel':
      case 'perpendicular':
      case 'tangent':
        constraintDof = 1;
        break;
      default:
        constraintDof = 1;
        break;
    }

    dofReduction += constraintDof;

    if (constraint.entityIds.length > 0) {
      const share = constraintDof / constraint.entityIds.length;
      for (const id of constraint.entityIds) {
        if (entityDofReductions[id] !== undefined) {
          entityDofReductions[id] += share;
        }
      }
    }
  }

  const conflictEntityIds = findConflictingLineEntityIds(entities, constraints);
  const conflictSet = new Set(conflictEntityIds);

  const totalDof = initialDof - dofReduction;

  let state: 'UnderDefined' | 'FullyDefined' | 'OverDefined';
  if (conflictSet.size > 0 || totalDof < 0) {
    state = 'OverDefined';
  } else if (totalDof === 0) {
    state = 'FullyDefined';
  } else {
    state = 'UnderDefined';
  }

  const entityStates: Record<string, 'UnderDefined' | 'FullyDefined' | 'OverDefined'> = {};
  for (const entity of entities) {
    if (conflictSet.has(entity.id)) {
      entityStates[entity.id] = 'OverDefined';
      continue;
    }

    const initD = entityInitialDof[entity.id] ?? 0;
    const redD = entityDofReductions[entity.id] ?? 0;
    const remaining = initD - redD;

    if (remaining < 0) {
      entityStates[entity.id] = 'OverDefined';
    } else if (remaining === 0) {
      entityStates[entity.id] = 'FullyDefined';
    } else {
      entityStates[entity.id] = 'UnderDefined';
    }
  }

  return {
    totalDof,
    state,
    entityStates,
  };
}
