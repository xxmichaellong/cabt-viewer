<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    debugZones?: boolean;
    replayMode?: boolean;
    children: Snippet;
  };

  let { debugZones = false, replayMode = false, children }: Props = $props();
</script>

<section class="table-shell" class:debug-zones={debugZones} class:replay-mode={replayMode}>
  {@render children()}
</section>

<style>
  .table-shell.replay-mode {
    /* Replay UI = a full-width playback strip pinned to the board's reserved bottom inset.
       The search analysis lives in a sibling dock column; the board column reserves its width
       via --analysis-w so the two never overlap. As a flex child it fills the space left of
       the dock (which equals --stage-w, keeping the card-sizing math consistent). */
    --replay-dock-h: 56px;            /* height reserved at the bottom for the playback strip */
    --analysis-w: var(--analysis-dock-w, 0px);
    flex: 1 1 0;
    min-width: var(--min-table-width);
  }

  .table-shell {
    --analysis-w: 0px;
    --stage-w: calc(100vw - var(--analysis-w));   /* board scales into the space left of the panel */
    /* Floors are pulled out so short viewports can lower them (see max-height queries below)
       and let the vh-based terms shrink the board enough to fit without scrolling. */
    --board-card-w-min: 58px;
    --hand-card-w-min: 96px;
    --opponent-hand-min: 58px;
    --board-card-w: clamp(var(--board-card-w-min), min(calc(var(--stage-w) * 0.08), 8.1vh), 104px);
    --card-w: var(--board-card-w);
    --hand-card-w: min(clamp(var(--hand-card-w-min), min(calc(var(--stage-w) * 0.078), 14.5vh), 150px), calc(var(--board-card-w) * 1.55));
    --min-table-width: 760px;
    --board-row-gap: calc(var(--board-card-w) * 0.16);
    --active-gap: calc(var(--board-card-w) * 0.24);
    --bench-card-w: calc(var(--board-card-w) * 1.24);
    --bench-row-h: calc(var(--bench-card-w) * 1.42);
    --opponent-hand-height: clamp(var(--opponent-hand-min), 7.2vh, 84px);
    --replay-dock-h: 0px;
    --hand-board-gap: 0px;
    --board-top-inset: calc(var(--opponent-hand-height) + var(--hand-board-gap));
    --hand-hover-pad: calc(var(--board-card-w) * 0.065);
    --hand-hover-clearance: calc(var(--hand-hover-pad) + 12px);
    --hand-shadow-clearance: calc(var(--hand-hover-pad) + 14px);
    --board-bottom-inset: calc((var(--hand-card-w) * 1.397) + (var(--hand-hover-pad) * 2.5) + 14px + var(--replay-dock-h));
    --board-right-rail: 150px;
    --table-side-gap: 14px;
    --player-panel-right: calc(var(--board-right-rail) + 8px);
    --board-h: calc(100vh - var(--board-top-inset) - var(--board-bottom-inset));
    --board-edge-pad: calc(var(--board-card-w) * 0.32);
    --board-outline-pad-y: calc(var(--board-card-w) * 0.06);
    --board-content-pad: calc(var(--board-card-w) * 0.18);
    --board-edge-pad-x: var(--board-edge-pad);
    --board-content-inset-y: calc(var(--board-outline-pad-y) + var(--board-content-pad));
    --board-content-inset-x: calc(var(--board-edge-pad-x) + var(--board-content-pad));
    width: max(var(--stage-w), var(--min-table-width));
    min-width: var(--min-table-width);
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    padding: 0;
    background: var(--app-backdrop-bg);
    -webkit-user-select: none;
    user-select: none;
  }

  .table-shell :global(*) {
    -webkit-user-select: none;
    user-select: none;
  }

  .table-shell :global(img) {
    -webkit-user-drag: none;
  }

  /* Short viewports: lower the card floors so the whole board + hands + playback strip fit
     within the height budget (--board-h) instead of being clipped / forcing a scroll. */
  @media (max-height: 820px) {
    .table-shell {
      --board-card-w-min: 46px;
      --hand-card-w-min: 76px;
      --opponent-hand-min: 46px;
    }
  }

  @media (max-height: 680px) {
    .table-shell {
      --board-card-w-min: 38px;
      --hand-card-w-min: 62px;
      --opponent-hand-min: 40px;
    }
  }
</style>
