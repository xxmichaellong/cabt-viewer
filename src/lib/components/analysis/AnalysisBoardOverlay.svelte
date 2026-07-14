<script lang="ts">
  // Serial-keyed board annotations for the analysis page: engine-truth damage/KO badges,
  // hover highlight for the options panel, and an optional plan overlay (KO turns + threat
  // heat). A pure measuring layer over `[data-pokemon-serial]` tiles (BoardSlot stamps the
  // attribute) — zero edits to the board components. Degrades silently when data is absent.
  import type { PromptView } from '../../analysis/promptIndex';

  type Props = {
    prompt: PromptView | null;
    hoveredCandidate: number | null;
    planOverlay: boolean;
    hoveredKoName: string | null;
    /** The element to measure tile rects against (the board container). */
    host: HTMLElement | null;
  };

  let { prompt, hoveredCandidate, planOverlay, hoveredKoName, host }: Props = $props();

  type TileRect = { serial: number; left: number; top: number; width: number; height: number };

  let rects = $state<TileRect[]>([]);

  function measure(): void {
    if (!host) {
      rects = [];
      return;
    }
    const hostRect = host.getBoundingClientRect();
    const next: TileRect[] = [];
    for (const tile of host.querySelectorAll<HTMLElement>('[data-pokemon-serial]')) {
      const serial = Number(tile.dataset.pokemonSerial);
      if (!Number.isFinite(serial)) {
        continue;
      }
      const rect = tile.getBoundingClientRect();
      next.push({
        serial,
        left: rect.left - hostRect.left,
        top: rect.top - hostRect.top,
        width: rect.width,
        height: rect.height,
      });
    }
    rects = next;
  }

  // Re-measure when the prompt (board state) changes and when the host resizes.
  $effect(() => {
    void prompt?.frameIndex;
    if (!host) {
      return;
    }
    // Wait a frame so the new board DOM has laid out.
    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  });

  let hitsBySerial = $derived(new Map((prompt?.derived?.hits ?? []).map((hit) => [hit.serial, hit])));

  let hoveredRow = $derived(
    hoveredCandidate !== null
      ? prompt?.ranker?.find((row) => row.optionIndex === hoveredCandidate) ?? null
      : null,
  );

  // Forward-attack hover: an ATTACK row with oracle but no target serial paints their Active.
  let activeThreatSerial = $derived(prompt?.derived?.threats.find((threat) => threat.active)?.serial ?? null);
  let hoverSerial = $derived(
    hoveredRow?.targetSerial
    ?? (hoveredRow?.oracle && hoveredRow.targetSerial === null ? activeThreatSerial : null),
  );
  let hoverOracle = $derived(hoveredRow?.oracle ?? (hoverSerial !== null ? hitsBySerial.get(hoverSerial) ?? null : null));

  let playedSerials = $derived.by((): Set<number> => {
    const serials = new Set<number>();
    const rows = prompt?.ranker ?? [];
    for (const row of rows) {
      if (row.chosen && row.targetSerial !== null) {
        serials.add(row.targetSerial);
      }
    }
    return serials;
  });

  // Plan overlay: newer captures carry the EXACT target serial on each ko_set row; older
  // files only have names, so fall back to first-unused-name against the threat table
  // (ambiguous with duplicate-named Pokemon — the serial path exists precisely for that).
  let koBySerial = $derived.by((): Map<number, { turn: number; prize: number; name: string }> => {
    const map = new Map<number, { turn: number; prize: number; name: string }>();
    if (!prompt?.plan?.ko_set) {
      return map;
    }
    const used = new Set<number>();
    for (const ko of prompt.plan.ko_set) {
      let serial: number | null = Number.isFinite(Number(ko.serial)) ? Number(ko.serial) : null;
      if (serial === null && prompt.derived) {
        const threat = prompt.derived.threats.find(
          (candidate) => candidate.name === ko.name && candidate.serial !== null && !used.has(candidate.serial),
        );
        serial = threat?.serial ?? null;
      }
      if (serial !== null) {
        used.add(serial);
        map.set(serial, { turn: ko.turn ?? 0, prize: ko.prize ?? 1, name: ko.name ?? '' });
      }
    }
    return map;
  });

  let threatBySerial = $derived(
    new Map((prompt?.derived?.threats ?? []).filter((threat) => threat.serial !== null).map((threat) => [threat.serial as number, threat])),
  );
</script>

<div class="overlay" aria-hidden="true">
  {#each rects as rect (rect.serial)}
    {@const hit = hitsBySerial.get(rect.serial)}
    {@const ko = planOverlay ? koBySerial.get(rect.serial) : undefined}
    {@const threat = planOverlay ? threatBySerial.get(rect.serial) : undefined}
    {@const isHover = hoverSerial === rect.serial}
    {@const koHover = hoveredKoName !== null && koBySerial.get(rect.serial)?.name === hoveredKoName}
    <div
      class="tile"
      class:hover={isHover || koHover}
      class:played={playedSerials.has(rect.serial)}
      style={`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`}
    >
      {#if threat && threat.threat > 1}
        <div class="heat" style={`opacity:${Math.min(0.35, (threat.threat - 1) * 0.3)}`}></div>
      {/if}
      {#if hit}
        <span class="badge" class:ko={hit.ko}>{hit.damage}{hit.ko ? '·KO' : ''}</span>
      {:else if isHover && hoverOracle}
        <span class="badge" class:ko={hoverOracle.ko}>{hoverOracle.damage}{hoverOracle.ko ? '·KO' : ''}</span>
      {/if}
      {#if ko}
        <span class="ribbon">KO t{ko.turn} · {ko.prize}pz</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 9;
    pointer-events: none;
  }

  .tile {
    position: absolute;
    border-radius: 8px;
  }

  .tile.hover {
    outline: 2px solid var(--accent-base);
    outline-offset: 2px;
  }

  .tile.played {
    outline: 2px solid #58a86e;
    outline-offset: 2px;
  }

  .heat {
    position: absolute;
    inset: 0;
    border-radius: 8px;
    background: #c04352;
  }

  .badge {
    position: absolute;
    top: -7px;
    right: -6px;
    padding: 1px 6px;
    border: 1px solid var(--accent-base);
    border-radius: 9px;
    background: var(--surface-toolbar-bg);
    color: var(--accent-base);
    font-size: 10px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .badge.ko {
    border-color: #c04352;
    color: #d4707c;
  }

  .ribbon {
    position: absolute;
    bottom: -7px;
    left: 50%;
    padding: 1px 6px;
    border: 1px solid #58a86e;
    border-radius: 9px;
    background: var(--surface-toolbar-bg);
    color: #58a86e;
    font-size: 9px;
    font-weight: 800;
    white-space: nowrap;
    transform: translateX(-50%);
  }
</style>
