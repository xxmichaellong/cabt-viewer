// Prompt-by-prompt index over a captured game's raw visualize frames — the analysis
// site's navigation model (?view=analyze). One PromptView per frame carrying a `select`:
// exactly the sequence of engine prompts, including every resolver sub-prompt, in the
// order the agent saw them. All `_`-prefixed analysis fields (stamped by ptcg-kaggle's
// run/rulebased/capture_option_ranker.py, schema 2) are OPTIONAL — an old capture still
// yields a browsable index with decoded option labels only.
//
// This deliberately does NOT touch buildDecisionSteps / cabtReplayToSnapshot: the board
// for prompt k is simply snapshot.views[frameIndex] (one settled GameView per frame).
import cardRows from '../cabt/cardData.generated.json';
import attackRows from '../cabt/attackData.generated.json';
import { displayName } from '../cabt/cardView';

type CardRowLite = { id: number; name: string };
type AttackRowLite = { attackId: number; name: string };

const cardNames = new Map<number, string>((cardRows as CardRowLite[]).map((c) => [c.id, c.name]));
const attackNames = new Map<number, string>((attackRows as AttackRowLite[]).map((a) => [a.attackId, a.name]));

export type TraceFactor = { name: string; value: number; note?: string };

export type OracleResult = { damage: number; ko: boolean };

/** One option as the ranker ordered it (rank order preserved), plus the structured trace. */
export type RankerRow = {
  rank: number;
  label: string;
  reason: string;
  chosen: boolean;
  score: number | null;
  optionIndex: number | null;
  tier: string | null;
  within: number | null;
  rule: string | null;
  /** 1-based tier position + list length, emitted by the capture so the viewer never
      hardcodes the _MAIN_TIERS size. Null on captures predating tier_ord. */
  tierOrd: number | null;
  tierTotal: number | null;
  oracle: OracleResult | null;
  targetSerial: number | null;
  factors: TraceFactor[];
};

export type DeckEntry = { cid: number; name: string; count: number };

export type ThreatInfo = {
  serial: number | null;
  cid: number;
  name: string;
  hp: number;
  maxHp: number | null;
  prize: number;
  active: boolean;
  energy: number;
  threat: number;
  role: string;
};

export type OracleHit = { serial: number; damage: number; ko: boolean };
export type OracleFwd = { attackId: number; name: string; damage: number; ko: boolean };

export type SelectMeta = {
  context: string | null;
  minCount: number | null;
  maxCount: number | null;
  remainDamageCounter: number | null;
  contextCard: { cid: number; name: string } | null;
  effect: { cid: number; name: string } | null;
};

export type RaceInfo = {
  ourTurns: number | null;
  oppTurns: number | null;
  margin: number | null;
  verdict: 'winning' | 'losing' | 'unclear' | 'developing';
  ourAttacker: string | null;
  oppAttacker: string | null;
  oppTimeToOnline: number | null;
};

export type DerivedInfo = {
  deckRemaining: DeckEntry[];
  deckResolved: boolean;
  prizes: DeckEntry[] | null;
  hits: OracleHit[];
  fwd: OracleFwd[];
  threats: ThreatInfo[];
  matchup: string | null;
  nextTurnReach: number | null;
  race: RaceInfo | null;
  select: SelectMeta | null;
};

/** The Python plan dict, passed through verbatim (snake_case) with light typing. */
export type PlanInfo = {
  render?: string;
  turns?: number | null;
  crucial?: Array<{ piece?: string; criticality?: number; secured?: boolean }>;
  ko_set?: Array<{ serial?: number; name?: string; prize?: number; turn?: number }>;
  needed_pieces?: string[];
  attack_kos_active?: boolean;
  give_prizes?: boolean;
  advisory?: boolean;
};

export type PromptView = {
  frameIndex: number;
  turn: number;
  seat: number;
  isOurs: boolean;
  context: string;
  isMain: boolean;
  optionCount: number;
  /** Rank-ordered rows when the frame carried `_ranker`; null on opponent/old frames. */
  ranker: RankerRow[] | null;
  /** Decoded option labels in ENGINE order (fallback when `ranker` is absent). */
  fallbackLabels: string[];
  plan: PlanInfo | null;
  derived: DerivedInfo | null;
  /** What the driver actually submitted (option indices). */
  selectedIndices: number[];
  /** The ranker's own pick — differs from selectedIndices under DRIVER=ref. */
  rankerSelected: number[] | null;
  searchBeginInput: string | null;
};

export type GameMeta = {
  schema?: number;
  deck?: string;
  opponent?: string;
  seed?: number;
  driver?: string;
  planner?: boolean;
  plannerView?: boolean;
  seeded?: boolean;
  iteration?: string;
  won?: boolean;
  draw?: boolean;
  turns?: number;
  prompts?: number;
  mainDecisions?: number;
  dashboardFile?: string;
};

type RawFrame = Record<string, unknown> & {
  select?: Record<string, unknown> | null;
  current?: { turn?: number; yourIndex?: number; result?: number; players?: unknown[] };
};

export function gameMetaFrom(json: unknown): GameMeta {
  const meta = (json as { meta?: unknown })?.meta;
  return meta && typeof meta === 'object' ? (meta as GameMeta) : {};
}

/** Resolve the frame list from any replay shape the app plays back — mirrors cabtReplay's
    internal extractVisualizeFrames (not exported upstream): a wrapped runner file
    ({visualize: [...]}), a bare frame array, or a Kaggle environment dump. */
export function resolveFrames(input: unknown): RawFrame[] {
  if (Array.isArray(input)) {
    return input as RawFrame[];
  }
  const wrapped = (input as { visualize?: unknown })?.visualize;
  if (Array.isArray(wrapped)) {
    return wrapped as RawFrame[];
  }
  const env = (input as { environment?: { steps?: unknown[][] } })?.environment
    ?? (input as { steps?: unknown[][] });
  const step0 = env?.steps?.[0]?.[0] as
    | { observation?: { visualize?: unknown }; visualize?: unknown }
    | undefined;
  const envFrames = step0?.observation?.visualize ?? step0?.visualize;
  return Array.isArray(envFrames) ? (envFrames as RawFrame[]) : [];
}

/** Engine SelectContext names arrive UPPER_SNAKE from `_rankerContext` but PascalCase from the
    raw frame's select ('ToHand') — normalize so styling/abbreviation checks match both. */
function normalizeContext(value: unknown): string {
  return String(value ?? '?').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

export function buildPromptIndex(input: unknown): PromptView[] {
  const frames = resolveFrames(input);
  const prompts: PromptView[] = [];
  frames.forEach((frame, frameIndex) => {
    const select = frame.select;
    if (!select || typeof select !== 'object') {
      return;
    }
    const options = Array.isArray(select.option) ? (select.option as Record<string, unknown>[]) : [];
    // The engine's game-over frame still carries a `select` with ZERO options — it was never
    // a decision anyone answered, so it must not become a navigable prompt.
    if (!options.length || Number(frame.current?.result ?? -1) >= 0) {
      return;
    }
    const seat = Number(frame.current?.yourIndex ?? 0);
    const ranker = rankerRowsFrom(frame);
    const context = typeof frame._rankerContext === 'string'
      ? frame._rankerContext
      : normalizeContext(select.context ?? select.type ?? '?');
    prompts.push({
      frameIndex,
      turn: Number(frame.current?.turn ?? 0),
      seat,
      isOurs: ranker !== null || seat === 0,
      context,
      isMain: context === 'MAIN',
      optionCount: options.length,
      ranker,
      fallbackLabels: options.map((option) => optionLabel(option, frame)),
      plan: planFrom(frame),
      derived: derivedFrom(frame),
      selectedIndices: selectedIndicesFrom(frame, frames[frameIndex + 1], seat),
      rankerSelected: numberArray(frame._rankerSelected),
      searchBeginInput: typeof frame.search_begin_input === 'string' ? frame.search_begin_input : null,
    });
  });
  return prompts;
}

function rankerRowsFrom(frame: RawFrame): RankerRow[] | null {
  const raw = frame._ranker;
  if (!Array.isArray(raw) || !raw.length) {
    return null;
  }
  return raw.map((entry, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const oracle = row.oracle as Record<string, unknown> | undefined;
    return {
      rank: index + 1,
      label: typeof row.label === 'string' ? row.label : `option ${index + 1}`,
      reason: typeof row.reason === 'string' ? row.reason : '',
      chosen: row.chosen === true,
      score: finiteOrNull(row.score),
      optionIndex: finiteOrNull(row.optionIndex),
      tier: typeof row.tier === 'string' ? row.tier : null,
      within: finiteOrNull(row.within),
      rule: typeof row.rule === 'string' ? row.rule : null,
      tierOrd: finiteOrNull(row.tier_ord),
      tierTotal: finiteOrNull(row.tier_total),
      oracle: oracle && typeof oracle === 'object'
        ? { damage: Number(oracle.damage) || 0, ko: oracle.ko === true }
        : null,
      targetSerial: finiteOrNull(row.target_serial),
      factors: Array.isArray(row.factors)
        ? (row.factors as Record<string, unknown>[]).map((f) => ({
            name: String(f.name ?? '?'),
            value: Number(f.value) || 0,
            note: typeof f.note === 'string' ? f.note : undefined,
          }))
        : [],
    };
  });
}

function planFrom(frame: RawFrame): PlanInfo | null {
  const plan = frame._plan;
  return plan && typeof plan === 'object' ? (plan as PlanInfo) : null;
}

function derivedFrom(frame: RawFrame): DerivedInfo | null {
  const raw = frame._derived as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const deck = (raw.deck ?? {}) as Record<string, unknown>;
  const names = (deck.names ?? {}) as Record<string, unknown>;
  const nameFor = (cid: number): string =>
    typeof names[String(cid)] === 'string' ? String(names[String(cid)]) : cardNames.get(cid) ?? `card ${cid}`;
  const oracle = (raw.oracle ?? {}) as Record<string, unknown>;
  const oracleAttackNames = (oracle.attack_names ?? {}) as Record<string, unknown>;
  const selectMeta = raw.select as Record<string, unknown> | undefined;
  const cardRef = (value: unknown): { cid: number; name: string } | null => {
    const ref = value as Record<string, unknown> | null | undefined;
    if (!ref || typeof ref !== 'object' || !Number.isFinite(Number(ref.cid))) {
      return null;
    }
    const cid = Number(ref.cid);
    return { cid, name: typeof ref.name === 'string' ? ref.name : nameFor(cid) };
  };
  return {
    deckRemaining: deckEntries(deck.remaining, nameFor),
    deckResolved: deck.resolved === true,
    prizes: deck.prizes && typeof deck.prizes === 'object' ? deckEntries(deck.prizes, nameFor) : null,
    hits: numberKeyed(oracle.hits).map(([serial, value]) => ({
      serial,
      damage: Number((value as Record<string, unknown>)?.damage) || 0,
      ko: (value as Record<string, unknown>)?.ko === true,
    })),
    fwd: numberKeyed(oracle.fwd).map(([attackId, value]) => ({
      attackId,
      name: typeof oracleAttackNames[String(attackId)] === 'string'
        ? String(oracleAttackNames[String(attackId)])
        : attackNames.get(attackId) ?? `attack ${attackId}`,
      damage: Number((value as Record<string, unknown>)?.damage) || 0,
      ko: (value as Record<string, unknown>)?.ko === true,
    })),
    threats: Array.isArray(raw.threats)
      ? (raw.threats as Record<string, unknown>[]).map((t) => ({
          serial: finiteOrNull(t.serial),
          cid: Number(t.cid) || 0,
          name: typeof t.name === 'string' ? t.name : nameFor(Number(t.cid) || 0),
          hp: Number(t.hp) || 0,
          maxHp: finiteOrNull(t.maxHp),
          prize: Number(t.prize) || 1,
          active: t.active === true,
          energy: Number(t.energy) || 0,
          threat: Number(t.threat) || 1,
          role: typeof t.role === 'string' ? t.role : 'neutral',
        }))
      : [],
    matchup: typeof raw.matchup === 'string' ? raw.matchup : null,
    nextTurnReach: finiteOrNull(raw.next_turn_reach),
    race: raceInfo(raw.race),
    select: selectMeta && typeof selectMeta === 'object'
      ? {
          context: typeof selectMeta.context === 'string' ? selectMeta.context : null,
          minCount: finiteOrNull(selectMeta.minCount),
          maxCount: finiteOrNull(selectMeta.maxCount),
          remainDamageCounter: finiteOrNull(selectMeta.remainDamageCounter),
          contextCard: cardRef(selectMeta.contextCard),
          effect: cardRef(selectMeta.effect),
        }
      : null,
  };
}

function raceInfo(raw: unknown): RaceInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const v = r.verdict;
  return {
    ourTurns: finiteOrNull(r.our_turns),
    oppTurns: finiteOrNull(r.opp_turns),
    margin: finiteOrNull(r.margin),
    verdict: v === 'winning' || v === 'losing' || v === 'developing' ? v : 'unclear',
    ourAttacker: typeof r.our_attacker === 'string' ? r.our_attacker : null,
    oppAttacker: typeof r.opp_attacker === 'string' ? r.opp_attacker : null,
    oppTimeToOnline: finiteOrNull(r.opp_time_to_online),
  };
}

function deckEntries(raw: unknown, nameFor: (cid: number) => string): DeckEntry[] {
  return numberKeyed(raw)
    .map(([cid, count]) => ({ cid, name: nameFor(cid), count: Number(count) || 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** JSON stringifies int keys — normalize `{ "74": … }` maps back to number-keyed entries. */
function numberKeyed(raw: unknown): Array<[number, unknown]> {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  return Object.entries(raw as Record<string, unknown>)
    .map(([key, value]) => [Number(key), value] as [number, unknown])
    .filter(([key]) => Number.isFinite(key));
}

function selectedIndicesFrom(frame: RawFrame, nextFrame: RawFrame | undefined, seat: number): number[] {
  const stamped = numberArray(frame._selectedIndices);
  if (stamped) {
    return stamped;
  }
  // The NEXT frame's action/selected answers THIS frame's select (per-seat array of
  // option indices, or a flat index list on single-seat records).
  const answer = nextFrame?.action ?? nextFrame?.selected;
  if (Array.isArray(answer)) {
    const perSeat = answer[seat];
    if (Array.isArray(perSeat)) {
      return perSeat.map(Number).filter(Number.isFinite);
    }
    if (answer.every((value) => typeof value === 'number')) {
      return (answer as number[]).filter(Number.isFinite);
    }
  }
  return [];
}

function numberArray(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  return raw.map(Number).filter(Number.isFinite);
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// --- Option label fallback (frames without `_ranker`: opponent prompts, old files) ---
// The viewer files carry ENGINE-LABELED option/area types (PascalCase strings), unlike
// the numeric enums cabtReplay's decodeOption handles — so this is a string-keyed twin.

const AREA_NAMES: Record<string, string> = {
  Deck: 'deck', Hand: 'hand', Discard: 'discard', Active: 'active', Bench: 'bench',
  Prize: 'prize', Stadium: 'stadium', Energy: 'energy', Tool: 'tool', Looking: 'look',
};

function refName(frame: RawFrame, playerIndex: number, area: unknown, index: unknown): string {
  const players = (frame.current?.players ?? []) as Array<Record<string, unknown>>;
  const player = players[playerIndex];
  const i = Number(index);
  const zone = String(area ?? '');
  const list = player?.[zone.toLowerCase() as 'hand' | 'discard' | 'bench' | 'active'];
  const ref = Array.isArray(list) ? (zone === 'Active' ? list[0] : list[i]) : undefined;
  const id = (ref as Record<string, unknown> | undefined)?.id;
  if (Number.isFinite(Number(id))) {
    return displayName(cardNames.get(Number(id)) ?? `card ${id}`);
  }
  const areaLabel = AREA_NAMES[zone] ?? 'zone';
  return Number.isFinite(i) ? `${areaLabel} #${i}` : areaLabel;
}

export function optionLabel(option: Record<string, unknown>, frame: RawFrame): string {
  const owner = typeof option.playerIndex === 'number'
    ? option.playerIndex
    : Number(frame.current?.yourIndex ?? 0);
  const here = (area: unknown, index: unknown) => refName(frame, owner, area, index);
  switch (String(option.type ?? '')) {
    case 'Choose':
      return `Choose ${option.number ?? '?'}`;
    case 'Yes':
      return 'Yes';
    case 'No':
      return 'No';
    case 'Play':
      return `Play ${here('Hand', option.index)}`;
    case 'Attach':
      return `Attach ${here(option.area, option.index)} → ${here(option.inPlayArea, option.inPlayIndex)}`;
    case 'Evolve':
      return `Evolve ${here(option.inPlayArea, option.inPlayIndex)} → ${here(option.area, option.index)}`;
    case 'Ability':
      return `Ability · ${here(option.area, option.index)}`;
    case 'Discard':
      return `Discard ${here(option.area, option.index)}`;
    case 'Retreat':
      return 'Retreat';
    case 'Attack': {
      const name = attackNames.get(Number(option.attackId));
      return `Attack · ${name ? displayName(name) : `#${option.attackId ?? '?'}`}`;
    }
    case 'End':
      return 'End turn';
    case 'Number':
      return `Choose ${option.number ?? '?'}`;
    default:
      return option.area !== undefined
        ? here(option.area, option.index)
        : `Option ${option.type ?? '?'}`;
  }
}
