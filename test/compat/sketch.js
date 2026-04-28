// Shared p5.plotSvg compatibility sketch for p5.js v1 and v2.

p5.disableFriendlyErrors = true;

const TEST_W = 420;
const TEST_H = 420;

function setup() {
  createCanvas(TEST_W, TEST_H);
  noLoop();

  const button = createButton("Export");
  button.mousePressed(() => {
    const svg = window.runPlotSvgSmokeTest();
    console.log(`p5.plotSvg smoke SVG length: ${svg.length}`);
  });

  drawTestScene();
}

function draw() {
  drawTestScene();
}

function drawTestScene() {
  background(248);
  noFill();
  stroke(0);
  strokeWeight(1);

  line(24, 28, 124, 70);
  point(155, 50);
  rect(188, 24, 70, 46, 8);
  circle(318, 48, 54);
  ellipse(72, 128, 90, 42);
  arc(190, 128, 86, 62, 0, PI + QUARTER_PI, OPEN);
  triangle(294, 103, 352, 151, 256, 159);
  quad(35, 204, 92, 184, 130, 230, 58, 250);

  push();
  translate(230, 220);
  rotate(PI / 8);
  scale(1.1, 0.75);
  rect(-38, -26, 76, 52);
  pop();

  stroke("red");
  bezier(30, 330, 100, 260, 150, 390, 210, 318);

  stroke("blue");
  if (isP5V2()) {
    beginShape();
    bezierVertex(238, 330);
    bezierVertex(274, 260);
    bezierVertex(326, 390);
    bezierVertex(382, 318);
    endShape();
  } else {
    beginShape();
    vertex(238, 330);
    bezierVertex(274, 260, 326, 390, 382, 318);
    endShape();
  }

  stroke("green");
  if (isP5V2()) {
    splineProperty("tightness", 0);
    splineProperty("ends", INCLUDE);
    beginShape();
    splineVertex(32, 282);
    splineVertex(84, 242);
    splineVertex(132, 292);
    splineVertex(184, 252);
    endShape();
    splineProperty("ends", EXCLUDE);
    spline(226, 282, 268, 242, 318, 292, 370, 252);
  } else {
    curveTightness(0);
    beginShape();
    curveVertex(32, 282);
    curveVertex(32, 282);
    curveVertex(84, 242);
    curveVertex(132, 292);
    curveVertex(184, 252);
    curveVertex(184, 252);
    endShape();
    curve(226, 282, 268, 242, 318, 292, 370, 252);
  }
}

function isP5V2() {
  return parseInt(p5.VERSION.split(".")[0], 10) >= 2;
}

window.runPlotSvgSmokeTest = function() {
  beginRecordSvg(window, null);
  drawTestScene();
  const svg = endRecordSvg();
  window.__lastPlotSvgSmoke = {
    version: p5.VERSION,
    svg
  };
  return svg;
};
