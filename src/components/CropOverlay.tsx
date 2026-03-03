import React, { useState, useEffect, useRef } from 'react';

interface CropOverlayProps {
  crop: number[] | null; // [x1, y1, x2, y2]
  onChange: (crop: number[]) => void;
  imgRef: React.RefObject<HTMLImageElement | null>;
  scale: number;
  pan: { x: number, y: number };
}

export function CropOverlay({ crop, onChange, imgRef, scale, pan }: CropOverlayProps) {
  const [activeHandle, setActiveHandle] = useState<number | null>(null);
  const [localCrop, setLocalCrop] = useState<number[]>(crop || [0, 0, 1, 1]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawStartRef = useRef<{ x: number, y: number } | null>(null);
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0, top: 0, left: 0 });

  useEffect(() => {
    setLocalCrop(crop || [0, 0, 1, 1]);
  }, [crop]);

  useEffect(() => {
    const updateLayout = () => {
      if (!imgRef.current) return;
      const img = imgRef.current;
      
      // Calculate the size of the image as rendered (ignoring transforms)
      // Because we use object-fit: contain, the visible image might be smaller than the element.
      const elRect = img.getBoundingClientRect();
      const elWidth = elRect.width / scale; // Remove transform scale manually
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
        top: 0, // We will center it via flex in the wrapper
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (activeHandle === null || !overlayRef.current) return;
      
      const rect = overlayRef.current.getBoundingClientRect();
      
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      const clampedX = Math.max(0, Math.min(1, x));
      const clampedY = Math.max(0, Math.min(1, y));
      
      setLocalCrop(prev => {
        const next = [...prev];
        if (activeHandle === -1 && drawStartRef.current) {
          const startX = drawStartRef.current.x;
          const startY = drawStartRef.current.y;
          next[0] = Math.min(startX, clampedX);
          next[1] = Math.min(startY, clampedY);
          next[2] = Math.max(startX, clampedX);
          next[3] = Math.max(startY, clampedY);
        } else if (activeHandle === 0) { // top-left
          next[0] = Math.min(clampedX, next[2] - 0.01);
          next[1] = Math.min(clampedY, next[3] - 0.01);
        } else if (activeHandle === 1) { // top-right
          next[2] = Math.max(clampedX, next[0] + 0.01);
          next[1] = Math.min(clampedY, next[3] - 0.01);
        } else if (activeHandle === 2) { // bottom-right
          next[2] = Math.max(clampedX, next[0] + 0.01);
          next[3] = Math.max(clampedY, next[1] + 0.01);
        } else if (activeHandle === 3) { // bottom-left
          next[0] = Math.min(clampedX, next[2] - 0.01);
          next[3] = Math.max(clampedY, next[1] + 0.01);
        }
        return next;
      });
    };

    const handleMouseUp = () => {
      if (activeHandle !== null) {
        onChange(localCrop);
        if (activeHandle === -1) {
          drawStartRef.current = null;
        }
        setActiveHandle(null);
      }
    };

    if (activeHandle !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeHandle, localCrop, onChange]);

  if (imgLayout.width === 0) return null;

  const [x1, y1, x2, y2] = localCrop;

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <div 
        ref={overlayRef}
        style={{
          position: 'relative',
          width: imgLayout.width,
          height: imgLayout.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          pointerEvents: 'auto',
          cursor: activeHandle === null ? 'crosshair' : 'default',
          transformOrigin: 'center center',
        }}
        onMouseDown={(e) => {
          if (activeHandle !== null) return;
          const rect = overlayRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          const clampedX = Math.max(0, Math.min(1, x));
          const clampedY = Math.max(0, Math.min(1, y));
          
          drawStartRef.current = { x: clampedX, y: clampedY };
          setActiveHandle(-1);
          setLocalCrop([clampedX, clampedY, clampedX, clampedY]);
        }}
      >
        {/* Dark overlay for cropped out areas */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${y1 * 100}%`, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(1 - y2) * 100}%`, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        <div style={{ position: 'absolute', top: `${y1 * 100}%`, bottom: `${(1 - y2) * 100}%`, left: 0, width: `${x1 * 100}%`, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        <div style={{ position: 'absolute', top: `${y1 * 100}%`, bottom: `${(1 - y2) * 100}%`, right: 0, width: `${(1 - x2) * 100}%`, backgroundColor: 'rgba(0,0,0,0.5)' }} />

        {/* Crop Border */}
        <div 
          style={{
            position: 'absolute',
            left: `${x1 * 100}%`,
            top: `${y1 * 100}%`,
            width: `${(x2 - x1) * 100}%`,
            height: `${(y2 - y1) * 100}%`,
            border: '2px solid rgba(255, 255, 255, 0.8)',
            boxSizing: 'border-box',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
          }}
        />

        {/* Handles */}
        {[
          { id: 0, left: `${x1 * 100}%`, top: `${y1 * 100}%`, cursor: 'nwse-resize' },
          { id: 1, left: `${x2 * 100}%`, top: `${y1 * 100}%`, cursor: 'nesw-resize' },
          { id: 2, left: `${x2 * 100}%`, top: `${y2 * 100}%`, cursor: 'nwse-resize' },
          { id: 3, left: `${x1 * 100}%`, top: `${y2 * 100}%`, cursor: 'nesw-resize' },
        ].map(handle => (
          <div
            key={handle.id}
            onMouseDown={(e) => {
              e.stopPropagation();
              setActiveHandle(handle.id);
            }}
            style={{
              position: 'absolute',
              left: handle.left,
              top: handle.top,
              width: 16,
              height: 16,
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              border: '1px solid black',
              borderRadius: '50%',
              pointerEvents: 'auto',
              cursor: handle.cursor,
            }}
          />
        ))}
      </div>
    </div>
  );
}
