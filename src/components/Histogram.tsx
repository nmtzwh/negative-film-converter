import { useEffect, useRef } from 'react';

interface HistogramProps {
  data: number[][]; // [R, G, B] arrays, each length 256
  width?: number;
  height?: number;
}

export function Histogram({ data, width = 256, height = 150 }: HistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!data || data.length !== 3 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find the maximum value to scale the histogram vertically
    // Ignore the 0 and 255 bins to prevent extreme spikes from dominating the view
    let maxVal = 0;
    for (let c = 0; c < 3; c++) {
      for (let i = 1; i < 255; i++) {
        if (data[c][i] > maxVal) {
          maxVal = data[c][i];
        }
      }
    }

    if (maxVal === 0) maxVal = 1; // Prevent division by zero

    const colors = [
      'rgba(255, 0, 0, 0.6)',   // Red
      'rgba(0, 255, 0, 0.6)',   // Green
      'rgba(0, 100, 255, 0.6)', // Blue
    ];

    // Draw the histogram using composite blending
    ctx.globalCompositeOperation = 'screen';

    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = colors[c];
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * width;
        // Apply a square root scale to the heights to make smaller peaks more visible
        const scaledHeight = Math.pow(data[c][i] / maxVal, 0.5) * height;
        const y = height - scaledHeight;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
    }
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';

  }, [data, width, height]);

  return (
    <div style={{ background: '#222', borderRadius: '4px', padding: '10px' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', background: '#111' }}
      />
    </div>
  );
}
