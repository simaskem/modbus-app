import { useRef, useState } from 'react';
import { useModbusConfig } from './hooks/useModbusConfig';
import { denormalizeConfig } from './utils/configTransformer';
import { ChannelSettingsModal } from './components/config/ChannelSettingsModal';
import { DatapointsTable } from './components/config/DatapointsTable';
import { MonitoringDashboard } from './components/monitoring/MonitoringDashboard';
import { Sidebar } from './components/config/Sidebar';
import { Button } from './components/ui/Button';

export function App() {
  const [activeTab, setActiveTab] = useState<'config' | 'monitoring'>('config');

  const {
    state,
    error,
    isSaving,
    selectedStationUid,
    setSelectedStationUid,
    editingChannelUid,
    setEditingChannelUid,
    updateChannel,
    addDevice,
    deleteDevice,
    moveStations,
    addRegister,
    copyDatapointsToStation,
    bulkUpdateDatapoints,
    bulkDeleteDatapoints,
    importJsonConfig,
    saveConfig,
  } = useModbusConfig();

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (error) return <div style={{ padding: '20px', color: 'red' }}>Klaida: {error}</div>;
  if (!state) return <div style={{ padding: '20px' }}>Kraunama konfigūracija...</div>;

  const activeStation = selectedStationUid ? state.stations[selectedStationUid] || null : null;
  const editingChannel = editingChannelUid ? state.channels[editingChannelUid] || null : null;

  const handleExportJson = () => {
    const raw = denormalizeConfig(state);
    const blob = new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modbus_config_export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        importJsonConfig(parsed);
      } catch {
        alert('Netinkamas JSON failo formatas!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>Modbus Gateway</h2>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Button
              variant={activeTab === 'config' ? 'primary' : 'default'}
              onClick={() => setActiveTab('config')}
            >
              Configuration
            </Button>
            <Button
              variant={activeTab === 'monitoring' ? 'primary' : 'default'}
              onClick={() => setActiveTab('monitoring')}
            >
              Monitoring Dashboard
            </Button>
          </div>
        </div>

        {activeTab === 'config' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <Button onClick={() => fileInputRef.current?.click()}>Import JSON</Button>
            <Button onClick={handleExportJson}>Export JSON</Button>
            <Button variant="success" onClick={saveConfig} disabled={isSaving}>
              {isSaving ? 'Saugoma...' : 'Save Configuration'}
            </Button>
          </div>
        )}
      </header>

      <div className="app-body">
        {activeTab === 'config' ? (
          <>
            <Sidebar
              channels={state.channels}
              stations={state.stations}
              selectedStationUid={selectedStationUid}
              onSelectStation={setSelectedStationUid}
              onEditChannel={setEditingChannelUid}
              onAddDevice={addDevice}
              onDeleteDevice={deleteDevice}
              onMoveStations={moveStations}
            />

            <DatapointsTable
              station={activeStation}
              stations={state.stations}
              datapoints={state.datapoints}
              onAddRegister={addRegister}
              onCopyDatapointsToStation={copyDatapointsToStation}
              onBulkUpdateDatapoints={bulkUpdateDatapoints}
              onBulkDeleteDatapoints={bulkDeleteDatapoints}
            />
          </>
        ) : (
          <MonitoringDashboard state={state} isActive={activeTab === 'monitoring'} />
        )}
      </div>

      {editingChannel && (
        <ChannelSettingsModal
          channel={editingChannel}
          onSave={updateChannel}
          onClose={() => setEditingChannelUid(null)}
        />
      )}
    </div>
  );
}

export default App;
