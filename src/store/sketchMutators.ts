import { CADDocument, CADEntity2D, SketchFeature } from '../types/cad';

export function insertEntityIntoSketch(doc: CADDocument, sketchId: string, entity: CADEntity2D): CADDocument {
  return {
    ...doc,
    featureTree: doc.featureTree.map((feature) => {
      if (feature.id === sketchId && feature.type === 'SKETCH') {
        return {
          ...feature,
          entities: [...feature.entities, entity],
        };
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

        return {
          ...feature,
          entities: feature.entities.filter((e) => e.id !== entityId),
          // Remove the associated constraints
          constraints: feature.constraints.filter((c) => !constraintsToRemove.has(c.id)),
          // Remove the dimensions linked to the removed constraints
          dimensions: feature.dimensions.filter(
            (d) => !d.constraintId || !constraintsToRemove.has(d.constraintId)
          ),
        };
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
        return {
          ...feature,
          entities: feature.entities.map((e) => (e.id === entity.id ? entity : e)),
        };
      }
      return feature;
    }),
  };
}
