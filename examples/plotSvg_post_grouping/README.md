# plotSvg_post_grouping Example

The `plotSvg_post_grouping` example demonstrates how to use the `setSvgMergeNamedGroups()` function to merge groups of SVG paths, even if they were computed at different times, so long as they were placed within groups with the same name. This is useful for grouping together paths that should be plotted with (e.g.) the same color pen. 


![post_grouping.png](post_grouping.png)

Code: 

* At editor.p5js.org: [https://editor.p5js.org/golan/sketches/aWfRPvVfT](https://editor.p5js.org/golan/sketches/aWfRPvVfT)
* At Github: [sketch.js](https://raw.githubusercontent.com/golanlevin/p5.plotSvg/refs/heads/main/examples/plotSvg_post_grouping/sketch.js)
* A related example by @Ucodia can be found [here](https://editor.p5js.org/golan/sketches/k3xWBNTND)


```js
// plotSvg_post_grouping: lines grouped by their color.
// Click to re-generate design; press 's' to export SVG.
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
  createCanvas(600, 400);
  setSvgMergeNamedGroups(true); // Groups the lines!
}

function mousePressed(){
  myRandomSeed = millis(); 
}

function keyPressed(){
  if (key == 's'){ 
    bDoExportSvg = true; 
  }
}

function draw(){
  randomSeed(myRandomSeed);
  background(255); 
  strokeWeight(2); 
  
  if (bDoExportSvg){
    beginRecordSVG(this, "post_grouping.svg");
  }

  // Do a drunk walk, alternating horizonal and vertical moves. 
  // Horizonal lines are red, vertical lines are blue.
  // Ensure that like-colored lines are grouped together.
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
    endRecordSVG();
    bDoExportSvg = false;
  }
}
```