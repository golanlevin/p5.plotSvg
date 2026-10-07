const { test, expect } = require("@playwright/test");
const path = require("path");

/*
 * Adapted from the native p5.svg visual test scenarios added to p5.js in
 * PR #9123 by Vansh Kabra:
 * https://github.com/processing/p5.js/pull/9123
 * https://github.com/processing/p5.js/blob/202d0da34fe24a161da47fcc8cd419429eea2d37/test/unit/visual/cases/svg.js
 *
 * The upstream tests target p5.svg's retained-shape import/export APIs. These
 * tests translate the export-relevant drawing scenarios into p5.plotSvg's
 * beginRecordSvg()/endRecordSvg() workflow and assert plotter-oriented SVG.
 */

const runners = [
  {
    name: "p5 v1.11.13",
    file: "native-svg-inspired/runner-v1.html",
    major: 1
  },
  {
    name: "p5 v2.3.4",
    file: "native-svg-inspired/runner-v2.html",
    major: 2
  }
];

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

for (const runner of runners) {
  test(`${runner.name} exports p5.svg-inspired primitive and state scenarios`, async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", msg => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", err => {
      pageErrors.push(err.message);
    });

    await page.goto(testUrl(runner.file));
    await page.waitForFunction(() => typeof window.runNativeSvgInspiredExports === "function");

    const report = await page.evaluate(() => {
      const svgs = window.runNativeSvgInspiredExports();
      return {
        version: p5.VERSION,
        cases: Object.fromEntries(
          Object.entries(svgs).map(([name, svg]) => [name, parseSvg(svg)])
        )
      };

      function parseStroke(style) {
        if (!style) return null;
        const match = style.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/);
        return match ? match[1].trim() : null;
      }

      function parseSvg(svg) {
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        const parseError = doc.querySelector("parsererror");
        const elements = selector => Array.from(doc.querySelectorAll(selector));
        return {
          parseError: parseError ? parseError.textContent : "",
          hasMalformedText: /undefined|NaN|Infinity/.test(svg),
          counts: {
            circle: elements("circle").length,
            ellipse: elements("ellipse").length,
            line: elements("line").length,
            path: elements("path").length,
            polygon: elements("polygon").length,
            polyline: elements("polyline").length,
            rect: elements("rect").length,
            group: elements("g").length
          },
          pathData: elements("path").map(pathEl => pathEl.getAttribute("d") || ""),
          transforms: elements("[transform]").map(el => el.getAttribute("transform")),
          lineStrokes: elements("line").map(line => parseStroke(line.getAttribute("style")))
        };
      }
    });

    expect(parseInt(report.version.split(".")[0], 10)).toBe(runner.major);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    for (const caseReport of Object.values(report.cases)) {
      expect(caseReport.parseError).toBe("");
      expect(caseReport.hasMalformedText).toBe(false);
    }

    expect(report.cases.primitives.counts).toMatchObject({
      circle: 2,
      ellipse: 1,
      line: 1,
      path: 1,
      polygon: 2,
      rect: 2
    });

    expect(report.cases.customPaths.counts.path).toBeGreaterThanOrEqual(1);
    expect(report.cases.customPaths.pathData.join(" ")).toMatch(/\bC\b/);
    expect(report.cases.customPaths.counts.polygon + report.cases.customPaths.counts.polyline).toBeGreaterThanOrEqual(2);

    expect(report.cases.transforms.counts.ellipse + report.cases.transforms.counts.circle).toBeGreaterThanOrEqual(2);
    expect(report.cases.transforms.counts.rect).toBeGreaterThanOrEqual(2);
    expect(report.cases.transforms.transforms.length).toBeGreaterThanOrEqual(4);
    expect(report.cases.transforms.transforms.join(" ")).toMatch(/translate|rotate|scale|matrix/);

    expect(report.cases.pushPopState.counts.line).toBe(5);
    expect(report.cases.pushPopState.lineStrokes).toEqual([
      null,
      "red",
      "blue",
      "red",
      "black"
    ]);
    expect(report.cases.pushPopState.transforms.length).toBeGreaterThanOrEqual(2);
  });
}
