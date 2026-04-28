const { test, expect } = require("@playwright/test");
const path = require("path");

const runners = [
  {
    name: "p5 v1.11.13",
    file: "prototype/runner-v1.html",
    major: 1
  },
  {
    name: "p5 v2.2.2",
    file: "prototype/runner-v2.html",
    major: 2
  }
];

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

for (const runner of runners) {
  test(`${runner.name} exposes p5.plotSvg prototype API`, async ({ page }) => {
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
    await page.waitForFunction(() => typeof window.runPrototypeApiExport === "function");

    const report = await page.evaluate(() => {
      const svg = window.runPrototypeApiExport();
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      const protoMethods = [
        "beginRecordSvg",
        "pauseRecordSvg",
        "endRecordSvg",
        "setSvgDocumentSize",
        "setSvgResolutionDPI",
        "setSvgPointRadius",
        "beginSvgGroup",
        "endSvgGroup",
        "isRecordingSVG",
        "injectSvgDef"
      ];
      return {
        version: p5.VERSION,
        globalsStillExist: typeof window.beginRecordSvg === "function" &&
          typeof window.p5plotSvg?.beginRecordSvg === "function",
        proto: Object.fromEntries(protoMethods.map(name => [
          name,
          typeof p5.prototype[name]
        ])),
        svgLength: svg.length,
        parseError: parseError ? parseError.textContent : "",
        hasUndefinedOrNaN: /undefined|NaN/.test(svg),
        counts: {
          circle: doc.querySelectorAll("circle").length,
          line: doc.querySelectorAll("line").length,
          rect: doc.querySelectorAll("rect").length,
          group: doc.querySelectorAll("g").length
        }
      };
    });

    expect(parseInt(report.version.split(".")[0], 10)).toBe(runner.major);
    expect(report.globalsStillExist).toBe(true);
    for (const type of Object.values(report.proto)) {
      expect(type).toBe("function");
    }
    expect(report.svgLength).toBeGreaterThan(0);
    expect(report.parseError).toBe("");
    expect(report.hasUndefinedOrNaN).toBe(false);
    expect(report.counts.circle).toBeGreaterThanOrEqual(1);
    expect(report.counts.line).toBeGreaterThanOrEqual(1);
    expect(report.counts.rect).toBeGreaterThanOrEqual(1);
    expect(report.counts.group).toBeGreaterThanOrEqual(1);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
