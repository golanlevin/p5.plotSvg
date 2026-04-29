const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

function readFixture(file) {
  return fs.readFileSync(path.resolve(__dirname, file), "utf8");
}

function normalizeSvgForFixtureComparison(svg) {
  return svg
    .replace(/\r\n/g, "\n")
    .replace(/^<!-- shapes_v1\.svg -->\n/m, "")
    .replace(
      /^<!-- Generated using p5\.js v\..* and p5\.plotSvg v\..*: -->$/m,
      "<!-- Generated using p5.js and p5.plotSvg -->"
    )
    .replace(
      /^<!-- [A-Z][a-z]{2} [A-Z][a-z]{2} .* GMT.* -->$/m,
      "<!-- SVG export timestamp -->"
    )
    .trim();
}

test("p5 v1 exports focused shapes baseline SVG", async ({ page }) => {
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

  await page.goto(testUrl("shapes/shapes_v1/index.html"));
  await page.waitForFunction(() => typeof window.runShapesV1Export === "function");

  const report = await page.evaluate(() => {
    const svg = window.runShapesV1Export();
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const parseError = doc.querySelector("parsererror");
    const count = selector => doc.querySelectorAll(selector).length;

    return {
      version: p5.VERSION,
      svg,
      svgLength: svg.length,
      parseError: parseError ? parseError.textContent : "",
      hasUndefinedOrNaN: /undefined|NaN/.test(svg),
      counts: {
        circle: count("circle"),
        line: count("line"),
        path: count("path")
      }
    };
  });

  expect(parseInt(report.version.split(".")[0], 10)).toBe(1);
  expect(report.svgLength).toBeGreaterThan(1000);
  expect(report.parseError).toBe("");
  expect(report.hasUndefinedOrNaN).toBe(false);
  expect(report.counts.circle).toBe(6);
  expect(report.counts.line).toBe(2);
  expect(report.counts.path).toBe(10);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);

  const actualSvg = normalizeSvgForFixtureComparison(report.svg);
  const expectedSvg = normalizeSvgForFixtureComparison(readFixture("shapes/fixtures/shapes_v1.svg"));
  expect(actualSvg).toBe(expectedSvg);
});
