# p5.plotSvg Tests

## Manual Split-Screen Smoke Test

Open `test/compat/split.html` in a browser to see the same compatibility sketch
running in two isolated iframes:

- left: `test/p5.js-v.1.11.13/p5.js`
- right: `test/p5.js-v2.2.2/p5.js`

Each side has an Export button that runs `beginRecordSvg(window, null)` and logs
the returned SVG string length.

## Automated Browser Smoke Test

Run:

```sh
npx playwright test test/p5-compat.spec.js --browser=chromium
```

The test loads both local p5 versions, runs the shared sketch, exports SVG with
filename `null`, parses the SVG in the browser, and checks for expected geometry
without `undefined` or `NaN` output.

## Manual Split-Screen Compatibility Audit

Open `test/compat2/split.html` in a browser to see a second split-screen test
that explicitly exercises the eight current v2 compatibility findings.

The pages expose `window.runCompat2Audit()`, which returns structured evidence
for the curve, vertex, clipping, text, instance-mode, and test-depth findings.

## Automated Compatibility Audit

Run:

```sh
npx playwright test test/p5-compat2.spec.js --browser=chromium
```

This test intentionally checks the current known gaps, so it should be updated
as those gaps are fixed.
