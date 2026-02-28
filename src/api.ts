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
