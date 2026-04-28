const { test, expect } = require("@playwright/test");
const path = require("path");

const runners = [
  {
    name: "p5 v1.11.13",
    file: "compat/runner-v1.html",
    major: 1
  },
  {
    name: "p5 v2.2.2",
    file: "compat/runner-v2.html",
    major: 2
  }
];

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

for (const runner of runners) {
  test(`${runner.name} exports expected SVG geometry`, async ({ page }) => {
    const consoleMessages = [];
    page.on("console", msg => {
      if (msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });

    await page.goto(testUrl(runner.file));
    await page.waitForFunction(() => typeof window.runPlotSvgSmokeTest === "function");

    const result = await page.evaluate(() => {
      const svg = window.runPlotSvgSmokeTest();
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      return {
        version: p5.VERSION,
        svg,
        parseError: parseError ? parseError.textContent : "",
        lineCount: doc.querySelectorAll("line").length,
        pathCount: doc.querySelectorAll("path").length,
        circleCount: doc.querySelectorAll("circle").length,
        rectCount: doc.querySelectorAll("rect").length,
        polygonCount: doc.querySelectorAll("polygon").length,
        ellipseCount: doc.querySelectorAll("ellipse").length
      };
    });

    expect(parseInt(result.version.split(".")[0], 10)).toBe(runner.major);
    expect(result.parseError).toBe("");
    expect(consoleMessages).toEqual([]);
    expect(result.svg).not.toMatch(/undefined|NaN/);
    expect(result.lineCount).toBeGreaterThanOrEqual(1);
    expect(result.pathCount).toBeGreaterThanOrEqual(4);
    expect(result.circleCount).toBeGreaterThanOrEqual(2);
    expect(result.rectCount).toBeGreaterThanOrEqual(2);
    expect(result.polygonCount).toBeGreaterThanOrEqual(2);
    expect(result.ellipseCount).toBeGreaterThanOrEqual(1);
  });
}
