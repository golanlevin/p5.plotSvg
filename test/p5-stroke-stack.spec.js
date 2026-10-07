const { test, expect } = require("@playwright/test");
const path = require("path");

const runners = [
  {
    name: "p5 v1.11.13",
    file: "stroke-stack/runner-v1.html",
    major: 1
  },
  {
    name: "p5 v2.3.0",
    file: "stroke-stack/runner-v2.html",
    major: 2
  }
];

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

function parseStroke(style) {
  if (!style) return null;
  const match = style.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/);
  return match ? match[1].trim() : null;
}

for (const runner of runners) {
  test(`${runner.name} restores stroke color across push/pop`, async ({ page }) => {
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
    await page.waitForFunction(() => typeof window.runStrokeStackExport === "function");

    const report = await page.evaluate(() => {
      const svg = window.runStrokeStackExport();
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      return {
        version: p5.VERSION,
        parseError: parseError ? parseError.textContent : "",
        hasUndefinedOrNaN: /undefined|NaN/.test(svg),
        lineStyles: Array.from(doc.querySelectorAll("line"), line => line.getAttribute("style"))
      };
    });

    expect(parseInt(report.version.split(".")[0], 10)).toBe(runner.major);
    expect(report.parseError).toBe("");
    expect(report.hasUndefinedOrNaN).toBe(false);
    expect(report.lineStyles.map(parseStroke)).toEqual([
      null,
      "red",
      "blue",
      "red",
      "black"
    ]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
