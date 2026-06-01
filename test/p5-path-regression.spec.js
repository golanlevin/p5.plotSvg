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

test("p5 v1 handles malformed numeric coordinates by policy", async ({ page }) => {
  const pageErrors = [];

  page.on("pageerror", err => {
    pageErrors.push(err.message);
  });

  await page.goto(testUrl("path-regression/index.html"));
  await page.waitForFunction(() => typeof window.runMalformedNumberExport === "function");

  const report = await page.evaluate(() => {
    const parseSvg = svg => {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const attr = (selector, name) =>
        Array.from(doc.querySelectorAll(selector), el => el.getAttribute(name));
      return {
        hasMalformedText: /NaN|Infinity/.test(svg),
        lines: attr("line", "x1").map((x1, index) => ({
          x1,
          y1: attr("line", "y1")[index],
          x2: attr("line", "x2")[index],
          y2: attr("line", "y2")[index]
        })),
        rects: attr("rect", "y"),
        polylines: attr("polyline", "points")
      };
    };

    return {
      sanitized: parseSvg(window.runMalformedNumberExport(true)),
      skipped: parseSvg(window.runMalformedNumberExport(false))
    };
  });

  expect(report.sanitized.hasMalformedText).toBe(false);
  expect(report.sanitized.lines).toEqual([
    { x1: "0", y1: "10", x2: "50", y2: "10" },
    { x1: "10", y1: "80", x2: "50", y2: "80" }
  ]);
  expect(report.sanitized.rects).toEqual(["0"]);
  expect(report.sanitized.polylines).toEqual(["0,40 50,40"]);

  expect(report.skipped.hasMalformedText).toBe(false);
  expect(report.skipped.lines).toEqual([
    { x1: "10", y1: "80", x2: "50", y2: "80" }
  ]);
  expect(report.skipped.rects).toEqual([]);
  expect(report.skipped.polylines).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("p5 v1 clamps very large coordinate values by policy", async ({ page }) => {
  const pageErrors = [];

  page.on("pageerror", err => {
    pageErrors.push(err.message);
  });

  await page.goto(testUrl("path-regression/index.html"));
  await page.waitForFunction(() => typeof window.runLargeCoordinateExport === "function");

  const report = await page.evaluate(() => {
    const parseSvg = svg => {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const attr = (selector, name) =>
        Array.from(doc.querySelectorAll(selector), el => el.getAttribute(name));
      return {
        lines: attr("line", "x1").map((x1, index) => ({
          x1,
          y1: attr("line", "y1")[index],
          x2: attr("line", "x2")[index],
          y2: attr("line", "y2")[index]
        })),
        rects: attr("rect", "y"),
        widths: attr("rect", "width"),
        polylines: attr("polyline", "points")
      };
    };

    return {
      clamped: parseSvg(window.runLargeCoordinateExport(true)),
      unclamped: parseSvg(window.runLargeCoordinateExport(false))
    };
  });

  expect(report.clamped.lines).toEqual([
    { x1: "-100", y1: "10", x2: "100", y2: "20" }
  ]);
  expect(report.clamped.rects).toEqual(["-100"]);
  expect(report.clamped.widths).toEqual(["100"]);
  expect(report.clamped.polylines).toEqual(["-100,40 100,40"]);

  expect(report.unclamped.lines).toEqual([
    { x1: "-200", y1: "10", x2: "200", y2: "20" }
  ]);
  expect(report.unclamped.rects).toEqual(["-250"]);
  expect(report.unclamped.widths).toEqual(["200"]);
  expect(report.unclamped.polylines).toEqual(["-300,40 300,40"]);
  expect(pageErrors).toEqual([]);
});
