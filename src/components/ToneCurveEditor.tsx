import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Curves } from '../api';

interface ToneCurveEditorProps {
  curves: Curves;
  onChange: (c: Curves) => void;
}

type Channel = 'rgb' | 'r' | 'g' | 'b';

export const ToneCurveEditor: React.FC<ToneCurveEditorProps> = ({ curves, onChange }) => {
  const [activeChannel, setActiveChannel] = useState<Channel>('rgb');
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activePoints = curves[activeChannel] || [[0, 0], [1, 1]];

  const getCoords = (e: React.PointerEvent | PointerEvent) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = 1.0 - (e.clientY - rect.top) / rect.height; // invert y
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const coords = getCoords(e);
    if (!coords) return;
    
    e.currentTarget.setPointerCapture(e.pointerId);

    // Find closest point
    const threshold = 0.05; // 5% of width/height
    let closestIdx = -1;
    let minDist = Infinity;

    activePoints.forEach((p, idx) => {
      const dist = Math.sqrt(Math.pow(p[0] - coords.x, 2) + Math.pow(p[1] - coords.y, 2));
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    if (minDist <= threshold) {
      setDraggingIdx(closestIdx);
    } else {
      // Insert new point
      const newPoints = [...activePoints, [coords.x, coords.y] as [number, number]];
      newPoints.sort((a, b) => a[0] - b[0]);
      const newIdx = newPoints.findIndex(p => p[0] === coords.x && p[1] === coords.y);
      onChange({ ...curves, [activeChannel]: newPoints });
      setDraggingIdx(newIdx);
    }
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (draggingIdx === null) return;
    const coords = getCoords(e);
    if (!coords) return;

    const newPoints = [...activePoints];
    
    // Constraints
    let minX = 0;
    let maxX = 1;
    if (draggingIdx > 0) {
      minX = newPoints[draggingIdx - 1][0] + 0.01;
    }
    if (draggingIdx < newPoints.length - 1) {
      maxX = newPoints[draggingIdx + 1][0] - 0.01;
    }
    
    // First and last points should ideally stay at x=0 and x=1 respectively, but user can change y
    if (draggingIdx === 0) {
       coords.x = 0;
    } else if (draggingIdx === newPoints.length - 1) {
       coords.x = 1;
    } else {
       coords.x = Math.max(minX, Math.min(maxX, coords.x));
    }

    newPoints[draggingIdx] = [coords.x, coords.y];
    onChange({ ...curves, [activeChannel]: newPoints });
  }, [draggingIdx, activePoints, activeChannel, curves, onChange]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    setDraggingIdx(null);
  }, []);

  useEffect(() => {
    if (draggingIdx !== null) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [draggingIdx, handlePointerMove, handlePointerUp]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    const coords = getCoords(e as any);
    if (!coords) return;

    const threshold = 0.05;
    let closestIdx = -1;
    let minDist = Infinity;

    activePoints.forEach((p, idx) => {
      const dist = Math.sqrt(Math.pow(p[0] - coords.x, 2) + Math.pow(p[1] - coords.y, 2));
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    if (minDist <= threshold && closestIdx !== 0 && closestIdx !== activePoints.length - 1) {
      const newPoints = activePoints.filter((_, i) => i !== closestIdx);
      onChange({ ...curves, [activeChannel]: newPoints });
    }
  };

  // Convert points to SVG path
  const createPath = (points: [number, number][]) => {
    if (points.length === 0) return '';
    const d = points.map((p, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      return `${cmd} ${p[0] * 100} ${(1 - p[1]) * 100}`;
    }).join(' ');
    return d;
  };

  const channelColors = {
    rgb: '#ffffff',
    r: '#ff4444',
    g: '#44ff44',
    b: '#4444ff'
  };

  return (
    <div className="tone-curve-editor" style={{ padding: '10px', background: '#2a2a2a', borderRadius: '4px', marginTop: '10px' }}>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
        {(['rgb', 'r', 'g', 'b'] as Channel[]).map(ch => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            style={{
              flex: 1,
              padding: '4px',
              background: activeChannel === ch ? '#444' : '#333',
              color: channelColors[ch],
              border: `1px solid ${activeChannel === ch ? channelColors[ch] : '#555'}`,
              borderRadius: '3px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            {ch}
          </button>
        ))}
      </div>
      
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#1a1a1a', border: '1px solid #444', touchAction: 'none' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          style={{ overflow: 'visible', cursor: draggingIdx !== null ? 'grabbing' : 'crosshair' }}
        >
          {/* Grid */}
          {[25, 50, 75].map(line => (
            <React.Fragment key={line}>
              <line x1={line} y1="0" x2={line} y2="100" stroke="#333" strokeWidth="0.5" />
              <line x1="0" y1={line} x2="100" y2={line} stroke="#333" strokeWidth="0.5" />
            </React.Fragment>
          ))}
          {/* Diagonal */}
          <line x1="0" y1="100" x2="100" y2="0" stroke="#333" strokeWidth="0.5" />

          {/* Background Curves (inactive) */}
          {(['rgb', 'r', 'g', 'b'] as Channel[]).map(ch => {
            if (ch === activeChannel) return null;
            return (
              <path
                key={ch}
                d={createPath(curves[ch] || [[0,0],[1,1]])}
                fill="none"
                stroke={channelColors[ch]}
                strokeWidth="1"
                opacity={0.3}
              />
            );
          })}

          {/* Active Curve */}
          <path
            d={createPath(activePoints)}
            fill="none"
            stroke={channelColors[activeChannel]}
            strokeWidth="2"
          />

          {/* Active Points */}
          {activePoints.map((p, i) => (
            <circle
              key={i}
              cx={p[0] * 100}
              cy={(1 - p[1]) * 100}
              r="3"
              fill={channelColors[activeChannel]}
              stroke="#000"
              strokeWidth="1"
              style={{ cursor: 'grab' }}
            />
          ))}
        </svg>
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginTop: '5px', textAlign: 'center' }}>
        Click/drag to add/move points. Double-click to remove.
      </div>
    </div>
  );
};
