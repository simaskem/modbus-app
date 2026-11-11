// ==========================================
// 1. PRADINIO JSON FAILO TIPAI (Raw API / Disk)
// ==========================================

export interface RawDatapointMeta {
    descr: string;
    scale: string;
    units: string;
  }
  
  export interface RawDatapoint {
    id: string;
    start_addr: string;
    reg_size: string;
    data_type: string;
    byte_order: string;
    func_code: string;
    acq_cycle: string;
    meta: RawDatapointMeta;
  }
  
  export interface RawStation {
    id: string;
    station_addr: string;
    name: string;
    datapoints: RawDatapoint[];
  }
  
  export interface RawBaseChannel {
    channel_id: string;
    name: string;
    conn_type: string;
    request_retries: string;
    request_timeout: string;
    connect_retries: string;
    connect_timeout: string;
    enable: string;
    stations: RawStation[];
  }
  
  export interface RawTcpChannel extends RawBaseChannel {
    tcp_host: string;
    tcp_port: string;
  }
  
  export interface RawSerialChannel extends RawBaseChannel {
    ser_port: string;
    baudrate: string;
    stopbits: string;
    bytesize: string;
    parity: string;
  }
  
  export interface RawModbusConfig {
    modbus_tcp?: RawTcpChannel[];
    modbus_ser?: RawSerialChannel[];
  }
  
  // ==========================================
  // 2. PLOKŠČIOS BŪSENOS TIPAI (Normalized UI State)
  // ==========================================
  
  export type ProtocolType = 'tcp' | 'rtu';
  
  export interface FlatChannel {
    uid: string;
    protocol: ProtocolType;
    channel_id: string;
    name: string;
    conn_type: string;
    request_retries: string;
    request_timeout: string;
    connect_retries: string;
    connect_timeout: string;
    enable: string;
    // TCP specifiniai laukai (neprivalomi, nes RTU jų neturi)
    tcp_host?: string;
    tcp_port?: string;
    // RTU / Serial specifiniai laukai (neprivalomi, nes TCP jų neturi)
    ser_port?: string;
    baudrate?: string;
    stopbits?: string;
    bytesize?: string;
    parity?: string;
  }
  
  export interface FlatStation {
    uid: string;
    channelUid: string; // Nuoroda į FlatChannel.uid
    id: string;
    station_addr: string;
    name: string;
  }
  
  export interface FlatDatapoint extends RawDatapoint {
    uid: string;
    stationUid: string; // Nuoroda į FlatStation.uid
  }
  
  export interface NormalizedState {
    channels: Record<string, FlatChannel>;
    stations: Record<string, FlatStation>;
    datapoints: Record<string, FlatDatapoint>;
  }
  