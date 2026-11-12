import { memo } from 'react';
import { FlatStation } from '../../types/modbus';

interface StationItemProps {
  station: FlatStation;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (uid: string) => void;
  onToggleCheck: (uid: string) => void;
  onDelete: (uid: string) => void;
}

export const StationItem = memo(function StationItem({
  station,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
  onDelete,
}: StationItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Ar tikrai ištrinti įrenginį "${station.name}" ir visus jo registrus?`)) {
      onDelete(station.uid);
    }
  };

  return (
    <div
      className={`station-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(station.uid)}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => onToggleCheck(station.uid)}
        onClick={(e) => e.stopPropagation()}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            fontWeight: isSelected ? 600 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {station.name}
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280' }}>
          Addr: {station.station_addr} | ID: {station.id}
        </div>
      </div>
      <button
        onClick={handleDelete}
        title="Ištrinti įrenginį"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#9ca3af',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '12px',
        }}
      >
        ✕
      </button>
    </div>
  );
});
