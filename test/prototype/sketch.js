p5.disableFriendlyErrors = true;

function drawPrototypeApiScene(sketch) {
  sketch.background(255);
  sketch.noFill();
  sketch.stroke(0);
  sketch.beginSvgGroup("prototype-api");
  sketch.line(10, 10, 110, 110);
  sketch.circle(60, 60, 45);
  sketch.rect(20, 25, 35, 30);
  sketch.point(90, 35);
  sketch.endSvgGroup();
}

function configurePrototypeApiExport(sketch) {
  sketch.setSvgDocumentSize(120, 120);
  sketch.setSvgResolutionDPI(96);
  sketch.setSvgPointRadius(0.5);
  sketch.setSvgCoordinatePrecision(3);
  sketch.setSvgTransformPrecision(3);
  sketch.setSvgDefaultStrokeColor("black");
  sketch.setSvgDefaultStrokeWeight(1);
  sketch.setSvgFlattenTransforms(false);
  sketch.setSvgGroupByStrokeColor(false);
}

new p5(function(sketch) {
  sketch.setup = function() {
    sketch.createCanvas(120, 120);
    sketch.noLoop();

    window.runPrototypeApiExport = function(mode) {
      configurePrototypeApiExport(sketch);
      if (mode === "namespace") {
        p5plotSvg.beginRecordSvg(sketch, null);
      } else if (mode === "old-explicit") {
        beginRecordSvg(sketch, null);
      } else {
        sketch.beginRecordSvg(null);
      }
      drawPrototypeApiScene(sketch);
      return sketch.endRecordSvg();
    };

    window.runPrototypeApiExportWithFilename = function(mode) {
      configurePrototypeApiExport(sketch);
      if (mode === "namespace") {
        p5plotSvg.beginRecordSvg(sketch, "prototype-api.svg");
      } else if (mode === "old-explicit") {
        beginRecordSvg(sketch, "prototype-api.svg");
      } else {
        sketch.beginRecordSvg("prototype-api.svg");
      }
      drawPrototypeApiScene(sketch);
      const svg = sketch.endRecordSvg();
      return {
        svgLength: svg.length,
        hasFilenameComment: svg.includes("<!-- prototype-api.svg -->")
      };
    };

    window.runNamespaceApiExport = function() {
      configurePrototypeApiExport(sketch);
      p5plotSvg.beginRecordSvg(sketch, null);
      drawPrototypeApiScene(sketch);
      return p5plotSvg.endRecordSvg();
    };

    window.runExplicitPrototypeApiExport = function() {
      configurePrototypeApiExport(sketch);
      sketch.beginRecordSvg(null);
      drawPrototypeApiScene(sketch);
      return sketch.endRecordSvg();
    };

    sketch.background(255);
    sketch.line(10, 10, 110, 110);
  };
});
