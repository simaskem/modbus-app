import { useState } from 'react';
import { FlatStation } from '../types/modbus';
import { Button } from './ui/Button';

type EditableField = 'acq_cycle' | 'func_code' | 'byte_order';

interface BulkDatapointBarProps {
  selectedCount: number;
  stations: Record<string, FlatStation>;
  onApply: (field: EditableField, value: string) => void;
  onCopyToStation: (targetStationUid: string) => void;
  onDeleteSelected: () => void;
}

export function BulkDatapointBar({
  selectedCount,
  stations,
  onApply,
  onCopyToStation,
  onDeleteSelected,
}: BulkDatapointBarProps) {
  const [field, setField] = useState<EditableField>('acq_cycle');
  const [value, setValue] = useState('');
  const [targetStation, setTargetStation] = useState('');

  if (selectedCount === 0) return null;

  const handleApply = () => {
    if (!value.trim()) return;
    onApply(field, value.trim());
    setValue('');
  };

  const handleCopy = () => {
    if (!targetStation) return;
    onCopyToStation(targetStation);
    setTargetStation('');
  };

  const handleDelete = () => {
    if (confirm(`Ar tikrai ištrinti ${selectedCount} pažymėtus registrus?`)) {
      onDeleteSelected();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginLeft: 'auto',
        backgroundColor: '#eff6ff',
        padding: '6px 10px',
        borderRadius: '4px',
        border: '1px solid #bfdbfe',
      }}
    >
      <strong style={{ color: '#1e40af' }}>Pažymėta ({selectedCount}):</strong>

      {/* Masinis laukų redagavimas */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <select
          className="select"
          value={field}
          onChange={(e) => setField(e.target.value as EditableField)}
        >
          <option value="acq_cycle">Acq Cycle (ms)</option>
          <option value="func_code">Function Code</option>
          <option value="byte_order">Byte Order</option>
        </select>
        <input
          className="input"
          style={{ width: '95px' }}
          placeholder="Reikšmė..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button variant="primary" disabled={!value.trim()} onClick={handleApply}>
          Pakeisti
        </Button>
      </div>

      <span style={{ color: '#93c5fd' }}>|</span>

      {/* Kopijavimas į kitą stotį */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <select
          className="select"
          value={targetStation}
          onChange={(e) => setTargetStation(e.target.value)}
        >
          <option value="">Kopijuoti į įrenginį...</option>
          {Object.values(stations).map((st) => (
            <option key={st.uid} value={st.uid}>
              {st.name} (Addr: {st.station_addr})
            </option>
          ))}
        </select>
        <Button variant="primary" disabled={!targetStation} onClick={handleCopy}>
          Kopijuoti
        </Button>
      </div>

      <span style={{ color: '#93c5fd' }}>|</span>

      <Button
        style={{ backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
        onClick={handleDelete}
      >
        Ištrinti
      </Button>
    </div>
  );
}
