import { CADEntity2D } from '../../types/cad';

export interface SolverResult {
  entities: CADEntity2D[];
  iterations: number;
  maxDisp: number;
  converged: boolean;
}

export interface SketchDofState {
  totalDof: number;
  state: 'UnderDefined' | 'FullyDefined' | 'OverDefined';
  entityStates: Record<string, 'UnderDefined' | 'FullyDefined'>;
}

export const SOLVER_MAX_ITERATIONS = 50;
export const SOLVER_TOLERANCE = 1e-4;
