import { useState, useEffect } from 'react';
import { checkHealth } from './api';

function App() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = setInterval(async () => {
      const isConnected = await checkHealth();
      setConnected(isConnected);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

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
    </div>
  );
}

export default App;
