import { useState, useEffect, useRef, MouseEvent } from 'react';
import { checkHealth, loadImage, convertImage, ImageMetadata } from './api';
import { open } from '@tauri-apps/plugin-dialog';
import { Histogram } from './components/Histogram';

function App() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [histogramData, setHistogramData] = useState<number[][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [exposure, setExposure] = useState<number>(0.0);
  const [baseColor, setBaseColor] = useState<number[] | null>(null);
  const [isPickingBase, setIsPickingBase] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

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
        const result = await convertImage(currentFilePath, exposure, baseColor);
        if (!controller.signal.aborted) {
          setImageUrl(result.imageUrl);
          setHistogramData(result.histogram);
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
  }, [exposure, currentFilePath, baseColor]);

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
        setHistogramData(null);
        setMetadata(null);
        setExposure(0.0);
        setBaseColor(null);
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

  const handleImageClick = async (e: MouseEvent<HTMLImageElement>) => {
    if (!isPickingBase || !currentFilePath || !imgRef.current) return;

    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    
    // Calculate coordinates relative to the image's actual displayed size (object-fit: contain)
    const viewRatio = rect.width / rect.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    
    let renderedWidth = rect.width;
    let renderedHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (viewRatio > imgRatio) {
      // Image is bound by height (pillarboxed)
      renderedWidth = rect.height * imgRatio;
      offsetX = (rect.width - renderedWidth) / 2;
    } else {
      // Image is bound by width (letterboxed)
      renderedHeight = rect.width / imgRatio;
      offsetY = (rect.height - renderedHeight) / 2;
    }

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    // Check if clicked outside the actual image area
    if (clickX < 0 || clickX > renderedWidth || clickY < 0 || clickY > renderedHeight) {
      return;
    }

    const normalizedX = clickX / renderedWidth;
    const normalizedY = clickY / renderedHeight;

    try {
      setLoading(true);
      const { sampleColor } = await import('./api');
      const color = await sampleColor(currentFilePath, normalizedX, normalizedY);
      setBaseColor(color);
      setIsPickingBase(false); // Turn off picker after selection
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
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
          <div style={{ display: 'inline-block', verticalAlign: 'middle', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div>
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
                  style={{ width: '150px', verticalAlign: 'middle' }}
                />
              </div>

              <div>
                <button 
                  onClick={() => setIsPickingBase(!isPickingBase)}
                  style={{ 
                    padding: '5px 10px', 
                    backgroundColor: isPickingBase ? '#007bff' : '#fff',
                    color: isPickingBase ? '#fff' : '#000',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {isPickingBase ? 'Cancel Picker' : 'Pick Film Base'}
                </button>
                {baseColor && (
                  <button 
                    onClick={() => setBaseColor(null)}
                    style={{ marginLeft: '10px', padding: '5px 10px' }}
                  >
                    Reset WB
                  </button>
                )}
              </div>
              
              {loading && <span style={{ color: '#666' }}>Processing...</span>}
            </div>
          </div>
        )}
      </div>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        <div style={{ minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {metadata && (
            <div>
              <h3>Image Metadata</h3>
              <p><strong>Width:</strong> {metadata.width}</p>
              <p><strong>Height:</strong> {metadata.height}</p>
              <p><strong>White Balance:</strong> {metadata.camera_white_balance.join(', ')}</p>
            </div>
          )}
          
          {histogramData && (
            <div>
              <h3>Histogram</h3>
              <Histogram data={histogramData} width={250} height={150} />
            </div>
          )}
        </div>

        {imageUrl && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111', borderRadius: '4px', overflow: 'hidden' }}>
            <img 
              ref={imgRef}
              src={imageUrl} 
              alt="Converted" 
              onClick={handleImageClick}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                objectFit: 'contain',
                cursor: isPickingBase ? 'crosshair' : 'default'
              }} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;