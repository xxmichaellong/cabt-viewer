import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPromptIndex, gameMetaFrom } from './promptIndex';

// Guards the analysis-site prompt index over a schema-2 capture (capture_option_ranker.py).
// The fixture is machine-local (gitignored game-logs), so this skips where it's absent.
const fixture = resolve(homedir(), 'cabt-viewer/public/game-logs/optionranker_archaludon_masami_s0.json');
const hasFixture = existsSync(fixture);

describe.skipIf(!hasFixture)('analysis prompt index', () => {
  const input = hasFixture ? JSON.parse(readFileSync(fixture, 'utf8')) : null;

  it('yields one prompt per ANSWERABLE select frame, our prompts carrying the ranker slate', () => {
    const frames = input.visualize as Array<Record<string, unknown>>;
    const prompts = buildPromptIndex(frames);
    // Answerable = has options and the game is not over. The engine's terminal frame still
    // carries a zero-option select — it must NOT become a navigable prompt.
    const answerable = frames.filter((frame) => {
      const select = frame.select as { option?: unknown[] } | undefined;
      const result = Number((frame.current as { result?: number } | undefined)?.result ?? -1);
      return select && Array.isArray(select.option) && select.option.length > 0 && result < 0;
    });
    expect(prompts.length).toBe(answerable.length);
    expect(prompts.length).toBeLessThan(frames.filter((frame) => frame.select).length);

    const ours = prompts.filter((prompt) => prompt.ranker !== null);
    expect(ours.length).toBe(frames.filter((frame) => '_ranker' in frame).length);
    expect(ours.length).toBeGreaterThan(0);

    for (const prompt of ours) {
      expect(prompt.ranker!.length).toBeGreaterThan(0);
      expect(prompt.ranker![0].rank).toBe(1);
    }
  });

  it('resolves the full replay json (wrapped shape) identically to the bare frame array', () => {
    const fromJson = buildPromptIndex(input);
    const fromFrames = buildPromptIndex(input.visualize);
    expect(fromJson.length).toBe(fromFrames.length);
  });

  it('carries real scores + tiers on MAIN prompts (schema 2)', () => {
    const prompts = buildPromptIndex(input.visualize);
    const main = prompts.find((prompt) => prompt.isMain && prompt.ranker);
    expect(main).toBeTruthy();
    expect(typeof main!.ranker![0].score).toBe('number');
    expect(typeof main!.ranker![0].tier).toBe('string');
    expect(main!.selectedIndices.length).toBeGreaterThan(0);
  });

  it('normalizes derived string keys to numbers', () => {
    const prompts = buildPromptIndex(input.visualize);
    const derived = prompts.find((prompt) => prompt.derived)?.derived;
    expect(derived).toBeTruthy();
    expect(derived!.deckRemaining.length).toBeGreaterThan(0);
    expect(typeof derived!.deckRemaining[0].cid).toBe('number');
    expect(derived!.deckRemaining[0].name).not.toMatch(/^card \d+$/);
    // The first derived block can predate the opponent's board (setup) — find one with threats.
    const threats = prompts.find((prompt) => prompt.derived?.threats.length)?.derived?.threats;
    expect(threats).toBeTruthy();
    expect(typeof threats![0].serial).toBe('number');
    const withHits = prompts.find((prompt) => prompt.derived && prompt.derived.hits.length);
    if (withHits) {
      expect(typeof withHits.derived!.hits[0].serial).toBe('number');
      expect(withHits.derived!.hits[0].damage).toBeGreaterThan(0);
    }
  });

  it('reads the top-level meta block', () => {
    const meta = gameMetaFrom(input);
    expect(meta.schema).toBeGreaterThanOrEqual(2);
    expect(typeof meta.opponent).toBe('string');
    expect(typeof meta.dashboardFile).toBe('string');
  });

  it('decodes fallback labels for prompts without _ranker (opponent frames)', () => {
    const prompts = buildPromptIndex(input.visualize);
    const opp = prompts.find((prompt) => !prompt.ranker && prompt.optionCount > 0);
    if (opp) {
      expect(opp.fallbackLabels.length).toBe(opp.optionCount);
      expect(opp.fallbackLabels.every((label) => typeof label === 'string' && label.length > 0)).toBe(true);
    }
  });
});
