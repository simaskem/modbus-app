import { FlatChannel, NormalizedState, RawDatapoint, RawModbusConfig, RawStation } from '../types/modbus';
import { denormalizeConfig, normalizeConfig } from '../utils/configTransformer';

export const configApi = {
  async fetchConfig(): Promise<NormalizedState> {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    const raw: RawModbusConfig = await res.json();
    return normalizeConfig(raw);
  },

  async saveFullConfig(state: NormalizedState): Promise<void> {
    const rawPayload = denormalizeConfig(state);
    await this.saveRawConfig(rawPayload);
  },

  async saveRawConfig(rawPayload: RawModbusConfig): Promise<void> {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawPayload),
    });
    if (!res.ok) throw new Error('Nepavyko išsaugoti konfigūracijos');
  },

  async updateChannel(channel: FlatChannel): Promise<void> {
    const { uid, protocol, ...payload } = channel;
    const res = await fetch(`/api/channels/${protocol}/${channel.channel_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Nepavyko atnaujinti kanalo');
  },

  async createDevice(channel: FlatChannel, device: Omit<RawStation, 'datapoints'>): Promise<RawStation> {
    const res = await fetch(`/api/channels/${channel.protocol}/${channel.channel_id}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
    if (!res.ok) throw new Error('Nepavyko sukurti įrenginio');
    return res.json();
  },

  async deleteDevice(channel: FlatChannel, deviceId: string): Promise<void> {
    const res = await fetch(`/api/channels/${channel.protocol}/${channel.channel_id}/devices/${deviceId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Nepavyko ištrinti įrenginio');
  },

  async addRegister(channel: FlatChannel, deviceId: string, register: RawDatapoint): Promise<void> {
    const res = await fetch(`/api/channels/${channel.protocol}/${channel.channel_id}/devices/${deviceId}/registers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(register),
    });
    if (!res.ok) throw new Error('Nepavyko pridėti registro');
  },
};
