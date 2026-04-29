const { test, expect } = require("@playwright/test");
const fs = require("fs");
const http = require("http");
const path = require("path");

const scriptRunners = [
  {
    name: "p5 v1.11.13 script build",
    file: "addon-build/script-v1.html",
    major: 1
  },
  {
    name: "p5 v2.2.2 script build",
    file: "addon-build/script-v2.html",
    major: 2
  }
];

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

let staticServer;
let staticServerBaseUrl;

test.beforeAll(async () => {
  const root = path.resolve(__dirname, "..");
  staticServer = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const filePath = path.resolve(root, urlPath.slice(1));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml"
    };

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
      res.end(data);
    });
  });

  await new Promise(resolve => {
    staticServer.listen(0, "127.0.0.1", () => {
      const { port } = staticServer.address();
      staticServerBaseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.afterAll(async () => {
  if (!staticServer) return;
  await new Promise(resolve => staticServer.close(resolve));
});

function httpTestUrl(file) {
  return `${staticServerBaseUrl}/${file}`;
}

for (const runner of scriptRunners) {
  test(`${runner.name} exports SVG from dist script build`, async ({ page }) => {
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
    await page.waitForFunction(() => typeof window.runAddonScriptBuildExport === "function");

    const report = await page.evaluate(() => {
      const svg = window.runAddonScriptBuildExport();
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      return {
        version: p5.VERSION,
        hasNamespace: typeof window.p5plotSvg === "object",
        hasPrototypeApi: typeof p5.prototype.beginRecordSvg === "function",
        hasGlobalApi: typeof window.beginRecordSvg === "function",
        registeredAddon: typeof p5.registerAddon !== "function" ||
          p5._registeredAddons.has(window.p5plotSvg.plotSvgAddon),
        svg: {
          svgLength: svg.length,
          parseError: parseError ? parseError.textContent : "",
          hasUndefinedNaNOrInfinity: /undefined|NaN|Infinity/.test(svg),
          counts: {
            circle: doc.querySelectorAll("circle").length,
            line: doc.querySelectorAll("line").length,
            rect: doc.querySelectorAll("rect").length
          }
        }
      };
    });

    expect(parseInt(report.version.split(".")[0], 10)).toBe(runner.major);
    expect(report.hasNamespace).toBe(true);
    expect(report.hasPrototypeApi).toBe(true);
    expect(report.hasGlobalApi).toBe(true);
    expect(report.registeredAddon).toBe(true);
    expect(report.svg.parseError).toBe("");
    expect(report.svg.hasUndefinedNaNOrInfinity).toBe(false);
    expect(report.svg.counts).toEqual({ circle: 1, line: 1, rect: 1 });
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}

test("p5 v2 imports dist ESM build and exports SVG", async ({ page }) => {
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

  await page.goto(httpTestUrl("test/addon-build/esm-v2.html"));
  await page.waitForFunction(() => typeof window.runAddonEsmBuildExport === "function");

  const report = await page.evaluate(() => {
    const svg = window.runAddonEsmBuildExport();
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const parseError = doc.querySelector("parsererror");
    return {
      version: p5.VERSION,
      importReport: window.__addonEsmImportReport,
      hasPrototypeApi: typeof p5.prototype.beginRecordSvg === "function",
      hasGlobalApi: typeof window.beginRecordSvg === "function",
      svg: {
        svgLength: svg.length,
        parseError: parseError ? parseError.textContent : "",
        hasUndefinedNaNOrInfinity: /undefined|NaN|Infinity/.test(svg),
        counts: {
          circle: doc.querySelectorAll("circle").length,
          line: doc.querySelectorAll("line").length,
          rect: doc.querySelectorAll("rect").length
        }
      }
    };
  });

  expect(parseInt(report.version.split(".")[0], 10)).toBe(2);
  expect(report.importReport).toEqual({
    defaultMatchesNamed: true,
    hasNamespace: true,
    hasAddon: true,
    registeredAddon: true
  });
  expect(report.hasPrototypeApi).toBe(true);
  expect(report.hasGlobalApi).toBe(true);
  expect(report.svg.parseError).toBe("");
  expect(report.svg.hasUndefinedNaNOrInfinity).toBe(false);
  expect(report.svg.counts).toEqual({ circle: 1, line: 1, rect: 1 });
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
