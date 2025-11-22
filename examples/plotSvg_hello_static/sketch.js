// https://github.com/golanlevin/p5.plotSvg (v.0.1.0)
// A Plotter-Oriented SVG Exporter for p5.js
// Golan Levin, November 2024
//
// Extremely simple demo of using p5.plotSvg to export SVG files.
// Requires https://unpkg.com/p5.plotsvg@0.1.0/lib/p5.plotSvg.js or
// https://cdn.jsdelivr.net/npm/p5.plotsvg@latest/lib/p5.plotSvg.js
// 
// Note 1: This sketch will save an SVG at the very moment when you run it. 
// Note 2: This sketch issues many warnings; this line quiets them:
p5.disableFriendlyErrors = true;

function setup() {
  createCanvas(576, 384); // 6"x4" at 96 dpi
  background(245); 
  noFill();

  beginRecordSvg(this, "plotSvg_hello1.svg");
  circle(width/2, height/2, 300); 
  ellipse(width/2-60, height/2-40, 30, 50);
  ellipse(width/2+60, height/2-40, 30, 50);
  arc(width/2, height/2+30, 150, 100, 0, PI);
  endRecordSvg();
}