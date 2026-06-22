# p5.plotSvg Roadmap

This document tracks near-term release work and deferred technical decisions. It
is not a changelog; `CONTEXT.md` remains the primary orientation document for
the current architecture.

## 0.3.0 Add-on Release

The current goal is to publish p5.plotSvg as a p5.js add-on while preserving
existing sketches that load `lib/p5.plotSvg.js` directly or call the legacy
global functions.

Release checklist:

- Keep `lib/p5.plotSvg.js` as the source of truth for this release.
- Run `npm run build` after source changes and commit the generated `dist/`
  files.
- Keep package entry points conservative:
  - `main`: `lib/p5.plotSvg.js`
  - `browser`: `dist/p5.plotSvg.js`
  - `module`: `dist/p5.plotSvg.esm.js`
  - `unpkg` / `jsdelivr`: `dist/p5.plotSvg.js`
- Preserve unconditional global exports for backward compatibility.
- Prefer add-on/prototype-style usage in new documentation and examples.
- Verify release candidates with:

```sh
npm run build
npm test
npm pack --dry-run
```

## p5 Libraries Submission

Local staging materials live in `admin/p5-libraries-listing/`.

For the p5 website pull request:

- copy `admin/p5-libraries-listing/p5.plotSvg.yaml` to
  `p5.js-website/src/content/libraries/en/p5.plotSvg.yaml`;
- copy `admin/p5-libraries-listing/p5.plotSvg.png` to
  `p5.js-website/src/content/libraries/images/p5.plotSvg.png`;
- keep the category as `export` unless the p5 maintainers request a change;
- confirm that `npmFilePath: dist/p5.plotSvg.js` works through jsDelivr after
  publishing the package version being submitted.

## Compatibility Work

Completed compatibility work includes p5 v2 shims for `curve()`,
`curveTightness()`, `curveVertex()`, and `quadraticVertex()`, plus
descriptor-safe override/restore behavior that avoids instance-mode global
pollution.

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

After the add-on release is stable, use a separate branch to repair the
temporary conservative source layout.

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
noisy and could hide accidental behavior changes. This cleanup should remain
separate from the 0.3.0 add-on release.
