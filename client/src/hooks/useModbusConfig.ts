import { useCallback, useEffect, useState } from 'react';
import { configApi } from '../services/configApi';
import {
  FlatChannel,
  FlatDatapoint,
  NormalizedState,
  RawDatapoint,
  RawModbusConfig,
} from '../types/modbus';
import { normalizeConfig } from '../utils/configTransformer';
import { validateFullState, validateStation } from '../utils/modbusValidator';

export function useModbusConfig() {
  const [state, setState] = useState<NormalizedState | null>(null);
  const [selectedStationUid, setSelectedStationUid] = useState<string | null>(null);
  const [editingChannelUid, setEditingChannelUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const normalized = await configApi.fetchConfig();
      setState(normalized);
      const [firstStation] = Object.keys(normalized.stations);
      setSelectedStationUid((prev) => (prev && normalized.stations[prev] ? prev : firstStation || null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Klaida kraunant duomenis');
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateChannel = useCallback(async (uid: string, updates: Partial<FlatChannel>) => {
    setState((prev) => {
      if (!prev || !prev.channels[uid]) return prev;
      const updated = { ...prev.channels[uid], ...updates };
      configApi.updateChannel(updated).catch((e) => alert(e.message));
      return { ...prev, channels: { ...prev.channels, [uid]: updated } };
    });
  }, []);

  const addDevice = useCallback(
    async (channelUid: string, name: string, stationAddr: string) => {
      if (!state) return;
      const channel = state.channels[channelUid];
      if (!channel) return;

      const validationErr = validateStation(
        { name, station_addr: stationAddr, channelUid },
        state.stations,
        channel
      );
      if (validationErr) {
        alert(`Validacijos klaida: ${validationErr}`);
        return;
      }

      const existingChannelStations = Object.values(state.stations).filter(
        (s) => s.channelUid === channelUid
      );
      const maxStationId = existingChannelStations.reduce(
        (max, s) => Math.max(max, Number(s.id) || 0),
        0
      );

      const created = await configApi.createDevice(channel, {
        id: String(maxStationId + 1),
        name,
        station_addr: stationAddr,
      });

      const newUid = `st_${Date.now()}`;
      setState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          stations: {
            ...prev.stations,
            [newUid]: {
              uid: newUid,
              channelUid,
              id: created.id,
              name: created.name,
              station_addr: created.station_addr,
            },
          },
        };
      });
      setSelectedStationUid(newUid);
    },
    [state]
  );

  const deleteDevice = useCallback(
    async (stationUid: string) => {
      if (!state) return;
      const station = state.stations[stationUid];
      const channel = station ? state.channels[station.channelUid] : null;
      if (!station || !channel) return;

      await configApi.deleteDevice(channel, station.id);
      setState((prev) => {
        if (!prev) return null;
        const nextStations = { ...prev.stations };
        delete nextStations[stationUid];

        const nextDatapoints = { ...prev.datapoints };
        Object.values(nextDatapoints).forEach((dp) => {
          if (dp.stationUid === stationUid) delete nextDatapoints[dp.uid];
        });
        return { ...prev, stations: nextStations, datapoints: nextDatapoints };
      });
      if (selectedStationUid === stationUid) setSelectedStationUid(null);
    },
    [state, selectedStationUid]
  );

  const moveStations = useCallback(
    async (stationUids: string[], targetChannelUid: string) => {
      if (!state) return;
      const targetChannel = state.channels[targetChannelUid];
      if (!targetChannel) return;

      const simulatedStations = { ...state.stations };
      for (const uid of stationUids) {
        const st = simulatedStations[uid];
        if (!st) continue;
        const err = validateStation(
          { ...st, channelUid: targetChannelUid },
          simulatedStations,
          targetChannel,
          uid
        );
        if (err) {
          alert(`Negalima perkelti: ${err}`);
          return;
        }
        simulatedStations[uid] = { ...st, channelUid: targetChannelUid };
      }

      const nextState = { ...state, stations: simulatedStations };
      setState(nextState);
      configApi.saveFullConfig(nextState).catch((e) => alert(e.message));
    },
    [state]
  );

  const addRegister = useCallback(
    async (stationUid: string, reg: Omit<RawDatapoint, 'id'>) => {
      if (!state) return;
      const station = state.stations[stationUid];
      const channel = station ? state.channels[station.channelUid] : null;
      if (!station || !channel) return;

      const stationDps = Object.values(state.datapoints).filter(
        (dp) => dp.stationUid === stationUid
      );
      const maxDpId = stationDps.reduce((max, dp) => Math.max(max, Number(dp.id) || 0), 0);

      const newReg: RawDatapoint = { ...reg, id: String(maxDpId + 1) };
      await configApi.addRegister(channel, station.id, newReg);

      const dpUid = `dp_${Date.now()}`;
      setState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          datapoints: {
            ...prev.datapoints,
            [dpUid]: { ...newReg, uid: dpUid, stationUid },
          },
        };
      });
    },
    [state]
  );

  const copyDatapointsToStation = useCallback(
    (dpUids: string[], targetStationUid: string) => {
      if (!state || !state.stations[targetStationUid]) return;

      const updatedDatapoints: Record<string, FlatDatapoint> = { ...state.datapoints };

      const targetDps = Object.values(state.datapoints).filter(
        (dp) => dp.stationUid === targetStationUid
      );
      let nextId = targetDps.reduce((max, dp) => Math.max(max, Number(dp.id) || 0), 0);
      let uidCounter = Date.now();

      dpUids.forEach((uid) => {
        const source = state.datapoints[uid];
        if (!source) return;

        nextId += 1;
        uidCounter += 1;
        const newUid = `dp_${uidCounter}`;

        updatedDatapoints[newUid] = {
          ...source,
          meta: { ...source.meta },
          uid: newUid,
          id: String(nextId),
          stationUid: targetStationUid,
        };
      });

      const nextState: NormalizedState = { ...state, datapoints: updatedDatapoints };

      const validationErr = validateFullState(nextState);
      if (validationErr) {
        alert(`Kopijavimas atšauktas dėl validacijos klaidos:\n${validationErr}`);
        return;
      }

      setState(nextState);
      configApi.saveFullConfig(nextState).catch((e) => alert(e.message));
      alert(`Sėkmingai nukopijuota registrų: ${dpUids.length}`);
    },
    [state]
  );

  const bulkUpdateDatapoints = useCallback(
    (uids: string[], field: 'acq_cycle' | 'func_code' | 'byte_order', value: string) => {
      if (!state) return;
      if (field === 'func_code' && !['1', '2', '3', '4'].includes(value)) {
        alert('Function code privalo būti 1, 2, 3 arba 4.');
        return;
      }
      if (field === 'acq_cycle' && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
        alert('Acquisition cycle privalo būti teigiamas sveikasis skaičius (ms).');
        return;
      }

      const updatedDatapoints = { ...state.datapoints };
      uids.forEach((uid) => {
        if (updatedDatapoints[uid]) {
          updatedDatapoints[uid] = { ...updatedDatapoints[uid], [field]: value };
        }
      });

      const nextState = { ...state, datapoints: updatedDatapoints };
      const fullErr = validateFullState(nextState);
      if (fullErr) {
        alert(`Masinis pakeitimas atšauktas: ${fullErr}`);
        return;
      }

      setState(nextState);
      configApi.saveFullConfig(nextState).catch((e) => alert(e.message));
    },
    [state]
  );

  const bulkDeleteDatapoints = useCallback((uids: string[]) => {
    setState((prev) => {
      if (!prev) return null;
      const updatedDatapoints = { ...prev.datapoints };
      uids.forEach((uid) => delete updatedDatapoints[uid]);
      const nextState = { ...prev, datapoints: updatedDatapoints };
      configApi.saveFullConfig(nextState).catch(console.error);
      return nextState;
    });
  }, []);

  const importJsonConfig = useCallback(async (rawJson: RawModbusConfig) => {
    const normalized = normalizeConfig(rawJson);
    const validationErr = validateFullState(normalized);
    if (validationErr) {
      alert(`Importuojamas JSON failas turi klaidų:\n${validationErr}`);
      return;
    }

    setIsSaving(true);
    try {
      await configApi.saveRawConfig(rawJson);
      setState(normalized);
      alert('Konfigūracija sėkmingai patikrinta ir importuota!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Klaida importuojant JSON');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const saveConfig = useCallback(async () => {
    if (!state) return;
    const validationErr = validateFullState(state);
    if (validationErr) {
      alert(`Negalima išsaugoti konfigūracijos:\n${validationErr}`);
      return;
    }

    setIsSaving(true);
    try {
      await configApi.saveFullConfig(state);
      alert('Visi pakeitimai patikrinti ir išsaugoti!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nežinoma klaida');
    } finally {
      setIsSaving(false);
    }
  }, [state]);

  return {
    state,
    error,
    isSaving,
    selectedStationUid,
    setSelectedStationUid,
    editingChannelUid,
    setEditingChannelUid,
    updateChannel,
    addDevice,
    deleteDevice,
    moveStations,
    addRegister,
    copyDatapointsToStation,
    bulkUpdateDatapoints,
    bulkDeleteDatapoints,
    importJsonConfig,
    saveConfig,
    };
}