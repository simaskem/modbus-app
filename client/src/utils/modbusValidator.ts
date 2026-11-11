import {
    FlatChannel,
    FlatDatapoint,
    FlatStation,
    NormalizedState,
    RawDatapoint,
  } from '../types/modbus';
  
  const ALLOWED_FUNC_CODES = ['1', '2', '3', '4'];
  const ALLOWED_BAUDRATES = ['9600', '19200', '38400', '57600', '115200'];
  const IPV4_REGEX =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
  
  // Reikalingas reg_size pagal duomenų tipą
  export function getExpectedRegSize(dataType: string): number {
    if (['float32', 'uint32', 'int32'].includes(dataType)) return 2;
    if (['float64', 'uint64', 'int64'].includes(dataType)) return 4;
    return 1; // uint16, int16, bool ir kt.
  }
  
  // 1. Įrenginių (Stations) validacija
  export function validateStation(
    station: { name: string; station_addr: string; channelUid: string },
    allStations: Record<string, FlatStation>,
    channel: FlatChannel,
    ignoreStationUid?: string
  ): string | null {
    if (!station.name || !station.name.trim()) {
      return 'Įrenginio pavadinimas (name) negali būti tuščias.';
    }
  
    const addr = Number(station.station_addr);
    if (!Number.isInteger(addr) || addr < 1 || addr > 247) {
      return 'Modbus Slave Address privalo būti sveikasis skaičius nuo 1 iki 247 (0 yra draudžiamas).';
    }
  
    // Unikalumas RTU kanale
    if (channel.protocol === 'rtu') {
      const duplicate = Object.values(allStations).find(
        (s) =>
          s.channelUid === channel.uid &&
          s.uid !== ignoreStationUid &&
          Number(s.station_addr) === addr
      );
      if (duplicate) {
        return `RTU kanale "${channel.name}" jau yra įrenginys ("${duplicate.name}") su adresu ${addr}.`;
      }
    }
  
    return null;
  }
  
  // 2. Registrų (Datapoints) validacija + adresų persidengimo tikrinimas
  export function validateDatapoint(
    dp: Omit<RawDatapoint, 'id'>,
    stationDatapoints: FlatDatapoint[],
    ignoreDpUid?: string
  ): string | null {
    const start = Number(dp.start_addr);
    if (!Number.isInteger(start) || start < 0 || start > 65535) {
      return 'Start Address privalo būti sveikasis skaičius nuo 0 iki 65535.';
    }
  
    if (!ALLOWED_FUNC_CODES.includes(String(dp.func_code))) {
      return `Neteisingas Function Code (${dp.func_code}). Leistinos reikšmės: 1, 2, 3, 4.`;
    }
  
    const size = Number(dp.reg_size);
    const expectedSize = getExpectedRegSize(dp.data_type);
    if (size !== expectedSize) {
      return `Duomenų tipas "${dp.data_type}" reikalauja reg_size = ${expectedSize} (nurodyta: ${size}).`;
    }
  
    const scale = Number(dp.meta?.scale);
    if (isNaN(scale) || scale === 0) {
      return 'Skalė (scale) negali būti lygi 0.';
    }
  
    // Tikriname adresų persidengimą toje pačioje stotyje (su tuo pačiu func_code)
    const newEnd = start + size - 1;
    if (newEnd > 65535) {
      return 'Registro pabaigos adresas viršija maksimalią 65535 ribą.';
    }
  
    for (const existing of stationDatapoints) {
      if (existing.uid === ignoreDpUid) continue;
      if (existing.func_code !== dp.func_code) continue; // Skirtingų funkcijų (pvz. FC3 ir FC4) adresų erdvės atskiros
  
      const exStart = Number(existing.start_addr);
      const exEnd = exStart + Number(existing.reg_size) - 1;
  
      const overlaps = start <= exEnd && newEnd >= exStart;
      if (overlaps) {
        return `Adresų persidengimas! Adresai ${start}–${newEnd} kertasi su registru "${existing.meta.descr}" (${exStart}–${exEnd}).`;
      }
    }
  
    return null;
  }
  
  // 3. Kanalų (Channels TCP / RTU) validacija
  export function validateChannel(channel: FlatChannel): string | null {
    if (!channel.name || !channel.name.trim()) {
      return 'Kanalo pavadinimas negali būti tuščias.';
    }
  
    if (channel.protocol === 'tcp') {
      if (!channel.tcp_host || !IPV4_REGEX.test(channel.tcp_host.trim())) {
        return 'Neteisingas TCP Host IPv4 adreso formatas (pvz., 192.168.1.10).';
      }
      const port = Number(channel.tcp_port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return 'TCP Port privalo būti sveikasis skaičius nuo 1 iki 65535.';
      }
    } else {
      if (!channel.ser_port || !channel.ser_port.trim()) {
        return 'Serijinis portas (ser_port, pvz., /dev/ttyS2) negali būti tuščias.';
      }
      if (!ALLOWED_BAUDRATES.includes(String(channel.baudrate))) {
        return `Baudrate privalo būti vienas iš standartinių: ${ALLOWED_BAUDRATES.join(', ')}.`;
      }
    }
  
    return null;
  }
  
  // Visos konfigūracijos patikra (naudojama prieš Import / Save)
  export function validateFullState(state: NormalizedState): string | null {
    for (const ch of Object.values(state.channels)) {
      const chErr = validateChannel(ch);
      if (chErr) return `Kanalas "${ch.name}": ${chErr}`;
    }
  
    for (const st of Object.values(state.stations)) {
      const ch = state.channels[st.channelUid];
      if (!ch) return `Stotis "${st.name}" priskirta neegzistuojančiam kanalui.`;
      const stErr = validateStation(st, state.stations, ch, st.uid);
      if (stErr) return stErr;
  
      const stDps = Object.values(state.datapoints).filter((dp) => dp.stationUid === st.uid);
      for (const dp of stDps) {
        const dpErr = validateDatapoint(dp, stDps, dp.uid);
        if (dpErr) return `Stotis "${st.name}", registras ID ${dp.id}: ${dpErr}`;
      }
    }
  
    return null;
  }
  