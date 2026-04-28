const { test, expect } = require("@playwright/test");
const path = require("path");

const runners = [
  {
    name: "p5 v1.11.13",
    file: "escaping/runner-v1.html",
    major: 1
  },
  {
    name: "p5 v2.2.2",
    file: "escaping/runner-v2.html",
    major: 2
  }
];

function testUrl(file) {
  return `file://${path.resolve(__dirname, file)}`;
}

for (const runner of runners) {
  test(`${runner.name} escapes user-provided SVG text and attributes`, async ({ page }) => {
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
    await page.waitForFunction(() => typeof window.runEscapingExport === "function");

    const report = await page.evaluate(() => {
      const svg = window.runEscapingExport();
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      const root = doc.documentElement;
      const marker = doc.querySelector("marker");
      const group = doc.querySelector("g[id]");
      const text = doc.querySelector("text");
      const desc = doc.querySelector("desc");

      return {
        version: p5.VERSION,
        svg,
        parseError: parseError ? parseError.textContent : "",
        rootDataNote: root.getAttribute("data-note"),
        markerId: marker?.getAttribute("id") || "",
        markerDataNote: marker?.getAttribute("data-note") || "",
        groupId: group?.getAttribute("id") || "",
        groupDataNote: group?.getAttribute("data-note") || "",
        textFont: text?.getAttribute("font-family") || "",
        textContent: text?.textContent || "",
        descContent: desc?.textContent || "",
        rawEscapes: {
          header: svg.includes('data-note="root &amp; &quot;quote&quot; &lt;tag&gt; &gt; end"'),
          defId: svg.includes('id="marker &amp; &quot;quote&quot; &lt;tag&gt; &gt; end"'),
          groupId: svg.includes('id="group &amp; &quot;quote&quot; &lt;tag&gt; &gt; end"'),
          font: svg.includes('font-family="Arial &amp; &lt;Sans&gt;"'),
          text: svg.includes('Text &amp; &lt;tag&gt; "quote" \'apos\' &gt; end'),
          desc: svg.includes('Description &amp; &lt;tag&gt; "quote" \'apos\' &gt; end')
        }
      };
    });

    expect(parseInt(report.version.split(".")[0], 10)).toBe(runner.major);
    expect(report.parseError).toBe("");
    expect(report.rootDataNote).toBe('root & "quote" <tag> > end');
    expect(report.markerId).toBe('marker & "quote" <tag> > end');
    expect(report.markerDataNote).toBe('def & "quote" <tag> > end');
    expect(report.groupId).toBe('group & "quote" <tag> > end');
    expect(report.groupDataNote).toBe('group attr & "quote" <tag> > end');
    expect(report.textFont).toBe('Arial & <Sans>');
    expect(report.textContent).toBe('Text & <tag> "quote" \'apos\' > end');
    expect(report.descContent).toBe('Description & <tag> "quote" \'apos\' > end');
    for (const didEscape of Object.values(report.rawEscapes)) {
      expect(didEscape).toBe(true);
    }
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
