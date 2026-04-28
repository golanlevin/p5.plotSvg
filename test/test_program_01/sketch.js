// Temporary scratch test for arc() in p5 instance mode.
// This intentionally avoids global p5 drawing symbols such as OPEN.

(function() {
  p5.disableFriendlyErrors = true;

  new p5(function(sketch) {
    let bDoExportSvg = false;

    sketch.setup = function() {
      sketch.createCanvas(520, 300);

      const saveButton = sketch.createButton("Save SVG");
      saveButton.position(10, 10);
      saveButton.mousePressed((event) => {
        event.stopPropagation();
        bDoExportSvg = true;
      });

      console.log("p5.plotSvg arc scratch", {
        p5Version: sketch.constructor.VERSION,
        globalOpen: typeof window.OPEN,
        instanceOpen: sketch.OPEN
      });

      window.runArcInstanceExport = function() {
        beginRecordSvg(sketch, null);
        drawArcScene(sketch);
        return endRecordSvg();
      };
    };

    sketch.draw = function() {
      drawArcScene(sketch);

      if (bDoExportSvg) {
        beginRecordSvg(sketch, "test_arc_instance.svg");
        drawArcScene(sketch);
        endRecordSvg();
        bDoExportSvg = false;
      }
    };
  });

  function drawArcScene(sketch) {
    sketch.background(245);
    sketch.noFill();
    sketch.stroke(0);
    sketch.strokeWeight(1);

    drawArcCase(sketch, 75, 150, undefined, "omitted mode");
    drawArcCase(sketch, 200, 150, sketch.PIE, "PIE");
    drawArcCase(sketch, 325, 150, sketch.CHORD, "CHORD");
    drawArcCase(sketch, 450, 150, sketch.OPEN, "OPEN");
  }

  function drawArcCase(sketch, x, y, mode, label) {
    const start = 0;
    const stop = sketch.PI + sketch.HALF_PI;

    if (typeof mode === "undefined") {
      sketch.arc(x, y, 80, 80, start, stop);
    } else {
      sketch.arc(x, y, 80, 80, start, stop, mode);
    }

    sketch.noStroke();
    sketch.fill(30);
    sketch.textAlign(sketch.CENTER, sketch.TOP);
    sketch.text(label, x, y + 52);
    sketch.noFill();
    sketch.stroke(0);
  }
})();
