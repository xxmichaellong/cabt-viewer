import type { GameView } from './types';

export type ReplayPlayerInfo = {
  userId: number;
  name: string;
};

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
  mcts?: MctsStepView | null;
};

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

export type ReplayLoadResponse = {
  ok: boolean;
  replay?: ReplaySnapshot;
  error?: string;
};
