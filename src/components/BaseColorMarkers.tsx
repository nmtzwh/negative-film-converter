import React, { useState, useEffect } from 'react';
import { ColorSample } from '../api';

interface BaseColorMarkersProps {
  samples: ColorSample[];
  imgRef: React.RefObject<HTMLImageElement | null>;
  scale: number;
  pan: { x: number, y: number };
}

export function BaseColorMarkers({ samples, imgRef, scale, pan }: BaseColorMarkersProps) {
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0, top: 0, left: 0 });

  useEffect(() => {
    const updateLayout = () => {
      if (!imgRef.current) return;
      const img = imgRef.current;
      
      const elRect = img.getBoundingClientRect();
      const elWidth = elRect.width / scale; 
      const elHeight = elRect.height / scale;

      if (elWidth <= 0 || elHeight <= 0 || !img.naturalWidth) return;

      const viewRatio = elWidth / elHeight;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      
      let renderedWidth = elWidth;
      let renderedHeight = elHeight;

      if (viewRatio > imgRatio) {
        renderedWidth = elHeight * imgRatio;
      } else {
        renderedHeight = elWidth / imgRatio;
      }

      setImgLayout({ 
        width: renderedWidth, 
        height: renderedHeight,
        top: 0,
        left: 0
      });
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    if (imgRef.current && imgRef.current.complete) {
        updateLayout();
    } else if (imgRef.current) {
        imgRef.current.addEventListener('load', updateLayout);
    }
    
    return () => {
      window.removeEventListener('resize', updateLayout);
      if (imgRef.current) {
          imgRef.current.removeEventListener('load', updateLayout);
      }
    };
  }, [imgRef, imgRef.current?.src, scale]);

  if (samples.length === 0 || imgLayout.width === 0) return null;

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: imgLayout.width,
          height: imgLayout.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          pointerEvents: 'none',
          transformOrigin: 'center center',
        }}
      >
        {samples.map((sample, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${sample.x * 100}%`,
              top: `${sample.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '16px',
              height: '16px',
            }}
          >
            {/* Crosshair lines */}
            <div style={{ position: 'absolute', top: '7px', left: 0, right: 0, height: '2px', backgroundColor: 'white', boxShadow: '0 0 2px black' }} />
            <div style={{ position: 'absolute', left: '7px', top: 0, bottom: 0, width: '2px', backgroundColor: 'white', boxShadow: '0 0 2px black' }} />
            {/* Center dot */}
            <div style={{ position: 'absolute', top: '6px', left: '6px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'transparent', border: '1px solid black' }} />
          </div>
        ))}
      </div>
    </div>
  );
}