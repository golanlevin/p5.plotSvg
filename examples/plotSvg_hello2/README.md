# plotSvg_hello2 Example

The `plotSvg_hello2` example shows basic use of the p5.plotSvg library, in the context of the familiar p5.js `setup()` and `draw()` functions.  Note that the global boolean variable `bDoExportSvg` is used as a latch to export an SVG file only when the user presses the `s` key. 

![plotSvg_hello2.png](plotSvg_hello2.png)

Code: 

* At editor.p5js.org: [https://editor.p5js.org/golan/sketches/JA-ty5j83](https://editor.p5js.org/golan/sketches/JA-ty5j83)
* At openprocessing.org: [https://openprocessing.org/sketch/2455390](https://openprocessing.org/sketch/2455390)
* At Github: [sketch.js](https://raw.githubusercontent.com/golanlevin/p5.plotSvg/refs/heads/main/examples/plotSvg_hello2/sketch.js)


```
// https://github.com/golanlevin/p5.plotSvg (v.0.1.0)
// A Plotter-Oriented SVG Exporter for p5.js
// Golan Levin, November 2024
//
// This sketch emonstrates how to use the p5.plotSvg library 
// to export SVG files. Press 's' to export an SVG. 

// This line of code disables the p5.js "Friendly Error System" (FES), 
// to prevent several distracting warnings. Feel free to comment this out:
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

  // Draw your artwork here.
  circle(width/2, height/2, 300); 
  ellipse(width/2-60, height/2-40, 30, 50);
  ellipse(width/2+60, height/2-40, 30, 50);
  arc(width/2, height/2+30, 150, 100, 0, PI);

  if (bDoExportSvg){
    endRecordSVG();
    bDoExportSvg = false;
  }
}
```
