import { useState, useEffect, useRef, MouseEvent } from 'react';
import { checkHealth, loadImage, convertImage, ImageMetadata, listDirectory, FileEntry, saveSettings, loadSettings, exportImage, Settings, updateRollProfile, loadRollProfile, getRawPreview, Curves } from './api';
import { open } from '@tauri-apps/plugin-dialog';
import { Histogram } from './components/Histogram';
import { FilmStrip } from './components/FilmStrip';
import { CurveGraph } from './components/CurveGraph';
import { CropOverlay } from './components/CropOverlay';
import { ToneCurveEditor } from './components/ToneCurveEditor';
import { useHistory } from './hooks/useHistory';
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
  const [baseColorSamples, setBaseColorSamples] = useState<number[][]>([]);
  const [crop, setCrop] = useState<number[] | null>(null);
  const [isPickingBase, setIsPickingBase] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  
  const defaultCurves: Curves = { rgb: [[0,0],[1,1]], r: [[0,0],[1,1]], g: [[0,0],[1,1]], b: [[0,0],[1,1]] };
  const [userCurves, setUserCurves] = useState<Curves>(defaultCurves);

  const { pushState, undo, redo, resetHistory, canUndo, canRedo } = useHistory({
    exposure: 0.0,
    baseColor: null,
    baseColorSamples: [],
    crop: null,
    userCurves: defaultCurves
  });

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
  const [isBeforeViewSticky, setIsBeforeViewSticky] = useState(false);
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
      
      // Undo / Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          const prevState = undo();
          if (prevState) {
            setExposure(prevState.exposure);
            setBaseColor(prevState.baseColor);
            setBaseColorSamples(prevState.baseColorSamples);
            setCrop(prevState.crop);
            setUserCurves(prevState.userCurves);
          }
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          const nextState = redo();
          if (nextState) {
            setExposure(nextState.exposure);
            setBaseColor(nextState.baseColor);
            setBaseColorSamples(nextState.baseColorSamples);
            setCrop(nextState.crop);
            setUserCurves(nextState.userCurves);
          }
        }
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
        const result = await convertImage(currentFilePath, exposure, baseColor, userCurves);
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
  }, [exposure, currentFilePath, baseColor, curveVisData, userCurves]);

  // Auto-save settings debounced and push history
  useEffect(() => {
    if (!currentFilePath) return;
    const timer = setTimeout(() => {
      pushState({ exposure, baseColor, baseColorSamples, crop, userCurves });
      saveSettings(currentFilePath, exposure, baseColor, crop, userCurves).catch(e => console.error("Auto-save failed:", e));
    }, 1000);
    return () => clearTimeout(timer);
  }, [exposure, baseColor, baseColorSamples, crop, userCurves, currentFilePath, pushState]);

  const loadFile = async (file: string) => {
    setCurrentFilePath(null); // Reset to clear old image
    setImageUrl(null);
    setRawImageUrl(null);
    setHistogramData(null);
    setMetadata(null);
    setScale(1);
    setPan({ x: 0, y: 0 });
    setIsBeforeViewSticky(false);
    setLoading(true);
    setError(null);
    
    try {
      getRawPreview(file).then(setRawImageUrl).catch(console.error);
      const data = await loadImage(file);
      setMetadata(data);
      
      const settings = await loadSettings(file);
      setExposure(settings.exposure);
      setBaseColor(settings.base_color);
      setBaseColorSamples([]);
      setCrop(settings.crop || null);
      setUserCurves(settings.user_curves || defaultCurves);
      
      resetHistory({
        exposure: settings.exposure,
        baseColor: settings.base_color,
        baseColorSamples: [],
        crop: settings.crop || null,
        userCurves: settings.user_curves || defaultCurves
      });

      setCurrentFilePath(file); // This will trigger the conversion
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      let folder: string | null = null;
      if ('__TAURI_INTERNALS__' in window) {
        const selected = await open({
          multiple: false,
          directory: true,
        });
        if (typeof selected === 'string') folder = selected;
      } else {
        folder = window.prompt("Web Browser Mode: Enter absolute directory path on your local machine:");
      }

      if (folder) {
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
      let file: string | null = null;
      if ('__TAURI_INTERNALS__' in window) {
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: 'Images',
              extensions: ['ARW', 'DNG', 'NEF', 'CR2', 'CR3', 'ORF', 'RW2', 'JPG', 'JPEG', 'PNG', 'TIFF', 'TIF', 'BMP'],
            },
          ],
        });
        if (typeof selected === 'string') file = selected;
      } else {
        file = window.prompt("Web Browser Mode: Enter absolute file path on your local machine:");
      }

      if (file) {
        setFiles([{ name: file.split(/[/\\]/).pop() || 'image', path: file }]);
        
        const dirMatch = file.match(/(.*)[/\\]/);
        if (dirMatch) {
          const dir = dirMatch[1];
          setCurrentDir(dir);
          try {
            const profile = await loadRollProfile(dir);
            setRollAnchors(profile.anchors || []);
            setCurveVisData(profile.vis_data || null);
          } catch (e) {
            console.error("Failed to load roll profile", e);
            setRollAnchors([]);
            setCurveVisData(null);
          }
        } else {
          setCurrentDir(null);
        }

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
        const newSamples = [...baseColorSamples, color];
        setBaseColorSamples(newSamples);
        
        const avgColor = [0, 0, 0];
        for (const s of newSamples) {
          avgColor[0] += s[0];
          avgColor[1] += s[1];
          avgColor[2] += s[2];
        }
        avgColor[0] /= newSamples.length;
        avgColor[1] /= newSamples.length;
        avgColor[2] /= newSamples.length;
        
        setBaseColor(avgColor);
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
    setSettingsClipboard({ exposure, base_color: baseColor, crop, user_curves: userCurves });
  };

  const handlePasteSettings = () => {
    if (settingsClipboard) {
      setExposure(settingsClipboard.exposure);
      setBaseColor(settingsClipboard.base_color);
      if (settingsClipboard.crop) setCrop(settingsClipboard.crop);
      if (settingsClipboard.user_curves) setUserCurves(settingsClipboard.user_curves);
    }
  };

  const handleExportCurrent = async () => {
    if (!currentFilePath) return;
    try {
      let outputDir: string | null = null;
      if ('__TAURI_INTERNALS__' in window) {
        const selected = await open({ directory: true, multiple: false });
        if (typeof selected === 'string') outputDir = selected;
      } else {
        outputDir = window.prompt("Web Browser Mode: Enter absolute directory path for export:");
      }
      if (outputDir) {
        setLoading(true);
        await exportImage(currentFilePath, outputDir, exposure, baseColor, crop, userCurves);
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
      let outputDir: string | null = null;
      if ('__TAURI_INTERNALS__' in window) {
        const selected = await open({ directory: true, multiple: false });
        if (typeof selected === 'string') outputDir = selected;
      } else {
        outputDir = window.prompt("Web Browser Mode: Enter absolute directory path for batch export:");
      }
      if (outputDir) {
        setLoading(true);
        let current = 0;
        setExportProgress({ current, total: files.length });
        for (const file of files) {
          try {
            const settings = await loadSettings(file.path);
            await exportImage(file.path, outputDir, settings.exposure, settings.base_color, settings.crop, settings.user_curves);
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
            <div className="button-group" style={{ marginBottom: '10px' }}>
              <button className="btn" onClick={() => {
                const prevState = undo();
                if (prevState) {
                  setExposure(prevState.exposure);
                  setBaseColor(prevState.baseColor);
                  setBaseColorSamples(prevState.baseColorSamples);
                  setCrop(prevState.crop);
                  setUserCurves(prevState.userCurves);
                }
              }} disabled={!canUndo || loading} title="Undo (Ctrl+Z)">
                Undo
              </button>
              <button className="btn" onClick={() => {
                const nextState = redo();
                if (nextState) {
                  setExposure(nextState.exposure);
                  setBaseColor(nextState.baseColor);
                  setBaseColorSamples(nextState.baseColorSamples);
                  setCrop(nextState.crop);
                  setUserCurves(nextState.userCurves);
                }
              }} disabled={!canRedo || loading} title="Redo (Ctrl+Y)">
                Redo
              </button>
            </div>
            <div className="input-group">
              <label htmlFor="exposure">Exposure: {exposure.toFixed(2)} EV</label>
              <input
                id="exposure"
                type="range"
                min="-3"
                max="3"
                step="0.1"
                value={exposure}
                onChange={(e) => {
                  setExposure(parseFloat(e.target.value));
                  setIsBeforeViewSticky(false);
                }}
                disabled={!currentFilePath || loading}
              />
            </div>

            <div className="button-group" style={{ marginTop: '10px' }}>
              <button 
                className={`btn ${isPickingBase ? 'active' : ''}`}
                onClick={() => {
                  setIsPickingBase(!isPickingBase);
                  if (!isPickingBase) {
                    setIsCropping(false);
                    setIsPickingAnchor(false);
                  }
                }}
                disabled={!currentFilePath || loading}
                title="Click on the unexposed film border to set white balance"
              >
                {isPickingBase ? 'Cancel Picker' : 'Pick Film Base'}
              </button>
              <button 
                className="btn"
                onClick={() => {
                  setBaseColor(null);
                  setBaseColorSamples([]);
                  setIsBeforeViewSticky(false);
                }}
                disabled={!baseColor || loading}
                title="Reset white balance to camera default"
              >
                Reset WB
              </button>
            </div>
            
            {baseColorSamples.length > 0 && (
              <div style={{ marginTop: '5px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Samples: {baseColorSamples.length}</span>
                <button 
                  onClick={() => {
                    setBaseColorSamples([]);
                    // keep current baseColor, just clear the samples so they can start fresh
                  }} 
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                >
                  Clear Points
                </button>
              </div>
            )}
            
            <div className="button-group" style={{ marginTop: '10px' }}>
              <button 
                className={`btn ${isCropping ? 'active' : ''}`}
                onClick={() => {
                  setIsCropping(!isCropping);
                  setIsBeforeViewSticky(false);
                  if (!isCropping) {
                    setIsPickingBase(false);
                    setIsPickingAnchor(false);
                  }
                }}
                disabled={!currentFilePath || loading}
                title="Crop the image"
              >
                {isCropping ? 'Done Cropping' : 'Crop'}
              </button>
              <button 
                className="btn"
                onClick={() => {
                  setCrop(null);
                  setIsBeforeViewSticky(false);
                }}
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
                onClick={() => {
                  setIsPickingAnchor(!isPickingAnchor);
                  if (!isPickingAnchor) {
                    setIsPickingBase(false);
                    setIsCropping(false);
                  }
                }}
                disabled={!currentFilePath || !currentDir || loading}
                title="Sample gray points across the roll to build a density curve"
              >
                {isPickingAnchor ? 'Cancel Picker' : 'Pick Gray Anchor'}
              </button>
            </div>
            {rollAnchors.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '0.8rem', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Anchors: {rollAnchors.length}</span>
                  <button 
                    onClick={async () => {
                      setRollAnchors([]);
                      if (currentDir) {
                        try {
                          const profile = await updateRollProfile(currentDir, []);
                          setCurveVisData(profile.vis_data);
                        } catch (e: any) { setError(e.message); }
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                    title="Clear All Anchors"
                  >
                    Clear All
                  </button>
                </div>
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
          {imageUrl && (
            <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, display: 'flex', gap: '10px' }}>
              <button 
                className={`btn ${isBeforeViewSticky ? 'active' : ''}`}
                onClick={() => setIsBeforeViewSticky(!isBeforeViewSticky)}
                disabled={!rawImageUrl}
                title="Toggle Before/After View"
                style={{
                  backgroundColor: isBeforeViewSticky ? 'var(--accent)' : 'var(--bg-panel)',
                  opacity: 0.9,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}
              >
                {isBeforeViewSticky ? 'Showing Before' : 'Compare'}
              </button>
            </div>
          )}
          {imageUrl ? (
            <>
              <img 
                ref={imgRef}
                src={(showOriginal || isBeforeViewSticky) && rawImageUrl ? rawImageUrl : imageUrl} 
                alt="Converted" 
                onClick={handleImageClick}
                style={{ 
                  cursor: (isPickingBase || isPickingAnchor) ? 'crosshair' : (scale > 1 && isPanning ? 'grabbing' : (scale > 1 && !isCropping ? 'grab' : 'default')),
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
                }} 
              />
              {(showOriginal || isBeforeViewSticky) && rawImageUrl && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    backgroundColor: 'rgba(255, 0, 0, 0.7)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                >
                  ORIGINAL NEGATIVE
                </div>
              )}
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
            <h3>Tone Curves</h3>
            <ToneCurveEditor curves={userCurves} onChange={(c) => { setUserCurves(c); setIsBeforeViewSticky(false); }} />
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