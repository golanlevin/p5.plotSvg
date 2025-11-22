// This sketch records a series of marks drawn by the user
// and exports an SVG file when the button is pressed.
// This sketch is mobile-friendly.
//
// Uses https://github.com/golanlevin/p5.plotSvg (v.0.1.x)
// A Plotter-Oriented SVG Exporter for p5.js
// Golan Levin, November 2024

p5.disableFriendlyErrors = true; 
let exportSvgButton;
let clearButton;
let bDoExportSvg = false; 
let marks = [];
let currentMark = []; 

function setup() {
  createCanvas(375, 500); // phone-safe size
  exportSvgButton = createButton('Export SVG');
  exportSvgButton.position(10, 10);
  exportSvgButton.mousePressed(() => bDoExportSvg = true);
  clearButton = createButton('Clear');
  clearButton.position(100, 10);
  clearButton.mousePressed(() => {
    marks = [];
    currentMark = [];
  });
}

//-------------------------------------
function keyPressed(){
  if (key == 's'){
    // Another way to initiate SVG exporting
    bDoExportSvg = true; 
  } else if (key == ' '){
    // Clear recordings with spacebar
    marks = [];
    currentMark = [];
  }
}

//-------------------------------------
function mousePressed(){
  currentMark = [];
  currentMark.push(createVector(mouseX, mouseY)); 
}
function mouseDragged(){
  currentMark.push(createVector(mouseX, mouseY)); 
}
function mouseReleased(){
  if (currentMark){
    marks.push(currentMark); 
  }
}
function touchStarted(event) {
  if (event.target.tagName === 'CANVAS') {
    mousePressed();
    return false;
  }
}
function touchMoved(event) {
  if (event.target.tagName === 'CANVAS') {
    mouseDragged();
    return false;
  }
}
function touchEnded(event) {
  if (event.target.tagName === 'CANVAS') {
    mouseReleased();
    return false;
  }
}

//-------------------------------------
function draw(){
  background(245); 
  strokeWeight(1);
  stroke(0);
  noFill();
  
  if (bDoExportSvg){
    let svgFilename = "plotSvg_recording_" + frameCount; 
    beginRecordSvg(this, svgFilename + ".svg");
  }

  // Draw each of the stored marks
  for (let j=0; j<marks.length; j++){
    beginShape();
    for (let i=0; i<marks[j].length; i++){
      vertex(marks[j][i].x, marks[j][i].y); 
    }
    endShape(); 
  }
  // Draw the current (active) mark
  beginShape();
  for (let i=0; i<currentMark.length; i++){
    vertex(currentMark[i].x, currentMark[i].y); 
  }
  endShape(); 

  if (bDoExportSvg){
    // End exporting, if doing so
    endRecordSvg();
    bDoExportSvg = false;
  }
}