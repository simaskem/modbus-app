import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSelection } from '../hooks/useSelection';
import { FlatDatapoint, FlatStation, RawDatapoint } from '../types/modbus';
import { AddRegisterModal } from './AddRegisterModal';
import { BulkDatapointBar } from './BulkDatapointBar';
import { DatapointRow } from './DatapointRow';
import { Button } from './ui/Button';

interface DatapointsTableProps {
  station: FlatStation | null;
  stations: Record<string, FlatStation>;
  datapoints: Record<string, FlatDatapoint>;
  onAddRegister: (stationUid: string, reg: Omit<RawDatapoint, 'id'>) => void;
  onCopyDatapointsToStation: (uids: string[], targetStationUid: string) => void;
  onBulkUpdateDatapoints: (
    uids: string[],
    field: 'acq_cycle' | 'func_code' | 'byte_order',
    value: string
  ) => void;
  onBulkDeleteDatapoints: (uids: string[]) => void;
}

const ROW_HEIGHT = 36;

export function DatapointsTable({
  station,
  stations,
  datapoints,
  onAddRegister,
  onCopyDatapointsToStation,
  onBulkUpdateDatapoints,
  onBulkDeleteDatapoints,
}: DatapointsTableProps) {
  const [search, setSearch] = useState('');
  const [showAllStations, setShowAllStations] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { selectedIds, toggle, toggleAll, clear } = useSelection();
  const parentRef = useRef<HTMLDivElement>(null);

  const stationDatapoints = useMemo(() => {
    if (!station) return [];
    return Object.values(datapoints).filter((dp) => dp.stationUid === station.uid);
  }, [datapoints, station]);

  const filteredDatapoints = useMemo(() => {
    const query = search.toLowerCase().trim();
    const baseList = showAllStations ? Object.values(datapoints) : stationDatapoints;
    if (!query) return baseList;

    return baseList.filter(
      (dp) =>
        dp.meta.descr.toLowerCase().includes(query) ||
        dp.start_addr.includes(query) ||
        dp.func_code.includes(query)
    );
  }, [datapoints, stationDatapoints, showAllStations, search]);

  const rowVirtualizer = useVirtualizer({
    count: filteredDatapoints.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (!station && !showAllStations) {
    return <main className="main-content">Pasirinkite arba sukurkite stotį kairėje pusėje.</main>;
  }

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  return (
    <main className="main-content">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <h3 style={{ margin: 0 }}>
          {showAllStations ? 'Visi įrenginio registrai' : `${station?.name} (Registrai)`}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showAllStations}
              onChange={(e) => {
                setShowAllStations(e.target.checked);
                clear();
              }}
            />
            Rodyti visų stočių registrus
          </label>
          {station && !showAllStations && (
            <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
              + Add Register
            </Button>
          )}
        </div>
      </div>

      <div className="table-toolbar">
        <input
          className="input"
          style={{ width: '240px' }}
          placeholder="Ieškoti pagal aprašymą, adresą, FC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span style={{ color: '#6b7280' }}>Rasta: {filteredDatapoints.length}</span>

        <BulkDatapointBar
          selectedCount={selectedIds.size}
          stations={stations}
          onApply={(field, value) => {
            onBulkUpdateDatapoints(Array.from(selectedIds), field, value);
            clear();
          }}
          onCopyToStation={(targetStationUid) => {
            onCopyDatapointsToStation(Array.from(selectedIds), targetStationUid);
            clear();
          }}
          onDeleteSelected={() => {
            onBulkDeleteDatapoints(Array.from(selectedIds));
            clear();
          }}
        />
      </div>

      <div ref={parentRef} className="virtual-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}>
                <input
                  type="checkbox"
                  checked={
                    filteredDatapoints.length > 0 && selectedIds.size === filteredDatapoints.length
                  }
                  onChange={() => toggleAll(filteredDatapoints.map((dp) => dp.uid))}
                />
              </th>
              <th style={{ width: '60px' }}>ID</th>
              <th style={{ width: '80px' }}>Addr</th>
              <th style={{ width: '70px' }}>FC</th>
              <th style={{ width: '90px' }}>Type</th>
              <th style={{ width: '90px' }}>Cycle</th>
              <th>Description</th>
              <th style={{ width: '80px' }}>Units</th>
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td colSpan={8} style={{ height: `${paddingTop}px`, padding: 0 }} />
              </tr>
            )}
            {virtualItems.map((virtualRow) => {
              const dp = filteredDatapoints[virtualRow.index];
              return (
                <DatapointRow
                  key={dp.uid}
                  datapoint={dp}
                  isChecked={selectedIds.has(dp.uid)}
                  height={ROW_HEIGHT}
                  onToggleCheck={toggle}
                />
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td colSpan={8} style={{ height: `${paddingBottom}px`, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAddModalOpen && station && (
        <AddRegisterModal
          existingDatapoints={stationDatapoints}
          onAdd={(reg) => onAddRegister(station.uid, reg)}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}
    </main>
  );
}
