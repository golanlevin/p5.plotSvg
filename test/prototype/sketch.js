p5.disableFriendlyErrors = true;

new p5(function(sketch) {
  sketch.setup = function() {
    sketch.createCanvas(120, 120);
    sketch.noLoop();

    window.runPrototypeApiExport = function() {
      sketch.setSvgDocumentSize(120, 120);
      sketch.setSvgResolutionDPI(96);
      sketch.setSvgPointRadius(0.5);
      sketch.setSvgCoordinatePrecision(3);
      sketch.setSvgTransformPrecision(3);
      sketch.setSvgDefaultStrokeColor("black");
      sketch.setSvgDefaultStrokeWeight(1);
      sketch.setSvgFlattenTransforms(false);
      sketch.setSvgGroupByStrokeColor(false);

      sketch.beginRecordSvg(null);
      sketch.background(255);
      sketch.noFill();
      sketch.stroke(0);
      sketch.beginSvgGroup("prototype-api");
      sketch.line(10, 10, 110, 110);
      sketch.circle(60, 60, 45);
      sketch.rect(20, 25, 35, 30);
      sketch.point(90, 35);
      sketch.endSvgGroup();
      return sketch.endRecordSvg();
    };

    sketch.background(255);
    sketch.line(10, 10, 110, 110);
  };
});
