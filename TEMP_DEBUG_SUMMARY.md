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
