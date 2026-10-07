/*
 * These p5.plotSvg regression cases are adapted from the native p5.svg
 * visual tests added to p5.js in PR #9123 by Vansh Kabra:
 * https://github.com/processing/p5.js/pull/9123
 * https://github.com/processing/p5.js/blob/202d0da34fe24a161da47fcc8cd419429eea2d37/test/unit/visual/cases/svg.js
 *
 * The original tests exercise p5.svg's buildShape()/getSVG() workflow. These
 * translated cases keep the useful drawing scenarios, but assert p5.plotSvg's
 * plotter-oriented SVG export behavior instead.
 */

p5.disableFriendlyErrors = true;

function setup() {
  createCanvas(220, 220);
  noLoop();
  setSvgCoordinatePrecision(4);
  setSvgTransformPrecision(4);

  window.runNativeSvgInspiredExports = function() {
    return {
      primitives: exportCase(drawPrimitiveShapes),
      customPaths: exportCase(drawCustomPaths),
      transforms: exportCase(drawTransforms),
      pushPopState: exportCase(drawPushPopState)
    };
  };
}

function draw() {
  background(255);
  drawPrimitiveShapes();
}

function exportCase(drawFn) {
  beginRecordSvg(window, null);
  drawFn();
  return endRecordSvg();
}

function applyDefaultStyle() {
  noFill();
  stroke("black");
  strokeWeight(1);
}

function drawPrimitiveShapes() {
  applyDefaultStyle();

  circle(35, 35, 30);
  ellipse(90, 35, 40, 22);
  rect(125, 20, 35, 25);
  square(175, 20, 25);
  line(20, 70, 70, 95);
  point(100, 82);
  triangle(125, 95, 145, 65, 170, 95);
  quad(25, 125, 65, 115, 75, 155, 35, 165);
  arc(130, 145, 55, 45, 0, PI + HALF_PI, OPEN);
}

function drawCustomPaths() {
  applyDefaultStyle();

  beginShape();
  vertex(20, 20);
  vertex(60, 20);
  vertex(60, 55);
  vertex(20, 55);
  endShape(CLOSE);

  if (getP5MajorVersion() >= 2 && typeof bezierOrder === "function") {
    bezierOrder(3);
    beginShape();
    vertex(85, 45);
    bezierVertex(105, 5);
    bezierVertex(145, 85);
    bezierVertex(165, 45);
    endShape();
  } else {
    beginShape();
    vertex(85, 45);
    bezierVertex(105, 5, 145, 85, 165, 45);
    endShape();
  }

  beginShape(TRIANGLE_FAN);
  vertex(45, 125);
  vertex(45, 85);
  vertex(80, 100);
  vertex(85, 135);
  vertex(55, 160);
  vertex(25, 135);
  endShape();

  beginShape(TRIANGLE_STRIP);
  vertex(115, 155);
  vertex(125, 100);
  vertex(135, 155);
  vertex(145, 100);
  vertex(155, 155);
  vertex(165, 100);
  endShape();

  beginShape(QUAD_STRIP);
  vertex(15, 205);
  vertex(15, 175);
  vertex(45, 205);
  vertex(45, 175);
  vertex(75, 205);
  vertex(75, 175);
  endShape();
}

function getP5MajorVersion() {
  return parseInt(p5.VERSION.split(".")[0], 10);
}

function drawTransforms() {
  applyDefaultStyle();

  push();
  translate(45, 35);
  ellipse(0, 0, 42, 24);
  pop();

  push();
  translate(120, 40);
  rotate(QUARTER_PI);
  rect(-18, -12, 36, 24);
  pop();

  push();
  translate(55, 125);
  scale(1.4, 0.7);
  circle(0, 0, 34);
  pop();

  push();
  translate(135, 130);
  rotate(PI / 6);
  scale(1.2, 0.85);
  rect(-18, -18, 36, 36);
  pop();
}

function drawPushPopState() {
  applyDefaultStyle();

  line(20, 25, 190, 25);

  push();
  translate(20, 25);
  stroke("red");
  line(0, 25, 170, 25);

  push();
  translate(0, 25);
  rotate(0.12);
  stroke("blue");
  line(0, 25, 170, 25);
  pop();

  line(0, 100, 170, 100);
  pop();

  line(20, 175, 190, 175);
}
