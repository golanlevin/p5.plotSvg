# p5.plotSvg Roadmap

This document tracks remaining work and deferred technical decisions. It is not
a changelog; completed release work should be removed from this file.

## p5 Libraries Submission

Local staging materials live in `admin/p5-libraries-listing/`.

Remaining work:

- Track the p5.js website pull request until p5.plotSvg is accepted or a
  revision is requested.
- Apply any listing metadata, category, image, or wording changes requested by
  the p5 maintainers.
- Confirm the public p5.js libraries listing after the website PR is merged and
  deployed.

## Compatibility Work

Remaining compatibility decisions:

- Decide how strongly to warn about old six-argument `bezierVertex()` usage
  under p5 v2. The exporter can record the old v1-style intent, but p5 v2's
  canvas API treats `bezierVertex()` as a point-stream API, so canvas output and
  SVG output can diverge.
- Add deeper tests and support for p5 v2-only curve and spline features one at a
  time.
- Revisit loaded-font SVG text export, especially p5 v2 `p5.Font` metadata and
  vertical text alignment.
- Continue using Smorgasbord and focused path fixtures as regression baselines
  before changing curve/path behavior.

## Text Outline Export

Text currently exports as SVG `<text>` elements. This is useful for visual SVG
preview, but many plotter and CAM workflows need actual outline paths.

Remaining work:

- Investigate browser-side font outline extraction for loaded fonts and system
  fonts.
- Decide whether outline export should be an optional mode rather than the
  default text behavior.
- Preserve current `<text>` export for users who want editable text or visual
  SVG output.
- Add tests for p5 v1/v2 text alignment, font size, style, leading, and loaded
  font behavior before changing text export.

## Plotter Path Optimization

p5.plotSvg currently exports paths in drawing order. That is predictable, but it
can produce unnecessary pen-up travel for plotters. See
https://github.com/golanlevin/p5.plotSvg/issues/29.

Goal: implement a simple optimizer that strengthens p5.plotSvg as a workshop
and teaching utility for plotter users. This should not try to replace full
tools such as vpype or DeepNest.

Future work:

- Add an optional lightweight path-ordering optimizer inspired by tools such as
  vpype.
- Start with a simple nearest-neighbor / 2-opt style TSP heuristic over path
  endpoints, not a heavyweight solver.
- Add travel-distance reordering to reduce pen-up movement.
- Add an optional innermost-to-outermost ordering mode for laser cutter
  workflows where interior cuts should happen before exterior cuts.
- Add de-duplication for identical or near-identical path geometry.
- Add merging of line segments with common endpoints into longer polylines when
  this does not change intended drawing behavior.
- Preserve drawing order by default; optimization should be opt-in because some
  sketches rely on ordering for layers, color grouping, or intentional plotter
  sequence.
- Consider optional path reversal when it reduces travel distance.
- Keep optimizer scope separate from geometry clipping and SVG generation.

## Explicit Non-goals

These choices are intentional unless the project scope changes:

- Do not replace the main SVG export dispatcher with a renderer map.
- Do not extract shared `ellipseMode()` / `rectMode()` normalization helpers;
  keep that handling local and explicit.
- Do not turn p5.plotSvg into a custom renderer. The project should continue to
  draw normally to the p5 canvas and capture commands only during explicit SVG
  recording sessions.

## Plotter-Safe Clipping Investigation

Support for `clip()`, `beginClip()`, and `endClip()` remains deferred, but is no
longer treated as a permanent non-goal. Visual SVG exporters can often represent
clipping with `<clipPath>` wrappers, but that is not enough for p5.plotSvg's
plotter-oriented goals: many plotter and CAM workflows need the actual path
geometry to be cropped, split, or omitted.

Current direction:

- Use a lightweight Clipper-family backend, most likely `clipper-lib` for the
  first integration experiment because it is pure JavaScript, already built, and
  supports open subject paths clipped by closed polygon masks.
- Keep the public feature plotter-centered: produce real clipped path geometry,
  not just SVG `<clipPath>` wrappers.
- Treat curved masks and curved clipped geometry as flatten-to-polyline cases
  with a configurable tolerance.
- Preserve a small-library mindset. If Clipper support grows the package too
  much, consider a separate full/clipping build rather than requiring users to
  manually include a second script.

Possible phases:

1. Continue local prototypes in `experiments/clipping/`, especially the
   `p5plotSvg-clipper-poc/` adapter and `golan-clip-test-2/` visual cases.
2. Define command-to-geometry adapters for closed polygonal masks and open
   plotter centerlines.
3. Add semantic recording for `beginClip()` / `endClip()`; the library currently
   only warns for `clip()`.
4. Support polygonal masks and simple clipped subjects first: `line()`,
   `rect()`, `triangle()`, `quad()`, simple `beginShape()` contours, `circle()`,
   and `ellipse()` flattened to polylines.
5. Resolve multiple masks, nested clipping, transforms, and seam merging before
   exposing the feature broadly.
6. Warn or skip unsupported cases such as text, images, fills, WEBGL geometry,
   and ambiguous clip masks.

## Deferred Source Layout Cleanup

The repository still uses the conservative release layout: `lib/p5.plotSvg.js`
is the source of truth, `src/` contains thin build wrappers, and `dist/` contains
generated package builds. This preserves old CDN paths, but it is not the clean
long-term structure for an add-on package.

Likely steps:

1. Move the real implementation from `lib/p5.plotSvg.js` to a proper source file
   under `src/`.
2. Change the wrapper so the core object can be exported cleanly instead of only
   attaching itself to `globalThis`.
3. Generate `dist/p5.plotSvg.js`, `dist/p5.plotSvg.esm.js`, and possibly
   `lib/p5.plotSvg.js` from the source file.
4. Keep `lib/p5.plotSvg.js` available for old CDN links during a transition
   period.
5. Update package metadata and documentation to distinguish source files,
   generated distribution files, and legacy compatibility paths.
6. Run the full browser test matrix and compare SVG fixtures after the move.

The main risk is churn: moving the large implementation file will make diffs
noisy and could hide accidental behavior changes. Keep this cleanup separate
from behavior changes.
