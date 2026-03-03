import { useState, useEffect, useRef, MouseEvent } from 'react';
import { checkHealth, loadImage, convertImage, ImageMetadata, listDirectory, FileEntry, saveSettings, loadSettings, exportImage, Settings, updateRollProfile, loadRollProfile, getRawPreview } from './api';
import { open } from '@tauri-apps/plugin-dialog';
import { Histogram } from './components/Histogram';
import { FilmStrip } from './components/FilmStrip';
import { CurveGraph } from './components/CurveGraph';
import { CropOverlay } from './components/CropOverlay';
import './App.css';

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
  const [crop, setCrop] = useState<number[] | null>(null);
  const [isPickingBase, setIsPickingBase] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  
  // New States for Task 2 & 3
  const [settingsClipboard, setSettingsClipboard] = useState<Settings | null>(null);
  const [exportProgress, setExportProgress] = useState<{current: number, total: number} | null>(null);

  // Roll Calibration States
  const [isPickingAnchor, setIsPickingAnchor] = useState(false);
  const [rollAnchors, setRollAnchors] = useState<number[][]>([]);
  const [curveVisData, setCurveVisData] = useState<any>(null);
  const [currentDir, setCurrentDir] = useState<string | null>(null);

  // Viewport Interaction States
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  const imgRef = useRef<HTMLImageElement>(null);

  // Health check
  useEffect(() => {
    const timer = setInterval(async () => {
      const isConnected = await checkHealth();
      setConnected(isConnected);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  // Hotkeys for Hold-to-Compare
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '\\' || e.code === 'Space') && !e.repeat) {
        if (e.code === 'Space' && e.target instanceof HTMLInputElement) return; // ignore typing space in inputs
        setShowOriginal(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === '\\' || e.code === 'Space') {
        setShowOriginal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Conversion trigger when exposure, baseColor, or file changes
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

  // Auto-save settings debounced
  useEffect(() => {
    if (!currentFilePath) return;
    const timer = setTimeout(() => {
      saveSettings(currentFilePath, exposure, baseColor, crop).catch(e => console.error("Auto-save failed:", e));
    }, 1000);
    return () => clearTimeout(timer);
  }, [exposure, baseColor, crop, currentFilePath]);

  const loadFile = async (file: string) => {
    setCurrentFilePath(null); // Reset to clear old image
    setImageUrl(null);
    setRawImageUrl(null);
    setHistogramData(null);
    setMetadata(null);
    setScale(1);
    setPan({ x: 0, y: 0 });
    setLoading(true);
    setError(null);
    
    try {
      getRawPreview(file).then(setRawImageUrl).catch(console.error);
      const data = await loadImage(file);
      setMetadata(data);
      
      const settings = await loadSettings(file);
      setExposure(settings.exposure);
      setBaseColor(settings.base_color);
      setCrop(settings.crop || null);

      setCurrentFilePath(file); // This will trigger the conversion
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const folder = await open({
        multiple: false,
        directory: true,
      });

      if (folder && typeof folder === 'string') {
        setLoading(true);
        setError(null);
        try {
          const dirFiles = await listDirectory(folder);
          setFiles(dirFiles);
          setCurrentDir(folder);
          
          try {
            const profile = await loadRollProfile(folder);
            setRollAnchors(profile.anchors || []);
            setCurveVisData(profile.vis_data || null);
          } catch (e) {
            console.error("Failed to load roll profile", e);
            setRollAnchors([]);
            setCurveVisData(null);
          }

          if (dirFiles.length > 0) {
            loadFile(dirFiles[0].path);
          } else {
            setCurrentFilePath(null);
            setImageUrl(null);
          }
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

  const handleOpenFile = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [
          {
            name: 'Images',
            extensions: ['ARW', 'DNG', 'NEF', 'CR2', 'CR3', 'ORF', 'RW2', 'JPG', 'JPEG', 'PNG', 'TIFF', 'TIF', 'BMP'],
          },
        ],
      });

      if (file && typeof file === 'string') {
        setFiles([{ name: file.split(/[/\\]/).pop() || 'image', path: file }]);
        loadFile(file);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleImageClick = async (e: MouseEvent<HTMLImageElement>) => {
    if ((!isPickingBase && !isPickingAnchor) || !currentFilePath || !imgRef.current || isCropping) return;

    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    
    const viewRatio = rect.width / rect.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    
    let renderedWidth = rect.width;
    let renderedHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (viewRatio > imgRatio) {
      renderedWidth = rect.height * imgRatio;
      offsetX = (rect.width - renderedWidth) / 2;
    } else {
      renderedHeight = rect.width / imgRatio;
      offsetY = (rect.height - renderedHeight) / 2;
    }

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    if (clickX < 0 || clickX > renderedWidth || clickY < 0 || clickY > renderedHeight) {
      return;
    }

    const normalizedX = clickX / renderedWidth;
    const normalizedY = clickY / renderedHeight;

    try {
      setLoading(true);
      const { sampleColor } = await import('./api');
      const color = await sampleColor(currentFilePath, normalizedX, normalizedY);
      
      if (isPickingBase) {
        setBaseColor(color);
        setIsPickingBase(false);
      } else if (isPickingAnchor && currentDir) {
        const newAnchors = [...rollAnchors, color];
        setRollAnchors(newAnchors);
        const profile = await updateRollProfile(currentDir, newAnchors);
        setCurveVisData(profile.vis_data);
        setIsPickingAnchor(false);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSensitivity = 0.002;
    const delta = -e.deltaY * zoomSensitivity;
    setScale(s => Math.min(Math.max(1, s + delta * s), 10));
    if (scale <= 1) setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPickingBase || isPickingAnchor) return;
    if (scale > 1) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  const handleCopySettings = () => {
    setSettingsClipboard({ exposure, base_color: baseColor, crop });
  };

  const handlePasteSettings = () => {
    if (settingsClipboard) {
      setExposure(settingsClipboard.exposure);
      setBaseColor(settingsClipboard.base_color);
      if (settingsClipboard.crop) setCrop(settingsClipboard.crop);
    }
  };

  const handleExportCurrent = async () => {
    if (!currentFilePath) return;
    try {
      const outputDir = await open({ directory: true, multiple: false });
      if (outputDir && typeof outputDir === 'string') {
        setLoading(true);
        await exportImage(currentFilePath, outputDir, exposure, baseColor, crop);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchExport = async () => {
    if (files.length === 0) return;
    try {
      const outputDir = await open({ directory: true, multiple: false });
      if (outputDir && typeof outputDir === 'string') {
        setLoading(true);
        let current = 0;
        setExportProgress({ current, total: files.length });
        for (const file of files) {
          try {
            const settings = await loadSettings(file.path);
            await exportImage(file.path, outputDir, settings.exposure, settings.base_color, settings.crop);
          } catch (err: any) {
            console.error(`Failed to export ${file.name}:`, err);
            // Optionally could gather errors here
          }
          current++;
          setExportProgress({ current, total: files.length });
        }
        setExportProgress(null);
      }
    } catch (e: any) {
      setError(e.message);
      setExportProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1 className="header-title">Negative Film Converter</h1>
        <div className="header-status">
          Backend: {' '}
          {connected === null ? (
            <span>Checking...</span>
          ) : connected ? (
            <span className="status-ok">Connected</span>
          ) : (
            <span className="status-err">Disconnected</span>
          )}
        </div>
      </header>

      {/* Main Area */}
      <main className="main-content">
        {/* Left Sidebar - Controls */}
        <aside className="sidebar">
          <div className="panel-section">
            <h3>File</h3>
            <div className="button-group">
              <button className="btn" onClick={handleOpenFolder} disabled={!connected || loading} title="Open a folder of RAW files">
                Open Folder
              </button>
              <button className="btn" onClick={handleOpenFile} disabled={!connected || loading} title="Open a single RAW file">
                Open File
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h3>Export</h3>
            <div className="button-group">
              <button className="btn" onClick={handleExportCurrent} disabled={!currentFilePath || loading} title="Export current image as JPEG">
                Export Current
              </button>
              <button className="btn" onClick={handleBatchExport} disabled={files.length === 0 || loading} title="Export all images in filmstrip">
                Batch Export All
              </button>
            </div>
            {exportProgress && (
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                />
                <span style={{ fontSize: '0.8rem', marginTop: '2px', display: 'block', textAlign: 'center' }}>
                  {exportProgress.current} / {exportProgress.total}
                </span>
              </div>
            )}
          </div>

          <div className="panel-section">
            <h3>Adjustments</h3>
            <div className="input-group">
              <label htmlFor="exposure">Exposure: {exposure.toFixed(2)} EV</label>
              <input
                id="exposure"
                type="range"
                min="-3"
                max="3"
                step="0.1"
                value={exposure}
                onChange={(e) => setExposure(parseFloat(e.target.value))}
                disabled={!currentFilePath || loading}
              />
            </div>

            <div className="button-group" style={{ marginTop: '10px' }}>
              <button 
                className={`btn ${isPickingBase ? 'active' : ''}`}
                onClick={() => {
                  setIsPickingBase(!isPickingBase);
                  if (!isPickingBase) setIsCropping(false);
                }}
                disabled={!currentFilePath || loading}
                title="Click on the unexposed film border to set white balance"
              >
                {isPickingBase ? 'Cancel Picker' : 'Pick Film Base'}
              </button>
              <button 
                className="btn"
                onClick={() => setBaseColor(null)}
                disabled={!baseColor || loading}
                title="Reset white balance to camera default"
              >
                Reset WB
              </button>
            </div>
            
            <div className="button-group" style={{ marginTop: '10px' }}>
              <button 
                className={`btn ${isCropping ? 'active' : ''}`}
                onClick={() => {
                  setIsCropping(!isCropping);
                  if (!isCropping) setIsPickingBase(false);
                }}
                disabled={!currentFilePath || loading}
                title="Crop the image"
              >
                {isCropping ? 'Done Cropping' : 'Crop'}
              </button>
              <button 
                className="btn"
                onClick={() => setCrop(null)}
                disabled={!crop || loading}
                title="Reset Crop"
              >
                Reset Crop
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h3>Roll Calibration</h3>
            <div className="button-group">
              <button 
                className={`btn ${isPickingAnchor ? 'active' : ''}`}
                onClick={() => setIsPickingAnchor(!isPickingAnchor)}
                disabled={!currentFilePath || !currentDir || loading}
                title="Sample gray points across the roll to build a density curve"
              >
                {isPickingAnchor ? 'Cancel Picker' : 'Pick Gray Anchor'}
              </button>
            </div>
            {rollAnchors.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '0.8rem', marginBottom: '5px' }}>Anchors: {rollAnchors.length}</div>
                <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {rollAnchors.map((anchor, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-header)', padding: '2px 5px', borderRadius: '4px' }}>
                      <span style={{ fontSize: '0.75rem' }}>
                        RGB: {anchor.map(v => (v * 255).toFixed(0)).join(', ')}
                      </span>
                      <button 
                        onClick={async () => {
                          const newAnchors = rollAnchors.filter((_, i) => i !== idx);
                          setRollAnchors(newAnchors);
                          if (currentDir) {
                            try {
                              const profile = await updateRollProfile(currentDir, newAnchors);
                              setCurveVisData(profile.vis_data);
                            } catch (e: any) { setError(e.message); }
                          }
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 5px' }}
                        title="Remove Anchor"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '10px' }}>
                  <CurveGraph data={curveVisData} width={268} height={100} />
                </div>
              </div>
            )}
          </div>

          <div className="panel-section">
            <h3>Settings</h3>
            <div className="button-group">
              <button className="btn" onClick={handleCopySettings} disabled={!currentFilePath}>
                Copy Settings
              </button>
              <button className="btn" onClick={handlePasteSettings} disabled={!currentFilePath || !settingsClipboard}>
                Paste Settings
              </button>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}
        </aside>

        {/* Center Viewport */}
        <section 
          className={`viewport ${scale > 1 && !isPickingBase && !isPickingAnchor && !isCropping ? 'can-pan' : ''} ${isPanning ? 'is-panning' : ''}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {imageUrl ? (
            <>
              <img 
                ref={imgRef}
                src={showOriginal && rawImageUrl ? rawImageUrl : imageUrl} 
                alt="Converted" 
                onClick={handleImageClick}
                style={{ 
                  cursor: (isPickingBase || isPickingAnchor) ? 'crosshair' : (scale > 1 && isPanning ? 'grabbing' : (scale > 1 && !isCropping ? 'grab' : 'default')),
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
                }} 
              />
              {isCropping && (
                <CropOverlay 
                  crop={crop} 
                  onChange={setCrop} 
                  imgRef={imgRef} 
                  scale={scale} 
                  pan={pan} 
                />
              )}
            </>
          ) : (
            <div style={{ color: '#666' }}>No image loaded</div>
          )}
          {loading && !exportProgress && (
            <div className="viewport-overlay">
              <div className="loader" style={{ marginRight: '10px' }}></div>
              Processing...
            </div>
          )}
        </section>

        {/* Right Sidebar - Info */}
        <aside className="sidebar-right">
          <div className="panel-section">
            <h3>Histogram</h3>
            {histogramData ? (
              <Histogram data={histogramData} width={220} height={150} />
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#666' }}>No data</div>
            )}
          </div>

          <div className="panel-section">
            <h3>Image Metadata</h3>
            {metadata ? (
              <div style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                <div><strong>Width:</strong> {metadata.width}</div>
                <div><strong>Height:</strong> {metadata.height}</div>
                <div><strong>White Balance:</strong> <br/>{metadata.camera_white_balance.map(v => v.toFixed(2)).join(', ')}</div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#666' }}>No data</div>
            )}
          </div>
        </aside>
      </main>

      {/* Footer - FilmStrip */}
      <FilmStrip 
        files={files} 
        currentFilePath={currentFilePath} 
        onSelectFile={loadFile} 
      />
    </div>
  );
}

export default App;