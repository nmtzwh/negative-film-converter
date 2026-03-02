interface CurveGraphProps {
  data: { r: number[], g: number[], b: number[] } | null;
  width: number;
  height: number;
}

export function CurveGraph({ data, width, height }: CurveGraphProps) {
  if (!data) {
    return (
      <div style={{ width, height, backgroundColor: 'var(--bg-header)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.8rem' }}>
        No curve data
      </div>
    );
  }

  // data contains r, g, b arrays of 100 points each.
  // X axis is 0 to 1, Y axis we should normalize based on min/max across all channels.
  let min = Infinity;
  let max = -Infinity;
  for (const ch of ['r', 'g', 'b'] as const) {
    for (const val of data[ch]) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  // add slight padding
  const range = Math.max(0.1, max - min);
  const yMin = min - range * 0.1;
  const yMax = max + range * 0.1;
  const yRange = yMax - yMin;

  const pointsCount = 100;
  
  const createPath = (channelData: number[]) => {
    return channelData.map((y, i) => {
      const px = (i / (pointsCount - 1)) * width;
      const py = height - ((y - yMin) / yRange) * height;
      return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
    }).join(' ');
  };

  return (
    <svg width={width} height={height} style={{ backgroundColor: 'var(--bg-header)', borderRadius: '4px' }}>
      <path d={createPath(data.r)} fill="none" stroke="red" strokeWidth="2" opacity={0.8} />
      <path d={createPath(data.g)} fill="none" stroke="green" strokeWidth="2" opacity={0.8} />
      <path d={createPath(data.b)} fill="none" stroke="blue" strokeWidth="2" opacity={0.8} />
    </svg>
  );
}
