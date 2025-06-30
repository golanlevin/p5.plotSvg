// WORK IN PROGRESS; NOTHING TO SEE HERE YET

p5.disableFriendlyErrors = true; 
let bDoExportSvg = false;

let aPowerStroke;
let bPowerStroke;

function setup() {
  createCanvas(576, 384); // Postcard size: 6"x4" at 96 dpi

  aPowerStroke = new PowerStroke();
  aPowerStroke.init(); // Initialize the PowerStroke instance
  aPowerStroke.addSpinePt(50, 250);
  aPowerStroke.addSpinePt(150, 100);
  aPowerStroke.addOffsetPt(0.0, 1.00);
  aPowerStroke.addOffsetPt(0.6, 0.15); 
  aPowerStroke.addOffsetPt(0.9, 0.50); 
  aPowerStroke.setPowerStrokeWeight(20.0);
  aPowerStroke.setInterpolatorType("Linear");
  aPowerStroke.computeEnvelope();
  
  bPowerStroke = new PowerStroke();
  bPowerStroke.init(); // Initialize the PowerStroke instance
  bPowerStroke.addSpinePt(250, 250);
  bPowerStroke.addSpinePt(350, 100);
  bPowerStroke.addOffsetPt(0.123456789, 1.00);
  bPowerStroke.addOffsetPt(0.4, 0.15); 
  bPowerStroke.addOffsetPt(1.0, 0.50); 
  bPowerStroke.setPowerStrokeWeight(30.0);
  bPowerStroke.setInterpolatorType("Linear");
  bPowerStroke.computeEnvelope();
}

function keyPressed(){
  if (key == 's'){ // Initiate SVG exporting
    bDoExportSvg = true; 
  }
}

function draw(){
  background(245); 
  strokeWeight(1);
  stroke(0);
  noFill();

  if (bDoExportSvg){
    beginRecordSVG(this, "plotSvg_powerstroke.svg");
  }

  let bDrawSpinePts = true;
  let bDrawOffsetPts = true;
  let bDrawEnvelope = true;
  let bEmitDebugViewToSvg = false;
  aPowerStroke.drawDebug (bDrawSpinePts, bDrawOffsetPts, bDrawEnvelope, bEmitDebugViewToSvg);
  bPowerStroke.drawDebug (bDrawSpinePts, bDrawOffsetPts, bDrawEnvelope, bEmitDebugViewToSvg);
  aPowerStroke.addToCurrentSvg();
  bPowerStroke.addToCurrentSvg();

  if (bDoExportSvg){
    endRecordSVG();
    bDoExportSvg = false;
  }
}
