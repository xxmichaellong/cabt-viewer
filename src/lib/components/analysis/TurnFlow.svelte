<script lang="ts">
  import type { PromptView } from '../../analysis/promptIndex';
  import type { TurnGroup } from '../../analysis/analysis.svelte';

  type Props = {
    groups: TurnGroup[];
    currentFrameIndex: number;
    gotoFrame: (frameIndex: number) => void;
    /** Collapse the rail (the discoverable affordance; the header 'turns' toggle also works). */
    oncollapse?: () => void;
  };

  let { groups, currentFrameIndex, gotoFrame, oncollapse }: Props = $props();

  let rail = $state<HTMLElement | null>(null);

  // Keep the current prompt in view as navigation moves.
  $effect(() => {
    const target = rail?.querySelector(`[data-frame="${currentFrameIndex}"]`);
    target?.scrollIntoView({ block: 'nearest' });
  });

  function chosenLabel(prompt: PromptView): string {
    if (prompt.ranker) {
      const played = prompt.ranker.find((row) => row.chosen);
      if (played) {
        return played.label;
      }
    }
    const first = prompt.selectedIndices[0];
    return first !== undefined ? prompt.fallbackLabels[first] ?? '' : '';
  }

  function ghosts(prompt: PromptView): string[] {
    if (!prompt.ranker) {
      return [];
    }
    return prompt.ranker.filter((row) => !row.chosen).slice(0, 3).map((row) => row.label);
  }

  function contextClass(prompt: PromptView): string {
    if (!prompt.isOurs) {
      return 'ctx-opp';
    }
    if (prompt.isMain) {
      return 'ctx-main';
    }
    if (prompt.context.startsWith('DAMAGE') || prompt.context === 'EFFECT_TARGET') {
      return 'ctx-target';
    }
    if (prompt.context.startsWith('TO_') || prompt.context.startsWith('ATTACH')) {
      return 'ctx-search';
    }
    return 'ctx-other';
  }

  function contextAbbrev(context: string): string {
    return context
      .replaceAll('DAMAGE_COUNTER_ANY', 'DMG')
      .replaceAll('DAMAGE_COUNTER', 'DMG')
      .replaceAll('EFFECT_TARGET', 'TGT')
      .replaceAll('DISCARD_ENERGY', 'DISC·E')
      .replaceAll('TO_HAND', 'FETCH')
      .replaceAll('TO_BENCH', 'BENCH')
      .replaceAll('TO_ACTIVE', 'PROMOTE')
      .replaceAll('ATTACH_FROM', 'ATT·FROM')
      .replaceAll('ATTACH_TO', 'ATT·TO');
  }
</script>

<nav class="turnflow" bind:this={rail} aria-label="Turn flow">
  {#if oncollapse}
    <div class="rail-head">
      <span>turns</span>
      <button type="button" onclick={oncollapse} title="Collapse the turn rail (widens the board)">◂ hide</button>
    </div>
  {/if}
  {#each groups as group (group.turn)}
    <div class="turn">
      <div class="turn-label">{group.turn === 0 ? 'setup' : `turn ${group.turn}`}</div>
      {#each group.prompts as prompt (prompt.frameIndex)}
        {@const current = prompt.frameIndex === currentFrameIndex}
        <div class="node-wrap" data-frame={prompt.frameIndex}>
          <button
            type="button"
            class="node {contextClass(prompt)}"
            class:main={prompt.isMain && prompt.isOurs}
            class:current
            onclick={() => gotoFrame(prompt.frameIndex)}
            title={`${prompt.context} · frame ${prompt.frameIndex}`}
          >
            <span class="dot"></span>
            {#if prompt.isMain && prompt.isOurs}
              <span class="node-label">{chosenLabel(prompt)}</span>
            {:else}
              <span class="node-ctx">{contextAbbrev(prompt.context)}</span>
              <span class="node-mini">{chosenLabel(prompt)}</span>
            {/if}
          </button>
          {#if current && prompt.isMain}
            {#each ghosts(prompt) as ghost}
              <div class="ghost" title="Not taken (rank-ordered alternative)">{ghost}</div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</nav>

<style>
  .turnflow {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    padding: 10px 8px;
    overflow-y: auto;
    overflow-x: hidden;
    border-right: 1px solid var(--surface-toolbar-border);
    background: var(--surface-toolbar-bg);
  }

  .rail-head {
    position: sticky;
    top: -10px;               /* rides the rail's own padding */
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -4px -2px 0;
    padding: 4px 4px 5px;
    background: var(--surface-toolbar-bg);
    color: var(--text-secondary);
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .rail-head button {
    padding: 1px 7px;
    border: 1px solid var(--surface-inset-border);
    border-radius: 6px;
    background: var(--surface-inset-bg);
    color: var(--text-secondary);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.05em;
    cursor: pointer;
  }

  .rail-head button:hover {
    border-color: var(--accent-base);
    color: var(--accent-base);
  }

  .turn {
    display: grid;
    gap: 2px;
  }

  /* Keep intrinsic (nowrap) node labels from blowing the rail's grid tracks. */
  .turn > :global(*) {
    min-width: 0;
  }

  .turn-label {
    padding: 2px 4px;
    color: var(--text-secondary);
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .node {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    margin: 0;
    padding: 2px 5px;
    border: 0;
    border-radius: 5px;
    background: none;
    color: var(--text-secondary);
    font: inherit;
    font-size: 10.5px;
    text-align: left;
    cursor: pointer;
  }

  .node:hover {
    background: var(--surface-inset-bg);
  }

  .node.current {
    background: var(--accent-soft);
    color: var(--text-primary);
    outline: 1px solid var(--accent-base);
  }

  .dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.7;
  }

  .node.main .dot {
    width: 9px;
    height: 9px;
  }

  .ctx-main {
    color: var(--text-primary);
  }

  .ctx-target .dot {
    background: #d4707c;
  }

  .ctx-search .dot {
    background: #58a86e;
  }

  .ctx-opp {
    opacity: 0.45;
  }

  .node-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 650;
  }

  .node-ctx {
    flex: none;
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .node-mini {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 9.5px;
  }

  .ghost {
    margin-left: 22px;
    padding: 1px 4px;
    overflow: hidden;
    color: var(--text-secondary);
    opacity: 0.55;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 9.5px;
    font-style: italic;
  }
</style>
