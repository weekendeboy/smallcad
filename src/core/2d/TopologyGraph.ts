import { CADEntity2D, Point2D } from '../../types/cad';

export interface GraphNode {
  id: string;
  point: Point2D;
  outgoingEdgeIds: string[];
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  entityId: string;
  angle: number;
}

export class PlanarGraph {
  public nodes: Map<string, GraphNode> = new Map();
  public edges: Map<string, GraphEdge> = new Map();

  private nextNodeId: number = 1;
  private nextEdgeId: number = 1;

  /**
   * Adds a node at the specified coordinates.
   * If a node already exists within the tolerance distance, returns the existing node.
   */
  public addNode(point: Point2D, tolerance: number = 1e-4): GraphNode {
    const tolSq = tolerance * tolerance;

    for (const node of this.nodes.values()) {
      const dx = node.point.x - point.x;
      const dy = node.point.y - point.y;
      if (dx * dx + dy * dy <= tolSq) {
        return node;
      }
    }

    const id = `node_${this.nextNodeId++}`;
    const newNode: GraphNode = {
      id,
      point: { x: point.x, y: point.y },
      outgoingEdgeIds: [],
    };

    this.nodes.set(id, newNode);
    return newNode;
  }

  /**
   * Adds bidirectional directed edges between p1 and p2 for an undirected segment.
   * Computes the exact polar angle (Math.atan2(dy, dx)) for each directed edge.
   */
  public addBiDirectionalEdge(
    p1: Point2D,
    p2: Point2D,
    entityId: string,
    tolerance: number = 1e-4
  ): void {
    const node1 = this.addNode(p1, tolerance);
    const node2 = this.addNode(p2, tolerance);

    // Degenerate line segment within tolerance
    if (node1.id === node2.id) {
      return;
    }

    // Forward edge: node1 -> node2
    const dx12 = node2.point.x - node1.point.x;
    const dy12 = node2.point.y - node1.point.y;
    const angle12 = Math.atan2(dy12, dx12);
    const edge12Id = `edge_${this.nextEdgeId++}`;

    const edge12: GraphEdge = {
      id: edge12Id,
      fromNodeId: node1.id,
      toNodeId: node2.id,
      entityId,
      angle: angle12,
    };

    this.edges.set(edge12Id, edge12);
    node1.outgoingEdgeIds.push(edge12Id);

    // Backward edge: node2 -> node1
    const dx21 = node1.point.x - node2.point.x;
    const dy21 = node1.point.y - node2.point.y;
    const angle21 = Math.atan2(dy21, dx21);
    const edge21Id = `edge_${this.nextEdgeId++}`;

    const edge21: GraphEdge = {
      id: edge21Id,
      fromNodeId: node2.id,
      toNodeId: node1.id,
      entityId,
      angle: angle21,
    };

    this.edges.set(edge21Id, edge21);
    node2.outgoingEdgeIds.push(edge21Id);
  }

  /**
   * Static factory method to build a planar graph from CAD entities.
   * Extracts endpoints for 'line' entities and adjacent vertices for 'polyline' entities.
   */
  public static buildFromEntities(
    entities: CADEntity2D[],
    tolerance: number = 1e-4
  ): PlanarGraph {
    const graph = new PlanarGraph();

    for (const entity of entities) {
      if (entity.visible === false) {
        continue;
      }

      if (entity.type === 'line') {
        graph.addBiDirectionalEdge(entity.start, entity.end, entity.id, tolerance);
      } else if (entity.type === 'polyline') {
        const points = entity.points;
        if (points.length >= 2) {
          const segmentsCount = entity.closed ? points.length : points.length - 1;
          for (let i = 0; i < segmentsCount; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            graph.addBiDirectionalEdge(p1, p2, entity.id, tolerance);
          }
        }
      }
    }

    return graph;
  }
}
