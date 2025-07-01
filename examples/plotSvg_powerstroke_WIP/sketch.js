// WORK IN PROGRESS; NOTHING TO SEE HERE YET

p5.disableFriendlyErrors = true; 
let bDoExportSvg = false;
let aPowerStroke;

function setup() {
  createCanvas(576, 384); // Postcard size: 6"x4" at 96 dpi

  aPowerStroke = new PowerStroke();
  aPowerStroke.init(); // Initialize the PowerStroke instance
  aPowerStroke.setPowerStrokeWeight(40.0);
  aPowerStroke.setInterpolatorType("Linear");
  aPowerStroke.addSpinePt(50, 250);
  aPowerStroke.addSpinePt(150, 100);
  aPowerStroke.addOffsetPt(0.0, 1.00);
  aPowerStroke.addOffsetPt(0.6, 0.15); 
  aPowerStroke.addOffsetPt(0.9, 0.50); 
}

function keyPressed(){
  if (key == 's'){ // Initiate SVG exporting
    bDoExportSvg = true; 
  }
}

function draw(){
  background(245); 
  strokeWeight(1);
  noFill();

  if (bDoExportSvg){
    beginRecordSVG(this, "plotSvg_powerstroke.svg");
  }

  stroke(255,0,0); 
  fill(0,0,0, 51); 
  aPowerStroke.drawDebug (false, false, true, false); // draw envelope to canvas
  aPowerStroke.drawDebug (true, false, false, true); // draw spine and emit to SVG
  aPowerStroke.addToCurrentSvg(); // add the PowerStroke to the current SVG 

  if (bDoExportSvg){
    endRecordSVG();
    bDoExportSvg = false;
  }
}