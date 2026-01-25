// This program is a stub used for temporary testing.
// No important code or examples should be saved here. 

p5.disableFriendlyErrors = true;
let bDoExportSvg = false; 

function setup() {
  createCanvas(640, 480);

  let saveButton = createButton("Save SVG");
  saveButton.position(10, 10);
  saveButton.mousePressed((event) => {
    event.stopPropagation();
    bDoExportSvg = true;
  });
}

function draw() {
  background(245);
  stroke(0);

  if (bDoExportSvg){
    beginRecordSvg(this, "post_grouping.svg");
  }

  line(0,0, mouseX,mouseY); 

  if (bDoExportSvg){
    endRecordSvg();
    bDoExportSvg = false;
  }
}