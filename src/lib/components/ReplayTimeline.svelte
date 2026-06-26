<script lang="ts">
  import type { ReplaySnapshot, ReplayStep } from '../game/replay';

  type Props = {
    replay: ReplaySnapshot;
    step: ReplayStep;
    stepIndex: number;
    playing: boolean;
    speed: number;
    setStep: (index: number) => void;
    previousStep: () => void;
    nextStep: () => void;
    firstStep: () => void;
    lastStep: () => void;
    togglePlay: () => void;
    setSpeed: (ms: number) => void;
  };

  let {
    replay,
    step,
    stepIndex,
    playing,
    speed,
    setStep,
    previousStep,
    nextStep,
    firstStep,
    lastStep,
    togglePlay,
    setSpeed,
  }: Props = $props();

  const SPEEDS = [
    { ms: 1600, label: '0.5×' },
    { ms: 800, label: '1×' },
    { ms: 400, label: '2×' },
    { ms: 200, label: '4×' },
  ];

  let maxStepIndex = $derived(Math.max(0, replay.steps.length - 1));

  function onStepInput(event: Event) {
    setStep(Number((event.currentTarget as HTMLInputElement).value));
  }

  function onSpeedChange(event: Event) {
    setSpeed(Number((event.currentTarget as HTMLSelectElement).value));
  }
</script>

<section class="replay-dock" aria-label="Replay timeline">
  <div class="replay-caption" title={step.label}>
    <span>{step.label}</span>
  </div>
  <div class="replay-controls" aria-label="Replay playback controls">
    <button
      class="play-toggle"
      aria-label={playing ? 'Pause' : 'Play'}
      aria-pressed={playing}
      onclick={togglePlay}
    >{playing ? '❚❚' : '▶'}</button>
    <button aria-label="First action" onclick={firstStep} disabled={stepIndex === 0}>|&lt;</button>
    <button aria-label="Previous action" onclick={previousStep} disabled={stepIndex === 0}>&lt;</button>
    <input
      aria-label="Action step"
      type="range"
      min="0"
      max={maxStepIndex}
      value={stepIndex}
      oninput={onStepInput}
    />
    <button aria-label="Next action" onclick={nextStep} disabled={stepIndex >= maxStepIndex}>&gt;</button>
    <button aria-label="Last action" onclick={lastStep} disabled={stepIndex >= maxStepIndex}>&gt;|</button>
    <select class="speed-select" aria-label="Playback speed" onchange={onSpeedChange}>
      {#each SPEEDS as option (option.ms)}
        <option value={option.ms} selected={option.ms === speed}>{option.label}</option>
      {/each}
    </select>
  </div>
</section>

<style>
  .replay-dock {
    position: absolute;
    /* Bottom playback strip: spans the board column and sits in the bottom inset the shell
       reserves via --replay-dock-h. Pinned INSIDE the shell so overflow:hidden never clips it. */
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    height: var(--replay-dock-h, 56px);
    z-index: 12;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    border-top: 1px solid var(--surface-toolbar-border);
    background: var(--surface-toolbar-bg);
    color: var(--text-primary);
    box-shadow: var(--surface-toolbar-shadow);
    backdrop-filter: blur(var(--backdrop-blur));
  }

  .replay-caption {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 7px);
    width: min(520px, calc(100% - 44px));
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .replay-caption span {
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    padding: 7px 13px;
    border: 1px solid var(--surface-toolbar-border);
    border-radius: 999px;
    background: var(--surface-toolbar-bg);
    color: var(--text-primary);
    box-shadow: var(--surface-toolbar-shadow);
    backdrop-filter: blur(var(--backdrop-blur));
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 850;
    line-height: 1;
  }

  .replay-controls {
    width: 100%;
    display: grid;
    grid-template-columns: 32px 32px 32px minmax(0, 1fr) 32px 32px auto;
    align-items: center;
    gap: 8px;
  }

  .play-toggle {
    font-size: 12px;
  }

  .speed-select {
    height: 30px;
    padding: 0 4px;
    border-radius: 5px;
    border: 1px solid var(--input-border);
    background: var(--input-bg);
    color: var(--input-text);
    font-size: 11px;
    font-weight: 800;
  }

  .replay-controls button {
    width: 32px;
    height: 30px;
    padding: 0;
    min-width: 0;
    border-radius: 5px;
    border: 1px solid var(--button-border);
    background: var(--button-bg);
    color: var(--button-text);
    font-size: 11px;
    font-weight: 800;
  }

  input[type='range'] {
    width: 100%;
  }

  @media (max-width: 860px) {
    .replay-dock {
      padding: 7px 10px;
    }

    .replay-caption {
      width: min(420px, calc(100% - 20px));
      bottom: calc(100% + 5px);
    }

    .replay-caption span {
      padding: 6px 10px;
      font-size: 12px;
    }
  }
</style>
