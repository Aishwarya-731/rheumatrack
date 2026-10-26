import type { DataService } from '@/data/services';
import { ALL_JOINT_SIDES, movementsFor } from '@/domain/joints';
import { computeMetrics } from '@/domain/metrics';
import { defaultSyntheticConfig, generateSynthetic, mulberry32 } from '@/domain/synthetic';

/**
 * Adds clearly labelled SYNTHETIC sample records for local development: simulation-generated
 * sessions (source = 'simulation', isSynthetic = true) and synthetic check-ins
 * (isSynthetic = true). Used by the Settings page (emulator mode only) and the seed script.
 */
export async function addSyntheticSampleData(data: DataService, uid: string, now: number = Date.now(), days = 21): Promise<{ sessions: number; assessments: number }> {
  const rand = mulberry32(20261026);
  const picks = ALL_JOINT_SIDES.filter(({ joint }) => joint === 'knee' || joint === 'shoulder' || joint === 'wrist');
  let sessions = 0;
  let assessments = 0;
  for (let d = days; d >= 0; d -= 2) {
    const dayStart = new Date(now - d * 86_400_000);
    dayStart.setHours(8, 30, 0, 0);
    for (const { joint, side } of picks) {
      const movement = movementsFor(joint)[0]!.id;
      const start = dayStart.getTime() + Math.floor(rand() * 40) * 60_000;
      if (start > now) continue;
      const cfg = defaultSyntheticConfig(joint, side, movement, start, Math.floor(rand() * 1e9));
      cfg.amplitudeDeg = cfg.amplitudeDeg * (0.8 + 0.25 * rand());
      cfg.durationS = 12;
      const samples = generateSynthetic(cfg);
      await data.createSession(
        uid,
        {
          joint,
          side,
          movement,
          source: 'simulation',
          isSynthetic: true,
          sourceFileName: null,
          sourceFormat: 'generated',
          metrics: computeMetrics(samples),
          calibrationId: null,
          calibrationStatus: 'not-calibrated',
          notes: 'Synthetic sample data generated for local development.',
        },
        samples,
      );
      sessions++;
      const stiff = Math.max(0, Math.min(10, Math.round(7 - (cfg.amplitudeDeg / 160) * 5 + rand() * 2)));
      await data.createAssessment(
        uid,
        {
          joint,
          side,
          pain: Math.max(0, Math.min(10, Math.round(stiff * 0.7 + rand() * 2))),
          stiffness: stiff,
          discomfort: Math.max(0, Math.min(10, Math.round(stiff * 0.5 + rand() * 3))),
          durationMinutes: Math.round(10 + rand() * 50),
          notes: 'Synthetic sample check-in.',
          assessedAt: start + 20 * 60_000 > now ? start : start + 20 * 60_000,
        },
        true,
      );
      assessments++;
    }
  }
  return { sessions, assessments };
}
