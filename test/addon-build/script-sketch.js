p5.disableFriendlyErrors = true;

function setup() {
  createCanvas(120, 80);
  noLoop();

  window.runAddonScriptBuildExport = function() {
    beginRecordSvg(window, null);
    line(10, 10, 110, 10);
    rect(20, 25, 40, 30);
    circle(85, 40, 20);
    return endRecordSvg();
  };
}

function draw() {
  background(255);
  line(10, 10, 110, 10);
  rect(20, 25, 40, 30);
  circle(85, 40, 20);
}
