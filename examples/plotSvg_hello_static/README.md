# plotSvg_hello_static Example

The `plotSvg_hello_static ` example shows the simplest possible use of the p5.plotSvg library. The program runs in the p5.js "static mode", and the SVG is exported at the conclusion of `setup()`. There is no interactivity or animation. 

![plotSvg_hello_static.png](plotSvg_hello_static.png)

Code: 

* At editor.p5js.org: [https://editor.p5js.org/golan/sketches/AW8GI36fA](https://editor.p5js.org/golan/sketches/AW8GI36fA)
* At openprocessing.org: [https://openprocessing.org/sketch/2455362](https://openprocessing.org/sketch/2455362)
* At GitHub: [sketch.js](https://raw.githubusercontent.com/golanlevin/p5.plotSvg/refs/heads/main/examples/plotSvg_hello_static/sketch.js)

```
// https://github.com/golanlevin/p5.plotSvg (v.0.1.x)
// A Plotter-Oriented SVG Exporter for p5.js
// Golan Levin, November 2024
//
// Extremely simple demo of using p5.plotSvg to export SVG files.
// Requires https://cdn.jsdelivr.net/npm/p5.plotsvg@latest/lib/p5.plotSvg.js
// 
// Note 1: This sketch will export an SVG at the very moment when you run it. 
// Note 2: This sketch issues many warnings; the following line quiets them:
p5.disableFriendlyErrors = true;

function setup() {
  createCanvas(576, 384); // Postcard size: 6"x4" at 96 dpi
  background(245); 
  noFill();

  beginRecordSVG(this, "plotSvg_hello_static.svg");
  circle(width/2, height/2, 300); 
  ellipse(width/2-60, height/2-40, 30, 50);
  ellipse(width/2+60, height/2-40, 30, 50);
  arc(width/2, height/2+30, 150, 100, 0, PI);
  endRecordSVG();
}
```
