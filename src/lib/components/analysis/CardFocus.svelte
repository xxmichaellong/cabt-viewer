<script lang="ts">
  // Single-card close-up for the analysis page. Upstream has no zoom overlay for HAND cards
  // (ActiveFocus renders board slots only), so this fills the gap: one large CardTile on a
  // dimmed backdrop. Pure display — backdrop click (or Esc, handled by AnalysisPage) closes.
  import CardTile from '../CardTile.svelte';
  import type { CardView } from '../../game/types';

  type Props = {
    card: CardView;
    close: () => void;
  };

  let { card, close }: Props = $props();
</script>

<div class="card-focus" role="dialog" aria-label={card.name}>
  <button class="backdrop" onclick={close} aria-label="Close card view"></button>
  <div class="frame">
    <CardTile {card} />
    <p>{card.name}</p>
  </div>
</div>

<style>
  .card-focus {
    position: absolute;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(8, 10, 14, 0.62);
    cursor: pointer;
  }

  .frame {
    position: relative;
    width: min(320px, 58vw);
    --card-w: min(320px, 58vw);   /* CardTile sizes itself from this var */
    pointer-events: none;
  }

  .frame p {
    margin: 8px 0 0;
    color: #e6e9ee;
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  }
</style>
