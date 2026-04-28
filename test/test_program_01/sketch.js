// This program is a stub used for temporary testing.
// No important code or examples should be saved here. 

p5.disableFriendlyErrors = true;
let bDoExportSvg = false; 

function setup() {
  createCanvas(480, 480);

  let saveButton = createButton("Save SVG");
  saveButton.position(10, 10);
  saveButton.mousePressed((event) => {
    event.stopPropagation();
    bDoExportSvg = true;
  });
}

function draw() {
  background(245);
  noFill(); 
  stroke(0);
  

  if (bDoExportSvg) {                               
    beginRecordSvg(this, "test.svg");   
  }   

  // Draw the anchor points in black.
  //stroke(0);
  //strokeWeight(5);
  //point(85, 20);
  //point(15, 80);

  // Draw the control points in red.
  //stroke(255, 0, 0);
  //point(10, 10);
  //point(90, 90);

  // Draw a black bezier curve.
  //noFill();
  //stroke(0);
  //strokeWeight(1);
  bezier(85, 20, 10, 10, 90, 90, 15, 80);

  // Draw red lines from the anchor points to the control points.
  //stroke(255, 0, 0);
  //line(85, 20, 10, 10);
  //line(15, 80, 90, 90);


  if (bDoExportSvg){
    endRecordSvg();
    bDoExportSvg = false;
  }
}

