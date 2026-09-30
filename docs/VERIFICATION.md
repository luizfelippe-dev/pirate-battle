# Verification

The browser suite runs against the actual React/Pixi application with MSW enabled. Each test starts with an isolated browser context and empty origin storage. The seed is fixed. Test code may inspect simulation state and advance its clock; attacks and movement enter through keyboard or pointer events.

On 30 September 2026, the final local run passed all 36 browser tests (18 desktop and 18 mobile) and all 11 simulation tests. TypeScript, ESLint, formatting and the production build also passed. The browser run took 4.2 minutes. Automated accessibility scans found no axe violations in the tested states; this is not a claim of complete accessibility compliance.

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

Playwright creates `playwright-report/index.html`, screenshots on failures and retained failure traces under `test-results/`. CI uploads these directories even if a test fails. The final local HTML report is also copied into `docs/evidence/playwright-report/` for review without a rerun.

Expected HTTP failures from selected network scenarios may appear in browser network diagnostics. They are handled by the UI. They are distinct from unhandled JavaScript errors, which the suite rejects.

## Manual checks still matter

Mobile results are browser emulation, not physical-device measurements. Hardware audio output and a physical multitouch screen need a manual pass. The public deployment also needs a fresh-browser smoke test after its URL exists; local results cannot establish that a hosting configuration works.
