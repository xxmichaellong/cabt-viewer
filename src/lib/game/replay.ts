import type { GameView } from './types';
import type { ActionTimelineEvent } from './types';

export type ReplayPlayerInfo = {
  userId: number;
  name: string;
};

// --- Decision readouts (our own testing overlay; carried on frames by run/export_replay.py
//     and run/rulebased/capture_option_ranker.py, ignored by anything that doesn't know them) ---

/** One legal option as an MCTS search reported it (visits/q/prior). */
export type MctsCandidate = {
  optionIndex: number;
  label: string;
  visits: number;
  visitShare: number;
  q: number;
  prior: number;
  chosen: boolean;
};

export type MctsStepView = {
  totalVisits: number;
  optionCount: number;
  candidates: MctsCandidate[];
};

/** One legal option as the rule-based option-ranker ordered it. `candidates` is already
    in rank order (first = do first); `reason` carries the ranker's note, including any
    engine-truth damage the ranker baked in (e.g. "…[engine·200dmg·KO]"). */
export type RankerCandidate = {
  rank: number; // 1-based display rank (position in the ordered list)
  label: string;
  reason: string;
  chosen: boolean;
};

export type RankerStepView = {
  context?: string; // SelectContext name, e.g. "PLAY" / "ATTACK" / "SELECT_TARGET"
  optionCount: number;
  candidates: RankerCandidate[];
};

/** What governed one decision — either an MCTS search or the option-ranker. The `kind`
    tag lets the dock render the right panel. */
export type DecisionView =
  | ({ kind: 'mcts' } & MctsStepView)
  | ({ kind: 'ranker' } & RankerStepView);

export type ReplayStep = {
  index: number;
  label: string;
  stateIndex: number;
  actionIndex: number | null;
  sequence?: number;
  turn: number;
  phase: number;
  activePlayerIndex: number;
  type: string;
  payload: unknown;
  actionTimeline?: ActionTimelineEvent[];
  displayView?: GameView;
  animationPhases?: ReplayAnimationPhase[];
  /** Search/ranker readout for this decision, when the frame carried one. Null on the
      many in-between steps (reveals, sub-prompts, the opponent's forced moves). */
  decision?: DecisionView | null;
};

export type ReplayAnimationPhase = {
  key: string;
  label?: string;
  view: GameView;
  actionTimeline: ActionTimelineEvent[];
  durationMs: number;
};

export const replayAnimationPhaseGapMs = 120;

export function replayStepPlaybackDelayMs(step: ReplayStep | null | undefined, fallbackDelayMs: number): number {
  const phases = step?.animationPhases;
  if (!phases?.length) {
    return fallbackDelayMs;
  }
  const phaseDurationMs = phases.reduce((totalMs, phase) => totalMs + phase.durationMs + replayAnimationPhaseGapMs, 0);
  return Math.max(fallbackDelayMs, phaseDurationMs);
}

export type ReplaySnapshot = {
  id: string;
  name: string;
  created: number;
  players: ReplayPlayerInfo[];
  winner: number;
  stateCount: number;
  actionCount: number;
  turnCount: number;
  cardNames: string[];
  views: GameView[];
  steps: ReplayStep[];
};
