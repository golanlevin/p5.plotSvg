const { test, expect } = require("@playwright/test");
const path = require("path");

const runners = [
  {
    name: "p5 v1.11.13",
    file: "compat2/runner-v1.html",
    major: 1
  },
  {
    name: "p5 v2.2.2",
    file: "compat2/runner-v2.html",
    major: 2
  }
];

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

function finding(report, id) {
  return report.findings.find(item => item.id === id);
}

for (const runner of runners) {
  test(`${runner.name} exposes all compat2 audit findings`, async ({ page }) => {
    const consoleErrors = [];
    page.on("console", msg => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(testUrl(runner.file));
    await page.waitForFunction(() => typeof window.runCompat2Audit === "function");

    const sceneExport = await page.evaluate(() => {
      const svg = window.runCompat2SceneExport();
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      return {
        svgLength: svg.length,
        parseError: parseError ? parseError.textContent : "",
        hasUndefinedOrNaN: /undefined|NaN/.test(svg)
      };
    });

    const report = await page.evaluate(() => window.runCompat2Audit());

    expect(parseInt(report.version.split(".")[0], 10)).toBe(runner.major);
    expect(sceneExport.svgLength).toBeGreaterThan(0);
    expect(sceneExport.parseError).toBe("");
    expect(sceneExport.hasUndefinedOrNaN).toBe(false);
    expect(report.findings.map(item => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(consoleErrors).toEqual([]);

    for (const item of report.findings) {
      if (item.record) {
        expect(item.record.parseError).toBe("");
        expect(item.record.hasUndefinedOrNaN).toBe(false);
      }
    }

    const f1 = finding(report, 1);
    expect(f1.apiBeforeRecord).toHaveProperty("curve");
    expect(f1.record.error).toBe("");
    expect(f1.record.counts.path).toBeGreaterThanOrEqual(1);

    const f2 = finding(report, 2);
    expect(f2.record.error).toBe("");
    expect(f2.record.counts.path).toBeGreaterThanOrEqual(1);

    const f3 = finding(report, 3);
    expect(f3.record.error).toBe("");
    expect(f3.record.hasQuadraticPath).toBe(true);

    const f4 = finding(report, 4);
    expect(f4.record.counts.path).toBeGreaterThanOrEqual(1);
    expect(f4.record.hasCubicPath).toBe(true);

    const f5 = finding(report, 5);
    expect(f5.instanceProbe.error).toBe("");
    expect(f5.instanceProbe.svgLength).toBeGreaterThan(0);
    expect(f5.instanceProbe.before).toHaveProperty("lineOwn");
    expect(f5.instanceProbe.after).toHaveProperty("lineOwn");
    expect(f5.instanceProbe.after.lineOwn).toBe(f5.instanceProbe.before.lineOwn);
    expect(f5.instanceProbe.after.rectOwn).toBe(f5.instanceProbe.before.rectOwn);
    expect(f5.instanceProbe.after.lineType).toBe(f5.instanceProbe.before.lineType);
    expect(f5.instanceProbe.after.rectType).toBe(f5.instanceProbe.before.rectType);

    const f6 = finding(report, 6);
    expect(f6.apiBeforeRecord).toHaveProperty("beginClip");
    expect(f6.record.counts.clipPath).toBe(0);

    const f7 = finding(report, 7);
    expect(f7.record.counts.text).toBe(1);
    expect(f7.record.textAttrs.length).toBe(1);

    const f8 = finding(report, 8);
    expect(f8.checks.length).toBeGreaterThanOrEqual(6);
  });
}
