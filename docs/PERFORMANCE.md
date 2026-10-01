# Performance

Measured on 30 September 2026 using a production Vite build of balance version 2, including the water and ship wake effects. Raw measurements are in [profile.json](evidence/profile.json), with the result screen in [profile-result.png](evidence/profile-result.png).

## Three-minute voyage

| Environment | Value                                                   |
| ----------- | ------------------------------------------------------- |
| CPU         | Intel Core i7-9700, 8 logical cores                     |
| RAM         | 47.8 GiB                                                |
| OS          | Windows 11, build 26200                                 |
| Browser     | Chromium 153.0.8010.12, headless                        |
| Renderer    | Intel UHD Graphics 630, ANGLE / Direct3D 11             |
| Viewport    | 1280 × 800, DPR 1                                       |
| Settings    | 180 seconds, one enemy every 6 seconds, seed 7321       |
| Input       | Automated keyboard steering with all three weapons held |
| Audio       | Disabled                                                |

| Measurement                    | Result                                             |
| ------------------------------ | -------------------------------------------------- |
| Active simulation time         | 180 seconds                                        |
| Render intervals recorded      | 10,795                                             |
| Mean frame rate                | 60.00 FPS                                          |
| 95th-percentile frame interval | 17.80 ms                                           |
| Peak entities                  | 28, including player, enemies, bullets and effects |
| Outcome                        | Survived, 25 points, 88 health                     |
| Unhandled browser errors       | 0                                                  |

The frame interval includes browser scheduling as well as game work; it is not CPU render time alone. The six-second spawn interval makes the automated route reliably survive the full measurement. It is a supported configuration, but less dense than the four-second default. This does not establish a 60 FPS guarantee for the one-second extreme.

An earlier run selected SwiftShader software rendering automatically. It measured 32.29 FPS and a 33.80 ms p95 at a four-second spawn interval; the automated player died at 110.65 seconds. That record is preserved in [profile-software.json](evidence/profile-software.json). The runs use different settings and renderers, so they are environment diagnostics, not an optimization A/B comparison.

## Repeated mounting

The main run then starts, plays for three seconds, pauses and abandons five games. Each sample follows explicit garbage collection through Chromium's debugging protocol. All samples have one document and zero remaining canvases. Listener/node counts return to their prior range. JavaScript heap grows from 7.64 MB before the cycles to 8.21 MB after five cycles.

I investigated that increase with a separate 25-cycle run and heap snapshots at cycles 5 and 25. The lifecycle now explicitly destroys owned Graphics contexts as well as containers, while retaining shared asset textures. In the extended run, document, DOM node and event listener counts stayed fixed at 1, 324 and 207; canvases returned to zero each time. The heap grew from 6.90 MB to 8.36 MB, mostly during warm-up, with a smaller increase continuing later.

The object-count comparison still found 20 additional Pixi BindGroup objects after 20 further mounts, plus associated arrays/objects. This is a small retained-resource issue in the current renderer/library lifecycle, not an ever-growing active arena or listener tree. It is recorded as a limitation rather than claiming the runtime is leak-free. The object counts and samples are in `evidence/memory-extended.json`; the earlier run is in `evidence/memory-before-context-disposal.json`.

These figures describe JavaScript heap and DOM resources. They do not measure total GPU memory. Forced collection helps diagnose lifecycle issues but does not model normal browser collection timing.

## Reproduction

```sh
pnpm run profile
```

The script builds with `.env.profile`, starts a preview, drives the player's keyboard handlers, and writes JSON and a screenshot. It does not set health, inject scores or bypass collisions. Windows runs explicitly select D3D11; other systems use the browser default and report the detected renderer.

For the longer lifecycle investigation, run `node scripts/memory.mjs` after `pnpm build:profile`. Run `pnpm build` afterward to restore a production build without profiling hooks.

Physical phones, other browsers, high-DPI displays and the densest spawn setting have not been benchmarked. Mobile E2E checks layout and interaction through emulation; it does not provide mobile GPU performance evidence.
