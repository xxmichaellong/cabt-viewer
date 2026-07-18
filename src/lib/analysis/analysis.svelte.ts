// State for ?view=analyze — the prompt-by-prompt analysis page. Owns its own loading
// (independent of replayStore; the two views never share navigation state) and renders
// SETTLED views only: snapshot.views[frameIndex], no animation phases, no timers — which
// also sidesteps the scrub/orphaned-sprite hazards the replay store manages around.
import type { GameView } from '../game/types';
import { cabtReplayToSnapshot } from '../cabt/cabtReplay';
import {
  buildPromptIndex,
  gameMetaFrom,
  type GameMeta,
  type PromptView,
} from './promptIndex';

export type PromptFilter = 'all' | 'ours' | 'main';

export type TurnGroup = {
  turn: number;
  prompts: PromptView[];
};

class AnalysisStore {
  loading = $state(false);
  error = $state('');
  replayUrl = $state('');
  meta = $state<GameMeta>({});
  prompts = $state<PromptView[]>([]);
  promptIdx = $state(0);
  filter = $state<PromptFilter>('ours');
  /** optionIndex of the hovered options-panel row (board highlight), or null. */
  hoveredCandidate = $state<number | null>(null);
  /** optionIndex of the row whose logic path is expanded; null = the played option. */
  selectedCandidate = $state<number | null>(null);
  planOverlay = $state(false);
  copyStatus = $state<'' | 'copied' | 'failed'>('');
  /** The "report" composer on the analyze header: a free-text note the analyst types about the
      current position; copyReport compiles it WITH the position block so the whole message pastes
      straight to Claude (author-move / queue add). Reset on navigation (a note is tied to ITS
      position — see gotoPosition). */
  reportOpen = $state(false);
  reportText = $state('');
  reportStatus = $state<'' | 'copied' | 'failed'>('');
  private views: GameView[] = [];

  get currentPrompt(): PromptView | null {
    return this.prompts[this.promptIdx] ?? null;
  }

  get currentView(): GameView | null {
    const prompt = this.currentPrompt;
    if (!prompt) {
      return null;
    }
    const view = this.views[prompt.frameIndex] ?? null;
    // Settled board only: strip the frame's own timeline so nothing animates.
    return view ? { ...view, actionTimeline: [] } : null;
  }

  turnGroups = $derived.by((): TurnGroup[] => {
    const groups: TurnGroup[] = [];
    for (const prompt of this.prompts) {
      const last = groups[groups.length - 1];
      if (last && last.turn === prompt.turn) {
        last.prompts.push(prompt);
      } else {
        groups.push({ turn: prompt.turn, prompts: [prompt] });
      }
    }
    return groups;
  });

  /** Positions (into `prompts`) that match the active filter. */
  filteredPositions = $derived.by((): number[] => {
    const positions: number[] = [];
    this.prompts.forEach((prompt, index) => {
      if (this.filter === 'all' || (this.filter === 'main' ? prompt.isMain && prompt.isOurs : prompt.isOurs)) {
        positions.push(index);
      }
    });
    return positions;
  });

  /** 1-based ordinal of the current prompt among OUR prompts (the author-move numbering). */
  get ourOrdinal(): { ordinal: number; total: number } {
    let ordinal = 0;
    let total = 0;
    this.prompts.forEach((prompt, index) => {
      if (prompt.ranker !== null) {
        total += 1;
        if (index <= this.promptIdx) {
          ordinal = total;
        }
      }
    });
    return { ordinal, total };
  }

  async load(url: string): Promise<void> {
    if (this.loading || (this.replayUrl === url && this.prompts.length > 0)) {
      return;                       // in flight, or this game is already loaded
    }
    this.loading = true;
    this.error = '';
    this.replayUrl = url;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${url}: ${response.status}`);
      }
      const json = await response.json();
      const snapshot = cabtReplayToSnapshot(json);
      this.views = snapshot.views;
      this.meta = gameMetaFrom(json);
      this.prompts = buildPromptIndex(json);   // resolves runner/bare/Kaggle-env shapes itself
      if (!this.prompts.length) {
        throw new Error('No prompts found in this replay.');
      }
      const fromUrl = initialPromptParam();
      const startPosition = fromUrl !== null
        ? this.prompts.findIndex((prompt) => prompt.frameIndex === fromUrl)
        : -1;
      this.gotoPosition(startPosition >= 0 ? startPosition : (this.filteredPositions[0] ?? 0), false);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.views = [];
      this.prompts = [];
      this.meta = {};
    } finally {
      this.loading = false;
    }
  }

  gotoPosition(position: number, syncUrl = true): void {
    if (!this.prompts.length) {
      return;
    }
    this.promptIdx = Math.min(this.prompts.length - 1, Math.max(0, Math.round(position)));
    this.hoveredCandidate = null;
    this.selectedCandidate = null;
    this.copyStatus = '';
    this.reportOpen = false;        // a report is about the position it was opened on; don't carry
    this.reportText = '';           // a stale note (about a different board) onto the new prompt
    this.reportStatus = '';
    if (syncUrl) {
      this.syncUrl();
    }
  }

  gotoFrame(frameIndex: number): void {
    const position = this.prompts.findIndex((prompt) => prompt.frameIndex === frameIndex);
    if (position >= 0) {
      this.gotoPosition(position);
    }
  }

  next(): void {
    this.step(1);
  }

  previous(): void {
    this.step(-1);
  }

  nextMain(): void {
    this.stepMatching(1, (prompt) => prompt.isMain && prompt.isOurs);
  }

  previousMain(): void {
    this.stepMatching(-1, (prompt) => prompt.isMain && prompt.isOurs);
  }

  private step(direction: 1 | -1): void {
    const positions = this.filteredPositions.length
      ? this.filteredPositions
      : this.prompts.map((_prompt, index) => index);
    if (direction > 0) {
      const target = positions.find((position) => position > this.promptIdx);
      if (target !== undefined) {
        this.gotoPosition(target);
      }
      return;
    }
    let target: number | undefined;
    for (const position of positions) {
      if (position < this.promptIdx) {
        target = position;
      } else {
        break;
      }
    }
    if (target !== undefined) {
      this.gotoPosition(target);
    }
  }

  private stepMatching(direction: 1 | -1, match: (prompt: PromptView) => boolean): void {
    if (direction > 0) {
      for (let index = this.promptIdx + 1; index < this.prompts.length; index += 1) {
        if (match(this.prompts[index])) {
          this.gotoPosition(index);
          return;
        }
      }
      return;
    }
    for (let index = this.promptIdx - 1; index >= 0; index -= 1) {
      if (match(this.prompts[index])) {
        this.gotoPosition(index);
        return;
      }
    }
  }

  setFilter(filter: PromptFilter): void {
    this.filter = filter;
  }

  /** The author-move position block (header + top-5 ranked slate) for the current prompt, or null
      when it has no ranking. Only OUR decisions (prompt.ranker set) get one: the decision N/total
      numbering indexes the dashboard replay's decisions — a block from an opponent frame would point
      at a position the analyst never viewed. Shared by copyPosition and copyReport. */
  private positionBlock(): string | null {
    const prompt = this.currentPrompt;
    if (!prompt || prompt.ranker === null) {
      return null;
    }
    const { ordinal, total } = this.ourOrdinal;    // current prompt HAS ranker → counts itself; >= 1
    const file = this.meta.dashboardFile ?? 'optionranker_replay_?.json';
    const lines = [
      `# Position — ${file} · decision ${ordinal}/${total} · turn ${prompt.turn} · ${prompt.context}`,
    ];
    for (const row of prompt.ranker.slice(0, 5)) {
      const mark = row.chosen ? '*' : ' ';
      const score = row.score !== null ? `[score=${row.score}]` : '';
      lines.push(`${mark} ${row.rank}. ${row.label} ${score} | ${row.reason}`);
    }
    return lines.join('\n');
  }

  /** Copy just the position block (the UI disables the button on prompts with no ranking). */
  async copyPosition(): Promise<void> {
    const block = this.positionBlock();
    if (block === null || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(block);
      this.copyStatus = 'copied';
    } catch {
      this.copyStatus = 'failed';    // e.g. document unfocused / permission denied — never
    }                                // let stale clipboard contents masquerade as this position
  }

  openReport(): void {
    if (this.currentPrompt?.ranker == null) {
      return;                        // nothing to author on this prompt — no position to attach
    }
    this.reportOpen = true;
    this.reportStatus = '';
  }

  closeReport(): void {
    this.reportOpen = false;
    this.reportStatus = '';
  }

  /** Compile the analyst's free-text note + the position block into ONE message and copy it, so the
      whole thing pastes to Claude (which routes it to author-move or `golden.py queue add`). The
      `REPORT —` prefix marks it as an intentional issue report vs a raw position paste. Keeps the
      composer open with the text intact on failure (clipboard blocked); clears + closes on success. */
  async copyReport(): Promise<void> {
    const text = this.reportText.trim();
    const block = this.positionBlock();
    if (!text || block === null) {
      return;                        // Save is disabled while empty; guard the Enter path too
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      this.reportStatus = 'failed';
      return;
    }
    try {
      await navigator.clipboard.writeText(`REPORT — ${text}\n\n${block}`);
      this.reportStatus = 'copied';
      this.reportText = '';
      this.reportOpen = false;
    } catch {
      this.reportStatus = 'failed';
    }
  }

  private syncUrl(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const prompt = this.currentPrompt;
    if (!prompt) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'analyze');
    params.set('prompt', String(prompt.frameIndex));
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  }
}

function initialPromptParam(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = new URLSearchParams(window.location.search).get('prompt');
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export const analysisStore = new AnalysisStore();
