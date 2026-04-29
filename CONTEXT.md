# Context for p5.plotSvg Codebase

This document provides orientation for authors and LLMs working on the
p5.plotSvg codebase. It is intended as a high-level map of the current design,
not a full API reference or changelog.

## Overview

**p5.plotSvg** is a JavaScript library that enables p5.js sketches to export SVG
files optimized for pen plotters and other CNC machines. It captures p5.js
drawing commands and converts them to mostly geometry-only SVG: strokes, paths,
groups, transforms, and text are represented, while fill, transparency, raster
effects, and WEBGL are intentionally out of scope.

- **Version**: 0.2.0
- **Primary source file**: `lib/p5.plotSvg.js` (~4,800 lines)
- **Generated browser build**: `dist/p5.plotSvg.js`
- **Generated ESM build**: `dist/p5.plotSvg.esm.js`
- **Build entries**: `src/browser.js` and `src/main.js`
- **Current compatibility target**: p5.js v1.11.13 and p5.js v2.2.2 test fixtures

The project is in the middle of becoming a more official p5.js add-on. Existing
global and `p5plotSvg` namespace APIs are still preserved for backward
compatibility.

## Architecture

The main implementation is still an IIFE that creates a `p5plotSvg` namespace.
It now also installs prototype methods for add-on-style usage:

- p5 v2: registers through `p5.registerAddon(plotSvgAddon)` when available.
- p5 v1: falls back to direct `p5.prototype` attachment.
- Existing global functions such as `beginRecordSvg()` remain available.

The core export model has not changed: p5.plotSvg temporarily overrides p5
drawing functions during an explicit recording session, captures drawing
commands, then restores the original p5 functions before returning the SVG
string.

```text
beginRecordSvg()
  -> detect p5 v1/v2 and global/instance mode
  -> override p5 drawing functions with descriptor-safe wrappers
  -> drawing calls append command objects to session.commands

endRecordSvg()
  -> exportSVG() serializes command objects
  -> postProcessSvgString() applies optional SVG post-processors
  -> restoreP5Functions() restores exact original descriptors
  -> return SVG string
```

The override/restore layer records original property descriptors per
target/function pair. This matters for p5 v2, where some p5 properties are
non-writable, and for instance mode, where inherited methods should not be
converted into permanent own properties.

## Internal State

### `config`

Persistent export options live in a private `config` object. These are set by
public setter functions and are intended to persist across recording sessions.

Important fields include:

| Field | Default | Purpose |
| --- | --- | --- |
| `flattenTransforms` | `false` | If true, encode transforms as matrices; otherwise use nested `<g>` groups |
| `coordPrecision` | `4` | Decimal places for geometry coordinates |
| `transformPrecision` | `6` | Decimal places for transform values |
| `defaultStrokeColor` | `"black"` | Default SVG stroke color |
| `defaultStrokeWeight` | `1` | Default SVG stroke weight |
| `pointRadius` | `0.25` | Radius for `point()` rendered as circles |
| `dpi` | `96` | Resolution for inch/cm calculations |
| `mergeNamedGroups` | `true` | Merge groups with the same ID |
| `groupByStrokeColor` | `false` | Group elements by stroke color for multi-pen workflows |
| `inkscapeCompatibility` | `false` | Add Inkscape layer metadata for named groups |
| `exportPolylinesAsPaths` | `false` | Export simple polylines as `<path>` instead of `<polyline>` |

### `session`

Per-recording mutable state lives in a private `session` object. This includes:

- recorded commands, vertex stack, group stack, injected header attributes, and
  injected defs;
- primitive set counters;
- recording lifecycle flags;
- active shape mode/kind;
- p5 instance, pixel density, p5 major version, and global-mode detection;
- curve/spline compatibility state;
- Inkscape layer bookkeeping;
- temporary p5 override bookkeeping in `session.overrides`.

`p5plotSvg._commands` is an experimental public hook that points to
`session.commands` during an active recording session and is reset after export.

### `warnings`

Warn-once flags live in a separate module-level `warnings` object. They are not
session-local, so repeated known warnings stay suppressed across exports.

### `renderContext`

`exportSVG()` creates a per-export `renderContext` object for serializer-local
state:

- current SVG group depth;
- current stroke color and whether a non-default stroke has appeared;
- transform group stack.

This keeps render-time mutation separate from recording/session state.

## Command And Segment Types

Command and path segment type strings are defined as explicit constants:

- `p5plotSvg.SVG_COMMAND`
- `p5plotSvg.SVG_SEGMENT`

Use these constants when extending the command stream. Avoid introducing new raw
string command types unless the constants are updated as part of the change.

Common command families:

- primitives: `ARC`, `BEZIER`, `CIRCLE`, `CURVE`, `ELLIPSE`, `LINE`, `POINT`,
  `QUAD`, `RECT`, `SPLINE`, `TRIANGLE`;
- beginShape output: `POLYLINE`, `PATH`, `POINTS`, `LINES`, `TRIANGLES`,
  `TRIANGLE_FAN`, `TRIANGLE_STRIP`, `QUADS`, `QUAD_STRIP`;
- transforms/groups: `PUSH`, `POP`, `SCALE`, `TRANSLATE`, `ROTATE`, `SHEAR_X`,
  `SHEAR_Y`, `BEGIN_GROUP`, `END_GROUP`;
- other: `STROKE`, `TEXT`, `DESCRIPTION`.

Nested path segment types include `VERTEX`, `BEZIER`, `BEZIER_POINT`,
`QUADRATIC`, `CURVE`, `SPLINE`, `CONTOUR_START`, and `CONTOUR_END`.

## SVG Generation

`exportSVG()` creates the base SVG document, serializes command objects, and then
passes the result through `postProcessSvgString()`.

Each command type is still handled by a readable `if` / `else if` dispatcher
that calls a corresponding `getSvgStr*()` function. The dispatcher is
intentionally not being replaced by a renderer map.

Important helper areas:

- `formatNumber()` centralizes numeric formatting and guards against `NaN` /
  `Infinity`.
- XML escaping helpers handle text, attribute values, XML name validation, and
  repeated attribute serialization through `attrsToString()`.
- CSS color validation is cached and uses `CSS.supports("color", value)` when
  available, with a temporary-DOM fallback.
- Inkscape layer tracking uses `Map`.
- `postProcessSvgString()` runs named-group merging and stroke-color grouping as
  a final SVG string/DOM post-processing step.

### Path Generation

Path and segment generation has been partially unified, but cautiously. Current
helpers include:

- `appendPathMoveTo()`
- `appendPathLineTo()`
- `appendPathCubicTo()`
- `appendPathQuadraticTo()`
- `appendPathClose()`
- `generateVertexPathData()`
- `appendSegmentPathData()`
- `generateSegmentPathData()`

The current goal is to preserve existing v1-style curve output while improving
the internal structure. Full support for every new p5 v2 curve/spline form is
not complete yet.

### Transform Handling

Two transform modes are supported:

1. **Hierarchical**: default mode. Transforms become nested SVG `<g
   transform="...">` elements.
2. **Flattened**: each element receives a `transform="matrix(...)"` attribute.

## Public API

The public API is available in three styles:

```js
beginRecordSvg(this, "file.svg");        // legacy explicit p5 instance form
beginRecordSvg("file.svg");              // global-mode add-on style
sketch.beginRecordSvg("file.svg");       // instance-mode add-on style
p5plotSvg.beginRecordSvg(this, null);    // namespace form, no download
```

Core functions:

- `beginRecordSvg(...)`
- `pauseRecordSvg(bPause)`
- `endRecordSvg()`

Configuration setters:

- `setSvgDocumentSize(w, h)`
- `setSvgResolutionDPI(dpi)` / `setSvgResolutionDPCM(dpcm)`
- `setSvgDefaultStrokeColor(col)` / `setSvgDefaultStrokeWeight(wei)`
- `setSvgBackgroundColor(col)`
- `setSvgFlattenTransforms(bool)`
- `setSvgCoordinatePrecision(n)` / `setSvgTransformPrecision(n)`
- `setSvgPointRadius(r)`
- `setSvgIndent(type, amount)`
- `setSvgMergeNamedGroups(bool)`
- `setSvgInkscapeCompatibility(bool)`
- `setSvgGroupByStrokeColor(bool)`
- `setSvgExportPolylinesAsPaths(bool)`

Grouping and injection:

- `beginSvgGroup(nameOrAttrs, attrs)`
- `endSvgGroup()`
- `injectSvgHeaderAttribute(name, value)`
- `injectSvgDef(type, attributesObj)`

Utilities:

- `getDefaultStrokeColor()`
- `isRecordingSVG()`

Deprecated capitalized aliases such as `beginRecordSVG()` and
`setSVGDocumentSize()` remain as compatibility wrappers and warn when used.

## p5 v1 / v2 Compatibility Notes

p5.plotSvg currently includes v2 shims for several v1 curve APIs:

- `curve()`
- `curveTightness()`
- `curveVertex()`
- `quadraticVertex()`

Known compatibility caveats:

- Old six-argument `bezierVertex()` under p5 v2 is dangerous because p5 v2 uses
  point-stream Bezier APIs. The exporter can still record the old intent, while
  the on-screen canvas may differ.
- New p5 v2 curve/spline functionality is not fully exported yet.
- `clip()`, `beginClip()`, and `endClip()` are intentionally unsupported. Proper
  plotter-safe clipping would require computational geometry and path splitting.
- Text/font behavior is not fully v2-aware, especially for loaded fonts and
  vertical alignment.

## Build And Packaging

The project has a first Rollup scaffold:

```sh
npm run build
```

This generates:

- `dist/p5.plotSvg.js` for classic browser script loading;
- `dist/p5.plotSvg.esm.js` for ESM import/npm usage.

For now, `lib/p5.plotSvg.js` remains the source of truth. The `src/` files are
thin build entries that import the library and expose browser/ESM outputs. A
future decision is still needed on whether implementation should eventually move
into `src/` with `lib/` and `dist/` treated as generated artifacts.

## File Structure

```text
p5.plotSvg/
├── lib/
│   └── p5.plotSvg.js          # Current source of truth
├── src/
│   ├── browser.js             # Rollup browser entry
│   └── main.js                # Rollup ESM entry
├── dist/
│   ├── p5.plotSvg.js          # Generated script-tag build
│   └── p5.plotSvg.esm.js      # Generated ESM build
├── examples/                  # Example sketches
├── test/                      # Manual fixtures and Playwright tests
├── images/                    # README images
├── documentation.md           # API documentation
├── README.md                  # Project overview
├── TEMP_DEBUG_SUMMARY.md      # Temporary working notes
├── rollup.config.mjs
└── package.json
```

Local p5 test fixtures live under:

- `test/p5.js-v.1.11.13/p5.js`
- `test/p5.js-v2.2.2/p5.js`

The top-level `temp/` directory is ignored and should remain scratch space.

## Extension Points

The library intentionally exposes some low-level experimental extension hooks for
advanced add-ons and research sketches. These hooks are not required for ordinary
SVG export, and they are less stable than the public drawing/export API.

During an active recording session, `p5plotSvg._commands` points to the live
internal command array. External code may:

- read the command array;
- append compatible command objects before `endRecordSvg()`;
- add custom command `attributes` arrays;
- inject custom SVG header attributes with `injectSvgHeaderAttribute()`;
- inject custom `<defs>` elements with `injectSvgDef()`.

`p5plotSvg._commands` is only valid between `beginRecordSvg()` and
`endRecordSvg()`. Use `p5plotSvg.SVG_COMMAND` and `p5plotSvg.SVG_SEGMENT` as the
reference for supported command and segment `type` strings.

## Testing

The test suite is browser-based and uses Playwright. The main test command is:

```sh
npm test
```

Common focused commands:

```sh
npm run build
npx playwright test test/p5-compat.spec.js --browser=chromium
npx playwright test test/p5-compat2.spec.js --browser=chromium
npx playwright test test/p5-prototype-api.spec.js --browser=chromium
npx playwright test test/p5-addon-build.spec.js --browser=chromium
npx playwright test test/p5-smorgasbord.spec.js --browser=chromium
npx playwright test test/p5-path-regression.spec.js --browser=chromium
npx playwright test test/p5-svg-escaping.spec.js --browser=chromium
```

Important fixtures:

- `test/compat/`: split-screen p5 v1/v2 smoke test.
- `test/compat2/`: explicit compatibility findings and instance-mode probes.
- `test/prototype/`: add-on-style prototype API tests.
- `test/addon-build/`: generated `dist/` build tests.
- `test/smorgasbord/`: broad v1/v2 SVG regression baselines.
- `test/path-regression/`: compact exact path-data regression fixture.
- `test/escaping/`: SVG escaping regression fixture.
- `test/shapes/`: p5 v1/v2 shape and curve experiments.

When modifying the library, test the relevant subset first, then run the broader
Playwright tests before committing behavior changes.

## Refactor Boundaries

Current deliberate boundaries:

- Do not add `clip()` export support unless the project explicitly takes on
  computational geometry.
- Do not replace the main export dispatcher with a renderer map.
- Do not extract shared `ellipseMode()` / `rectMode()` normalization helpers;
  keep that handling local and explicit.
- Do not make the unified path helpers responsible for all new p5 v2 curve APIs
  until exact curve regression tests are stronger.
