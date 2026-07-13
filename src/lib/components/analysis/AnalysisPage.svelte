<script lang="ts">
  // ?view=analyze — the game-analysis page. Steps EVERY engine prompt exactly as the
  // agent saw it (MAIN menus and resolver sub-prompts alike), with the full option slate,
  // structured logic path, derived info, plan panel, and a serial-keyed board overlay.
  // The board is Charlie's own renderer (TableShell → BoardLayer → GameBoard) fed one
  // SETTLED view per prompt with all interactions no-op'd — see docs/analysis-site.md.
  import BoardLayer from '../BoardLayer.svelte';
  import GameBoard from '../GameBoard.svelte';
  import Hand from '../Hand.svelte';
  import PlayerPanel from '../PlayerPanel.svelte';
  import TableShell from '../TableShell.svelte';
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

  let watchUrl = $derived(
    `/?view=replay&replayUrl=${encodeURIComponent(analysisStore.replayUrl)}`,
  );

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
  <div class="analysis-layout">
    <TurnFlow
      groups={analysisStore.turnGroups}
      currentFrameIndex={prompt.frameIndex}
      gotoFrame={(frameIndex) => analysisStore.gotoFrame(frameIndex)}
    />

    <div class="board-column" bind:this={boardHost}>
      <header class="analysis-head">
        <a class="back" href="/games.html" title="Game index">◂ games</a>
        <strong>
          {meta.opponent ?? 'game'}
          {#if meta.seed !== undefined}<small>· seed {meta.seed}</small>{/if}
          {#if meta.won !== undefined}
            <span class="outcome" class:won={meta.won}>{meta.won ? 'WIN' : 'LOSS'}</span>
          {/if}
          {#if meta.driver}<small>· {meta.driver} drove</small>{/if}
        </strong>
        <nav class="prompt-nav">
          <button onclick={() => analysisStore.previous()} title="Previous prompt (←)">◀</button>
          <span>
            prompt {position >= 0 ? position + 1 : '·'} / {analysisStore.filteredPositions.length}
            <small>· turn {prompt.turn} · {prompt.context}</small>
          </span>
          <button onclick={() => analysisStore.next()} title="Next prompt (→)">▶</button>
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
          <button onclick={() => void analysisStore.copyPosition()} title="Copy the author-move position header">
            {analysisStore.copiedPosition ? 'position copied' : 'copy position'}
          </button>
          <a href={watchUrl} title="Open this game in the animated replayer">watch ▸</a>
        </div>
      </header>

      <TableShell debugZones={false} replayMode={false}>
        <BoardLayer>
          {#each view.players as panelPlayer (panelPlayer.index)}
            <PlayerPanel side={panelPlayer.index === 0 ? 'bottom' : 'top'}>
              <Hand
                player={panelPlayer}
                selectedHand={null}
                disabled={true}
                playableIndexes={[]}
                concealed={panelPlayer.index !== 0}
                onSelect={() => {}}
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
            clickSlot={() => {}}
            allowDrop={() => {}}
            dropToSlot={() => {}}
            canPlaceSetupActive={() => false}
            placeSetupActive={() => {}}
            showZone={() => {}}
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
        </BoardLayer>
      </TableShell>

      <AnalysisBoardOverlay
        {prompt}
        hoveredCandidate={analysisStore.hoveredCandidate}
        planOverlay={analysisStore.planOverlay}
        {hoveredKoName}
        host={boardHost}
      />
    </div>

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
  </div>
{/if}

<style>
  .analysis-layout {
    /* Board width math: TableShell subtracts this from 100vw. */
    --analysis-dock-w: 640px;
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

  /* The turn rail eats 250px that TableShell's 100vw math doesn't know about. */
  .board-column :global(.table-shell) {
    width: 100%;
    min-width: 0;
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

  .prompt-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    white-space: nowrap;
  }

  .prompt-nav span {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
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
