export async function checkHealth() {
  try {
    const response = await fetch('http://localhost:8000/health');
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    console.error('Failed to connect to backend:', error);
    return false;
  }
}

export interface ImageMetadata {
  width: number;
  height: number;
  camera_white_balance: number[];
}

export async function loadImage(path: string): Promise<ImageMetadata> {
  const response = await fetch('http://localhost:8000/load_image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to load image');
  }

  return response.json();
}

export async function sampleColor(path: string, x: number, y: number): Promise<number[]> {
  const response = await fetch('http://localhost:8000/sample_color', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, x, y }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to sample color');
  }

  const data = await response.json();
  return data.color;
}
export interface FileEntry {
  name: string;
  path: string;
}

export async function listDirectory(path: string): Promise<FileEntry[]> {
  const response = await fetch('http://localhost:8000/list_directory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to list directory');
  }

  const data = await response.json();
  return data.files;
}

export async function getThumbnail(path: string): Promise<string> {
  const response = await fetch('http://localhost:8000/get_thumbnail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get thumbnail');
  }

  const data = await response.json();
  return data.image;
}

export async function getRawPreview(path: string): Promise<string> {
  const response = await fetch('http://localhost:8000/get_raw_preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) throw new Error('Failed to get raw preview');
  const data = await response.json();
  return data.image;
}

export type Curves = { rgb: [number,number][], r: [number,number][], g: [number,number][], b: [number,number][] };

export interface ConvertResult {
  imageUrl: string;
  histogram: number[][]; // [R, G, B] each with 256 bins
}

export async function convertImage(path: string, exposure: number = 0.0, baseColor: number[] | null = null, userCurves: Curves | null = null): Promise<ConvertResult> {
  const response = await fetch('http://localhost:8000/convert_image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, exposure, base_color: baseColor, user_curves: userCurves }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to convert image');
  }

  const data = await response.json();
  return {
    imageUrl: data.image,
    histogram: data.histogram,
  };
}

export interface Settings {
  exposure: number;
  base_color: number[] | null;
  crop?: number[] | null;
  user_curves?: Curves | null;
}

export async function saveSettings(path: string, exposure: number, baseColor: number[] | null, crop?: number[] | null, userCurves?: Curves | null): Promise<void> {
  const response = await fetch('http://localhost:8000/save_settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, exposure, base_color: baseColor, crop, user_curves: userCurves }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to save settings');
  }
}

export async function loadSettings(path: string): Promise<Settings> {
  const response = await fetch('http://localhost:8000/load_settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to load settings');
  }

  return response.json();
}

export async function exportImage(path: string, outputDir: string, exposure: number, baseColor: number[] | null, crop?: number[] | null, userCurves?: Curves | null): Promise<string> {
  const response = await fetch('http://localhost:8000/export_image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, output_dir: outputDir, exposure, base_color: baseColor, crop, user_curves: userCurves }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to export image');
  }

  const data = await response.json();
  return data.output_path;
}

export interface RollProfileData {
  anchors: number[][];
  curve_params: any | null;
  vis_data: { r: number[], g: number[], b: number[] } | null;
}

export async function loadRollProfile(dirPath: string): Promise<RollProfileData> {
  const response = await fetch('http://localhost:8000/load_roll_profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: dirPath }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to load roll profile');
  }

  return response.json();
}

export async function updateRollProfile(dirPath: string, anchors: number[][]): Promise<RollProfileData> {
  const response = await fetch('http://localhost:8000/update_roll_profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dir_path: dirPath, anchors }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update roll profile');
  }

  return response.json();
}
