# Architecture

## Runtime boundaries

React owns the harbor, options, tables, result screen, pause dialog, and semantic HUD. Pixi owns the arena, ships, projectiles, effects, and health bars. `Simulation` does not import React, Pixi, browser APIs, storage, or the network layer. It can run under a unit test without a canvas.

`Combat` creates one simulation and one renderer for a mounted game. The ticker advances the simulation and then renders its state. React receives HUD snapshots at most ten times per active second; entity coordinates never enter React state. A match ID is created only on completion, and the completion callback has a one-shot guard.

The E2E build stops the automatic ticker. Its controlled clock calls the real simulation and renderer together, and resizing still renders the viewport. This avoids continuously repainting frozen frames on a software GPU. Profiling and public builds use the normal ticker, so E2E timings are not presented as game performance measurements.

The modules are deliberately small:

| Module               | Responsibility                                                |
| -------------------- | ------------------------------------------------------------- |
| `game/config.ts`     | Arena, islands, validation and balance constants              |
| `game/simulation.ts` | Fixed-step movement, AI, collision, weapons and match rules   |
| `game/input.ts`      | Keyboard/mouse bindings and aggregation of held input sources |
| `game/renderer.ts`   | Texture loading, Pixi objects and viewport fitting            |
| `game/audio.ts`      | Reusable sound instances and disposal                         |
| `game/telemetry.ts`  | Opt-in frame and entity measurements                          |
| `data/storage.ts`    | Persisted options, identity, results and pending queue        |
| `data/api.ts`        | Axios client and Query defaults                               |
| `data/mocks.ts`      | Shared REST handlers, fixtures and reproducible failures      |
| `ui/Records.tsx`     | Paged ranking/history query states                            |

## Simulation

An accumulator consumes fixed 1/120-second steps. Rendering frequency changes how many steps run, not movement speed, cooldown duration, or damage. A small epsilon avoids losing a final step to floating-point rounding. The browser adapter caps one frame's catch-up to 100 ms to avoid a spiral after a long main-thread stall. Pausing clears the accumulator and input state. The test clock feeds the same accumulator without a browser-frame cap.

The simulation snapshots options at construction. Enemy type selection follows the configured sequence, while spawn positions come from a seeded linear congruential generator. Candidate positions must be inside the arena, outside islands, clear of other enemies, and at least 330 units from the player. Failed candidates are skipped rather than forcing an unsafe spawn.

Chasers turn toward and pursue the player. Shooters close to their preferred distance, turn before firing, and use a separate cooldown. A nearby island changes the desired heading toward a tangent. This is local steering rather than a navigation mesh; it suits three circular islands but is not intended for maze-like maps.

Ship collision uses circles and axis-separated movement, allowing sliding along shorelines. Projectile collision runs every fixed step. At the configured maximum projectile speed, travel per step is 3.5 units, smaller than the projectile radius and smallest target. A projectile is consumed by its first obstacle or valid target, and dead enemies are excluded immediately. Increasing projectile speed substantially would require a swept-segment test.

Port and starboard cannons spawn three shots with parallel directions and perpendicular offsets. Each weapon has its own active-time cooldown. Chaser contact removes the Chaser and damages the player without awarding score. A player projectile that reduces an enemy to zero awards exactly one point.

Time and health endings lock the simulation. Calls to `advance` after an ending do nothing. Abandonment unmounts the runtime without creating a result.

## Resources and layout

`Assets.load` caches the small set of shared textures. All required textures must resolve before input and combat begin; failures expose a retry action. Repeated matches reuse textures. Per-match containers, graphics, sprite instances, ticker, canvas, ResizeObserver, keyboard listeners, blur/visibility listeners, and audio instances are disposed on exit.

Async initialization checks cancellation after texture loading and after application initialization. If React Strict Mode unmounts a pending initialization, that instance never attaches listeners or starts combat. Shared texture sources are retained intentionally; destroying them per match would invalidate the global asset cache.

The animated water uses a shared tile texture and active simulation time, so it freezes with the rest of the arena during pause. The repeated-mount investigation and remaining library resource retention are documented in [Performance](docs/PERFORMANCE.md).

The world is fixed at 1200 × 720. A ResizeObserver fits it uniformly within the available rectangle and centers any letterboxing. Device resolution is capped at 2 to limit fill-rate cost. Touch controls express actions, not screen coordinates, so resizing cannot change input physics. Health bars stay above each ship independently of heading.

`InputController` records the source of each held action. Space and the mouse may hold the same cannon; releasing one source leaves the other active. Pointer IDs separate simultaneous touches. Pause clears both source ownership and simulation input, and repeated keyboard events cannot restore a held key after resuming. Mouse listeners belong only to the arena and are installed only when the saved preference is enabled.

Reverse thrust uses its own speed through the same collision system. Forward and reverse cancel each other. Balance version 2 separates these runs from scores produced before reverse was available. Mouse preference is an input choice, so it is persisted separately from the match's gameplay configuration. Weapon readiness is read into the same throttled HUD snapshot as score and health.

Wake particles are renderer-only, expire after 1.2 seconds of active time, and are capped at 160. A single Graphics object draws them. They never enter combat collision or scoring, and their buffers are cleared on disposal.

## REST contracts

`GET /api/ranking?page=1&duration=90&spawnInterval=4` returns scores with the same options and balance version. `GET /api/history?page=1&player=<id>` returns that player's completed matches. Both return `{ items, total, page, pages }`, five rows per page.

`POST /api/history` accepts `{ id, playerId, playerName, date, score, duration, reason, config, version }`. `config` contains the starting session/spawn settings; `version` identifies the balance constants. `reason` is `time` or `sunk`. Duration is actual active simulation time. The body ID is also sent as an `Idempotency-Key` header. The mock indexes by match ID and returns an existing match on retry.

Ranking and history derive from one confirmed-record collection. There is no second insert that could leave the two panels inconsistent. Mock GET handlers snapshot the collection before their simulated delay, making genuinely stale responses possible during testing.

Query keys include resource, page, and options. Each query forwards TanStack Query's AbortSignal to Axios. Unmounted page requests can be cancelled; different pages/configurations have separate cache entries. Scenario changes cancel in-flight reads before invalidation. Successful writes invalidate both resource prefixes. Panels refetch on mount and window focus, and display pending, empty, error, and background-refresh states.

## Durable results

Completion writes the last result and outbox before beginning the mutation. Success acknowledges only the matching ID. Failed entries remain available after refresh and can be retried while another game runs. The mock commits before delaying the `timeout-after-save` response; the retry retrieves that commit instead of duplicating it.

Storage is scoped to a browser origin. Clearing site data removes it. This submission does not synchronize tabs or devices and does not pretend client-side results are trustworthy. A production backend would validate runs and enforce uniqueness transactionally.

## Accessibility and tradeoffs

Menus use native buttons, labels, forms and visible focus. Native modal dialogs contain focus and support Escape. Options restores focus to its trigger; resuming restores focus to the arena. The HUD exposes score, time and health as text without an every-frame live announcement. Errors and registration updates have semantic status regions.

Combat remains a visual action game; the semantic HUD is not a nonvisual gameplay alternative. Browser mobile emulation covers layout and touch input, but is not a substitute for testing a physical phone. Those limits are reported separately from automated test results.
