import { describe, expect, it } from 'vitest';
import { cabtReplayToSnapshot } from './cabtReplay';

describe('cabtReplayToSnapshot', () => {
  it('renders physical attached energy cards instead of provided energy units', () => {
    const snapshot = cabtReplayToSnapshot({
      visualize: [{
        current: {
          turn: 1,
          yourIndex: 0,
          result: -1,
          players: [{
            active: [{
              id: 710,
              serial: 10,
              hp: 180,
              maxHp: 180,
              energies: [1, 1],
              energyCards: [{ id: 1, serial: 20, playerIndex: 0, name: 'Basic {G} Energy' }],
            }],
            bench: [],
            benchMax: 5,
            handCount: 0,
            deckCount: 0,
            prize: [],
          }, {
            active: [],
            bench: [],
            benchMax: 5,
            handCount: 0,
            deckCount: 0,
            prize: [],
          }],
        },
      }],
    });

    expect(snapshot.views[0].players[0].active.energy).toHaveLength(1);
    expect(snapshot.views[0].players[0].active.energy[0].name).toBe('Basic Grass Energy');
  });

  it('does not render provided energy units as attached cards', () => {
    const snapshot = cabtReplayToSnapshot({
      visualize: [{
        current: {
          turn: 1,
          yourIndex: 0,
          result: -1,
          players: [{
            active: [{
              id: 710,
              serial: 10,
              hp: 180,
              maxHp: 180,
              energies: [1, 1],
            }],
            bench: [],
            benchMax: 5,
            handCount: 0,
            deckCount: 0,
            prize: [],
          }, {
            active: [],
            bench: [],
            benchMax: 5,
            handCount: 0,
            deckCount: 0,
            prize: [],
          }],
        },
      }],
    });

    expect(snapshot.views[0].players[0].active.energy).toHaveLength(0);
  });

  it('summarizes multi-prize frames instead of showing only the last prize card move', () => {
    const snapshot = cabtReplayToSnapshot({
      visualize: [{
        logs: [
          { type: 'MoveCard', playerIndex: 0, cardId: 96, fromArea: 6, toArea: 2 },
          { type: 'MoveCard', playerIndex: 0, cardId: 1261, fromArea: 6, toArea: 2 },
        ],
        current: {
          turn: 8,
          yourIndex: 0,
          result: -1,
          players: [{
            active: [],
            bench: [],
            benchMax: 5,
            handCount: 0,
            deckCount: 0,
            prize: [],
          }, {
            active: [],
            bench: [],
            benchMax: 5,
            handCount: 0,
            deckCount: 0,
            prize: [],
          }],
        },
      }],
    });

    expect(snapshot.steps[0].label).toBe('Player 1 took 2 Prize cards.');
  });

  it('uses attack names in replay step labels when card metadata has them', () => {
    const snapshot = cabtReplayToSnapshot({
      visualize: [{
        logs: [
          { type: 'Attack', playerIndex: 0, cardId: 96, serial: 3, attackId: 120 },
          { type: 'HpChange', playerIndex: 1, cardId: 150, serial: 72, value: -270, putDamageCounter: false },
          { type: 'MoveCard', playerIndex: 1, cardId: 1, serial: 111, fromArea: 8, toArea: 3 },
        ],
        current: {
          turn: 7,
          yourIndex: 0,
          result: -1,
          players: [{
            active: [{ id: 96, serial: 3, hp: 210, maxHp: 210 }],
            bench: [],
            benchMax: 5,
            handCount: 0,
            deckCount: 0,
            prize: [],
          }, {
            active: [],
            bench: [],
            benchMax: 5,
            handCount: 0,
            deckCount: 0,
            prize: [],
          }],
        },
      }],
    });

    expect(snapshot.steps[0].label).toBe('Player 1 used Myriad Leaf Shower with Teal Mask Ogerpon ex.');
  });

  const emptyPlayer = {
    active: [],
    bench: [],
    benchMax: 5,
    handCount: 0,
    deckCount: 0,
    prize: [],
  };

  it('builds a search overlay ranked by visits with the played option marked', () => {
    const snapshot = cabtReplayToSnapshot({
      visualize: [{
        select: {
          type: 'YesNo',
          context: 'IsFirst',
          option: [{ type: 1 }, { type: 2 }],
        },
        _engineChoice: [1],
        _mcts: [
          { select: [0], visits: 200, q: -0.1, prior: 0.25 },
          { select: [1], visits: 800, q: 0.3, prior: 0.75 },
        ],
        current: { turn: 0, yourIndex: 0, result: -1, players: [emptyPlayer, emptyPlayer] },
      }],
    });

    const mcts = snapshot.steps[0].mcts;
    expect(mcts).toBeTruthy();
    expect(mcts?.totalVisits).toBe(1000);
    expect(mcts?.optionCount).toBe(2);
    expect(mcts?.candidates.map((candidate) => candidate.label)).toEqual(['No', 'Yes']);
    expect(mcts?.candidates[0]).toMatchObject({ visits: 800, visitShare: 0.8, chosen: true });
    expect(mcts?.candidates[1]).toMatchObject({ visits: 200, chosen: false });
  });

  it('labels a play option by its hand location when the card is hidden', () => {
    const snapshot = cabtReplayToSnapshot({
      visualize: [{
        select: { type: 'Main', context: 'Main', option: [{ type: 7, index: 0 }, { type: 14 }] },
        _engineChoice: [14],
        _mcts: [
          { select: [0], visits: 10, q: 0, prior: 0.5 },
          { select: [1], visits: 5, q: 0, prior: 0.5 },
        ],
        current: { turn: 1, yourIndex: 0, result: -1, players: [emptyPlayer, emptyPlayer] },
      }],
    });

    const labels = snapshot.steps[0].mcts?.candidates.map((candidate) => candidate.label);
    expect(labels).toContain('Play hand #0');
    expect(labels).toContain('End turn');
  });

  it('omits the search overlay when a frame has no MCTS stats', () => {
    const snapshot = cabtReplayToSnapshot({
      visualize: [{
        select: { type: 'YesNo', context: 'IsFirst', option: [{ type: 1 }, { type: 2 }] },
        current: { turn: 0, yourIndex: 0, result: -1, players: [emptyPlayer, emptyPlayer] },
      }],
    });

    expect(snapshot.steps[0].mcts).toBeNull();
  });
});
