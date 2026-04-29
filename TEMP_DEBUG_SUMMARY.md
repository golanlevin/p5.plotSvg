# Temporary Debug Summary: p5.js v2 Compatibility Status

## Current Status

The earlier p5.js v2 `bezier()` export crash has been addressed. The library now pauses SVG recording while calling original p5 functions, which prevents p5 v2 internals from leaking malformed `beginShape()` / `bezierVertex()` commands into the SVG command stream.

Current test infrastructure lives under `test/`:

- `test/compat/split.html` shows p5 v1 and p5 v2 side by side.
- `test/compat/sketch.js` draws a shared compatibility sketch.
- `test/compat2/` explicitly exercises the original compatibility findings, including instance-mode probes.
- `test/prototype/` exercises the newer prototype/add-on-style API in instance and global mode.
- `test/addon-build/` exercises the generated script-tag and ESM distribution builds.
- `test/smorgasbord/` contains v1/v2 Smorgasbord baselines and exact/normalized SVG regression tests.
- `test/path-regression/` checks compact `beginShape()` path `d` output.
- `test/escaping/` checks SVG text/attribute escaping.
- `test/shapes/` contains p5 v1 and p5 v2 curve/shape experiments.
- `test/test_program_01/` remains a small manual/browser sanity test.

Recent broad verification has included:

```sh
npm run build
npx playwright test test/p5-addon-build.spec.js test/p5-prototype-api.spec.js test/p5-smorgasbord.spec.js --browser=chromium
```

The generated `dist/` files are now part of the test surface.

The local p5 copies used by tests now live under `test/p5.js-v.1.11.13/` and `test/p5.js-v2.2.2/`. The top-level `temp/` directory remains ignored through `.gitignore`.

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

8. **Tests are stronger, but not complete.**

   The Playwright tests now cover valid SVG output, selected exact path data, Smorgasbord normalized-output baselines, prototype/add-on usage, instance-mode cleanup, escaping behavior, and generated build artifacts. Remaining gaps include loaded-font text behavior, deeper p5 v2 curve/spline features, and screen/export visual equivalence.

## Priority

1. Completed: add v2 shims for `curve()`, `curveTightness()`, `curveVertex()`, and `quadraticVertex()`.
2. Decide what to do with old six-argument `bezierVertex()` under v2: warn hard, shim it, or require v2 examples.
3. Completed: fix instance-mode global pollution.
4. Completed initial exact-output tests: Smorgasbord baselines and a compact path-regression test now compare normalized SVG/path output. More curve-specific exact tests are still useful before deeper v2 curve work.
5. Document and preserve the intentional non-support stance for `clip()`, `beginClip()`, and `endClip()`.
6. Revisit text after geometry compatibility is stable.

## Official p5.js Add-on Assessment

p5.plotSvg is now partly structured like a p5.js add-on. It has a p5 v2 `registerAddon()` path, a p5 v1 prototype fallback, prototype methods, flexible begin-record argument handling, and a first Rollup build scaffold. The remaining work is mostly packaging/docs policy: deciding the long-term source/distribution layout, hardening generated builds, reducing reliance on broad globals where practical, and preparing official library submission materials.

The practical conversion path is to use the local `temp/p5.js-addon-template-main/templates/basic` pattern rather than the custom renderer template. A custom renderer would be a much larger redesign and would conflict with p5.plotSvg's current model: keep drawing to the normal p5 canvas, then temporarily capture drawing commands only during explicit SVG export.

Needed changes:

1. Completed: add an official add-on installer function, `plotSvgAddon(p5, fn, lifecycles)`, which attaches methods such as `beginRecordSvg()`, `endRecordSvg()`, `setSvgDocumentSize()`, and related configuration functions to the p5 sketch API. p5 v2 now uses `p5.registerAddon(plotSvgAddon)` when available; p5 v1 falls back to invoking the same installer directly against `p5.prototype`.
2. Completed: add prototype methods without removing globals. p5 instances now expose wrappers such as `sketch.beginRecordSvg("file.svg")`, `sketch.endRecordSvg()`, and `sketch.setSvgDocumentSize(w, h)`, while existing `beginRecordSvg(this, "file.svg")` and `p5plotSvg.beginRecordSvg(this, "file.svg")` usage remains supported.
3. Completed: add flexible argument handling for add-on-native usage. The old explicit form `beginRecordSvg(this, "file.svg")` still works, global-mode sketches can use `beginRecordSvg("file.svg")`, and instance-mode sketches can use `sketch.beginRecordSvg("file.svg")`. In p5 v2 global mode, p5 may expose `beginRecordSvg` through a prototype-generated global alias, so the wrapper detects `this === p5.instance` and records against `window` to ensure global drawing functions are captured.
4. Remaining: stop relying on broad unconditional global exports where practical. Let p5 expose prototype methods globally in global mode, while keeping existing globals as compatibility aliases if needed.
5. Completed first scaffold / still hardening: add a Rollup-based build pipeline like the template, producing an IIFE build for script tags and an ESM build for imports/npm. The scaffold now exists with `src/browser.js`, `src/main.js`, `rollup.config.mjs`, generated `dist/p5.plotSvg.js`, generated `dist/p5.plotSvg.esm.js`, and a package `exports` map. The scaffold intentionally keeps `lib/p5.plotSvg.js` as the source-of-truth for now.
6. Completed: support both p5 v1 and p5 v2 through the same installer path. p5 v2 can use `p5.registerAddon()`, while p5 v1 falls back to direct prototype attachment.
7. In progress: document the temporary p5 function override model honestly. It technically conflicts with the p5 recommendation not to overwrite p5 functions, but p5.plotSvg does so only during recording and restores exact property descriptors afterward. Internal JSDoc now documents the add-on installer and related helper contracts; README/user docs still need updating.
8. Prepare p5 libraries page submission materials: category likely `Export`, concise description, author info, license, docs link, examples, npm/CDN links, and a thumbnail/image.

Important note: p5.plotSvg should not become a custom renderer unless the project intentionally changes direction. The current export-on-demand architecture is better served by a standard add-on wrapper around the existing implementation.

## Planned Add-on Next Steps

The add-on conversion should continue incrementally. The current priority is to make the project look and behave like a p5 add-on without breaking existing sketches that load `lib/p5.plotSvg.js` directly or call the older global functions.

1. **Stabilize the build scaffold.**

   Keep `lib/p5.plotSvg.js` as the current source file while using Rollup to generate `dist/p5.plotSvg.js` and `dist/p5.plotSvg.esm.js`. Do not move implementation code into `src/` yet unless the test suite stays green and the distribution files remain byte-for-byte understandable.

2. **Clarify source vs. distribution policy.**

   Decide whether `lib/p5.plotSvg.js` remains the long-term editable source, or whether the project eventually moves to `src/main.js` as the source and treats both `lib/` and `dist/` as generated outputs. For now, the safest policy is:

   - edit `lib/p5.plotSvg.js`;
   - run `npm run build`;
   - commit both source and generated `dist/` files when preparing a release.

3. **Expand add-on build tests.**

   Continue testing the script-tag build and ESM build in browser contexts. The minimum matrix should cover:

   - p5 v1 script tag + `dist/p5.plotSvg.js`;
   - p5 v2 script tag + `dist/p5.plotSvg.js`;
   - p5 v2 ESM import + `dist/p5.plotSvg.esm.js`;
   - instance mode and global mode;
   - old forms like `beginRecordSvg(this, "file.svg")`;
   - new forms like `beginRecordSvg("file.svg")` and `sketch.beginRecordSvg("file.svg")`.

4. **Update examples gradually.**

   Keep existing examples working, but begin adding `index_p5v1.html` and `index_p5v2.html` entry points where useful. Examples should eventually prefer the distribution build that users will load from npm/CDN, while tests may still exercise `lib/p5.plotSvg.js` directly to catch source regressions.

5. **Document installation paths.**

   The README should explain three supported usage modes:

   - traditional browser script loading from CDN or local file;
   - p5 v1 global/prototype fallback behavior;
   - p5 v2 add-on registration and ESM import behavior.

   The documentation should explicitly say that older sketches are intended to keep working.

6. **Prepare package metadata for publishing.**

   Review `package.json` fields before publishing: `main`, `module`, `exports`, `files`, repository URL, license, keywords, npm package name, and release scripts. Minification can wait; the immediate goal is a clear, reliable package structure.

7. **Prepare p5 libraries submission materials.**

   Gather the p5 libraries page requirements: concise description, category, author/maintainer info, license, documentation URL, examples, npm/CDN links, repository URL, and thumbnail or preview image.

8. **Document the override model honestly.**

   p5.plotSvg temporarily overrides p5 drawing functions while recording. This is central to how the library works, even though it is unusual for a p5 add-on. The docs should explain that overrides are temporary, descriptor-restored, and scoped to active recording sessions.

## Refactor Decisions

The following refactors are intentionally out of scope:

- Do not extract shared `ellipseMode()` / `rectMode()` normalization helpers. The existing per-function handling should remain local and explicit.
- Do not replace the main SVG export dispatcher with a renderer map. The current large `if` / `else if` chain is direct, legible, and appropriate for this library.

Completed organizational cleanup:

- Persistent SVG export options are grouped in a private internal `config` object.
- Per-recording mutable state is grouped in a private internal `session` object. This now includes command/vertex/group arrays, injected header/defs arrays, primitive set counters, transform-existence tracking, recording lifecycle flags, active shape state, p5 target/version context, curve/spline compatibility state, Inkscape layer bookkeeping, and temporary p5 override bookkeeping.
- Warn-once flags live in a separate module-level `warnings` object so warnings remain suppressed across recording sessions where appropriate.
- Temporary p5 override state lives in `session.overrides`, including the descriptor restore stack and all original p5 function references. This preserves p5 v1 compatibility, supports p5 v2 non-writable properties, and avoids instance-mode global pollution.
- SVG render-time group depth, stroke state, and transform group stack are isolated in a per-export `renderContext` object instead of mutating session-level state during serialization.
- SVG string post-processing is isolated behind `postProcessSvgString()`, which applies named-group merging and stroke-color grouping in one explicit final stage after base SVG serialization.
- SVG escaping helpers now cover XML text, XML attributes, XML name validation, and repeated attribute serialization through `attrsToString()`.
- Command and segment types are explicit constants instead of scattered raw strings.
- Path/segment generation has been partially unified through path-formatting helpers, `appendSegmentPathData()`, `generateVertexPathData()`, and `generateSegmentPathData()`. The current goal is still cautious unification, not full p5 v2 curve feature support.
- `formatNumber()` now guards against `NaN` and `Infinity` centrally and warns once.
- CSS color validation is cached. The helper uses `CSS.supports("color", value)` when available, with a temporary-DOM fallback for older environments.
- Inkscape layer tracking now uses `Map` instead of plain objects.
- JSDoc has been added for the newer path/curve helper contracts, deprecated public aliases, the stroke-color extraction helper, layer reset helper, and `plotSvgAddon()`.
- The commented-out old `getIndentStr()` implementation and earlier debug text blocks have been removed.

Current refactor boundaries:

- Do not attempt `clip()` export support; it remains intentionally out of scope.
- Do not normalize all shape-mode handling into shared helpers.
- Do not replace the export dispatcher with a renderer map.
- Do not make the unified path handler responsible for all new p5 v2 curve/spline APIs yet. The next geometry work should first preserve current v1-style exports, then explicitly add v2-only features one at a time with tests.

Remaining refactor follow-ups:

- Decide whether to further reduce direct global exports after README/examples are updated for add-on-style usage.
- Expand curve-specific path tests before deeper p5 v2 spline/bezier work.
- Revisit text/font extraction after geometry compatibility stabilizes.
- Eventually decide whether `lib/p5.plotSvg.js` remains source-of-truth or whether implementation moves into `src/` with generated `lib/`/`dist/` outputs.
