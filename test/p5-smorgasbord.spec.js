const { test, expect } = require("@playwright/test");
const path = require("path");

const runners = [
  {
    name: "p5 v1.11.13",
    file: "smorgasbord/runner-v1.html",
    major: 1
  },
  {
    name: "p5 v2.2.2",
    file: "smorgasbord/runner-v2.html",
    major: 2
  }
];

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

for (const runner of runners) {
  test(`${runner.name} exports smorgasbord baseline SVG`, async ({ page }) => {
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
    await page.waitForFunction(() => typeof window.runSmorgasbordExport === "function");

    const report = await page.evaluate(() => {
      const svg = window.runSmorgasbordExport();
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      const count = selector => doc.querySelectorAll(selector).length;
      return {
        version: p5.VERSION,
        svgLength: svg.length,
        parseError: parseError ? parseError.textContent : "",
        hasUndefinedOrNaN: /undefined|NaN/.test(svg),
        counts: {
          circle: count("circle"),
          ellipse: count("ellipse"),
          line: count("line"),
          path: count("path"),
          point: count("circle[data-p5-plot-svg-point], circle"),
          polygon: count("polygon"),
          polyline: count("polyline"),
          rect: count("rect"),
          text: count("text"),
          group: count("g")
        }
      };
    });

    expect(parseInt(report.version.split(".")[0], 10)).toBe(runner.major);
    expect(report.svgLength).toBeGreaterThan(10000);
    expect(report.parseError).toBe("");
    expect(report.hasUndefinedOrNaN).toBe(false);
    expect(report.counts.circle).toBeGreaterThanOrEqual(5);
    expect(report.counts.ellipse).toBeGreaterThanOrEqual(2);
    expect(report.counts.line).toBeGreaterThanOrEqual(3);
    expect(report.counts.path).toBeGreaterThanOrEqual(15);
    expect(report.counts.polygon + report.counts.polyline).toBeGreaterThanOrEqual(8);
    expect(report.counts.rect).toBeGreaterThanOrEqual(12);
    expect(report.counts.text).toBeGreaterThanOrEqual(4);
    expect(report.counts.group).toBeGreaterThanOrEqual(8);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
