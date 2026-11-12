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

export function UPlotChart({ series, history, unitLabel, timeRangeMinutes }: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const rangeSecRef = useRef<number>(timeRangeMinutes * 60);

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
          size: 7,
          fill: s.color,
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
              return [nowSec, nowSec + windowSec];
            }

            if (dataMax - dataMin < windowSec) {
              return [dataMin, dataMin + windowSec];
            }

            return [dataMax - windowSec, dataMax];
          },
        },
      },
    };

    const emptyData: uPlot.AlignedData = [
      [],
      ...series.map(() => []),
    ];

    uplotRef.current = new uPlot(opts, emptyData, containerRef.current);

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

    if (series.length === 0) {
      uplotRef.current.setData([[]]);
      return;
    }

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
    const alignedData: uPlot.AlignedData = [
      sortedTimestamps,
      ...seriesMaps.map((map) => sortedTimestamps.map((ts) => map.get(ts) ?? null)),
    ];

    uplotRef.current.setData(alignedData);
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
