import { useMemo, useState } from 'react';
import { StationItem } from './StationItem';
import { useSelection } from '../../hooks/useSelection';
import { FlatChannel, FlatStation, ProtocolType } from '../../types/modbus';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface SidebarProps {
  channels: Record<string, FlatChannel>;
  stations: Record<string, FlatStation>;
  selectedStationUid: string | null;
  onSelectStation: (stationUid: string | null) => void;
  onEditChannel: (channelUid: string) => void;
  onAddDevice: (channelUid: string, name: string, stationAddr: string) => void;
  onDeleteDevice: (stationUid: string) => void;
  onMoveStations: (stationUids: string[], targetChannelUid: string) => void;
}

export function Sidebar({
  channels,
  stations,
  selectedStationUid,
  onSelectStation,
  onEditChannel,
  onAddDevice,
  onDeleteDevice,
  onMoveStations,
}: SidebarProps) {
  const [protocolFilter, setProtocolFilter] = useState<'all' | ProtocolType>('all');
  const [targetChannel, setTargetChannel] = useState('');
  const { selectedIds, toggle, clear } = useSelection();

  const channelList = useMemo(
    () =>
      Object.values(channels).filter(
        (ch) => protocolFilter === 'all' || ch.protocol === protocolFilter
      ),
    [channels, protocolFilter]
  );

  const stationsByChannel = useMemo(() => {
    const map: Record<string, FlatStation[]> = {};
    Object.values(stations).forEach((st) => {
      if (!map[st.channelUid]) map[st.channelUid] = [];
      map[st.channelUid].push(st);
    });
    return map;
  }, [stations]);

  const handleProtocolChange = (proto: 'all' | ProtocolType) => {
    setProtocolFilter(proto);

    const visibleChannels = Object.values(channels).filter(
      (ch) => proto === 'all' || ch.protocol === proto
    );
    const visibleChannelIds = new Set(visibleChannels.map((c) => c.uid));
    const visibleStations = Object.values(stations).filter((st) =>
      visibleChannelIds.has(st.channelUid)
    );

    const isCurrentStillVisible = visibleStations.some((st) => st.uid === selectedStationUid);
    if (!isCurrentStillVisible) {
      const [nextStation] = visibleStations;
      onSelectStation(nextStation ? nextStation.uid : null);
    }
  };

  const handleBulkMove = () => {
    if (!targetChannel || selectedIds.size === 0) return;
    onMoveStations(Array.from(selectedIds), targetChannel);
    clear();
    setTargetChannel('');
  };

  const handleCreateDevice = (channelUid: string) => {
    const name = prompt('Įveskite naujo įrenginio pavadinimą:', 'Electricity Meter');
    if (!name) return;
    const addr = prompt('Įveskite Modbus Slave Address (1-247):', '1');
    if (!addr) return;
    onAddDevice(channelUid, name.trim(), addr.trim());
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-filters">
        {(['all', 'tcp', 'rtu'] as const).map((proto) => (
          <Button
            key={proto}
            variant={protocolFilter === proto ? 'primary' : 'default'}
            style={{ flex: 1, textTransform: 'uppercase' }}
            onClick={() => handleProtocolChange(proto)}
          >
            {proto}
          </Button>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="bulk-bar">
          <div style={{ fontWeight: 600, color: '#1e40af' }}>
            Pažymėta stočių: {selectedIds.size}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <select
              className="select"
              style={{ flex: 1 }}
              value={targetChannel}
              onChange={(e) => setTargetChannel(e.target.value)}
            >
              <option value="">Perkelti į kanalą...</option>
              {Object.values(channels).map((ch) => (
                <option key={ch.uid} value={ch.uid}>
                  [{ch.protocol.toUpperCase()}] {ch.name}
                </option>
              ))}
            </select>
            <Button variant="primary" disabled={!targetChannel} onClick={handleBulkMove}>
              Perkelti
            </Button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {channelList.map((ch) => {
          const chStations = stationsByChannel[ch.uid] || [];
          return (
            <div key={ch.uid} style={{ marginBottom: '14px' }}>
              <div
                style={{
                  fontWeight: 600,
                  color: '#4b5563',
                  padding: '4px 6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  [{ch.protocol.toUpperCase()}] {ch.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <Badge variant={ch.enable === 'true' ? 'success' : 'danger'}>
                    {ch.enable === 'true' ? 'ON' : 'OFF'}
                  </Badge>
                  <Button
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                    onClick={() => handleCreateDevice(ch.uid)}
                    title="Pridėti naują įrenginį"
                  >
                    + Device
                  </Button>
                  <Button
                    style={{ padding: '2px 6px', fontSize: '11px' }}
                    onClick={() => onEditChannel(ch.uid)}
                    title="Redaguoti kanalo parametrus"
                  >
                    ⚙
                  </Button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                {chStations.length === 0 ? (
                  <div style={{ color: '#9ca3af', paddingLeft: '12px' }}>Nėra stočių</div>
                ) : (
                  chStations.map((st) => (
                    <StationItem
                      key={st.uid}
                      station={st}
                      isSelected={st.uid === selectedStationUid}
                      isChecked={selectedIds.has(st.uid)}
                      onSelect={onSelectStation}
                      onToggleCheck={toggle}
                      onDelete={onDeleteDevice}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
