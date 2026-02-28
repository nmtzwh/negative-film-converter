import { useState, useEffect } from 'react';
import { checkHealth, loadImage, ImageMetadata } from './api';
import { open } from '@tauri-apps/plugin-dialog';

function App() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(async () => {
      const isConnected = await checkHealth();
      setConnected(isConnected);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  const handleOpenFile = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [
          {
            name: 'RAW Images',
            extensions: ['ARW', 'DNG', 'NEF', 'CR2', 'CR3', 'ORF', 'RW2'],
          },
        ],
      });

      if (file && typeof file === 'string') {
        setLoading(true);
        setError(null);
        try {
          const data = await loadImage(file);
          setMetadata(data);
        } catch (e: any) {
          setError(e.message);
        } finally {
          setLoading(false);
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h1>Negative Film Converter</h1>
      <p>
        Backend Status: {' '}
        {connected === null ? (
          'Checking...'
        ) : connected ? (
          <span style={{ color: 'green' }}>Connected</span>
        ) : (
          <span style={{ color: 'red' }}>Disconnected</span>
        )}
      </p>

      <button onClick={handleOpenFile} disabled={!connected || loading}>
        {loading ? 'Loading...' : 'Open RAW File'}
      </button>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {metadata && (
        <div style={{ marginTop: '20px' }}>
          <h3>Image Metadata</h3>
          <p>Width: {metadata.width}</p>
          <p>Height: {metadata.height}</p>
          <p>White Balance: {metadata.camera_white_balance.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

export default App;
