import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cabtReplayToSnapshot } from './cabtReplay';

// Guards the option-ranker decision overlay (our local testing surface): a capture from
// run/rulebased/capture_option_ranker.py with VIEWER=1 stamps `_ranker` on our decision
// frames, and the additive attach in cabtReplayToSnapshot must surface EVERY one as a
// navigable decision step — even after upstream refactors coalesce frames differently.
// The fixture is machine-local (gitignored game-logs), so this skips where it's absent.
const fixture = resolve(homedir(), 'cabt-viewer/public/game-logs/optionranker_lucario_s0.json');
const hasFixture = existsSync(fixture);

describe.skipIf(!hasFixture)('option-ranker decision overlay', () => {
  it('surfaces every _ranker frame as a ranker decision step', () => {
    const input = JSON.parse(readFileSync(fixture, 'utf8'));
    const snap = cabtReplayToSnapshot(input);
    expect(snap.steps.length).toBeGreaterThan(0);

    const rankerFrames = (input.visualize as Array<Record<string, unknown>>).filter(
      (frame) => '_ranker' in frame,
    ).length;
    const rankerSteps = snap.steps.filter((step) => step.decision?.kind === 'ranker');

    expect(rankerFrames).toBeGreaterThan(0);
    expect(rankerSteps.length).toBe(rankerFrames);

    const sample = rankerSteps[0].decision;
    expect(sample?.kind).toBe('ranker');
    if (sample?.kind === 'ranker') {
      expect(sample.candidates.length).toBeGreaterThan(0);
      expect(sample.candidates[0].rank).toBe(1);
      expect(typeof sample.candidates[0].label).toBe('string');
      expect(sample.candidates.some((candidate) => candidate.chosen)).toBe(true);
    }
  });

  it('surfaces the prize-map plan on ranker steps when the capture carried _plan (PLANNER=1)', () => {
    const input = JSON.parse(readFileSync(fixture, 'utf8'));
    const hasPlanFrame = (input.visualize as Array<Record<string, unknown>>).some(
      (frame) => frame._plan && typeof frame._plan === 'object',
    );
    if (!hasPlanFrame) {
      return; // capture without PLANNER=1 — nothing to assert
    }
    const snap = cabtReplayToSnapshot(input);
    const planned = snap.steps
      .map((step) => step.decision)
      .find((d) => d?.kind === 'ranker' && d.plan && d.plan.crucial.length > 0);
    expect(planned).toBeTruthy();
    if (planned?.kind === 'ranker' && planned.plan) {
      expect(typeof planned.plan.render).toBe('string');
      expect(typeof planned.plan.crucial[0].piece).toBe('string');
      expect(typeof planned.plan.crucial[0].criticality).toBe('number');
      expect(typeof planned.plan.crucial[0].secured).toBe('boolean');
    }
  });
});
