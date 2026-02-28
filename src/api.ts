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
