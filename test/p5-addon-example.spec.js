const { test, expect } = require("@playwright/test");
const fs = require("fs");
const http = require("http");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const examples = [
  {
    name: "p5 v1.11.13 global add-on example",
    page: "examples/plotSvg_addon_example/plotSvg_addon_example_v1_global/index.html",
    fixture: "examples/plotSvg_addon_example/results/plotSvg_addon_example_v1_global.svg",
    major: 1,
    cdnPattern: "**/npm/p5@1.11.13/lib/p5.js",
    localP5: "test/p5.js-v.1.11.13/p5.js"
  },
  {
    name: "p5 v1.11.13 instance add-on example",
    page: "examples/plotSvg_addon_example/plotSvg_addon_example_v1_instance/index.html",
    fixture: "examples/plotSvg_addon_example/results/plotSvg_addon_example_v1_instance.svg",
    major: 1,
    cdnPattern: "**/npm/p5@1.11.13/lib/p5.js",
    localP5: "test/p5.js-v.1.11.13/p5.js"
  },
  {
    name: "p5 v2.3.0 global add-on example",
    page: "examples/plotSvg_addon_example/plotSvg_addon_example_v2_global/index.html",
    fixture: "examples/plotSvg_addon_example/results/plotSvg_addon_example_v2_global.svg",
    major: 2,
    cdnPattern: "**/npm/p5@2.3.0/lib/p5.js",
    localP5: "test/p5.js-v2.3.0/p5.js"
  },
  {
    name: "p5 v2.3.0 instance add-on example",
    page: "examples/plotSvg_addon_example/plotSvg_addon_example_v2_instance/index.html",
    fixture: "examples/plotSvg_addon_example/results/plotSvg_addon_example_v2_instance.svg",
    major: 2,
    cdnPattern: "**/npm/p5@2.3.0/lib/p5.js",
    localP5: "test/p5.js-v2.3.0/p5.js"
  }
];

let staticServer;
let staticServerBaseUrl;

test.use({ acceptDownloads: true });

test.beforeAll(async () => {
  staticServer = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const filePath = path.resolve(repoRoot, urlPath.slice(1));
    if (!filePath.startsWith(repoRoot)) {
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

function exampleUrl(file) {
  return `${staticServerBaseUrl}/${file}`;
}

function readText(file) {
  return fs.readFileSync(path.resolve(repoRoot, file), "utf8");
}

function normalizeSvg(svg) {
  return svg
    .replace(/\r\n/g, "\n")
    .replace(
      /^<!-- [A-Z][a-z]{2} [A-Z][a-z]{2} .* GMT.* -->$/m,
      "<!-- SVG export timestamp -->"
    )
    .trim();
}

for (const example of examples) {
  test(`${example.name} exports the expected SVG`, async ({ page }) => {
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

    await page.route(example.cdnPattern, async route => {
      await route.fulfill({
        contentType: "text/javascript; charset=utf-8",
        body: readText(example.localP5)
      });
    });

    await page.goto(exampleUrl(example.page), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.p5 && document.querySelector("canvas") && document.querySelector("button"));

    const downloadPromise = page.waitForEvent("download");
    await page.click("button");
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    const actualSvg = fs.readFileSync(downloadedPath, "utf8");

    const report = await page.evaluate(svg => {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      const count = selector => doc.querySelectorAll(selector).length;
      return {
        version: p5.VERSION,
        parseError: parseError ? parseError.textContent : "",
        hasUndefinedNaNOrInfinity: /undefined|NaN|Infinity/.test(svg),
        recording: p5plotSvg.isRecordingSVG(),
        counts: {
          circle: count("circle"),
          line: count("line"),
          path: count("path"),
          group: count("g")
        }
      };
    }, actualSvg);

    expect(parseInt(report.version.split(".")[0], 10)).toBe(example.major);
    expect(download.suggestedFilename()).toBe(path.basename(example.fixture));
    expect(report.parseError).toBe("");
    expect(report.hasUndefinedNaNOrInfinity).toBe(false);
    expect(report.recording).toBe(false);
    expect(report.counts.circle).toBeGreaterThanOrEqual(9);
    expect(report.counts.line).toBeGreaterThanOrEqual(20);
    expect(report.counts.path).toBeGreaterThanOrEqual(2);
    expect(report.counts.group).toBeGreaterThanOrEqual(3);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    const expectedSvg = readText(example.fixture);
    expect(normalizeSvg(actualSvg)).toBe(normalizeSvg(expectedSvg));
  });
}
