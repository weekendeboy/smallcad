import { CADDocument, CADEntity2D, Constraint } from '../types/cad';

export interface CADState {
  document: CADDocument;
  
  viewMode: '2D' | '3D';
  currentTool: 'SELECT' | 'LINE' | 'RECTANGLE' | 'CIRCLE' | 'ARC' | 'ARC_3P' | 'ARC_CENTER' | 'POLYLINE' | 'PAN' | 'DIMENSION';
  activeSketchId: string | null;
  selectedEntityIds: string[];
  selectedFeatureId: string | null;
  osnapEnabled: boolean;

  undoStack: CADDocument[];
  redoStack: CADDocument[];

  setViewMode: (mode: '2D' | '3D') => void;
  setTool: (tool: 'SELECT' | 'LINE' | 'RECTANGLE' | 'CIRCLE' | 'ARC' | 'ARC_3P' | 'ARC_CENTER' | 'POLYLINE' | 'PAN' | 'DIMENSION') => void;
  setActiveSketch: (sketchId: string | null) => void;
  selectEntity: (id: string) => void;
  clearSelection: () => void;
  addEntity: (entity: CADEntity2D) => void;
  removeEntity: (id: string) => void;
  updateEntity: (id: string, updates: Partial<CADEntity2D>) => void;
  toggleConstruction: (entityId: string) => void;
  addConstraint: (constraint: Constraint) => void;
  removeConstraint: (constraintId: string) => void;
  toggleOsnap: () => void;
  resetDocument: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}
