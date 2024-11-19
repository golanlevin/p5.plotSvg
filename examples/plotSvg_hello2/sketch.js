// Demonstrates how to use the p5.plotSvg library to export SVG files.

// This line of code disables the p5.js "Friendly Error System" (FES), 
// to prevent several distracting warnings. Feel free to comment this out.
p5.disableFriendlyErrors = true; 

let bDoExportSvg = false; 
function setup() {
  createCanvas(576, 384); // 6"x4" at 96 dpi
}

function keyPressed(){
  if (key == 's'){
    bDoExportSvg = true; 
  }
}

function draw(){
  background(245); 
  strokeWeight(1);
  stroke(0);
  noFill();
  
  if (bDoExportSvg){
    beginRecordSVG(this, "plotSvg_hello2.svg");
  }

  circle(width/2, height/2, 300); 
  ellipse(width/2-60, height/2-40, 30, 50);
  ellipse(width/2+60, height/2-40, 30, 50);
  arc(width/2, height/2+30, 150, 100, 0, PI);

  if (bDoExportSvg){
    endRecordSVG();
    bDoExportSvg = false;
  }
}