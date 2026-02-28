import { useState, useEffect } from 'react';
import { checkHealth, loadImage, convertImage, ImageMetadata } from './api';
import { open } from '@tauri-apps/plugin-dialog';

function App() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
        setImageUrl(null);
        setMetadata(null);
        try {
          const data = await loadImage(file);
          setMetadata(data);
          
          const url = await convertImage(file);
          setImageUrl(url);
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
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
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

      <button onClick={handleOpenFile} disabled={!connected || loading} style={{ padding: '10px 20px', fontSize: '16px' }}>
        {loading ? 'Processing...' : 'Open & Convert RAW File'}
      </button>

      {error && <p style={{ color: 'red', marginTop: '20px' }}>Error: {error}</p>}

      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        {metadata && (
          <div style={{ minWidth: '200px' }}>
            <h3>Image Metadata</h3>
            <p><strong>Width:</strong> {metadata.width}</p>
            <p><strong>Height:</strong> {metadata.height}</p>
            <p><strong>White Balance:</strong> {metadata.camera_white_balance.join(', ')}</p>
          </div>
        )}

        {imageUrl && (
          <div style={{ flex: 1 }}>
            <h3>Converted Positive</h3>
            <img src={imageUrl} alt="Converted" style={{ maxWidth: '100%', maxHeight: '600px', border: '1px solid #ccc' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
