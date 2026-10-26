import { RotateCcw } from 'lucide-react';
import { JOINT_CATALOGUE, JOINTS, MOVEMENTS, movementLabel, SIDES, sideLabel, type Joint, type Movement, type Side } from '@/domain/joints';
import { SelectField, TextField } from './ui/Fields';

export interface FilterInputs {
  joint: Joint | 'all';
  side: Side | 'all';
  movement: Movement | 'all';
  fromDate: string;
  toDate: string;
}

export const EMPTY_FILTER_INPUTS: FilterInputs = { joint: 'all', side: 'all', movement: 'all', fromDate: '', toDate: '' };

export function RecordFilters({ value, onChange, showMovement = true }: { value: FilterInputs; onChange: (v: FilterInputs) => void; showMovement?: boolean }) {
  const movementOptions = (value.joint === 'all' ? MOVEMENTS : JOINT_CATALOGUE[value.joint].movements.map((m) => m.id)).map((m) => ({ value: m, label: movementLabel(m) }));
  const dateError = value.fromDate && value.toDate && value.fromDate > value.toDate ? 'Start date is after end date.' : undefined;
  return (
    <div className="filter-bar" role="search" aria-label="Filter records">
      <SelectField<Joint | 'all'>
        label="Joint"
        value={value.joint}
        options={[{ value: 'all', label: 'All joints' }, ...JOINTS.map((j) => ({ value: j, label: JOINT_CATALOGUE[j].label }))]}
        onChange={(joint) => {
          const movementStillValid = value.movement === 'all' || joint === 'all' || JOINT_CATALOGUE[joint].movements.some((m) => m.id === value.movement);
          onChange({ ...value, joint, movement: movementStillValid ? value.movement : 'all' });
        }}
      />
      <SelectField<Side | 'all'>
        label="Side"
        value={value.side}
        options={[{ value: 'all', label: 'Both sides' }, ...SIDES.map((s) => ({ value: s, label: sideLabel(s) }))]}
        onChange={(side) => onChange({ ...value, side })}
      />
      {showMovement && (
        <SelectField<Movement | 'all'>
          label="Movement"
          value={value.movement}
          options={[{ value: 'all', label: 'All movements' }, ...movementOptions]}
          onChange={(movement) => onChange({ ...value, movement })}
        />
      )}
      <TextField label="From" type="date" value={value.fromDate} onChange={(e) => onChange({ ...value, fromDate: e.target.value })} />
      <TextField label="To" type="date" value={value.toDate} onChange={(e) => onChange({ ...value, toDate: e.target.value })} error={dateError} />
      <button type="button" className="btn btn-ghost" onClick={() => onChange(EMPTY_FILTER_INPUTS)} style={{ flex: 'none' }}>
        <RotateCcw aria-hidden /> Reset
      </button>
    </div>
  );
}
