import React, { useState } from 'react';
import { Point2D, SketchProfile } from '../types/cad';

export interface ProfileRendererProps {
  profiles: SketchProfile[];
  worldToScreen: (pt: Point2D) => Point2D;
}

/**
 * Converts a polygon loop (list of world points) into an SVG path subpath string ('M x y L x y ... Z').
 */
function loopToSvgPath(points: Point2D[], worldToScreen: (pt: Point2D) => Point2D): string {
  if (points.length === 0) return '';
  const first = worldToScreen(points[0]);
  let pathStr = `M ${first.x} ${first.y}`;

  for (let i = 1; i < points.length; i++) {
    const pt = worldToScreen(points[i]);
    pathStr += ` L ${pt.x} ${pt.y}`;
  }

  pathStr += ' Z';
  return pathStr;
}

export const ProfileRenderer: React.FC<ProfileRendererProps> = ({
  profiles,
  worldToScreen,
}) => {
  const [hoveredProfileId, setHoveredProfileId] = useState<string | null>(null);

  if (!profiles || profiles.length === 0) {
    return null;
  }

  return (
    <g id="sketch-profiles-layer" className="sketch-profiles">
      {profiles.map((profile) => {
        // Build the combined path (outer loop + inner loops)
        let d = loopToSvgPath(profile.outerLoop, worldToScreen);

        if (profile.innerLoops && profile.innerLoops.length > 0) {
          for (const innerLoop of profile.innerLoops) {
            d += ' ' + loopToSvgPath(innerLoop, worldToScreen);
          }
        }

        const isHovered = hoveredProfileId === profile.id;

        return (
          <path
            key={profile.id}
            id={`profile-${profile.id}`}
            d={d}
            fill={isHovered ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.18)'}
            stroke="none"
            fillRule="evenodd"
            className="transition-colors duration-150 cursor-pointer"
            style={{ pointerEvents: 'auto' }}
            onMouseEnter={() => setHoveredProfileId(profile.id)}
            onMouseLeave={() => setHoveredProfileId(null)}
          />
        );
      })}
    </g>
  );
};
