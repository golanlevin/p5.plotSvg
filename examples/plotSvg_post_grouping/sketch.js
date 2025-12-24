// plotSvg_post_grouping: lines grouped by their color.
// Click to re-generate design; press button to export SVG.
// Demonstrates post-hoc merging of groups, using
// setSvgMergeNamedGroups(true). This function is 
// useful for grouping together lines that are computed
// at different times, but should be executed with the 
// same drawing implement on the plotter.
// Requires p5.plotSvg 0.1.5+

p5.disableFriendlyErrors = true; // hush, p5
let bDoExportSvg = false; 
let myRandomSeed = 12345;

function setup(){
  createCanvas(6 * 96, 4 * 96); // 6x4 inches at 96dpi
  setSvgMergeNamedGroups(true); // Groups the lines!
  
  let saveButton = createButton("Save SVG");
  saveButton.position(10, 10);
  saveButton.mousePressed((event) => {
    event.stopPropagation();
    bDoExportSvg = true;
    // save("post_grouping.png"); 
  });
}

function mousePressed(){
  myRandomSeed = millis(); 
}

function draw(){
  randomSeed(myRandomSeed);
  background(245); 
  strokeWeight(1); 
  
  if (bDoExportSvg){
    beginRecordSvg(this, "post_grouping.svg");
  }

  // Do a drunk walk, alternating horizonal and vertical moves. 
  // Horizonal lines are red, vertical lines are blue.
  // setSvgMergeNamedGroups(true) ensures that lines inside
  // the same group are (eventually) grouped together.
  let px = width/2; 
  let py = height/2;
  for (let i=0; i<75; i++){
    let qx = px; 
    let qy = py;
    
    if (i%2 == 0){
      qx += 40 * random(-1,1); 
      beginSvgGroup("horizontalLines");
      stroke('red'); 
      line(px,py, qx,qy); 
      endSvgGroup(); 
      
    } else {
      qy += 30 * random(-1,1); 
      beginSvgGroup("verticalLines"); 
      stroke('blue'); 
      line(px,py, qx,qy); 
      endSvgGroup(); 
    } 
    
    px = qx; 
    py = qy; 
  }

  if (bDoExportSvg){
    endRecordSvg();
    bDoExportSvg = false;
  }
}