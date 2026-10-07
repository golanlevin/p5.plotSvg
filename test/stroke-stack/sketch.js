p5.disableFriendlyErrors = true;

function setup() {
  createCanvas(140, 100);
  noLoop();

  window.runStrokeStackExport = function() {
    beginRecordSvg(window, null);
    drawStrokeStackScene();
    return endRecordSvg();
  };
}

function draw() {
  background(255);
  drawStrokeStackScene();
}

function drawStrokeStackScene() {
  noFill();
  stroke("black");
  strokeWeight(1);

  line(20, 20, 120, 20);

  push();
  stroke("red");
  line(20, 35, 120, 35);

  push();
  stroke("blue");
  line(20, 50, 120, 50);
  pop();

  line(20, 65, 120, 65);
  pop();

  line(20, 80, 120, 80);
}
