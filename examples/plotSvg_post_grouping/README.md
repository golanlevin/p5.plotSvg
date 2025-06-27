# plotSvg_post_grouping Example

The `plotSvg_post_grouping` example demonstrates how to use the `setSvgMergeNamedGroups()` function to merge groups of SVG paths, even if the paths were computed at different times, *so long as the SVG groups have the same name*. This is useful for grouping together paths that should be plotted with (e.g.) the same color pen. The implementation of this functionality is thanks to the contribution of Lionel Ringenbach ([@Ucodia](https://github.com/ucodia)) and is supported in p5.plotSvg 0.1.5+.


![post_grouping.png](post_grouping.png)

Code: 

* At editor.p5js.org: [https://editor.p5js.org/golan/sketches/aWfRPvVfT](https://editor.p5js.org/golan/sketches/aWfRPvVfT)
* At Github: [sketch.js](https://raw.githubusercontent.com/golanlevin/p5.plotSvg/refs/heads/main/examples/plotSvg_post_grouping/sketch.js)
* A related example by @Ucodia can be found [here](https://editor.p5js.org/golan/sketches/k3xWBNTND)

In the example provided here, a `for` loop in the `draw()` function accumulates 75 steps of a "drunk walk", alternately pushing a tracer at `(px,py)` horizontally and vertically by random amounts. Horizontal movements are shown with a red line, and vertical movements are shown with a blue line. In the [resulting SVG](post_grouping.svg), the horizontal and vertical lines are placed into separate SVG groups, e.g.:

```xml
  <g id="horizontalLines">
    <line x1="300" y1="200" x2="271.5501" y2="200" style="stroke:red;"/>
    <line x1="271.5501" y1="224.2344" x2="257.3954" y2="224.2344" style="stroke:red;"/>
    <line x1="257.3954" y1="250.4216" x2="222.5099" y2="250.4216" style="stroke:red;"/>
    ...
```

Program code:

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
