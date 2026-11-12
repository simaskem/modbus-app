import { useMemo, useState } from 'react';
import { useDeviceMonitoring } from '../../hooks/useDeviceMonitoring';
import { FlatDatapoint, NormalizedState } from '../../types/modbus';
import { ChartSeriesConfig, UPlotChart } from './UPlotChart';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface MonitoringDashboardProps {
  state: NormalizedState;
  isActive: boolean;
}

interface UnitCategory {
  id: string;
  label: string;
  matchUnits: string[];
}

const UNIT_CATEGORIES: UnitCategory[] = [
  { id: 'volts', label: 'Volts', matchUnits: ['v', 'volt', 'volts'] },
  { id: 'amps', label: 'Amps', matchUnits: ['a', 'amp', 'amps'] },
  { id: 'kw', label: 'kW', matchUnits: ['kw'] },
  { id: 'kva', label: 'kVA', matchUnits: ['kva'] },
  { id: 'kvar', label: 'kVAr', matchUnits: ['kvar'] },
  { id: 'energy', label: 'Energy', matchUnits: ['kwh', 'wh', 'mwh'] },
];

const LINE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];
const MAX_LINES = 6;
const TIME_RANGES =[1, 3, 5, 10];

// Pagalbinė funkcija ilgiems įrenginių ir registrų pavadinimams sutrumpinti
function formatShortLabel(stationName: string, descr: string): string {
  // Sutrumpiname įrenginio pavadinimą: "Electricity Meter Ser. EM1254" -> "EM1254"
  const serMatch = stationName.match(/Ser\.\s*([^\s]+)/i);
  const shortStation = serMatch
    ? serMatch[1]
    : stationName.length > 14
    ? `${stationName.slice(0, 14)}…`
    : stationName;

  // Sutrumpiname aprašymą: "Phase 1 line to neutral volts" -> "Phase 1"
  let shortDescr = descr
    .replace(/\s*line to neutral.*/i, '')
    .replace(/\s*line to line.*/i, ' (L-L)')
    .replace(/\s*total system\s*/i, 'Total ')
    .replace(/\s*(volts|amps|watts|volt amps|reactive power|kwh)\s*$/i, '')
    .trim();

  if (shortDescr.length > 22) {
    shortDescr = `${shortDescr.slice(0, 22)}…`;
  }

  return `${shortStation}: ${shortDescr || descr}`;
}

export function MonitoringDashboard({ state, isActive }: MonitoringDashboardProps) {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedDpUids, setSelectedDpUids] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<number>(3);

  // Filtruojame TIK įjungtų (enable === 'true') kanalų registrus
  const datapointsByCategory = useMemo(() => {
    const map: Record<string, FlatDatapoint[]> = {};
    UNIT_CATEGORIES.forEach((c) => (map[c.id] = []));

    Object.values(state.datapoints).forEach((dp) => {
      const st = state.stations[dp.stationUid];
      const ch = st ? state.channels[st.channelUid] : null;
      if (!ch || ch.enable !== 'true') return; // Praleidžiame išjungtus kanalus

      const unit = (dp.meta?.units || '').trim().toLowerCase();
      const cat = UNIT_CATEGORIES.find((c) => c.matchUnits.includes(unit));
      if (cat) map[cat.id].push(dp);
    });

    return map;
  }, [state]);

  const activeCategory = UNIT_CATEGORIES.find((c) => c.id === selectedUnitId) || null;
  const availableDatapoints = selectedUnitId ? datapointsByCategory[selectedUnitId] || [] : [];

  const { latestValues, history, isConnected } = useDeviceMonitoring(
    state,
    isActive,
    selectedDpUids,
    timeRange
  );

  // Pasirinkus matavimo vienetą nieko automatiškai nežymime – vartotojas renkasi pats
  const handleSelectCategory = (catId: string) => {
    setSelectedUnitId(catId);
    setSelectedDpUids([]);
  };

  const toggleDatapoint = (uid: string) => {
    setSelectedDpUids((prev) => {
      if (prev.includes(uid)) return prev.filter((id) => id !== uid);
      if (prev.length >= MAX_LINES) {
        alert(`Viename grafike galima palyginti ne daugiau nei ${MAX_LINES} registrus.`);
        return prev;
      }
      return [...prev, uid];
    });
  };

  const maxSelectable = Math.min(availableDatapoints.length, MAX_LINES);
  const isAllMaxSelected = maxSelectable > 0 && selectedDpUids.length === maxSelectable;

  const handleToggleSelectAll = () => {
    if (isAllMaxSelected) {
      setSelectedDpUids([]);
    } else {
      setSelectedDpUids(availableDatapoints.slice(0, MAX_LINES).map((d) => d.uid));
    }
  };

  const chartSeries: ChartSeriesConfig[] = useMemo(() => {
    return selectedDpUids
      .map((uid, idx) => {
        const dp = state.datapoints[uid];
        if (!dp) return null;
        const st = state.stations[dp.stationUid];
        return {
          uid,
          label: formatShortLabel(st?.name || 'Device', dp.meta.descr),
          color: LINE_COLORS[idx % LINE_COLORS.length],
        };
      })
      .filter((s): s is ChartSeriesConfig => s !== null);
  }, [selectedDpUids, state]);

  return (
    <main className="main-content" style={{ gap: '14px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {UNIT_CATEGORIES.map((cat) => {
            const count = datapointsByCategory[cat.id]?.length || 0;
            const isDisabled = count === 0;
            return (
              <Button
                key={cat.id}
                variant={selectedUnitId === cat.id ? 'primary' : 'default'}
                disabled={isDisabled}
                title={
                  isDisabled
                    ? 'Aktyviuose kanaluose šio vieneto registrų nėra'
                    : `Aktyvių registrų skaičius: ${count}`
                }
                onClick={() => handleSelectCategory(cat.id)}
              >
                {cat.label} ({count})
              </Button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#6b7280', fontSize: '12px' }}>Laiko langas:</span>
            {TIME_RANGES.map((min) => (
              <Button
                key={min}
                variant={timeRange === min ? 'primary' : 'default'}
                style={{ padding: '4px 8px' }}
                onClick={() => setTimeRange(min)}
              >
                {min} min
              </Button>
            ))}
          </div>

          <Badge variant={isConnected ? 'success' : 'danger'}>
            {isConnected ? 'WS: Aktyvus' : 'WS: Neprisijungęs'}
          </Badge>
        </div>
      </div>

      {!activeCategory ? (
        <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: '6px', color: '#6b7280' }}>
          Pasirinkite vieną iš matavimo vienetų mygtukų viršuje (pvz., <strong>Volts</strong> arba <strong>Amps</strong>), kad galėtumėte pasirinkti registrus.
        </div>
      ) : (
        <>
          <UPlotChart
            series={chartSeries}
            history={history}
            unitLabel={activeCategory.label}
            timeRangeMinutes={timeRange}
          />

          {chartSeries.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {chartSeries.map((s) => {
                const dp = state.datapoints[s.uid];
                const val = latestValues[s.uid];
                return (
                  <div
                    key={s.uid}
                    style={{
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      borderLeft: `4px solid ${s.color}`,
                      borderRadius: '4px',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', color: s.color }}>
                      {val !== undefined ? `${val} ${dp?.meta.units}` : 'Laukiama...'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                      Ciklas: {dp?.acq_cycle} ms | Addr: {dp?.start_addr}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <h4 style={{ margin: '0 0 8px 0' }}>
              Pasirinkite registrus grafike ({activeCategory.label} — pažymėta {selectedDpUids.length}/{MAX_LINES}):
            </h4>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', maxHeight: '220px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>
                        <input
                        type="checkbox"
                        checked={isAllMaxSelected}
                        onChange={handleToggleSelectAll}
                        title={`Pažymėti pirmus ${maxSelectable}`}
                        />
                    </th>
                    <th>Įrenginys / Kanalas</th>
                    <th>Registras</th>
                    <th style={{ width: '80px' }}>Addr</th>
                    <th style={{ width: '90px' }}>Cycle</th>
                    <th style={{ width: '110px' }}>Reikšmė</th>
                  </tr>
                </thead>
                <tbody>
                  {availableDatapoints.map((dp) => {
                    const st = state.stations[dp.stationUid];
                    const ch = st ? state.channels[st.channelUid] : null;
                    const isChecked = selectedDpUids.includes(dp.uid);
                    const liveVal = latestValues[dp.uid];

                    return (
                      <tr
                        key={dp.uid}
                        className={isChecked ? 'checked' : ''}
                        style={{ height: '34px', cursor: 'pointer' }}
                        onClick={() => toggleDatapoint(dp.uid)}
                      >
                        <td>
                          <input type="checkbox" checked={isChecked} onChange={() => {}} />
                        </td>
                        <td>
                          {st?.name} <span style={{ color: '#6b7280' }}>({ch?.name})</span>
                        </td>
                        <td>{dp.meta.descr}</td>
                        <td>{dp.start_addr}</td>
                        <td>{dp.acq_cycle} ms</td>
                        <td style={{ fontWeight: 600 }}>
                          {isChecked
                            ? liveVal !== undefined
                              ? `${liveVal} ${dp.meta.units}`
                              : '...'
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}