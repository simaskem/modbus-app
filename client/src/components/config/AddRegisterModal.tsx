import { useState } from 'react';
import { FlatDatapoint, RawDatapoint } from '../../types/modbus';
import { getExpectedRegSize, validateDatapoint } from '../../utils/modbusValidator';
import { Button } from '../ui/Button';

interface AddRegisterModalProps {
  existingDatapoints: FlatDatapoint[];
  onAdd: (reg: Omit<RawDatapoint, 'id'>) => void;
  onClose: () => void;
}

export function AddRegisterModal({ existingDatapoints, onAdd, onClose }: AddRegisterModalProps) {
  const [startAddr, setStartAddr] = useState('0');
  const [funcCode, setFuncCode] = useState('3');
  const [dataType, setDataType] = useState('float32');
  const [acqCycle, setAcqCycle] = useState('1000');
  const [descr, setDescr] = useState('');
  const [scale, setScale] = useState('1');
  const [units, setUnits] = useState('V');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newReg: Omit<RawDatapoint, 'id'> = {
      start_addr: startAddr.trim(),
      reg_size: String(getExpectedRegSize(dataType)),
      data_type: dataType,
      byte_order: 'ABCD',
      func_code: funcCode,
      acq_cycle: acqCycle.trim(),
      meta: { descr: descr.trim() || 'New Register', scale: scale.trim(), units: units.trim() },
    };

    const err = validateDatapoint(newReg, existingDatapoints);
    if (err) {
      setValidationError(err);
      return;
    }

    onAdd(newReg);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <form onSubmit={handleSubmit} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '6px', width: '380px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>Pridėti naują registrą</h3>

        {validationError && (
          <div style={{ padding: '8px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '12px' }}>
            {validationError}
          </div>
        )}

        <label>Start Address (0–65535):
          <input className="input" type="number" style={{ width: '100%' }} value={startAddr} onChange={(e) => { setStartAddr(e.target.value); setValidationError(null); }} required />
        </label>
        <label>Function Code:
          <select className="select" style={{ width: '100%' }} value={funcCode} onChange={(e) => { setFuncCode(e.target.value); setValidationError(null); }}>
            <option value="1">1 (Coil)</option>
            <option value="2">2 (Discrete Input)</option>
            <option value="3">3 (Holding Register)</option>
            <option value="4">4 (Input Register)</option>
          </select>
        </label>
        <label>Data Type (reg_size parenkamas automatiškai):
          <select className="select" style={{ width: '100%' }} value={dataType} onChange={(e) => { setDataType(e.target.value); setValidationError(null); }}>
            <option value="float32">float32 (size: 2)</option>
            <option value="uint32">uint32 (size: 2)</option>
            <option value="int32">int32 (size: 2)</option>
            <option value="uint16">uint16 (size: 1)</option>
            <option value="int16">int16 (size: 1)</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <label style={{ flex: 1 }}>Scale (ne 0):
            <input className="input" style={{ width: '100%' }} value={scale} onChange={(e) => { setScale(e.target.value); setValidationError(null); }} required />
          </label>
          <label style={{ flex: 1 }}>Units:
            <input className="input" style={{ width: '100%' }} value={units} onChange={(e) => setUnits(e.target.value)} />
          </label>
        </div>
        <label>Acquisition Cycle (ms):
          <input className="input" type="number" style={{ width: '100%' }} value={acqCycle} onChange={(e) => setAcqCycle(e.target.value)} />
        </label>
        <label>Description:
          <input className="input" style={{ width: '100%' }} value={descr} onChange={(e) => setDescr(e.target.value)} placeholder="Pvz., Voltage L1" required />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <Button type="button" onClick={onClose}>Atšaukti</Button>
          <Button type="submit" variant="primary">Pridėti</Button>
        </div>
      </form>
    </div>
  );
}
