import { ModbusConfig } from './configStore.js';

const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const ALLOWED_BAUDRATES = ['9600', '19200', '38400', '57600', '115200'];
const ALLOWED_FC = ['1', '2', '3', '4'];

export function validateModbusConfig(config: ModbusConfig): string | null {
  if (!config || (!Array.isArray(config.modbus_tcp) && !Array.isArray(config.modbus_ser))) {
    return 'Invalid root structure: expected modbus_tcp or modbus_ser arrays';
  }

  for (const ch of config.modbus_tcp || []) {
    if (!IPV4_REGEX.test(ch.tcp_host || '')) return `Invalid TCP host: ${ch.tcp_host}`;
    const port = Number(ch.tcp_port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return `Invalid TCP port: ${ch.tcp_port}`;
    const stErr = validateStations(ch.stations || [], false);
    if (stErr) return stErr;
  }

  for (const ch of config.modbus_ser || []) {
    if (!ch.ser_port?.trim()) return 'Serial port cannot be empty';
    if (!ALLOWED_BAUDRATES.includes(String(ch.baudrate))) return `Invalid baudrate: ${ch.baudrate}`;
    const stErr = validateStations(ch.stations || [], true);
    if (stErr) return stErr;
  }

  return null;
}

function validateStations(stations: any[], isRtu: boolean): string | null {
  const seenAddresses = new Set<number>();

  for (const st of stations) {
    if (!st.name?.trim()) return 'Station name is required';
    const addr = Number(st.station_addr);
    if (!Number.isInteger(addr) || addr < 1 || addr > 247) {
      return `Invalid station_addr ${st.station_addr} (must be 1-247)`;
    }
    if (isRtu) {
      if (seenAddresses.has(addr)) return `Duplicate RTU station_addr: ${addr}`;
      seenAddresses.add(addr);
    }

    const rangesByFc: Record<string, [number, number][]> = {};
    for (const dp of st.datapoints || []) {
      const start = Number(dp.start_addr);
      const size = Number(dp.reg_size);
      if (!Number.isInteger(start) || start < 0 || start > 65535) return `Invalid start_addr: ${dp.start_addr}`;
      if (!ALLOWED_FC.includes(String(dp.func_code))) return `Invalid func_code: ${dp.func_code}`;
      if (Number(dp.meta?.scale) === 0) return 'Register scale cannot be 0';

      const end = start + size - 1;
      const fc = String(dp.func_code);
      if (!rangesByFc[fc]) rangesByFc[fc] = [];

      for (const [exStart, exEnd] of rangesByFc[fc]) {
        if (start <= exEnd && end >= exStart) {
          return `Register overlap in station "${st.name}": ${start}-${end} overlaps with ${exStart}-${exEnd}`;
        }
      }
      rangesByFc[fc].push([start, end]);
    }
  }
  return null;
}
