import { useEffect, useState } from 'react';

export function App() {
  const [config, setConfig] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        return res.json();
      })
      .then((data) => setConfig(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Modbus App</h1>
      {error && <p style={{ color: 'red' }}>Klaida: {error}</p>}
      {config ? (
        <pre>{JSON.stringify(config, null, 2)}</pre>
      ) : (
        !error && <p>Kraunama konfigūracija...</p>
      )}
    </div>
  );
}

export default App;
