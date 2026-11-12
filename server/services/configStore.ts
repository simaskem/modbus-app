import fs from 'fs/promises';
import path from 'path';

export interface ModbusConfig {
  modbus_tcp: any[];
  modbus_ser: any[];
}

export class ConfigStore {
  private filePath: string;
  private cache: ModbusConfig | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async get(): Promise<ModbusConfig> {
    if (!this.cache) {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.cache = JSON.parse(raw);
    }
    return this.cache!;
  }

  async save(newConfig: ModbusConfig): Promise<void> {
    this.cache = newConfig;
    const tempPath = `${this.filePath}.tmp`;
    // Atominis įrašymas saugo nuo failo sugadinimo dingus maitinimui
    await fs.writeFile(tempPath, JSON.stringify(newConfig, null, 4), 'utf-8');
    await fs.rename(tempPath, this.filePath);
  }

  findChannel(config: ModbusConfig, protocol: string, channelId: string) {
    const list = protocol === 'tcp' ? config.modbus_tcp : config.modbus_ser;
    return list?.find((c) => c.channel_id === channelId);
  }
}
