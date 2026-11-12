import { useState } from 'react';
import { FlatChannel } from '../../types/modbus';
import { validateChannel } from '../../utils/modbusValidator';
import { Button } from '../ui/Button';

interface ChannelSettingsModalProps {
  channel: FlatChannel;
  onSave: (uid: string, updates: Partial<FlatChannel>) => void;
  onClose: () => void;
}

export function ChannelSettingsModal({ channel, onSave, onClose }: ChannelSettingsModalProps) {
  const [form, setForm] = useState<FlatChannel>({ ...channel });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = (field: keyof FlatChannel, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateChannel(form);
    if (err) {
      setValidationError(err);
      return;
    }
    onSave(channel.uid, form);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <form onSubmit={handleSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '6px', width: '380px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ margin: '0 0 6px 0' }}>Redaguoti kanalą ({channel.protocol.toUpperCase()})</h3>

        {validationError && (
          <div style={{ padding: '8px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '12px' }}>
            {validationError}
          </div>
        )}

        <label>
          Pavadinimas:
          <input className="input" style={{ width: '100%' }} value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
        </label>

        <label>
          Būsena (Enable):
          <select className="select" style={{ width: '100%' }} value={form.enable} onChange={(e) => handleChange('enable', e.target.value)}>
            <option value="true">Enabled (true)</option>
            <option value="false">Disabled (false)</option>
          </select>
        </label>

        {channel.protocol === 'tcp' ? (
          <>
            <label>
              TCP Host (IP):
              <input className="input" style={{ width: '100%' }} value={form.tcp_host || ''} onChange={(e) => handleChange('tcp_host', e.target.value)} />
            </label>
            <label>
              TCP Port (1–65535):
              <input className="input" type="number" style={{ width: '100%' }} value={form.tcp_port || ''} onChange={(e) => handleChange('tcp_port', e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label>
              Serial Port (pvz., /dev/ttyS2):
              <input className="input" style={{ width: '100%' }} value={form.ser_port || ''} onChange={(e) => handleChange('ser_port', e.target.value)} />
            </label>
            <label>
              Baudrate:
              <select className="select" style={{ width: '100%' }} value={form.baudrate || '9600'} onChange={(e) => handleChange('baudrate', e.target.value)}>
                {['9600', '19200', '38400', '57600', '115200'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
          <Button type="button" onClick={onClose}>Atšaukti</Button>
          <Button type="submit" variant="primary">Taikyti</Button>
        </div>
      </form>
    </div>
  );
}
