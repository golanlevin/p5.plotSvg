# Temporary Debug Summary: p5.js v2 Compatibility Status

## Current Status

The earlier p5.js v2 `bezier()` export crash has been addressed. The library now pauses SVG recording while calling original p5 functions, which prevents p5 v2 internals from leaking malformed `beginShape()` / `bezierVertex()` commands into the SVG command stream.

Current test infrastructure lives under `test/`:

- `test/compat/split.html` shows p5 v1 and p5 v2 side by side.
- `test/compat/sketch.js` draws a shared compatibility sketch.
- `test/p5-compat.spec.js` runs Playwright smoke tests against p5 v1.11.13 and p5 v2.2.2.

The latest browser smoke test passed:

```sh
npx playwright test test/p5-compat.spec.js test/p5-compat2.spec.js --browser=chromium
```

Result: `4 passed`.

The local p5 copies are ignored through `.gitignore` via `temp/`.

## v2 Compatibility Findings

1. **Completed: v1 curve APIs now have p5.js v2 shims.**

   `curve()` records v1-style curve geometry and draws through p5 v2's `spline()` with `ends: EXCLUDE`, restoring the prior spline end-mode afterward.

   `curveTightness()` now maps to p5 v2's `splineProperty("tightness", value)` and keeps the exporter state in sync.

2. **Completed: `curveVertex()` now has a p5.js v2 shim.**

   v1 `curveVertex()` calls record the same legacy curve-vertex path data and draw through p5 v2's `splineVertex()` with temporary `ends: EXCLUDE` state for the current shape.

3. **Completed: `quadraticVertex()` now has a p5.js v2 shim.**

   v1 `quadraticVertex()` calls record quadratic SVG path data and draw through p5 v2's `bezierOrder(2)` point stream, restoring the prior Bezier order after each compatibility call.

4. **Old six-argument `bezierVertex()` is dangerous under v2.**

   The exporter still records six-argument `bezierVertex()` as a v1-style cubic segment, but p5 v2's real canvas API interprets `bezierVertex()` as point-stream calls.

   Result: in v2, old sketches can produce an SVG that looks like the old v1 intent while the canvas does not. That is a screen/export mismatch.

5. **Completed: instance mode no longer pollutes globals.**

   A browser probe with `new p5(sketch)` for v1 and v2 confirms export works and `window.line` / `window.rect` return to their pre-recording own-property state after `endRecordSvg()`.

   The fix tracks original property descriptors per overridden target/name pair and restores those descriptors exactly. In instance mode, p5.plotSvg now skips unnecessary global overrides; in global mode, it still overrides globals as expected.

6. **Intentionally unsupported: `clip()`, `beginClip()`, and `endClip()`.**

   Clipping support is out of scope for both p5.js v1 and v2. Correctly exporting clipped geometry for pen plotters would require computational geometry for shape-shape intersections, occlusion, and path splitting, which p5.plotSvg will not attempt to provide.

   The library may still warn when clipping APIs are used, but the expected behavior is that clipped drawing exports as unclipped geometry.

7. **Text support is not fully v2-aware.**

   Text font extraction handles strings and an older `font.font.names` shape, but p5 v2's `p5.Font` path differs. This is likely to break loaded-font SVG `font-family` values.

   Vertical `textAlign()` was already known incomplete, and v2 uses canvas text baseline values that do not line up cleanly with the current switch.

8. **Tests are still too shallow for full compatibility.**

   The Playwright tests now verify that both versions produce valid SVG with expected element counts and that the v1 curve shims work under v2. They still do not compare exact path data, instance-mode cleanup, loaded fonts, or screen/export visual equivalence.

## Priority

1. Completed: add v2 shims for `curve()`, `curveTightness()`, `curveVertex()`, and `quadraticVertex()`.
2. Decide what to do with old six-argument `bezierVertex()` under v2: warn hard, shim it, or require v2 examples.
3. Completed: fix instance-mode global pollution.
4. Add tests that compare actual path `d` data for v1/v2 curve equivalents.
5. Document and preserve the intentional non-support stance for `clip()`, `beginClip()`, and `endClip()`.
6. Revisit text after geometry compatibility is stable.

## Official p5.js Add-on Assessment

p5.plotSvg is close in spirit to a p5.js add-on, but it is not yet structured like a modern official add-on. The main gap is packaging and registration: p5 add-ons are expected to attach methods to `p5.prototype` or, in p5 v2, register through `p5.registerAddon()`. p5.plotSvg currently exposes a standalone `p5plotSvg` namespace and many direct globals on `window`.

The practical conversion path is to use the local `temp/p5.js-addon-template-main/templates/basic` pattern rather than the custom renderer template. A custom renderer would be a much larger redesign and would conflict with p5.plotSvg's current model: keep drawing to the normal p5 canvas, then temporarily capture drawing commands only during explicit SVG export.

Needed changes:

1. Completed: add an official add-on installer function, `plotSvgAddon(p5, fn, lifecycles)`, which attaches methods such as `beginRecordSvg()`, `endRecordSvg()`, `setSvgDocumentSize()`, and related configuration functions to the p5 sketch API. p5 v2 now uses `p5.registerAddon(plotSvgAddon)` when available; p5 v1 falls back to invoking the same installer directly against `p5.prototype`.
2. Completed: add prototype methods without removing globals. p5 instances now expose wrappers such as `sketch.beginRecordSvg("file.svg")`, `sketch.endRecordSvg()`, and `sketch.setSvgDocumentSize(w, h)`, while existing `beginRecordSvg(this, "file.svg")` and `p5plotSvg.beginRecordSvg(this, "file.svg")` usage remains supported.
3. Completed: add flexible argument handling for add-on-native usage. The old explicit form `beginRecordSvg(this, "file.svg")` still works, global-mode sketches can use `beginRecordSvg("file.svg")`, and instance-mode sketches can use `sketch.beginRecordSvg("file.svg")`. In p5 v2 global mode, p5 may expose `beginRecordSvg` through a prototype-generated global alias, so the wrapper detects `this === p5.instance` and records against `window` to ensure global drawing functions are captured.
4. Stop relying on broad unconditional global exports. Let p5 expose prototype methods globally in global mode, while keeping the existing globals as compatibility aliases if needed.
5. Add a Rollup-based build pipeline like the template, producing an IIFE build for script tags and an ESM build for imports/npm. Update `package.json` with an `exports` map.
6. Support both p5 v1 and p5 v2: p5 v2 can use `p5.registerAddon()`, while p5 v1 needs a fallback that mutates `p5.prototype` directly.
7. Document the temporary p5 function override model honestly. It technically conflicts with the p5 recommendation not to overwrite p5 functions, but p5.plotSvg does so only during recording and restores exact property descriptors afterward.
8. Prepare p5 libraries page submission materials: category likely `Export`, concise description, author info, license, docs link, examples, npm/CDN links, and a thumbnail/image.

Important note: p5.plotSvg should not become a custom renderer unless the project intentionally changes direction. The current export-on-demand architecture is better served by a standard add-on wrapper around the existing implementation.

## Refactor Decisions

The following refactors are intentionally out of scope:

- Do not extract shared `ellipseMode()` / `rectMode()` normalization helpers. The existing per-function handling should remain local and explicit.
- Do not replace the main SVG export dispatcher with a renderer map. The current large `if` / `else if` chain is direct, legible, and appropriate for this library.

Completed organizational cleanup:

- SVG string post-processing is now isolated behind `postProcessSvgString()`, which applies named-group merging and stroke-color grouping in one explicit final stage after base SVG serialization.
- Persistent SVG export options are now grouped in a private internal `config` object. Live recording/session state remains in the existing module variables for now.
- A private internal `session` object has been introduced. The first migrated session-only batch contains the command, vertex, group, injected header/defs arrays, plus primitive set counters. Lifecycle flags, p5 instance state, current stroke state, transform state, and override bookkeeping remain separate for later phases.
- The next recording-local state batch has also moved into `session`: transform-existence tracking.
- Recording lifecycle and active shape state have moved into `session`: recording on/off, recording-begun state, recording session id, shape mode, and shape kind. p5 instance identity, p5 version/global-mode state, curve/spline compatibility state, Inkscape label bookkeeping, and override bookkeeping remain separate.
- Active p5 target/version context has moved into `session`: p5 instance, pixel density, p5 major version, and global-mode detection. Curve/spline compatibility state, Inkscape label bookkeeping, warning flags, and override bookkeeping remain separate.
- Curve/spline compatibility state has moved into `session`: curve tightness, Bezier order, spline end-mode, and the v2 curveVertex compatibility span state. Inkscape label bookkeeping, warning flags, and override bookkeeping remain separate.
- Inkscape layer bookkeeping is now grouped under `session.layers`. Warn-once flags are grouped in a separate module-level `warnings` object so they still persist across recording sessions.
- Temporary p5 override state has moved into `session.overrides`, including the descriptor restore stack and all original p5 function references. This completes the current session-state migration; persistent configuration remains in `config`, and warn-once state remains in `warnings`.
- SVG render-time group depth, stroke state, and transform group stack are now isolated in a per-export `renderContext` object instead of `session`, reducing render-side mutation while preserving existing output.
