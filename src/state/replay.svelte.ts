import type { GameView } from '../lib/game/types';
import type { ReplaySnapshot, ReplayStep } from '../lib/game/replay';
import { cabtReplayToSnapshot } from '../lib/cabt/cabtReplay';

class ReplayStore {
  replay = $state<ReplaySnapshot | null>(null);
  stepIndex = $state(0);
  loading = $state(false);
  error = $state('');
  copiedForkPoint = $state(false);
  playing = $state(false);
  speedMs = $state(800);
  private timer: ReturnType<typeof setInterval> | null = null;

  get currentStep(): ReplayStep | null {
    return this.replay?.steps[this.stepIndex] ?? null;
  }

  get currentView(): GameView | null {
    const replay = this.replay;
    const step = this.currentStep;
    if (!replay || !step) {
      return null;
    }
    return replay.views[step.stateIndex] ?? null;
  }

  get maxStepIndex(): number {
    return Math.max(0, (this.replay?.steps.length ?? 1) - 1);
  }

  // Steps that carry a search/MCTS readout. These are the "decisions" the agent made;
  // most frames in between (reveals, sub-prompts, the opponent's forced moves) have none.
  decisionIndices = $derived(
    this.replay
      ? this.replay.steps.reduce<number[]>((acc, step, index) => {
          if (step.mcts) {
            acc.push(index);
          }
          return acc;
        }, [])
      : [],
  );

  get decisionCount(): number {
    return this.decisionIndices.length;
  }

  // The decision governing the current step: the most recent one at or before stepIndex.
  // Carrying it forward keeps the search panel populated on the intermediate frames that
  // have no readout of their own (instead of blinking out). -1 before the first decision.
  get currentDecisionOrdinal(): number {
    const indices = this.decisionIndices;
    let ordinal = -1;
    for (let i = 0; i < indices.length; i += 1) {
      if (indices[i] <= this.stepIndex) {
        ordinal = i;
      } else {
        break;
      }
    }
    return ordinal;
  }

  get currentDecisionStep(): ReplayStep | null {
    const ordinal = this.currentDecisionOrdinal;
    if (ordinal < 0 || !this.replay) {
      return null;
    }
    return this.replay.steps[this.decisionIndices[ordinal]] ?? null;
  }

  // Jumping to a decision parks the board on the decision's own frame, i.e. the state
  // right before that decision was made (each CABT frame holds the pre-choice board).
  goToDecision(ordinal: number): void {
    const indices = this.decisionIndices;
    if (!indices.length) {
      return;
    }
    const clamped = Math.min(indices.length - 1, Math.max(0, ordinal));
    this.setStep(indices[clamped]);
  }

  nextDecision(): void {
    const next = this.decisionIndices.find((index) => index > this.stepIndex);
    if (next !== undefined) {
      this.setStep(next);
    }
  }

  previousDecision(): void {
    let target: number | undefined;
    for (const index of this.decisionIndices) {
      if (index < this.stepIndex) {
        target = index;
      } else {
        break;
      }
    }
    if (target !== undefined) {
      this.setStep(target);
    }
  }

  // Advance from the governing decision to the state its played move produced.
  showDecisionResult(): void {
    const step = this.currentDecisionStep;
    if (!step) {
      return;
    }
    this.setStep(step.index + 1);
  }

  async loadSaved(id = 'kaggle-context.json'): Promise<void> {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.error = '';
    this.copiedForkPoint = false;
    this.pause();
    try {
      this.replay = await loadCabtReplay(id);
      this.stepIndex = 0;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.replay = null;
      this.stepIndex = 0;
    } finally {
      this.loading = false;
    }
  }

  clear(): void {
    this.pause();
    this.replay = null;
    this.stepIndex = 0;
    this.loading = false;
    this.error = '';
    this.copiedForkPoint = false;
  }

  private applyStep(index: number): void {
    this.stepIndex = clampIndex(index, this.maxStepIndex);
    this.copiedForkPoint = false;
  }

  // Manual navigation pauses auto-play; the playback timer uses applyStep directly
  // so its own advances don't stop the loop.
  setStep(index: number): void {
    this.pause();
    this.applyStep(index);
  }

  nextStep(): void {
    this.pause();
    this.applyStep(this.stepIndex + 1);
  }

  previousStep(): void {
    this.pause();
    this.applyStep(this.stepIndex - 1);
  }

  firstStep(): void {
    this.pause();
    this.applyStep(0);
  }

  lastStep(): void {
    this.pause();
    this.applyStep(this.maxStepIndex);
  }

  play(): void {
    if (!this.replay) {
      return;
    }
    if (this.stepIndex >= this.maxStepIndex) {
      this.applyStep(0); // replay a finished game from the top
    }
    this.playing = true;
    this.startTimer();
  }

  pause(): void {
    this.clearTimer();
    this.playing = false;
  }

  togglePlay(): void {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  setSpeed(ms: number): void {
    this.speedMs = ms;
    if (this.playing) {
      this.startTimer(); // re-arm the interval at the new cadence
    }
  }

  private startTimer(): void {
    this.clearTimer();
    this.timer = setInterval(() => {
      if (this.stepIndex >= this.maxStepIndex) {
        this.pause();
        return;
      }
      this.applyStep(this.stepIndex + 1);
    }, this.speedMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setStateIndex(stateIndex: number): void {
    const replay = this.replay;
    if (!replay) {
      return;
    }
    const clampedState = clampIndex(stateIndex, Math.max(0, replay.stateCount - 1));
    const exact = replay.steps.findIndex((step) => step.stateIndex === clampedState);
    if (exact !== -1) {
      this.setStep(exact);
      return;
    }

    let bestIndex = 0;
    for (let index = 0; index < replay.steps.length; index += 1) {
      if (replay.steps[index].stateIndex <= clampedState) {
        bestIndex = index;
      }
    }
    this.setStep(bestIndex);
  }

  async copyForkPoint(): Promise<void> {
    const replay = this.replay;
    const step = this.currentStep;
    if (!replay || !step || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify({
      replayId: replay.id,
      replayName: replay.name,
      stepIndex: step.index,
      stateIndex: step.stateIndex,
      actionIndex: step.actionIndex,
      actionType: step.type,
      turn: step.turn,
    }));
    this.copiedForkPoint = true;
  }
}

async function loadCabtReplay(id: string): Promise<ReplaySnapshot> {
  const candidates = replayCandidates(id);
  const failures: string[] = [];
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        failures.push(`${url}: ${response.status}`);
        continue;
      }
      return cabtReplayToSnapshot(await response.json());
    } catch (error) {
      failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Unable to load CABT replay. Tried ${failures.join('; ')}`);
}

function replayCandidates(id: string): string[] {
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const replayUrl = params.get('replayUrl');
  if (replayUrl) {
    return [replayUrl];
  }
  const file = params.get('replay') || id;
  if (/^https?:\/\//.test(file) || file.startsWith('/')) {
    return [file];
  }
  return [
    `/game-logs/${encodePath(file)}`,
    `/cabt-artifacts/${encodePath(file)}`,
    '/cabt-artifacts/kaggle-context.json',
    '/cabt-artifacts/cabt-match.json',
  ];
}

function encodePath(path: string): string {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function clampIndex(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(max, Math.max(0, Math.round(value)));
}

export const replayStore = new ReplayStore();
