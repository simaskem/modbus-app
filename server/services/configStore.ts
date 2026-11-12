import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

export interface ModbusConfig {
  modbus_tcp: any[];
  modbus_ser: any[];
}

export class ConfigStore {
  private filePath: string;
  private cache: ModbusConfig | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private isDirty = false;
  private debounceMs = 2000;

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
    // 1. RAM podėlį atnaujiname akimirksniu
    this.cache = newConfig;
    this.isDirty = true;

    // 2. Atidedame fizinį įrašymą į Flash atmintį (Debounce)
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.flushToDisk().catch((err) => {
        logger.error({ err }, 'Failed to flush configuration to disk');
      });
    }, this.debounceMs);
  }

  // Priverstinis įrašymas į diską (naudojamas pasibaigus laikmačiui arba išjungiant serverį)
  async flushToDisk(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (!this.isDirty || !this.cache) return;

    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.cache, null, 4), 'utf-8');
    await fs.rename(tempPath, this.filePath);
    this.isDirty = false;
    logger.info('Configuration flushed atomically to Flash storage');
  }

  findChannel(config: ModbusConfig, protocol: string, channelId: string) {
    const list = protocol === 'tcp' ? config.modbus_tcp : config.modbus_ser;
    return list?.find((c) => c.channel_id === channelId);
  }
}
