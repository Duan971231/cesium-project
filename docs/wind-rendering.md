# Wind rendering

The default renderer uses WebGL 2 GPU advection and geographic history. Auto mode
falls back to the existing independent Canvas renderer if float render targets or
shader compilation are unavailable. The selector also permits explicit GPU/Canvas
comparison. No additional npm dependency or duplicate Cesium engine is introduced.

## Design references

- https://github.com/hongfaqiu/cesium-wind-layer — GPU state textures, computation
  commands and batched ribbon geometry. Source inspected at
  `b1f4ac4b4d158ab62c20800a28c64a4872145779`.
- https://github.com/RaymanNg/3D-Wind-Field — separate simulation/render passes and
  depth-aware rendering. Camera-driven hide/reset behavior is not adopted.
- https://github.com/QJvic/cesium-wind — configurable controls and a lightweight
  Canvas compatibility path.
- https://github.com/NOC-OI/cesium-wind-layer — configurable particle density and
  camera bounds; volumetric velocity data is outside this single-layer renderer.

The implementation here is project-specific. It uses existing Cesium 1.144.0
Renderer APIs through an isolated typed facade in `gpu/engine.ts`; these internal
APIs require regression checks when upgrading Cesium.

## Pipeline

1. Pack the downloaded north-to-south U/V grid into an RGBA float texture once.
   Longitude is periodic; manual bilinear interpolation crosses the 359°/0° seam.
2. Compute midpoint integration on the GPU, targeting about 30 simulation steps/s.
   Read/write state textures alternate. They also contain 16 geographic snapshots,
   sampled about every 80 ms, giving about 1.2 seconds of history.
3. Draw an indexed ribbon mesh. Shaders project the history for 3D, 2D and Columbus
   view, feather line edges, fade old samples and apply wind-speed colors.
4. Per-particle birth markers prevent connecting old trails to newly seeded heads.
   Out-of-view/expired particles respawn individually. Camera movement updates only
   matrices and spawn bounds; it does not allocate/reset the particle textures.
5. The layer uses the globe's depth testing and Cesium's derived log-depth shaders.
   The visual surface offset is 5 km to reduce terrain intersections; the data is
   still GFS **10 m wind**, not an atmospheric vertical profile.

Default density is 4096, configurable from 256 to 16384 on GPU. Canvas is capped
at 3000. Density changes intentionally recreate particle state; slider changes are
committed on release. Camera/zoom/mode changes preserve the existing state.

At 4096 particles the two 64×1024 RGBA32F state textures use about 2 MiB in total;
geometry, indices, wind texture and driver allocations are additional.

GPU animation shares Cesium's render loop and requests frames only while enabled.
Canvas animation uses its own overlay without requesting globe renders. GPU
simulation rate is independent of interaction render frequency. Both paths release
resources and callbacks when disabled or when the route is left.

## Verification

```sh
npm run build
```

Shader compilation and appearance should be verified in a browser in all three modes,
including repeated enable/disable, mode changes, resizing and density changes.

The panel shows browser animation-frame cadence and P95 frame interval, including
map activity. This is not GPU timer-query duration or the number of wind simulation
steps. Compare the two paths with identical particle counts, imagery, window size
and camera operations. Targets such as a frame interval below 33.3 ms are acceptance
goals, not hardware-independent guarantees. Globe imagery network load may affect
initial measurements. The static GFS sample does not auto-update.

## Browser validation, 2026-11-24

Verified actual GPU shader compilation, visible curved trails in 3D/2D/Columbus
view, dragging, zooming, renderer switching, repeated enable/disable and no console
rendering errors. GPU mode was explicitly selected during verification, so this
was not silently testing the Canvas fallback. Real terrain occlusion remains
unverified because the configured local terrain service is unavailable.

One short 1280×720 browser comparison with the same 3000 particles and satellite
imagery observed these **page animation-frame** metrics immediately after a drag:

| Path   | Page cadence | P95 frame interval |
| ------ | ------------ | ------------------ |
| Canvas | 22 fps       | 83.3 ms            |
| GPU    | 60 fps       | 16.8 ms            |

This is a single local interaction sample, not a controlled or repeatable GPU
benchmark. Background-tab throttling, imagery loading and capture tooling affect
measurements. It does not establish a universal speedup or minimum frame rate.
