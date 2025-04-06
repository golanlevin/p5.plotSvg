// plotSvg_instancemode example
// (squircle for plotters)
// by lionel ringenbach - @ucodia
// 26.02.2025
//
// This example demonstrates the use of p5.plotSvg in instance mode.
// The SVG export is triggered by a button click.
// Requires: https://cdn.jsdelivr.net/npm/p5.plotsvg@latest/lib/p5.plotSvg.js
// See: https://github.com/golanlevin/p5.plotSvg

function squircle(sketch) {
  let exportSvg = false;
  let seed = 12345;
  let regenerateButton;
  let exportSvgButton;

  sketch.setup = function () {
    sketch.createCanvas(576, 576); // 6"x6" at 96 dpi

    regenerateButton = sketch.createButton("Regenerate");
    regenerateButton.position(0, sketch.height);
    regenerateButton.mousePressed(regenerate);

    exportSvgButton = sketch.createButton("Export SVG");
    exportSvgButton.position(100, sketch.height);
    exportSvgButton.mousePressed(initiateSvgExport);
  };

  function regenerate() {
    seed = sketch.round(sketch.millis());
  }

  function initiateSvgExport() {
    exportSvg = true;
  }

  sketch.draw = function () {
    sketch.rectMode(sketch.CENTER);
    sketch.randomSeed(seed);
    sketch.background(255);
    sketch.strokeWeight(1);
    sketch.stroke(0);
    sketch.noFill();

    if (exportSvg) {
      beginRecordSVG(sketch, "plotSvg_instancemode_" + seed + ".svg");
    }

    // pick random line number and rotation increment
    let nLines = sketch.random(10, 100);
    let rotInc = sketch.random() < 0.5 ? sketch.random(-0.1, 0.1) : 0;

    let maxW = sketch.width * 0.75;
    let minW = sketch.width * 0.01;
    let wInc = (maxW - minW) / nLines;

    for (let i = 0; i < nLines; i++) {
      let rot = rotInc * i;
      let r = sketch.map(i, 0, nLines - 1, 0, sketch.width * 0.1);
      let w = maxW - i * wInc;

      sketch.push();
      sketch.translate(sketch.width / 2, sketch.height / 2);
      sketch.rotate(rot);
      sketch.translate(-sketch.width / 2, -sketch.height / 2);
      sketch.rect(sketch.width / 2, sketch.height / 2, w, w, r);
      sketch.pop();
    }

    if (exportSvg) {
      endRecordSVG();
      exportSvg = false;
    }
  };
}

new p5(squircle);