# Verification

The browser suite runs against the actual React/Pixi application with MSW enabled. Each test starts with an isolated browser context and empty origin storage. The seed is fixed. Test code may inspect simulation state and advance its clock; attacks and movement enter through keyboard or pointer events. With the test clock enabled, the Pixi ticker is stopped and the real renderer draws after clock advances or resize. Synchronous advances share one browser paint instead of submitting thousands of GPU frames. Idle software rendering no longer competes with browser assertions on CI. The normal build keeps its real-time ticker.

On 30 September 2026, the final local run passed all 42 browser tests (21 desktop and 21 mobile) and all 14 simulation/input tests. TypeScript, ESLint, formatting and the production build also passed. The browser run took 2.1 minutes. Automated accessibility scans found no axe violations in the tested states; this is not a claim of complete accessibility compliance.

## Coverage

| Area          | Checks                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Options       | Limits, accessible validation, saved values after reload                                       |
| Assets        | Visible loading, rejected texture request, successful retry                                    |
| Movement      | Forward motion, rotation, arena bounds, island collision                                       |
| Weapons       | Front/port/starboard, parallel shots, cooldown, single scoring                                 |
| Enemies       | Spawn timing, both types, pursuit, Shooter projectiles                                         |
| Endings       | Death, successful timed voyage, clean restart                                                  |
| Pause         | Manual and blur pause, frozen clock, explicit resume, cleared input                            |
| Results       | Completion state, persistence, upload status                                                   |
| Lifecycle     | Repeated start/abandon, one canvas during play and none after exit                             |
| Mobile        | Pixel 7 emulation, pointer movement, responsive visual baselines                               |
| Queries       | Loading, empty, errors, ranking/history pagination, recovery                                   |
| Writes        | Both panels updated, durable pending entry, retry after refresh                                |
| Consistency   | Timeout after commit returns one record; stale reads cannot replace newer state                |
| Accessibility | Automated axe checks across menus, tables, combat, pause and results; dialog focus restoration |
| Runtime       | Every browser test fails on an unhandled page error                                            |

The simulation unit suite adds frame-rate equivalence, projectile cooldown independence, unscored Chaser self-destruction, deterministic spawns, and frozen state after an ending. A separate steering test validates the profiling route at 30, 60 and 120 input updates per second.

Additional control cases cover reverse through S/Down, independent release of aliases, saved mouse preference, cancelled edits, mixed keyboard/mouse fire, two simultaneous touch contacts, and viewport rotation. The input unit tests cover source ownership, pause cleanup, reverse bounds and opposed thrust.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

The E2E runner starts its own Vite server with a controlled clock. Stop any other server on port 5173 first; reusing a server without `VITE_TEST_MODE=true` will not expose the clock.

Screenshots in `tests/e2e/battle.spec.ts-snapshots/` cover the harbor, stable arena and result in desktop and mobile. These are Windows/Chromium baselines, using SwiftShader for reproducible rasterization. CI uses Windows to match. Fonts are bundled locally. To update intentionally, run `pnpm test:visual` and inspect all six images before committing.

In the installed Playwright/Chromium combination, a full-page assertion resets touch emulation. The visual test restores it before entering combat and asserts that the mobile helm uses its touch layout, so the mobile arena baseline cannot silently capture desktop controls.

Playwright creates `playwright-report/index.html`, screenshots on failures and retained failure traces under `test-results/`. CI uploads these directories even if a test fails. The final local HTML report is also copied into `docs/evidence/playwright-report/` for review without a rerun.

Expected HTTP failures from selected network scenarios may appear in browser network diagnostics. They are handled by the UI. They are distinct from unhandled JavaScript errors, which the suite rejects.

## Public deployment

The GitHub Pages build of `021abf6` passed a fresh-browser smoke test on 1 October 2026 UTC (30 September locally). The same commit passed the [Windows CI suite](https://github.com/luizfelippe-dev/pirate-battle/actions/runs/36769317273). It loaded the ranking through MSW, survived refresh, preserved the mouse preference, exercised mouse fire with reverse movement, ran the normal combat clock without test hooks, paused/resumed, abandoned without recording, and completed another match. That result appeared once in ranking and history and remained available after refresh. There were no unhandled browser errors. The raw result is in [public-smoke.json](evidence/public-smoke.json).

```sh
node scripts/smoke.mjs https://luizfelippe-dev.github.io/pirate-battle/ --complete
```

This test uses the published build and waits for a real-time match ending. The controlled network failure cases are covered by the browser suite above.

The published build of `3c634d7` also passed the mobile/audio smoke check on 1 October 2026 UTC. Pixel 7 emulation covered 393 × 727, 844 × 390 and 320 × 568 viewports. The arena, HUD and controls stayed inside each viewport without horizontal overflow. Two simultaneous touches exercised sailing and cannon fire; the weapon cooldown indicator responded. Pause froze the clock and resume advanced it again.

The check observed the browser's real media playback promises: cannon audio started without rejection, the sound preference survived refresh in both states, muted combat created no audio instances, and abandoning disposed the active audio. This checks browser playback, not audible output from physical speakers. Results are in [mobile-smoke.json](evidence/mobile-smoke.json).

```sh
node scripts/smoke-mobile.mjs https://luizfelippe-dev.github.io/pirate-battle/
```

## Manual checks still matter

Mobile results are browser emulation, not physical-device measurements. Hardware audio output and a physical multitouch screen need a manual pass. Automated axe scans also cannot establish how usable a fast visual action game is for every player.
