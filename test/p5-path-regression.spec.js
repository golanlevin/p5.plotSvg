const { test, expect } = require("@playwright/test");
const path = require("path");

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

test("p5 v1 exports stable beginShape path data", async ({ page }) => {
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

  await page.goto(testUrl("path-regression/index.html"));
  await page.waitForFunction(() => typeof window.runPathRegressionExport === "function");

  const report = await page.evaluate(() => {
    const svg = window.runPathRegressionExport();
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const parseError = doc.querySelector("parsererror");
    const attrs = (selector, name) => Array.from(doc.querySelectorAll(selector), el => el.getAttribute(name));

    return {
      version: p5.VERSION,
      svg,
      parseError: parseError ? parseError.textContent : "",
      hasUndefinedOrNaN: /undefined|NaN/.test(svg),
      polylines: attrs("polyline", "points"),
      polygons: attrs("polygon", "points"),
      paths: attrs("path", "d")
    };
  });

  expect(parseInt(report.version.split(".")[0], 10)).toBe(1);
  expect(report.parseError).toBe("");
  expect(report.hasUndefinedOrNaN).toBe(false);
  expect(report.polylines).toEqual([
    "10,10 50,10 50,40"
  ]);
  expect(report.polygons).toEqual([
    "70,10 110,10 110,40"
  ]);
  expect(report.paths).toEqual([
    "M 10,70 C 30,50 50,90 70,70",
    "M 90,70 Q 120,40 150,70",
    "M 10,130 C 15,125 30,100 40,100 C 50,100 65,125 70,130",
    "M 120,110 L 190,110 L 190,180 L 120,180 Z M 140,130 L 140,160 L 170,160 L 170,130 Z"
  ]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
