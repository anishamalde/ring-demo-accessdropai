import { useState, useCallback } from 'react';
import { refreshToken, getDevices, getDeviceStatus, getDeviceCapabilities, getDeviceLocation, getDeviceConfigurations } from './api';
import LiveStream from './LiveStream';
import PersonDetector from './PersonDetector';
import ClipDownloader from './ClipDownloader';
import AccessDropScreen from './AccessDropScreen';
import { CONFIG } from '../config.js';

function App() {
  const [view, setView] = useState('explorer');
  const [creds, setCreds] = useState({
    accessToken: CONFIG.accessToken || '',
    refreshToken: CONFIG.refreshToken || '',
    clientId: CONFIG.clientId || '',
    clientSecret: CONFIG.clientSecret || '',
  });
  const [devices, setDevices] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceDetail, setDeviceDetail] = useState(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [log, setLog] = useState([]);

  const addLog = (msg) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

  const handleRefreshToken = useCallback(async () => {
    setError('');
    setLoading('Refreshing token...');
    addLog('Refreshing access token...');
    try {
      const data = await refreshToken(creds.refreshToken, creds.clientId, creds.clientSecret);
      setCreds((prev) => ({
        ...prev,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || prev.refreshToken,
      }));
      addLog(`Token refreshed. Expires in ${data.expires_in}s. Scope: ${data.scope}`);
    } catch (err) {
      setError(err.message);
      addLog(`Token refresh failed: ${err.message}`);
    } finally {
      setLoading('');
    }
  }, [creds]);

  const handleFetchDevices = useCallback(async () => {
    setError('');
    setLoading('Fetching devices...');
    addLog('GET /v1/devices?include=status');
    try {
      const data = await getDevices(creds.accessToken);
      setDevices(data);
      addLog(`Found ${data.data?.length || 0} device(s)`);
    } catch (err) {
      setError(err.message);
      addLog(`Fetch devices failed: ${err.message}`);
    } finally {
      setLoading('');
    }
  }, [creds.accessToken]);

  const handleDeviceAction = useCallback(async (action) => {
    if (!selectedDevice) return;
    setError('');
    setLoading(`Fetching ${action}...`);
    const id = selectedDevice;
    addLog(`GET /v1/devices/${id}/${action}`);
    try {
      let data;
      switch (action) {
        case 'status': data = await getDeviceStatus(id, creds.accessToken); break;
        case 'capabilities': data = await getDeviceCapabilities(id, creds.accessToken); break;
        case 'location': data = await getDeviceLocation(id, creds.accessToken); break;
        case 'configurations': data = await getDeviceConfigurations(id, creds.accessToken); break;
      }
      setDeviceDetail({ action, data });
      addLog(`${action} response received`);
    } catch (err) {
      setError(err.message);
      addLog(`${action} failed: ${err.message}`);
    } finally {
      setLoading('');
    }
  }, [selectedDevice, creds.accessToken]);

  if (view === 'accessdrop') {
    return (
      <div className="app">
        <AccessDropScreen
          deviceId={selectedDevice}
          accessToken={creds.accessToken}
          onBack={() => setView('explorer')}
          onLog={addLog}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Ring AVA Explorer</h1>

      <section className="credentials">
        <h2>Credentials</h2>
        <div className="form-grid">
          <label>
            Access Token
            <textarea rows={2} value={creds.accessToken} onChange={(e) => setCreds({ ...creds, accessToken: e.target.value })} placeholder="Paste access token..." />
          </label>
          <label>
            Refresh Token
            <textarea rows={2} value={creds.refreshToken} onChange={(e) => setCreds({ ...creds, refreshToken: e.target.value })} placeholder="Paste refresh token..." />
          </label>
          <label>
            Client ID
            <input value={creds.clientId} onChange={(e) => setCreds({ ...creds, clientId: e.target.value })} placeholder="Partner client ID" />
          </label>
          <label>
            Client Secret
            <input type="password" value={creds.clientSecret} onChange={(e) => setCreds({ ...creds, clientSecret: e.target.value })} placeholder="Partner client secret" />
          </label>
        </div>
        <div className="actions">
          <button onClick={handleRefreshToken} disabled={!creds.refreshToken || !creds.clientId || !creds.clientSecret}>
            Refresh Token
          </button>
        </div>
      </section>

      <section className="devices">
        <h2>Devices</h2>
        <div className="actions">
          <button onClick={handleFetchDevices} disabled={!creds.accessToken}>Fetch Devices</button>
        </div>
        {devices?.data?.length > 0 && (
          <ul className="device-list">
            {devices.data.map((d) => (
              <li key={d.id} className={selectedDevice === d.id ? 'selected' : ''} onClick={() => setSelectedDevice(d.id)}>
                <span className="device-name">{d.attributes?.name || 'Unnamed'}</span>
                <span className="device-id">{d.id.slice(0, 30)}...</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedDevice && (
        <section className="device-actions">
          <h2>Device: {selectedDevice.slice(0, 40)}...</h2>

          <LiveStream
            deviceId={selectedDevice}
            accessToken={creds.accessToken}
            onLog={addLog}
          />

          <PersonDetector
            deviceId={selectedDevice}
            accessToken={creds.accessToken}
            onLog={addLog}
          />

          <ClipDownloader
            deviceId={selectedDevice}
            accessToken={creds.accessToken}
            onLog={addLog}
          />

          <div className="actions" style={{ marginTop: 12 }}>
            <button onClick={() => handleDeviceAction('status')}>Status</button>
            <button onClick={() => handleDeviceAction('capabilities')}>Capabilities</button>
            <button onClick={() => handleDeviceAction('location')}>Location</button>
            <button onClick={() => handleDeviceAction('configurations')}>Configurations</button>
            <button onClick={() => setView('accessdrop')} aria-label="Open AccessDrop AI screen">
              AccessDrop AI
            </button>
          </div>
          {deviceDetail && (
            <pre className="json-output">{JSON.stringify(deviceDetail.data, null, 2)}</pre>
          )}
        </section>
      )}

      {loading && <div className="loading">{loading}</div>}
      {error && <div className="error">{error}</div>}

      <section className="log">
        <h2>Request Log</h2>
        <pre>{log.join('\n')}</pre>
      </section>
    </div>
  );
}

export default App;
