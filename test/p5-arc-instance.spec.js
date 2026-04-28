const { test, expect } = require("@playwright/test");
const path = require("path");

const runners = [
  {
    name: "p5 v1.11.13",
    file: "test_program_01/index_p5v1.html",
    major: 1
  },
  {
    name: "p5 v2.2.2",
    file: "test_program_01/index_p5v2.html",
    major: 2
  }
];

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

for (const runner of runners) {
  test(`${runner.name} exports instance-mode arc OPEN cases`, async ({ page }) => {
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
    await page.waitForFunction(() => typeof window.runArcInstanceExport === "function");

    const report = await page.evaluate(() => {
      const svg = window.runArcInstanceExport();
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      return {
        version: p5.VERSION,
        globalOpen: typeof window.OPEN,
        svgLength: svg.length,
        parseError: parseError ? parseError.textContent : "",
        hasUndefinedOrNaN: /undefined|NaN/.test(svg),
        pathCount: doc.querySelectorAll("path").length
      };
    });

    expect(parseInt(report.version.split(".")[0], 10)).toBe(runner.major);
    expect(report.svgLength).toBeGreaterThan(0);
    expect(report.parseError).toBe("");
    expect(report.hasUndefinedOrNaN).toBe(false);
    expect(report.pathCount).toBeGreaterThanOrEqual(4);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
