import { ArrowRight } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useSelection } from '@/app/providers/SelectionProvider';
import { JointPicker } from '@/components/JointPicker';
import { latestPerMovement } from '@/domain/analytics';
import { getMovement, jointLabel } from '@/domain/joints';
import { BodyDiagram } from './BodyDiagram';
import { RomRingsPanel } from './RomRingsPanel';

const BodyViewer3D = lazy(() => import('@/features/viewer3d/BodyViewer3D'));

export function ViewerFallback({ height }: { height: number }) {
  return <div className="skeleton" style={{ height, borderRadius: 14 }} aria-label="Loading 3D viewer" />;
}

export function JointsPage() {
  const { sessions, basePath } = useRecords();
  const { joint, side, movement } = useSelection();
  const latest = latestPerMovement(sessions, joint, side).get(movement) ?? null;
  const def = getMovement(joint, movement);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Joints &amp; range of motion</h1>
          <p>Select a joint on the 3D model, the body diagram or the menus. The camera zooms to the joint and its range of motion is shown.</p>
        </div>
        <Link to={`${basePath}/joints/${joint}/${side}`} className="btn btn-primary">
          {jointLabel(joint, side)} details <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className="grid grid-main-side">
        <section className="card" aria-label="3D body model">
          <Suspense fallback={<ViewerFallback height={540} />}>
            <BodyViewer3D latestSession={latest} height={540} />
          </Suspense>
        </section>
        <div className="stack">
          <section className="card stack">
            <JointPicker compact />
            {def && <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{def.description}</p>}
          </section>
          <section className="card">
            <BodyDiagram />
          </section>
        </div>
      </div>
      <RomRingsPanel />
    </div>
  );
}
