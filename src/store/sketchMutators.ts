import { CADDocument, CADEntity2D, Constraint, SketchFeature } from '../types/cad';
import { solveConstraints, analyzeSketchDOF } from '../core/solver/ConstraintSolver';

export function applyConstraintsToSketch(sketch: SketchFeature): SketchFeature {
  const solverResult = solveConstraints(sketch.entities, sketch.constraints);
  const dofState = analyzeSketchDOF(solverResult.entities, sketch.constraints);
  return {
    ...sketch,
    entities: solverResult.entities,
    solverState: dofState.state,
  };
}

export function insertEntityIntoSketch(doc: CADDocument, sketchId: string, entity: CADEntity2D): CADDocument {
  return {
    ...doc,
    featureTree: doc.featureTree.map((feature) => {
      if (feature.id === sketchId && feature.type === 'SKETCH') {
        const updatedSketch: SketchFeature = {
          ...feature,
          entities: [...feature.entities, entity],
        };
        return applyConstraintsToSketch(updatedSketch);
      }
      return feature;
    }),
  };
}

export function removeEntityFromSketch(doc: CADDocument, sketchId: string, entityId: string): CADDocument {
  return {
    ...doc,
    featureTree: doc.featureTree.map((feature) => {
      if (feature.id === sketchId && feature.type === 'SKETCH') {
        // Find all constraints that are associated with the target entity
        const constraintsToRemove = new Set(
          feature.constraints
            .filter((c) => c.entityIds.includes(entityId))
            .map((c) => c.id)
        );

        const updatedSketch: SketchFeature = {
          ...feature,
          entities: feature.entities.filter((e) => e.id !== entityId),
          // Remove the associated constraints
          constraints: feature.constraints.filter((c) => !constraintsToRemove.has(c.id)),
          // Remove the dimensions linked to the removed constraints
          dimensions: feature.dimensions.filter(
            (d) => !d.constraintId || !constraintsToRemove.has(d.constraintId)
          ),
        };
        return applyConstraintsToSketch(updatedSketch);
      }
      return feature;
    }),
  };
}

export function updateEntityInSketch(doc: CADDocument, sketchId: string, entity: CADEntity2D): CADDocument {
  return {
    ...doc,
    featureTree: doc.featureTree.map((feature) => {
      if (feature.id === sketchId && feature.type === 'SKETCH') {
        const updatedSketch: SketchFeature = {
          ...feature,
          entities: feature.entities.map((e) => (e.id === entity.id ? entity : e)),
        };
        return applyConstraintsToSketch(updatedSketch);
      }
      return feature;
    }),
  };
}

export function addConstraintToSketch(doc: CADDocument, sketchId: string, constraint: Constraint): CADDocument {
  return {
    ...doc,
    featureTree: doc.featureTree.map((feature) => {
      if (feature.id === sketchId && feature.type === 'SKETCH') {
        const updatedSketch: SketchFeature = {
          ...feature,
          constraints: [...feature.constraints, constraint],
        };
        return applyConstraintsToSketch(updatedSketch);
      }
      return feature;
    }),
  };
}

export function removeConstraintFromSketch(doc: CADDocument, sketchId: string, constraintId: string): CADDocument {
  return {
    ...doc,
    featureTree: doc.featureTree.map((feature) => {
      if (feature.id === sketchId && feature.type === 'SKETCH') {
        const updatedSketch: SketchFeature = {
          ...feature,
          constraints: feature.constraints.filter((c) => c.id !== constraintId),
        };
        return applyConstraintsToSketch(updatedSketch);
      }
      return feature;
    }),
  };
}
