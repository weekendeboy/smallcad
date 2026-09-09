import { create } from 'zustand';
import { CADState } from './cadStore.types';
import { CADEntity2D, createEmptyCADDocument, DatumFrontPlane, SketchFeature } from '../types/cad';
import {
  insertEntityIntoSketch,
  removeEntityFromSketch,
  updateEntityInSketch,
  addConstraintToSketch,
  removeConstraintFromSketch,
} from './sketchMutators';

function createInitialDocument() {
  const doc = createEmptyCADDocument();
  const initialSketch: SketchFeature = {
    id: 'sketch-1',
    name: 'Sketch1',
    type: 'SKETCH',
    dependencies: [],
    suppressed: false,
    plane: DatumFrontPlane,
    entities: [],
    constraints: [],
    dimensions: [],
    profiles: [],
    solverState: 'UnderDefined',
  };
  
  // We cannot mutate doc.featureTree directly if we want strict immutability, 
  // but since it's freshly created here, it's fine.
  doc.featureTree.push(initialSketch);
  doc.activeSketchId = 'sketch-1';
  return doc;
}

function pushUndoState(state: CADState): Partial<CADState> {
  // Deep copy the document as requested
  const clonedDoc = JSON.parse(JSON.stringify(state.document));
  const newUndoStack = [...state.undoStack, clonedDoc];
  if (newUndoStack.length > 20) {
    newUndoStack.shift();
  }
  return {
    undoStack: newUndoStack,
    redoStack: [],
  };
}

export const useCADStore = create<CADState>((set, get) => ({
  document: createInitialDocument(),
  viewMode: '2D',
  currentTool: 'SELECT',
  activeSketchId: 'sketch-1',
  selectedEntityIds: [],
  selectedFeatureId: null,
  osnapEnabled: true,
  undoStack: [],
  redoStack: [],

  setViewMode: (mode) => set({ viewMode: mode }),
  
  setTool: (tool) => set({ currentTool: tool }),
  
  setActiveSketch: (sketchId) => set({ activeSketchId: sketchId }),
  
  selectEntity: (id) => set((state) => {
    if (state.selectedEntityIds.includes(id)) {
      return state;
    }
    return { selectedEntityIds: [...state.selectedEntityIds, id] };
  }),
  
  clearSelection: () => set({ selectedEntityIds: [], selectedFeatureId: null }),
  
  addEntity: (entity) => set((state) => {
    if (!state.activeSketchId) return state;
    return {
      ...pushUndoState(state),
      document: insertEntityIntoSketch(state.document, state.activeSketchId, entity)
    };
  }),

  removeEntity: (id) => set((state) => {
    if (!state.activeSketchId) return state;
    return {
      ...pushUndoState(state),
      document: removeEntityFromSketch(state.document, state.activeSketchId, id),
      selectedEntityIds: state.selectedEntityIds.filter((entityId) => entityId !== id)
    };
  }),

  updateEntity: (id, updates) => set((state) => {
    if (!state.activeSketchId) return state;
    
    const sketch = state.document.featureTree.find(
      (f) => f.id === state.activeSketchId && f.type === 'SKETCH'
    ) as SketchFeature | undefined;
    
    if (!sketch) return state;
    
    const existingEntity = sketch.entities.find((e) => e.id === id);
    if (!existingEntity) return state;

    const updatedEntity = { ...existingEntity, ...updates } as CADEntity2D;

    return {
      ...pushUndoState(state),
      document: updateEntityInSketch(state.document, state.activeSketchId, updatedEntity)
    };
  }),

  addConstraint: (constraint) => set((state) => {
    if (!state.activeSketchId) return state;
    return {
      ...pushUndoState(state),
      document: addConstraintToSketch(state.document, state.activeSketchId, constraint),
    };
  }),

  removeConstraint: (constraintId) => set((state) => {
    if (!state.activeSketchId) return state;
    return {
      ...pushUndoState(state),
      document: removeConstraintFromSketch(state.document, state.activeSketchId, constraintId),
    };
  }),

  toggleOsnap: () => set((state) => ({ osnapEnabled: !state.osnapEnabled })),
  
  undo: () => set((state) => {
    if (state.undoStack.length === 0) return state;
    const previousDoc = state.undoStack[state.undoStack.length - 1];
    const newUndoStack = state.undoStack.slice(0, -1);
    
    return {
      undoStack: newUndoStack,
      redoStack: [...state.redoStack, JSON.parse(JSON.stringify(state.document))],
      document: previousDoc,
      selectedEntityIds: [],
      selectedFeatureId: null,
    };
  }),

  redo: () => set((state) => {
    if (state.redoStack.length === 0) return state;
    const nextDoc = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);
    
    return {
      undoStack: [...state.undoStack, JSON.parse(JSON.stringify(state.document))],
      redoStack: newRedoStack,
      document: nextDoc,
      selectedEntityIds: [],
      selectedFeatureId: null,
    };
  }),

  canUndo: () => get().undoStack.length > 0,
  
  canRedo: () => get().redoStack.length > 0,

  resetDocument: () => {
    set({
      document: createInitialDocument(),
      activeSketchId: 'sketch-1',
      selectedEntityIds: [],
      selectedFeatureId: null,
      currentTool: 'SELECT',
      viewMode: '2D',
      undoStack: [],
      redoStack: [],
    });
  }
}));

// Selector Hooks
export const useCADDocument = () => useCADStore((state) => state.document);
export const useViewMode = () => useCADStore((state) => state.viewMode);
export const useCurrentTool = () => useCADStore((state) => state.currentTool);
export const useActiveSketch = () => useCADStore((state) => state.activeSketchId);
