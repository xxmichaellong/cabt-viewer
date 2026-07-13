# Analysis site — rebase discipline (local branch)

The `local` branch carries the game-analysis site (`?view=analyze`) plus the replay decision dock
on top of Charlie's upstream (`origin`). These rules keep rebases onto `origin/main` trivial.

## Rules

1. **New feature code lives only in new files**: `src/lib/analysis/` and
   `src/lib/components/analysis/` (the older dock files `SearchDock/RankerPanel/MctsPanel` are
   ours too).
2. **Shared-file touch allowlist**: `src/App.svelte` (one mount branch per view),
   `src/lib/components/TableShell.svelte` (already touched), `public/games.html` (entirely ours).
   Everything else upstream is read-only.
3. **Frame enrichment is additive only**: `_`-prefixed fields (`_ranker`, `_rankerContext`,
   `_plan`, `_derived`, `_selectedIndices`, `_rankerSelected`, `_mcts`, `_engineChoice`) plus a
   top-level `meta` next to `visualize`. The viewer must tolerate every one of them being absent
   (old files render degraded, never broken). `buildDecisionSteps` is NEVER modified — decision
   data attaches after the fact by frame index (see `cabtReplayToSnapshot`).
4. **Remotes**: `origin` = charlielockyer-rice/cabt-viewer — NEVER push there. Backups go to
   `fork` = xxmichaellong/cabt-viewer: `git push fork local` after every working session.
5. **Rebase cadence**: `git fetch origin && git rebase origin/main local` periodically; re-verify
   the App.svelte mount hunk and the GameBoard prop surface in `AnalysisPage.svelte` afterwards
   (they are the only coupling points).

## Data producers (ptcg-kaggle repo)

`run/rulebased/capture_option_ranker.py` (env: `N OPPS DRIVER VIEWER PLANNER_VIEW`) writes
`public/game-logs/optionranker_<opp>_s<seed>.json`; `run/rulebased/build_viewer_index.py` writes
`optionranker_manifest.json` for `games.html`. The per-frame schema is documented there.
