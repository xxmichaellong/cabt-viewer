<script lang="ts">
  // ?view=analyze — the game-analysis page. Steps EVERY engine prompt exactly as the
  // agent saw it (MAIN menus and resolver sub-prompts alike), with the full option slate,
  // structured logic path, derived info, plan panel, and a serial-keyed board overlay.
  // The board is Charlie's own renderer (TableShell → BoardLayer → GameBoard) fed one
  // SETTLED view per prompt with all interactions no-op'd — see docs/analysis-site.md.
  import ActiveFocus from '../ActiveFocus.svelte';
  import BoardLayer from '../BoardLayer.svelte';
  import GameBoard from '../GameBoard.svelte';
  import Hand from '../Hand.svelte';
  import PlayerPanel from '../PlayerPanel.svelte';
  import TableShell from '../TableShell.svelte';
  import ZoneViewer from '../ZoneViewer.svelte';
  import CardFocus from './CardFocus.svelte';
  import { selectionStore } from '../../../state/selection.svelte';
  import { zoneViewerStore } from '../../../state/zoneViewer.svelte';
  import type { CardView } from '../../game/types';
  import AnalysisBoardOverlay from './AnalysisBoardOverlay.svelte';
  import AnalysisOptionsPanel from './AnalysisOptionsPanel.svelte';
  import DerivedPanel from './DerivedPanel.svelte';
  import LogicPathPanel from './LogicPathPanel.svelte';
  import PlanPanel from './PlanPanel.svelte';
  import TurnFlow from './TurnFlow.svelte';
  import { untrack } from 'svelte';
  import { analysisStore, type PromptFilter } from '../../analysis/analysis.svelte';

  type Props = {
    replayUrl: string;
  };

  let { replayUrl }: Props = $props();

  let boardHost = $state<HTMLElement | null>(null);
  let hoveredKoName = $state<string | null>(null);

  // Scale-to-fit: TableShell's internal geometry is viewport-coupled (100vh / vw-clamped card
  // sizes) and maxes out around --min-table-width, so it can't grow into a wide column or
  // shrink into a narrow one on its own. We pin it to its natural design size and uniformly
  // transform-scale the whole board to FIT the column: bigger when there's room, fully
  // visible (never clipped) when there isn't.
  let headerEl = $state<HTMLElement | null>(null);
  let viewportEl = $state<HTMLElement | null>(null);
  let scalerEl = $state<HTMLElement | null>(null);
  let headerH = $state(90);
  let boardScale = $state(1);

  $effect(() => {
    if (!viewportEl || !scalerEl) {
      return;
    }
    const measure = () => {
      headerH = headerEl?.offsetHeight ?? 0;
      const vw = viewportEl!.clientWidth;
      const vh = viewportEl!.clientHeight;
      const nw = scalerEl!.offsetWidth;
      const nh = scalerEl!.offsetHeight;
      if (vw > 4 && vh > 4 && nw > 4 && nh > 4) {
        boardScale = Math.min(vw / nw, vh / nh, 2);
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(viewportEl);
    ro.observe(scalerEl);
    if (headerEl) {
      ro.observe(headerEl);
    }
    measure();
    return () => ro.disconnect();
  });

  // Collapsible side columns (persisted). TableShell reads --analysis-dock-w to size the board,
  // so collapsing genuinely reclaims the width for the playmat.
  function persisted(key: string, initial: boolean): boolean {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : raw === '1';
    } catch {
      return initial;    // SSR, or storage blocked (getItem itself throws SecurityError)
    }
  }
  let railCollapsed = $state(persisted('analysis.railCollapsed', false));
  let panelsCollapsed = $state(persisted('analysis.panelsCollapsed', false));
  function toggleRail(): void {
    railCollapsed = !railCollapsed;
    try { window.localStorage.setItem('analysis.railCollapsed', railCollapsed ? '1' : '0'); } catch { /* private mode */ }
  }
  function togglePanels(): void {
    panelsCollapsed = !panelsCollapsed;
    try { window.localStorage.setItem('analysis.panelsCollapsed', panelsCollapsed ? '1' : '0'); } catch { /* private mode */ }
  }
  let dockWidth = $derived((railCollapsed ? 26 : 250) + (panelsCollapsed ? 26 : 390));

  $effect(() => {
    const url = replayUrl;
    if (url) {
      // untrack: load() reads/writes store $state (loading etc.) — without this the effect
      // would depend on that state and re-trigger itself in a perpetual reload loop.
      untrack(() => void analysisStore.load(url));
    }
  });

  let prompt = $derived(analysisStore.currentPrompt);
  let view = $derived(analysisStore.currentView);
  let meta = $derived(analysisStore.meta);
  let position = $derived(analysisStore.filteredPositions.indexOf(analysisStore.promptIdx));

  // The "report" composer (write a note + copy it with the position for pasting to Claude).
  let reportEl = $state<HTMLTextAreaElement | null>(null);
  // Enter copies (Shift+Enter = newline); Esc closes. Local to the textarea so it never reaches the
  // window arrow-key nav (which also bails inside inputs — see onKeydown).
  function onReportKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void analysisStore.copyReport();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      analysisStore.closeReport();
    }
  }
  // Focus the textarea when the composer opens. focus() touches no reactive state, so no loop
  // (unlike the store.load() effect that needed untrack — see docs/analysis-site.md).
  $effect(() => {
    if (analysisStore.reportOpen && reportEl) {
      reportEl.focus();
    }
  });

  let watchUrl = $derived(
    `/?view=replay&replayUrl=${encodeURIComponent(analysisStore.replayUrl)}`,
  );

  // Card close-ups (display-only reuse of the replayer's overlays; see docs/analysis-site.md):
  // board slot → ActiveFocus, discard/lost/stadium pile → ZoneViewer, hand card → CardFocus.
  let focusedHandCard = $state<CardView | null>(null);
  let focusedSlot = $derived(selectionStore.focusedSlot);
  let viewedCards = $derived(view ? zoneViewerStore.cardsFor(view) : []);

  $effect(() => {
    void prompt?.frameIndex;      // navigating prompts dismisses any stale overlay
    selectionStore.clearFocus();
    zoneViewerStore.close();
    focusedHandCard = null;
  });

  function closeOverlays(): void {
    selectionStore.clearFocus();
    zoneViewerStore.close();
    focusedHandCard = null;
  }

  const FILTERS: Array<{ id: PromptFilter; label: string; title: string }> = [
    { id: 'ours', label: 'our prompts', title: 'Every prompt our agent answered' },
    { id: 'main', label: 'MAIN only', title: 'Turn-level decisions only' },
    { id: 'all', label: 'all', title: 'Both seats, every prompt' },
  ];

  function onKeydown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (event.shiftKey) {
        analysisStore.nextMain();
      } else {
        analysisStore.next();
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (event.shiftKey) {
        analysisStore.previousMain();
      } else {
        analysisStore.previous();
      }
    } else if (event.key === 'Escape') {
      closeOverlays();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if analysisStore.loading}
  <section class="analysis-message"><strong>Loading game…</strong></section>
{:else if analysisStore.error}
  <section class="analysis-message">
    <strong>Unable to load the game</strong>
    <span>{analysisStore.error}</span>
    <a href="/games.html">← back to the game index</a>
  </section>
{:else if prompt && view}
  {@const bottomPlayer = view.players[0]}
  {@const topPlayer = view.players[1]}
  <div class="analysis-layout" style={`--analysis-dock-w: ${dockWidth}px`}>
    {#if railCollapsed}
      <button class="strip rail-strip" onclick={toggleRail} title="Show the turn rail">turns ▸</button>
    {:else}
      <TurnFlow
        groups={analysisStore.turnGroups}
        currentFrameIndex={prompt.frameIndex}
        gotoFrame={(frameIndex) => analysisStore.gotoFrame(frameIndex)}
        oncollapse={toggleRail}
      />
    {/if}

    <div class="board-column" bind:this={boardHost}>
      <header class="analysis-head" bind:this={headerEl}>
        <a class="back" href="/games.html" title="Game index">◂ games</a>
        <strong>
          {meta.opponent ?? 'game'}
          {#if meta.seed !== undefined}<small>· seed {meta.seed}</small>{/if}
          {#if meta.draw}
            <span class="outcome draw">DRAW</span>
          {:else if meta.won !== undefined}
            <span class="outcome" class:won={meta.won}>{meta.won ? 'WIN' : 'LOSS'}</span>
          {/if}
          {#if meta.driver}<small>· {meta.driver} drove</small>{/if}
          {#if meta.iteration}<small>· {meta.iteration}{meta.seeded ? ' (seeded)' : ''}</small>{/if}
        </strong>
        <nav class="prompt-nav">
          <!-- Arrows sit together at the nav's fixed left edge (the nav has a FIXED width and the
               label ellipsizes) so click targets never shift as the prompt text changes. -->
          <button onclick={() => analysisStore.previous()} title="Previous prompt (←)">◀</button>
          <button onclick={() => analysisStore.next()} title="Next prompt (→)">▶</button>
          <span>
            prompt {position >= 0 ? position + 1 : '·'} / {analysisStore.filteredPositions.length}
            <small>· turn {prompt.turn} · {prompt.context}</small>
          </span>
        </nav>
        <div class="filters" role="group" aria-label="Prompt filter">
          {#each FILTERS as filter (filter.id)}
            <button
              class:on={analysisStore.filter === filter.id}
              onclick={() => analysisStore.setFilter(filter.id)}
              title={filter.title}
            >{filter.label}</button>
          {/each}
        </div>
        <div class="tools">
          <button
            class:on={analysisStore.planOverlay}
            onclick={() => (analysisStore.planOverlay = !analysisStore.planOverlay)}
            title="Paint the plan's KO turns + threat heat on the board"
          >plan overlay</button>
          <button
            onclick={() => void analysisStore.copyPosition()}
            disabled={prompt.ranker === null}
            title={prompt.ranker === null
              ? 'Only our decisions have a position to author (this prompt carries no ranking)'
              : 'Copy the author-move position header'}
          >
            {analysisStore.copyStatus === 'copied' ? 'position copied'
              : analysisStore.copyStatus === 'failed' ? 'copy FAILED — retry'
              : 'copy position'}
          </button>
          <div class="report-tool">
            <button
              class:on={analysisStore.reportOpen}
              onclick={() => (analysisStore.reportOpen ? analysisStore.closeReport() : analysisStore.openReport())}
              disabled={prompt.ranker === null}
              title={prompt.ranker === null
                ? 'Only our decisions can be reported (this prompt carries no ranking)'
                : 'Write a note about this position, then copy note + board state to paste to Claude'}
            >
              {analysisStore.reportStatus === 'copied' ? 'report copied' : 'report'}
            </button>
            {#if analysisStore.reportOpen}
              <div class="report-pop">
                <label class="report-head" for="report-note">
                  Report this position
                  <small>note + the position slate get copied together — paste to Claude</small>
                </label>
                <textarea
                  id="report-note"
                  bind:this={reportEl}
                  bind:value={analysisStore.reportText}
                  onkeydown={onReportKeydown}
                  rows="4"
                  placeholder="What should the ranker do here, and why? (Enter to copy · Shift+Enter for a newline · Esc to close)"
                ></textarea>
                <div class="report-actions">
                  <span class="report-hint" class:fail={analysisStore.reportStatus === 'failed'}>
                    {analysisStore.reportStatus === 'failed' ? 'clipboard blocked — retry' : ''}
                  </span>
                  <button onclick={() => analysisStore.closeReport()}>cancel</button>
                  <button
                    class="primary"
                    disabled={!analysisStore.reportText.trim()}
                    onclick={() => void analysisStore.copyReport()}
                  >copy report</button>
                </div>
              </div>
            {/if}
          </div>
          <button class:on={!railCollapsed} onclick={toggleRail} title="Show/hide the turn rail">turns</button>
          <button class:on={!panelsCollapsed} onclick={togglePanels} title="Show/hide the analysis panels">panels</button>
          <a href={watchUrl} title="Watch this game with animations in the replayer (the analysis view shows settled snapshots)">animated replay ▸</a>
        </div>
      </header>

      <div class="board-viewport" bind:this={viewportEl} style={`top: ${headerH}px`}>
        <div class="board-scaler" bind:this={scalerEl} style={`transform: translate(-50%, -50%) scale(${boardScale})`}>
      <TableShell debugZones={false} replayMode={false}>
        <BoardLayer>
          {#each view.players as panelPlayer (panelPlayer.index)}
            <PlayerPanel side={panelPlayer.index === 0 ? 'bottom' : 'top'}>
              <Hand
                player={panelPlayer}
                selectedHand={null}
                disabled={panelPlayer.index !== 0}
                playableIndexes={panelPlayer.index === 0 ? panelPlayer.hand.map((_c, i) => i) : []}
                concealed={panelPlayer.index !== 0}
                onSelect={(playerIndex, handIndex) => {
                  const card = view?.players[playerIndex]?.hand[handIndex];
                  if (card) focusedHandCard = card;
                }}
                onDrag={() => {}}
                onDragEnd={() => {}}
              />
            </PlayerPanel>
          {/each}

          <GameBoard
            {topPlayer}
            {bottomPlayer}
            canPlayToBenchArea={() => false}
            canPlaceSetupBench={() => false}
            playToBenchArea={() => {}}
            placeSetupBench={() => {}}
            allowBenchDrop={() => {}}
            dropToBenchArea={() => {}}
            isPlayableTarget={() => false}
            isBoardPromptSelectable={() => false}
            isBoardPromptSelected={() => false}
            boardPickTally={() => 0}
            clickSlot={(slot) => {
              if (!slot.empty && slot.pokemon) selectionStore.focusSlot(slot);
            }}
            allowDrop={() => {}}
            dropToSlot={() => {}}
            canPlaceSetupActive={() => false}
            placeSetupActive={() => {}}
            showZone={(playerIndex, zone, title, faceDown) =>
              zoneViewerStore.show(playerIndex, zone, title, faceDown)}
            canPlayOnBoard={false}
            clickBoardPlay={() => {}}
            allowBoardPlayDrop={() => {}}
            dropToBoardPlay={() => {}}
            animationEvents={[]}
            animationScopeKey={`analysis-${prompt.frameIndex}`}
            animationTurnKey="analysis"
            evolutionChromeEvents={[]}
            replayMode={true}
            showEvalBar={false}
          />

          <!-- Card close-ups: display-only (canAct=false / inert action) — no engine calls. -->
          {#if focusedSlot}
            <ActiveFocus
              slot={focusedSlot}
              busy={false}
              promptActive={false}
              canAct={false}
              close={() => selectionStore.clearFocus()}
              selectOption={() => {}}
            />
          {/if}
          <ZoneViewer
            open={zoneViewerStore.open}
            title={zoneViewerStore.title}
            cards={viewedCards}
            faceDown={zoneViewerStore.faceDown}
            actionLabel=""
            actionDisabled={true}
            close={() => zoneViewerStore.close()}
          />
          {#if focusedHandCard}
            <CardFocus card={focusedHandCard} close={() => (focusedHandCard = null)} />
          {/if}
        </BoardLayer>
      </TableShell>
        </div>
      </div>

      <AnalysisBoardOverlay
        {prompt}
        hoveredCandidate={analysisStore.hoveredCandidate}
        planOverlay={analysisStore.planOverlay}
        {hoveredKoName}
        host={boardHost}
      />
    </div>

    {#if panelsCollapsed}
      <button class="strip panel-strip" onclick={togglePanels} title="Show the analysis panels">◂ analysis</button>
    {:else}
    <aside class="panels">
      <AnalysisOptionsPanel
        {prompt}
        selectedCandidate={analysisStore.selectedCandidate}
        onHover={(optionIndex) => (analysisStore.hoveredCandidate = optionIndex)}
        onSelect={(optionIndex) => (analysisStore.selectedCandidate = optionIndex)}
      />
      {#if prompt.ranker}
        <LogicPathPanel {prompt} selectedCandidate={analysisStore.selectedCandidate} />
      {/if}
      {#if prompt.plan}
        <PlanPanel plan={prompt.plan} onHoverKoName={(name) => (hoveredKoName = name)} />
      {/if}
      {#if prompt.derived}
        <DerivedPanel derived={prompt.derived} />
      {/if}
      <footer class="hint">← → prompt · shift+← → MAIN · hover an option to highlight its target</footer>
    </aside>
    {/if}
  </div>
{:else}
  <!-- No replayUrl (or nothing loaded): never a silent blank page. -->
  <section class="analysis-message">
    <strong>No game specified</strong>
    <span>Open a game from the index (the URL needs a <code>replayUrl</code> parameter).</span>
    <a href="/games.html">← back to the game index</a>
  </section>
{/if}

<style>
  .analysis-layout {
    /* Board width math: TableShell subtracts --analysis-dock-w from 100vw. The value is set
       INLINE from the rail/panels collapse state so collapsing widens the playmat. */
    display: flex;
    align-items: stretch;
    min-height: 100vh;
  }

  .analysis-layout > :global(.turnflow) {
    width: 250px;
    flex: none;
    height: 100vh;
    position: sticky;
    top: 0;
  }

  .board-column {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
  }

  /* The board renders at its natural design size and the scaler fits it to the column. */
  .board-viewport {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
  }

  /* Absolute-centered so an oversized natural box (the landscape design box is wider than a
     narrow column) centers on the viewport and overflows symmetrically instead of start-aligning
     and clipping off the right. translate(-50%,-50%) centers regardless of the box's own size;
     scale then fits it (see the boardScale effect). */
  .board-scaler {
    position: absolute;
    top: 50%;
    left: 50%;
    width: max-content;
    transform-origin: center;
  }

  .board-viewport :global(.table-shell) {
    /* Pin the shell to a FIXED design box AND its whole card-size cascade (board + hand card
       widths are otherwise viewport-clamped — pinning the box but not the cards made the board
       sparse at large windows). The frozen geometry matches a well-proportioned ~1440x950
       native window; the scaler then fits it to the column uniformly at ANY window size.
       Width MUST be the LANDSCAPE native width, not --min-table-width (the 760px floor): pinning
       the box to the floor made it portrait, so the scaler fit it to HEIGHT and left the board a
       narrow strip centered in a wide column. A landscape box fits to WIDTH and fills the column. */
    --board-design-w: 1440px;
    --board-design-h: 880px;
    --board-h: calc(var(--board-design-h) - var(--board-top-inset) - var(--board-bottom-inset));
    --board-card-w: 80px;
    --hand-card-w: 112px;
    width: var(--board-design-w);
    min-width: 0;
    height: var(--board-design-h);
    min-height: var(--board-design-h);
    overflow: hidden;
  }

  /* Children that anchor to 100vh directly must follow the design box instead, or the bottom
     half of the board clips at tall windows. */
  .board-viewport :global(.table-shell .board) {
    height: var(--board-design-h);
  }

  .board-viewport :global(.table-shell .player-panel.bottom) {
    top: calc(var(--board-design-h) - var(--board-bottom-inset) + var(--hand-board-gap) - var(--hand-hover-clearance));
  }

  .analysis-head {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 30;
    display: flex;
    flex-wrap: wrap;              /* narrow windows: nav/filters/tools drop to a second row
                                     instead of crushing the title and overflowing the column */
    align-items: center;
    gap: 4px 10px;
    padding: 7px 12px;
    border-bottom: 1px solid var(--surface-toolbar-border);
    background: var(--surface-toolbar-bg);
    backdrop-filter: blur(var(--backdrop-blur));
    font-size: 12px;
  }

  .analysis-head .back {
    flex: none;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 11px;
  }

  .analysis-head .back:hover {
    color: var(--text-primary);
  }

  .analysis-head strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .analysis-head small {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .outcome {
    margin-left: 6px;
    padding: 0 7px;
    border: 1px solid #c04352;
    border-radius: 9px;
    color: #d4707c;
    font-size: 9.5px;
    font-weight: 800;
  }

  .outcome.won {
    border-color: #2f8a55;
    color: #58d18b;
  }

  .outcome.draw {
    border-color: var(--surface-inset-border);
    color: var(--text-secondary);
  }

  .prompt-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    white-space: nowrap;
    width: 330px;               /* FIXED: the arrows never move as the prompt text changes */
    flex: none;
  }

  .prompt-nav span {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .prompt-nav small {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .prompt-nav button,
  .filters button,
  .tools button {
    padding: 2px 8px;
    border: 1px solid var(--surface-inset-border);
    border-radius: 6px;
    background: var(--surface-inset-bg);
    color: var(--text-primary);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .prompt-nav button:hover,
  .filters button:hover,
  .tools button:hover {
    border-color: var(--accent-base);
  }

  .filters,
  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
  }

  .filters button.on,
  .tools button.on {
    border-color: var(--accent-base);
    color: var(--accent-base);
    font-weight: 700;
  }

  .tools a {
    padding: 2px 8px;
    color: var(--accent-base);
    text-decoration: none;
    font-size: 11px;
    font-weight: 700;
  }

  /* Report composer: a small popover anchored under its button. */
  .report-tool {
    position: relative;
    display: flex;
    align-items: center;
  }

  .report-pop {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 40;
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--surface-toolbar-border);
    border-radius: 8px;
    background: var(--surface-panel-bg);
    box-shadow: var(--surface-toolbar-shadow);
  }

  .report-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .report-head small {
    font-weight: 400;
    font-size: 10px;
    color: var(--text-secondary);
  }

  .report-pop textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    min-height: 64px;
    padding: 6px 8px;
    border: 1px solid var(--surface-inset-border);
    border-radius: 6px;
    background: var(--surface-inset-bg);
    color: var(--text-primary);
    font: inherit;
    font-size: 12px;
    line-height: 1.4;
  }

  .report-pop textarea:focus {
    outline: none;
    border-color: var(--accent-base);
  }

  .report-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .report-hint {
    flex: 1;
    font-size: 10px;
    color: var(--text-secondary);
  }

  .report-hint.fail {
    color: var(--danger-text);
    font-weight: 700;
  }

  .report-pop .primary {
    border-color: var(--accent-base);
    background: var(--accent-base);
    color: var(--text-on-accent);
    font-weight: 700;
  }

  .report-pop .primary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .strip {
    flex: none;
    width: 26px;
    height: 100vh;
    position: sticky;
    top: 0;
    padding: 14px 0;
    border: 0;
    background: var(--surface-toolbar-bg);
    color: var(--text-secondary);
    font: inherit;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    writing-mode: vertical-rl;
    cursor: pointer;
  }

  .strip:hover {
    color: var(--accent-base);
  }

  .rail-strip {
    border-right: 1px solid var(--surface-toolbar-border);
  }

  .panel-strip {
    border-left: 1px solid var(--surface-toolbar-border);
  }

  .panels {
    width: 390px;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100vh;
    position: sticky;
    top: 0;
    padding: 12px;
    overflow-y: auto;
    border-left: 1px solid var(--surface-toolbar-border);
    background: var(--surface-toolbar-bg);
    color: var(--text-primary);
  }

  .hint {
    margin-top: auto;
    padding-top: 8px;
    color: var(--text-secondary);
    font-size: 9.5px;
  }

  .analysis-message {
    display: grid;
    gap: 8px;
    place-content: center;
    min-height: 100vh;
    color: var(--text-primary);
    text-align: center;
  }

  .analysis-message a {
    color: var(--accent-base);
  }
</style>
