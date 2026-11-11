import { memo } from 'react';
import { FlatDatapoint } from '../types/modbus';

interface DatapointRowProps {
  datapoint: FlatDatapoint;
  isChecked: boolean;
  height: number;
  onToggleCheck: (uid: string) => void;
}

export const DatapointRow = memo(function DatapointRow({
  datapoint,
  isChecked,
  height,
  onToggleCheck,
}: DatapointRowProps) {
  return (
    <tr className={isChecked ? 'checked' : ''} style={{ height: `${height}px` }}>
      <td style={{ width: '36px' }}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggleCheck(datapoint.uid)}
        />
      </td>
      <td style={{ width: '60px' }}>{datapoint.id}</td>
      <td style={{ width: '80px' }}>{datapoint.start_addr}</td>
      <td style={{ width: '70px' }}>{datapoint.func_code}</td>
      <td style={{ width: '90px' }}>{datapoint.data_type}</td>
      <td style={{ width: '90px' }}>{datapoint.acq_cycle} ms</td>
      <td>{datapoint.meta.descr}</td>
      <td style={{ width: '80px' }}>{datapoint.meta.units}</td>
    </tr>
  );
});
