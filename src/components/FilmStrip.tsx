import { useState, useEffect } from 'react';
import { FileEntry, getThumbnail } from '../api';

interface FilmStripProps {
  files: FileEntry[];
  currentFilePath: string | null;
  onSelectFile: (path: string) => void;
}

export function FilmStrip({ files, currentFilePath, onSelectFile }: FilmStripProps) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load thumbnails sequentially to avoid overwhelming the backend
    const loadThumbnails = async () => {
      for (const file of files) {
        if (!thumbnails[file.path]) {
          try {
            const imgData = await getThumbnail(file.path);
            setThumbnails(prev => ({ ...prev, [file.path]: imgData }));
          } catch (e) {
            console.error(`Failed to load thumbnail for ${file.name}`, e);
          }
        }
      }
    };

    if (files.length > 0) {
      loadThumbnails();
    }
  }, [files]); // Intentionally not including thumbnails in dep array to avoid infinite loop

  if (files.length === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      overflowX: 'auto',
      gap: '10px',
      padding: '10px',
      backgroundColor: '#222',
      borderTop: '1px solid #444',
      height: '120px',
      alignItems: 'center'
    }}>
      {files.map((file) => (
        <div 
          key={file.path}
          onClick={() => onSelectFile(file.path)}
          style={{
            cursor: 'pointer',
            border: currentFilePath === file.path ? '2px solid #007bff' : '2px solid transparent',
            borderRadius: '4px',
            overflow: 'hidden',
            width: '100px',
            height: '80px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#111',
            position: 'relative'
          }}
          title={file.name}
        >
          {thumbnails[file.path] ? (
            <img 
              src={thumbnails[file.path]} 
              alt={file.name} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <span style={{ color: '#666', fontSize: '12px' }}>Loading...</span>
          )}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
            fontSize: '10px',
            padding: '2px 4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {file.name}
          </div>
        </div>
      ))}
    </div>
  );
}
