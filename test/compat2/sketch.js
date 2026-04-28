// p5.plotSvg compatibility audit sketch.
// This deliberately exercises the known v2 compatibility findings.

p5.disableFriendlyErrors = true;

const AUDIT_W = 920;
const AUDIT_H = 760;
const CARD_W = 430;
const CARD_H = 150;
const GAP = 14;

function setup() {
  createCanvas(AUDIT_W, AUDIT_H);
  noLoop();

  const auditButton = createButton("Run audit");
  auditButton.mousePressed(async () => {
    const report = await window.runCompat2Audit();
    console.log("p5.plotSvg compat2 audit", report);
  });

  const exportButton = createButton("Export scene");
  exportButton.mousePressed(() => {
    const svg = window.runCompat2SceneExport();
    downloadCompat2Svg(svg);
    console.log(`p5.plotSvg compat2 SVG length: ${svg.length}`);
  });

  drawCompat2Scene();
}

function draw() {
  drawCompat2Scene();
}

function drawCompat2Scene() {
  background(248);
  textFont("system-ui, sans-serif");
  textSize(11);
  strokeWeight(1);

  drawCard(1, "curve() / curveTightness()", 14, 14, drawFinding1);
  drawCard(2, "curveVertex()", 458, 14, drawFinding2);
  drawCard(3, "quadraticVertex()", 14, 178, drawFinding3);
  drawCard(4, "old bezierVertex(...6)", 458, 178, drawFinding4);
  drawCard(5, "instance-mode globals", 14, 342, drawFinding5);
  drawCard(6, "clip APIs unsupported", 458, 342, drawFinding6);
  drawCard(7, "text state", 14, 506, drawFinding7);
  drawCard(8, "test depth", 458, 506, drawFinding8);
}

function drawCard(id, title, x, y, drawFn) {
  push();
  translate(x, y);
  noFill();
  stroke(205);
  rect(0, 0, CARD_W, CARD_H);
  noStroke();
  fill(30);
  textSize(12);
  text(`${id}. ${title}`, 10, 18);
  stroke(215);
  line(10, 26, CARD_W - 10, 26);
  translate(10, 36);
  drawFn(CARD_W - 20, CARD_H - 46);
  pop();
}

function drawFinding1(w, h) {
  noFill();
  stroke(30);
  if (isP5V2()) {
    drawControlPoints([30, 72, 120, 28, 250, 102, 360, 44]);
    stroke(200, 40, 40);
    line(120, 28, 250, 102);
    drawNote("v2 currently has no v1 curve() shim.");
  } else {
    curveTightness(-2);
    curve(30, 72, 120, 28, 250, 102, 360, 44);
    curveTightness(0);
  }
}

function drawFinding2(w, h) {
  noFill();
  stroke(30);
  if (isP5V2()) {
    drawControlPoints([32, 92, 32, 92, 95, 30, 178, 92, 250, 42, 250, 42]);
    stroke(200, 40, 40);
    line(95, 30, 178, 92);
    line(178, 92, 250, 42);
    drawNote("v2 currently has no curveVertex() shim.");
  } else {
    beginShape();
    curveVertex(32, 92);
    curveVertex(32, 92);
    curveVertex(95, 30);
    curveVertex(178, 92);
    curveVertex(250, 42);
    curveVertex(250, 42);
    endShape();
  }
}

function drawFinding3(w, h) {
  noFill();
  stroke(30);
  if (isP5V2()) {
    drawControlPoints([30, 90, 105, 15, 180, 90, 250, 20, 330, 90]);
    stroke(200, 40, 40);
    line(30, 90, 180, 90);
    line(180, 90, 330, 90);
    drawNote("v2 currently has no quadraticVertex() shim.");
  } else {
    beginShape();
    vertex(30, 90);
    quadraticVertex(105, 15, 180, 90);
    quadraticVertex(250, 20, 330, 90);
    endShape();
  }
}

function drawFinding4(w, h) {
  noFill();
  stroke(30);
  if (isP5V2()) {
    drawControlPoints([30, 84, 120, 0, 220, 130, 340, 84]);
    stroke(200, 40, 40);
    line(30, 84, 340, 84);
    drawNote("v2 canvas and SVG can diverge for old syntax.");
  } else {
    beginShape();
    vertex(30, 84);
    // This is intentionally old v1 syntax. In v2, p5's canvas API treats
    // bezierVertex() as a point stream, while the exporter records it as v1.
    bezierVertex(120, 0, 220, 130, 340, 84);
    endShape();
  }
}

function drawFinding5(w, h) {
  noFill();
  stroke(30);
  rect(28, 24, 120, 76);
  line(28, 24, 148, 100);
  noStroke();
  fill(30);
  text("Probe runs new p5(sketch) in a hidden iframe.", 18, 122);
}

function drawFinding6(w, h) {
  noStroke();
  fill(230, 240, 255);
  rect(24, 24, 110, 76);
  fill(60, 130, 190);
  circle(88, 62, 96);
  noFill();
  stroke(30);
  rect(24, 24, 110, 76);
  noStroke();
  fill(30);
  text("Intentional: SVG export leaves clipped geometry unclipped.", 18, 122);
}

function drawFinding7(w, h) {
  fill(30);
  noStroke();
  textFont("Georgia");
  textSize(34);
  textAlign(CENTER, CENTER);
  if (typeof BOLDITALIC !== "undefined") {
    textStyle(BOLDITALIC);
  }
  text("Text", w / 2, 62);
  textStyle(NORMAL);
  textAlign(LEFT, BASELINE);
  textFont("system-ui, sans-serif");
  textSize(11);
  text("Checks font, style, and vertical alignment metadata.", 18, 122);
}

function drawFinding8(w, h) {
  noFill();
  stroke(30);
  rect(24, 24, 62, 62);
  pathGlyph(118, 78);
  line(190, 24, 278, 94);
  noStroke();
  fill(30);
  text("compat2 adds path, API, iframe, clip, and text probes.", 18, 122);
}

function drawControlPoints(coords) {
  push();
  stroke(170);
  for (let i = 0; i + 3 < coords.length; i += 2) {
    line(coords[i], coords[i + 1], coords[i + 2], coords[i + 3]);
  }
  noFill();
  stroke(30);
  for (let i = 0; i < coords.length; i += 2) {
    circle(coords[i], coords[i + 1], 5);
  }
  pop();
}

function drawNote(msg) {
  push();
  noStroke();
  fill(120, 30, 30);
  textSize(11);
  text(msg, 18, 122);
  pop();
}

function pathGlyph(x, y) {
  beginShape();
  if (isP5V2()) {
    bezierVertex(x, y);
    bezierVertex(x + 22, y - 72);
    bezierVertex(x + 92, y - 72);
    bezierVertex(x + 114, y);
  } else {
    vertex(x, y);
    bezierVertex(x + 22, y - 72, x + 92, y - 72, x + 114, y);
  }
  endShape();
}

function isP5V2() {
  return parseInt(p5.VERSION.split(".")[0], 10) >= 2;
}

function getApiSnapshot() {
  return {
    curve: typeof window.curve,
    curveVertex: typeof window.curveVertex,
    curveTightness: typeof window.curveTightness,
    spline: typeof window.spline,
    splineVertex: typeof window.splineVertex,
    splineProperty: typeof window.splineProperty,
    quadraticVertex: typeof window.quadraticVertex,
    bezierOrder: typeof window.bezierOrder,
    beginClip: typeof window.beginClip,
    endClip: typeof window.endClip
  };
}

function recordSvg(fn) {
  let begun = false;
  let svg = "";
  let error = "";
  try {
    beginRecordSvg(window, null);
    begun = true;
    fn();
    svg = endRecordSvg();
    begun = false;
  } catch (err) {
    error = String(err && err.message ? err.message : err);
    if (begun) {
      try {
        svg = endRecordSvg();
      } catch (endErr) {
        error += " | endRecordSvg: " + String(endErr && endErr.message ? endErr.message : endErr);
      }
    }
  }
  return summarizeSvg(svg, error);
}

function summarizeSvg(svg, error) {
  const doc = new DOMParser().parseFromString(svg || "<svg></svg>", "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  const pathData = Array.from(doc.querySelectorAll("path")).map(path => path.getAttribute("d") || "");
  const textAttrs = Array.from(doc.querySelectorAll("text")).map(el => ({
    fontFamily: el.getAttribute("font-family"),
    fontStyle: el.getAttribute("font-style"),
    fontWeight: el.getAttribute("font-weight"),
    textAnchor: el.getAttribute("text-anchor"),
    y: el.getAttribute("y")
  }));
  return {
    error,
    svgLength: svg ? svg.length : 0,
    parseError: parseError ? parseError.textContent : "",
    counts: {
      circle: doc.querySelectorAll("circle").length,
      clipPath: doc.querySelectorAll("clipPath").length,
      line: doc.querySelectorAll("line").length,
      path: doc.querySelectorAll("path").length,
      polygon: doc.querySelectorAll("polygon").length,
      polyline: doc.querySelectorAll("polyline").length,
      rect: doc.querySelectorAll("rect").length,
      text: doc.querySelectorAll("text").length
    },
    pathData,
    textAttrs,
    hasCubicPath: pathData.some(d => /\bC\b/.test(d)),
    hasQuadraticPath: pathData.some(d => /\bQ\b/.test(d)),
    hasUndefinedOrNaN: /undefined|NaN/.test(svg || "")
  };
}

function downloadCompat2Svg(svg) {
  const major = window.P5_COMPAT2_MAJOR || parseInt(p5.VERSION.split(".")[0], 10);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `p5-plotSvg-compat2-v${major}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function runInstanceProbe() {
  return new Promise(resolve => {
    const probeUrl = window.P5_COMPAT2_INSTANCE_PROBE;
    if (!probeUrl) {
      resolve({ error: "No instance probe URL configured." });
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-10000px";
    iframe.style.width = "60px";
    iframe.style.height = "60px";

    const timeout = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      iframe.remove();
      resolve({ error: "Instance probe timed out." });
    }, 3000);

    function onMessage(event) {
      if (!event.data || event.data.type !== "compat2-instance-probe") return;
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      resolve(event.data.result);
    }

    window.addEventListener("message", onMessage);
    iframe.src = probeUrl;
    document.body.appendChild(iframe);
  });
}

function auditFinding1() {
  return {
    id: 1,
    name: "curve() and curveTightness()",
    apiBeforeRecord: getApiSnapshot(),
    record: recordSvg(() => {
      if (typeof window.curveTightness === "function") {
        window.curveTightness(-2);
      }
      if (typeof window.curve === "function") {
        window.curve(30, 72, 120, 28, 250, 102, 360, 44);
      }
    })
  };
}

function auditFinding2() {
  return {
    id: 2,
    name: "curveVertex()",
    apiBeforeRecord: getApiSnapshot(),
    record: recordSvg(() => {
      beginShape();
      window.curveVertex(32, 92);
      window.curveVertex(32, 92);
      window.curveVertex(95, 30);
      window.curveVertex(178, 92);
      window.curveVertex(250, 42);
      window.curveVertex(250, 42);
      endShape();
    })
  };
}

function auditFinding3() {
  return {
    id: 3,
    name: "quadraticVertex()",
    apiBeforeRecord: getApiSnapshot(),
    record: recordSvg(() => {
      beginShape();
      vertex(30, 90);
      window.quadraticVertex(105, 15, 180, 90);
      window.quadraticVertex(250, 20, 330, 90);
      endShape();
    })
  };
}

function auditFinding4() {
  return {
    id: 4,
    name: "old six-argument bezierVertex()",
    apiBeforeRecord: getApiSnapshot(),
    record: recordSvg(() => {
      beginShape();
      vertex(30, 84);
      bezierVertex(120, 0, 220, 130, 340, 84);
      endShape();
    })
  };
}

async function auditFinding5() {
  return {
    id: 5,
    name: "instance-mode global pollution",
    instanceProbe: await runInstanceProbe()
  };
}

function auditFinding6() {
  return {
    id: 6,
    name: "beginClip() and endClip()",
    apiBeforeRecord: getApiSnapshot(),
    record: recordSvg(() => {
      if (typeof beginClip === "function" && typeof endClip === "function") {
        beginClip();
        rect(10, 10, 80, 60);
        endClip();
        circle(60, 50, 120);
      }
    })
  };
}

function auditFinding7() {
  return {
    id: 7,
    name: "text state",
    record: recordSvg(() => {
      textFont("Georgia");
      textSize(34);
      textAlign(CENTER, CENTER);
      if (typeof BOLDITALIC !== "undefined") {
        textStyle(BOLDITALIC);
      }
      text("Text", 120, 80);
      textStyle(NORMAL);
      textAlign(LEFT, BASELINE);
    })
  };
}

function auditFinding8() {
  return {
    id: 8,
    name: "test depth",
    checks: [
      "API presence snapshots",
      "SVG path data inspection",
      "instance-mode iframe probe",
      "clipPath count inspection",
      "text attribute inspection",
      "undefined/NaN scan"
    ],
    note: "compat2 is intentionally deeper than the original count-only smoke test."
  };
}

window.runCompat2Audit = async function() {
  const report = {
    version: p5.VERSION,
    major: parseInt(p5.VERSION.split(".")[0], 10),
    findings: []
  };

  report.findings.push(auditFinding1());
  report.findings.push(auditFinding2());
  report.findings.push(auditFinding3());
  report.findings.push(auditFinding4());
  report.findings.push(await auditFinding5());
  report.findings.push(auditFinding6());
  report.findings.push(auditFinding7());
  report.findings.push(auditFinding8());

  window.__lastCompat2Audit = report;
  return report;
};

window.runCompat2SceneExport = function() {
  beginRecordSvg(window, null);
  drawCompat2Scene();
  const svg = endRecordSvg();
  window.__lastCompat2SceneSvg = svg;
  return svg;
};
