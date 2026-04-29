p5.disableFriendlyErrors = true;

function setup() {
  createCanvas(220, 220);
  setSvgCoordinatePrecision(4);

  window.runPathRegressionExport = function() {
    beginRecordSvg(window, null);
    drawPathRegressionScene();
    return endRecordSvg();
  };
}

function draw() {
  background(255);
  drawPathRegressionScene();
}

function drawPathRegressionScene() {
  noFill();
  stroke(0);
  strokeWeight(1);

  beginShape();
  vertex(10, 10);
  vertex(50, 10);
  vertex(50, 40);
  endShape();

  beginShape();
  vertex(70, 10);
  vertex(110, 10);
  vertex(110, 40);
  endShape(CLOSE);

  beginShape();
  vertex(10, 70);
  bezierVertex(30, 50, 50, 90, 70, 70);
  endShape();

  beginShape();
  vertex(90, 70);
  quadraticVertex(120, 40, 150, 70);
  endShape();

  beginShape();
  curveVertex(10, 130);
  curveVertex(10, 130);
  curveVertex(40, 100);
  curveVertex(70, 130);
  curveVertex(70, 130);
  endShape();

  beginShape();
  vertex(120, 110);
  vertex(190, 110);
  vertex(190, 180);
  vertex(120, 180);
  beginContour();
  vertex(140, 130);
  vertex(140, 160);
  vertex(170, 160);
  vertex(170, 130);
  endContour(CLOSE);
  endShape(CLOSE);
}
