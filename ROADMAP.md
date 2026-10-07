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

## Explicit Non-goals

These choices are intentional unless the project scope changes:

- Do not implement SVG export support for `clip()`, `beginClip()`, or
  `endClip()`. Correct plotter-safe clipping would require computational
  geometry and path splitting.
- Do not replace the main SVG export dispatcher with a renderer map.
- Do not extract shared `ellipseMode()` / `rectMode()` normalization helpers;
  keep that handling local and explicit.
- Do not turn p5.plotSvg into a custom renderer. The project should continue to
  draw normally to the p5 canvas and capture commands only during explicit SVG
  recording sessions.

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
