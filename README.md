# p5.plotSvg

### A Plotter-Oriented SVG Exporter for p5.js

![Plotter](images/bantam_artframe_plotter.jpg)

[**p5.plotSvg**](https://github.com/golanlevin/p5.plotSvg) is a p5.js library for exporting SVG files tailored for pen plotting.<br /> 
Version 0.1.2, December 6, 2024 • by Golan Levin ([@golanlevin](https://github.com/golanlevin))<br />

### Downloads, Mirrors, and Documentation:

* [**Download p5.plotSvg.js**](lib/p5.plotSvg.js) from GitHub ([raw](https://raw.githubusercontent.com/golanlevin/p5.plotSvg/refs/heads/main/lib/p5.plotSvg.js))
* p5.plotSvg.js at **npmjs.com**: [https://www.npmjs.com/package/p5.plotsvg](https://www.npmjs.com/package/p5.plotsvg)
* p5.plotSvg.js at **unpkg.com**: [https://unpkg.com/p5.plotsvg@0.1.2/lib/p5.plotSvg.js](https://unpkg.com/p5.plotsvg@0.1.2/lib/p5.plotSvg.js)
* p5.plotSvg.js at **cdn.jsdelivr.net**: [https://cdn.jsdelivr.net/npm/p5.plotsvg@latest/lib/p5.plotSvg.js](https://cdn.jsdelivr.net/npm/p5.plotsvg@latest/lib/p5.plotSvg.js)
* [**Documentation**](documentation.md)

### Contents:

* [About p5.plotSvg](#about-p5plotsvg)
* [Quickstart Installation](#quickstart-installation)
* [What the p5.plotSvg library *IS*](#what-the-p5plotsvg-library-is)
* [What the p5.plotSvg library *IS NOT*](#what-the-p5plotsvg-library-is-not)
* [Example Programs](#example-programs)
* [Usage Notes](#usage-notes)
* [Known Issues and Bugs](#known-issues-and-bugs)
* [Other Libraries and Related Work](#other-libraries-and-related-work)
* [License and Code of Conduct](#license-and-code-of-conduct)
* [Keywords](#keywords)
* [Acknowledgments](#acknowledgments)


---
## About p5.plotSvg

The [p5.plotSvg](https://github.com/golanlevin/p5.plotSvg) library allows the [p5.js](https://p5js.org/) creative coding toolkit to generate SVG files specifically tailored for path-based vector output devices like the [AxiDraw pen-plotter](https://www.axidraw.com/). Note that p5.plotSvg is *not* a general-purpose library for importing, exporting, optimizing, or rendering SVG files in p5.js. The p5.plotSvg library is known to be compatible with p5.js version [1.11.2](https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.2/p5.js). 

p5.plotSvg was developed by [Golan Levin](https://art.cmu.edu/people/golan-levin/) in November 2024 as a resource for the [*Drawing with Machines*](https://github.com/golanlevin/DrawingWithMachines) course at [CMU School of Art](https://art.cmu.edu/). It was created with encouragement and generous support from [Bantam Tools](https://www.bantamtools.com/), makers of the world's finest pen-plotting instruments.


---
## Quickstart Installation

First, include `p5.plotSvg.js` in your project. You can do this by linking to an online copy of p5.plotSvg at [unpkg.com](https://unpkg.com/p5.plotsvg@0.1.2/lib/p5.plotSvg.js) or 
[cdn.jsdelivr.net](https://cdn.jsdelivr.net/npm/p5.plotsvg@latest/lib/p5.plotSvg.js) in your `index.html` file. Alternatively, you can link to a local copy of p5.plotSvg.js, which you can download from this GitHub repo, [here](hhttps://raw.githubusercontent.com/golanlevin/p5.plotSvg/refs/heads/main/lib/p5.plotSvg.js). This example shows one way to include `p5.plotSvg.js` in your project's `index.html` file: 

```
<!-- This is the index.html file -->
<html>
  <head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.2/p5.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/p5.plotsvg@latest/lib/p5.plotSvg.js"></script>
  </head>
  <body>
    <script src="sketch.js"></script>
  </body>
</html>
```

Next, make a p5.js file like the one below, `sketch.js`, in the same directory as your `index.html`. When you run it, you can press the `s` key to export an SVG file.

```
// This is the sketch.js file.
// Press 's' to export the SVG.
let bDoExportSvg = false; 

function setup(){
  // The canvas dimensions are 8.5"x11" at 96 dpi
  createCanvas(816, 1056); 
}

function keyPressed(){
  if (key == 's'){ 
    bDoExportSvg = true; 
  }
}

function draw(){
  background(255); 
  if (bDoExportSvg){
    beginRecordSVG(this, "myOutput.svg");
  }

  // Draw stuff here, such as:
  line(0,0, mouseX, mouseY); 

  if (bDoExportSvg){
    endRecordSVG();
    bDoExportSvg = false;
  }
}
```


---
## What the p5.plotSvg library *IS*: 

* The p5.plotSvg library allows you to export a p5.js drawing as an SVG file that consists exclusively of scalable 2D vector paths, such as lines, arcs, shapes, polylines, and curves. I anticipate that you'll use the SVG files generated with this library to execute your drawings on a vector output device, such as a laser cutter or an AxiDraw/NextDraw pen-plotter.
* The p5.plotSvg library is intended for use with p5.js, and is modeled after the way in which [PDF exporting](https://processing.org/reference/libraries/pdf/index.html) and [SVG exporting](https://processing.org/reference/libraries/svg/index.html) are implemented in [Processing](https://processing.org/) (Java). To use p5.plotSvg, you are expected to manage the timing of a `beginRecordSVG()` and `endRecordSVG()` function.
* The p5.plotSvg library works by temporarily overriding the functionality of the p5.js drawing commands. At the precise moment when you export the SVG, p5 drawing commands like `line()` and `ellipse()` are redefined so that they not only draw onscreen, but *also* add their data to the SVG file. When the SVG is finished saving, the regular definitions of these functions are restored. 


---
## What the p5.plotSvg library *IS NOT*: 

* The p5.plotSvg library is not a general purpose p5-to-SVG exporter; it is intended for the *specific needs of plotter enthusiasts*. Large parts of both the p5 and SVG specifications have been purposefully omitted, even where they are common to both. To ensure plotter compatibility, this library provides no support for exporting SVG files with graphics features that have no analogue in pen-plotting — such as pixel-based images, transparency, filters, shaders, blend modes, gradients, animation, or (even) fills and stroke weights. You may be able to render such things onscreen with p5.js, but they will not appear in the SVG vector files made with this library.
* p5.plotSvg is not an SVG-based alternative renderer for the web browser. What you see onscreen is a regular p5 canvas. If you want an SVG runtime in the browser as a substitute for p5.js graphics, consider using Zenozeng's [p5.js-svg](https://github.com/zenozeng/p5.js-svg) library.
* This is not a library for loading, parsing, or displaying SVG files in p5.js. Zenozeng's [p5.js-svg](https://github.com/zenozeng/p5.js-svg) can do that as well.
* This is not a library for computational geometry in p5. For problems like computing [offset curves](https://en.wikipedia.org/wiki/Parallel_curve) or shape-shape intersections, consider using libraries like [Paper.js](http://paperjs.org/features/#svg-import-and-export) or [Shapely](https://shapely.readthedocs.io/en/stable/). 
* This is not a library for *optimizing* vector graphics for plotting or cutting. For example, no utilities are provided for *sorting* the order/direction of exported lines (using a TSP-like algorithm) to reduce your plotting time; for *merging* line segments with common endpoints; for *de-duplicating* multiple lines in the same location; or for *reordering* graphical elements from innermost to outermost for optimal laser-cutting. For such functionality, consider optimizing your SVGs with Antoine Beyeler's [vpype](https://vpype.readthedocs.io/en/latest/) for plotting, and/or [Deepnest](https://deepnest.io/) for laser cutting.
* This is not a library for *vectorizing* canvases rendered with p5.js. For example, no utilities are provided for hatching or dithering that would "convert" the pixels on the screen into vector strokes. The only marks that get exported to SVG are the ones you specify with p5.js drawing commands like `line()`, `ellipse()`, etc.


---
## Example Programs

These examples show how to generate plotter-friendly SVGs from p5.js using p5.plotSvg. Examples are mirrored at [editor.p5js.org](https://editor.p5js.org) and [openProcessing.org](https://openprocessing.org).

1. [**plotSvg_smorgasbord**](examples/plotSvg_smorgasbord/): ⭐ Full demonstration of all p5.js drawing primitives exported to SVG. [@editor](https://editor.p5js.org/golan/sketches/QReF_9ss2) • [@openProcessing](https://openprocessing.org/sketch/2455426)
2. [**plotSvg_hello_static**](examples/plotSvg_hello_static/): Simplest possible demo; all art in `setup()` only. [@editor](https://editor.p5js.org/golan/sketches/AW8GI36fA) • [@openProcessing](https://openprocessing.org/sketch/2455362)
3. [**plotSvg_hello_animating**](examples/plotSvg_hello_animating/): Simple demo; uses `setup()` & `draw()` and a keypress. [@editor](https://editor.p5js.org/golan/sketches/JA-ty5j83) • [@openProcessing](https://openprocessing.org/sketch/2455390)
4. [**plotSvg_generative**](examples/plotSvg_generative/): Simple "generative artwork"; press button to export. [@editor](https://editor.p5js.org/golan/sketches/LRTXmDg2q) • [@openProcessing](https://openprocessing.org/sketch/2455399)
5. [**plotSvg_drawing_recorder**](examples/plotSvg_drawing_recorder/): Records a series of marks drawn by the user. [@editor](https://editor.p5js.org/golan/sketches/bQDM5IQdv) • [@openProcessing](https://openprocessing.org/sketch/2478914)
6. [**plotSvg_particle_paths**](examples/plotSvg_particle_paths/): Accumulates the traces of some particles over time. [@editor](https://editor.p5js.org/golan/sketches/1Toe-pMZH) • [@openProcessing](https://openprocessing.org/sketch/2478945)
7. [**plotSvg_hatched_shapes**](examples/plotSvg_hatched_shapes/): A trick for exporting hatched ("filled") SVG shapes. [@editor](https://editor.p5js.org/golan/sketches/b75oVci5f) • [@openProcessing](https://openprocessing.org/sketch/2479519)


*Examples awaiting implementation (more soon!):*

* *plotSvg_flipbook*: A number of frames are arranged onto a page.
* *plotSvg_hershey*: Displays [Hershey Font](https://en.wikipedia.org/wiki/Hershey_fonts) text using Lingdong Huang's [p5-hershey-js](https://github.com/LingDong-/p5-hershey-js)

---
## Usage Notes

### Color

* The p5.plotSvg library ignores p5.js `fill()` commands, and does not export SVG shapes with filled colors. To export filled shapes for a pen-plotter, consider implementing your own hatching method, as in [this example](examples/plotSvg_hatched_shapes/).
* SVGs produced with p5.plotSvg have a default stroke color, `black`. This can be altered with `setSvgDefaultStrokeColor()`, which takes valid CSS color strings (e.g., `'red'`, `'#ff0000'`, `'rgb(255,0,0)'`).
* To create SVG paths with non-default colors, simply use the `stroke()` command as usual. Note, however, that any such strokes will have additional style information added to their SVG representation (e.g. `style="stroke:#ff0000;"`); this could lead to potentially large file sizes, depending on your design. To restore the default stroke color, you can use `stroke(getDefaultStrokeColor());`.
* If you use stroke colors, the working assumption of p5.plotSvg is that you are using so *to label different logical entities* — such as different color pens in a multi-pen plotter, different tools in a CNC machine, or different intensity settings in a laser cutter. For this reason, alpha (transparency) values are stripped out. I strongly recommend using just a small number of colors, and selecting easy-to-remember [CSS color keyword names](https://www.w3.org/TR/SVG11/types.html#ColorKeywords) such as `'red'`, `'green'`, `'blue'`, etc. 
* This library only accepts p5 `stroke()` commands with the following types of arguments: CSS named colors [in the set of 147 official SVG colors](https://johndecember.com/html/spec/colorsvg.html), hex formatted color strings, or as RGB/gray colors whose values range from 0-255. The p5 `colorMode()` command is not supported by p5.plotSvg, and calls to `colorMode()` may produce unpredictable results in your SVG. 

### Graphics Transforms

The p5.plotSvg library offers two different ways of encoding graphics transformation operations (such as `rotate()`, `translate()`, `scale()`, `shearX()` and `shearY()`) into your SVG. You can select the option you prefer using one the following functions during `setup()`: 

* `setSvgFlattenTransforms (true)`: The current transformation matrix is encoded into each SVG element. This leads to potentially larger SVG files, but graphical elements will appear with *exactly* the same transformations as they do in the corresponding p5 sketch. 
* `setSvgFlattenTransforms (false)` (*default option*): Graphics transforms are encoded into a hierarchy of SVG groups, each containing an atomic transform operation. This may produce smaller SVG files, depending on your design, but there is a possibility that different SVG rendering engines may accumulate the transforms with slightly different results.
* If no graphics transforms are used in a p5 sketch, none are encoded into the SVG file.

### Numeric Precision

p5.plotSvg offers two convenience functions which control how many digits of decimal precision are exported to SVG files. These can have a significant impact on SVG file size: 

* `setSvgCoordinatePrecision()` - The default is 4 digits of precision for path coordinates, e.g. `3.1416`
* `setSvgTransformPrecision()` - The default is 6 digits of precision for  matrix transform data, e.g. `3.141593`

---
## Known Issues and Bugs:

* As of p5.plotSvg v.0.1.x, non-default vertical `textAlign()` settings are not yet supported; only `BASELINE` currently works correctly.
* As of p5.plotSvg v.0.1.x, *multi-contour* shapes (made with `beginContour()` / [`endContour()`](https://p5js.org/reference/p5/endContour/) etc.) are not yet unsupported. For the time being, users should encode each contour in its own `beginShape()` / `endShape()` block instead. 
* As of p5.plotSvg v.0.1.x, there is a small discrepancy in the SVG output of polylines rendered with `curveVertex()`. Specifically, there is an error with the starting orientation of the first point of the polyline. 
* As of p5.plotSvg v.0.1.x, this library is not intended to be used in `WEBGL` mode. There is currently no support for converting 3D graphics to 2D, though this may be added later. 
* p5.plotSvg v.0.1.x works with versions of p5.js as old as v.1.4.2. The [forthcoming p5.js vertex API](https://github.com/processing/p5.js/issues/6766), which is due to come out with p5.js v.2.0, will likely cause breaking changes to portions of p5.plotSvg v.0.1.x.

---
## Other Libraries and Related Work

The following projects may be of interest to creative coders working with SVG files:

* [p5.js-svg](https://github.com/zenozeng/p5.js-svg) by Zenozeng allows for direct SVG rendering in p5.js sketches, offering an alternative SVG-based renderer for the web browser. It supports a wide range of SVG elements but also aims for full compatibility with p5.js drawing functions. *Note*: As of December 2024, p5.js-svg is only compatible with p5.js up to v.1.6.0.
* [canvas2svg](https://github.com/gliffy/canvas2svg) by Gliffy provides a way to export HTML5 Canvas content to SVG using JavaScript. It works by implementing a virtual canvas that mimics the CanvasRenderingContext2D interface, capturing drawing commands as SVG elements.
* [p5-svg-test](https://github.com/runemadsen/p5-svg-test) by Rune Madsen is a simple test for SVG generation using p5.js. This repository provides a proof of concept for exporting p5.js graphics to SVG format but is not a fully-featured library.
* [Rune.js](https://runemadsen.github.io/rune.js/) by Rune Madsen is a JavaScript library for creative coding, similar to p5.js. While it is not strictly a p5.js SVG exporter, it includes capabilities for working with vector graphics, including SVG import/export.
* [vpype](https://vpype.readthedocs.io/en/latest/) by Antoine Beyeler is a command-line tool and Python library for preprocessing and optimizing vector graphics for plotting. It provides utilities for sorting paths, simplifying curves, and optimizing plotting jobs for pen plotters.
* [Paper.js](http://paperjs.org/features/#svg-import-and-export) by Jürg Lehni & Jonathan Puckey is a powerful open-source vector graphics scripting framework that runs on top of the HTML5 Canvas. It supports SVG import and export and offers a wide range of vector graphics manipulation features.
* [ln](https://github.com/fogleman/ln) by Michael Fogleman is a vector-based 3D renderer written in Go. It is used to produce 2D vector graphics depicting 3D scenes.
* [PEmbroider](https://github.com/CreativeInquiry/PEmbroider) by the Frank-Ratchye STUDIO for Creative Inquiry at Carnegie Mellon University is a library for computational embroidery using Processing (Java). It allows users to generate embroidery stitch paths from their Processing sketches, with support for various embroidery machine formats.
* [stitch.js](https://github.com/stitchables/stitch.js) by Stitchables is a JavaScript library for rendering SVG-based embroidery patterns. It allows users to convert drawings made with HTML5 Canvas or SVG paths into embroidery stitch paths.
* Bob Cook's [SVG Example](https://jsfiddle.net/bobcook/2p9tqzze/) provides an example demonstrating how to convert canvas-based drawings to SVG using a custom library in a jsFiddle example.

---
## License and Code of Conduct

[p5.plotSvg](https://github.com/golanlevin/p5.plotSvg) is released under the [MIT License](LICENSE). The p5.plotSvg project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md) adapted from the [Contributor Covenant](http://contributor-covenant.org), version 1.1.0. 

--- 
## Keywords

Pen plotters, vector output, plotter art, p5.js, SVG, #plotterTwitter, creative coding, generative art, drawing machines, JavaScript library, AxiDraw, open-source software tools for the arts.

--
## Acknowledgments

This project was made possible by support from the [CMU School of Art](https://art.cmu.edu/), the [Frank-Ratchye STUDIO for Creative Inquiry](https://studioforcreativeinquiry.org) at Carnegie Mellon University, and [Bantam Tools](https://www.bantamtools.com/).

<img src="images/cmu_school_of_art_logo.png" height="55"> <img src="images/studio_logo.png" height="55"> <img src="images/bantam_tools_logo.png" height="55">
