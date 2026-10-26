import { useSelection } from '@/app/providers/SelectionProvider';
import { JOINT_CATALOGUE, JOINTS, movementsFor, SIDES, sideLabel, type Joint, type Movement, type Side } from '@/domain/joints';
import { Segmented, SelectField } from './ui/Fields';

const jointOptions = JOINTS.map((j) => ({ value: j, label: JOINT_CATALOGUE[j].label }));
const sideOptions = SIDES.map((s) => ({ value: s, label: sideLabel(s) }));

/** Joint dropdown + side toggle (+ optional movement dropdown), bound to the shared selection. */
export function JointPicker({ showMovement = true, compact = false }: { showMovement?: boolean; compact?: boolean }) {
  const { joint, side, movement, setJoint, setSide, setMovement } = useSelection();
  const movementOptions = movementsFor(joint).map((m) => ({ value: m.id, label: m.label }));
  return (
    <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
      <div style={{ minWidth: compact ? 140 : 170, flex: '1 1 140px' }}>
        <SelectField<Joint> label="Joint" value={joint} options={jointOptions} onChange={setJoint} data-testid="joint-select" />
      </div>
      <div className="field" style={{ flex: 'none' }}>
        <span className="field-label" id="side-label">
          Side
        </span>
        <Segmented<Side> label="Side" value={side} options={sideOptions} onChange={setSide} />
      </div>
      {showMovement && (
        <div style={{ minWidth: compact ? 150 : 180, flex: '1 1 150px' }}>
          <SelectField<Movement> label="Movement" value={movement} options={movementOptions} onChange={setMovement} data-testid="movement-select" />
        </div>
      )}
    </div>
  );
}
