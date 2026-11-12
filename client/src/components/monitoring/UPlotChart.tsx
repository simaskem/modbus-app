import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { TimeSeriesPoint } from '../../hooks/useDeviceMonitoring';

export interface ChartSeriesConfig {
  uid: string;
  label: string;
  color: string;
}

interface UPlotChartProps {
  series: ChartSeriesConfig[];
  history: Record<string, TimeSeriesPoint[]>;
  unitLabel: string;
  timeRangeMinutes: number;
}

function buildAlignedData(
  series: ChartSeriesConfig[],
  history: Record<string, TimeSeriesPoint[]>
): uPlot.AlignedData {
  if (series.length === 0) return [Array.of<number>()];

  const timestampSet = new Set<number>();
  const seriesMaps = series.map((s) => {
    const map = new Map<number, number>();
    (history[s.uid] || []).forEach((pt) => {
      const sec = Math.floor(pt.timestamp);
      timestampSet.add(sec);
      map.set(sec, pt.value);
    });
    return map;
  });

  const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

  // Jei yra tik 1 taškas, pridedame antrą tuščią laiko žymę (+1s),
  // kad uPlot iškart nupieštų pirmąjį apskritimą nelaukdamas antro matavimo
  if (sortedTimestamps.length === 1) {
    const [firstTs] = sortedTimestamps;
    sortedTimestamps.push(firstTs + 1);
  }

  return [
    sortedTimestamps,
    ...seriesMaps.map((map) => sortedTimestamps.map((ts) => map.get(ts) ?? null)),
  ];
}

export function UPlotChart({ series, history, unitLabel, timeRangeMinutes }: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const rangeSecRef = useRef<number>(timeRangeMinutes * 60);
  const historyRef = useRef(history);

  historyRef.current = history;

  useEffect(() => {
    rangeSecRef.current = timeRangeMinutes * 60;
  }, [timeRangeMinutes]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (uplotRef.current) {
      uplotRef.current.destroy();
      uplotRef.current = null;
    }

    const uSeries: uPlot.Series[] = [
      { label: 'Laikas' },
      ...series.map((s) => ({
        label: s.label,
        stroke: s.color,
        width: 2,
        spanGaps: true,
        points: {
          show: () => true,
          size: 8,
          fill: s.color,
          stroke: s.color,
        },
        value: (_self: uPlot, rawVal: number | null) =>
          rawVal == null ? '--' : `${rawVal.toFixed(2)} ${unitLabel}`,
      })),
    ];

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth || 700,
      height: 280,
      series: uSeries,
      axes: [
        {},
        {
          label: unitLabel,
          size: 65,
        },
      ],
      scales: {
        x: {
          time: true,
          range: (_u, dataMin, dataMax) => {
            const windowSec = rangeSecRef.current;
            const nowSec = Math.floor(Date.now() / 1000);

            if (!isFinite(dataMin) || !isFinite(dataMax)) {
              return [nowSec - 2, nowSec + windowSec];
            }

            if (dataMax - dataMin < windowSec) {
              return [dataMin - 2, dataMin + windowSec];
            }

            return [dataMax - windowSec, dataMax + 2];
          },
        },
      },
    };

    const initialData = buildAlignedData(series, historyRef.current);
    uplotRef.current = new uPlot(opts, initialData, containerRef.current);

    const handleResize = () => {
      if (containerRef.current && uplotRef.current) {
        uplotRef.current.setSize({
          width: containerRef.current.clientWidth,
          height: 280,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      uplotRef.current?.destroy();
      uplotRef.current = null;
    };
  }, [series, unitLabel]);

  useEffect(() => {
    if (!uplotRef.current) return;
    uplotRef.current.setData(buildAlignedData(series, history));
  }, [history, series, timeRangeMinutes]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        padding: '8px',
        backgroundColor: '#ffffff',
      }}
    />
  );
}
