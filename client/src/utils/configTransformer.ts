import {
    FlatChannel,
    NormalizedState,
    ProtocolType,
    RawDatapoint,
    RawModbusConfig,
    RawSerialChannel,
    RawStation,
    RawTcpChannel,
  } from '../types/modbus';
  
  export function normalizeConfig(raw: RawModbusConfig): NormalizedState {
    const state: NormalizedState = {
      channels: {},
      stations: {},
      datapoints: {},
    };
  
    let counter = 1;
    const nextUid = (prefix: string): string => `${prefix}_${counter++}`;
  
    const processProtocol = (
      list: (RawTcpChannel | RawSerialChannel)[] = [],
      protocol: ProtocolType
    ) => {
      for (const ch of list) {
        const channelUid = nextUid(protocol);
        const { stations = [], ...channelFields } = ch;
  
        state.channels[channelUid] = {
          ...channelFields,
          uid: channelUid,
          protocol,
        };
  
        for (const st of stations) {
          const stationUid = nextUid('st');
          const { datapoints = [], ...stationFields } = st;
  
          state.stations[stationUid] = {
            ...stationFields,
            uid: stationUid,
            channelUid,
          };
  
          for (const dp of datapoints) {
            const dpUid = nextUid('dp');
            state.datapoints[dpUid] = {
              ...dp,
              meta: { ...dp.meta }, // Sukuriame švarią meta objekto kopiją
              uid: dpUid,
              stationUid,
            };
          }
        }
      }
    };
  
    processProtocol(raw.modbus_tcp, 'tcp');
    processProtocol(raw.modbus_ser, 'rtu');
  
    return state;
  }
  
  export function denormalizeConfig(state: NormalizedState): RawModbusConfig {
    const modbus_tcp: RawTcpChannel[] = [];
    const modbus_ser: RawSerialChannel[] = [];
  
    // 1. Sugrupuojame registrus pagal stotį
    const dpsByStation: Record<string, RawDatapoint[]> = {};
    Object.values(state.datapoints).forEach(({ uid, stationUid, ...cleanDp }) => {
      if (!dpsByStation[stationUid]) {
        dpsByStation[stationUid] = [];
      }
      dpsByStation[stationUid].push(cleanDp);
    });
  
    // 2. Sugrupuojame stotis pagal kanalą
    const stationsByChannel: Record<string, RawStation[]> = {};
    Object.values(state.stations).forEach(({ uid, channelUid, ...cleanSt }) => {
      if (!stationsByChannel[channelUid]) {
        stationsByChannel[channelUid] = [];
      }
      stationsByChannel[channelUid].push({
        ...cleanSt,
        datapoints: dpsByStation[uid] || [],
      });
    });
  
    // 3. Surenkame kanalus atgal į pradinį formatą
    Object.values(state.channels).forEach((ch: FlatChannel) => {
      const { uid, protocol, ...cleanCh } = ch;
      const stations = stationsByChannel[uid] || [];
  
      if (protocol === 'tcp') {
        modbus_tcp.push({
          ...(cleanCh as Omit<RawTcpChannel, 'stations'>),
          stations,
        });
      } else {
        modbus_ser.push({
          ...(cleanCh as Omit<RawSerialChannel, 'stations'>),
          stations,
        });
      }
    });
  
    return { modbus_tcp, modbus_ser };
  }
  