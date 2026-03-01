import { useState, useEffect } from 'react';
import { checkHealth, loadImage, convertImage, ImageMetadata } from './api';
import { open } from '@tauri-apps/plugin-dialog';

function App() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [exposure, setExposure] = useState<number>(0.0);

  useEffect(() => {
    const timer = setInterval(async () => {
      const isConnected = await checkHealth();
      setConnected(isConnected);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentFilePath) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const url = await convertImage(currentFilePath, exposure);
        if (!controller.signal.aborted) {
          setImageUrl(url);
        }
      } catch (e: any) {
        if (!controller.signal.aborted) {
          setError(e.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [exposure, currentFilePath]);

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
        setCurrentFilePath(null); // Reset to clear old image
        setImageUrl(null);
        setMetadata(null);
        setExposure(0.0);
        setLoading(true);
        setError(null);
        
        try {
          const data = await loadImage(file);
          setMetadata(data);
          setCurrentFilePath(file); // This will trigger the useEffect to convert
        } catch (e: any) {
          setError(e.message);
          setLoading(false);
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', height: '100vh', boxSizing: 'border-box' }}>
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

      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleOpenFile} disabled={!connected || loading} style={{ padding: '10px 20px', fontSize: '16px', marginRight: '20px' }}>
          {loading && !currentFilePath ? 'Opening...' : 'Open RAW File'}
        </button>
        
        {currentFilePath && (
          <div style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <label htmlFor="exposure" style={{ marginRight: '10px' }}>Exposure: {exposure.toFixed(2)} EV</label>
            <input
              id="exposure"
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={exposure}
              onChange={(e) => setExposure(parseFloat(e.target.value))}
              disabled={loading}
              style={{ width: '200px', verticalAlign: 'middle' }}
            />
            {loading && <span style={{ marginLeft: '10px', color: '#666' }}>Processing...</span>}
          </div>
        )}
      </div>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        {metadata && (
          <div style={{ minWidth: '200px', overflowY: 'auto' }}>
            <h3>Image Metadata</h3>
            <p><strong>Width:</strong> {metadata.width}</p>
            <p><strong>Height:</strong> {metadata.height}</p>
            <p><strong>White Balance:</strong> {metadata.camera_white_balance.join(', ')}</p>
          </div>
        )}

        {imageUrl && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111', borderRadius: '4px', overflow: 'hidden' }}>
            <img src={imageUrl} alt="Converted" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;