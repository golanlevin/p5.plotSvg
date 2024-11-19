// Extremely simple demo of how to use the p5.plotSvg library to export SVG files.

function setup() {
  createCanvas(576, 384); // 6"x4" at 96 dpi
  background(245); 
  noFill();

  beginRecordSVG(this, "plotSvg_hello1.svg");
  circle(width/2, height/2, 300); 
  ellipse(width/2-60, height/2-40, 30, 50);
  ellipse(width/2+60, height/2-40, 30, 50);
  arc(width/2, height/2+30, 150, 100, 0, PI);
  endRecordSVG();
}