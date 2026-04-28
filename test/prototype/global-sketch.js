p5.disableFriendlyErrors = true;

function setup() {
  createCanvas(120, 120);
  noLoop();
  background(255);
  line(10, 10, 110, 110);
}

function configureGlobalPrototypeApiExport() {
  setSvgDocumentSize(120, 120);
  setSvgResolutionDPI(96);
  setSvgPointRadius(0.5);
  setSvgCoordinatePrecision(3);
  setSvgTransformPrecision(3);
  setSvgDefaultStrokeColor("black");
  setSvgDefaultStrokeWeight(1);
  setSvgFlattenTransforms(false);
  setSvgGroupByStrokeColor(false);
}

function drawGlobalPrototypeApiScene() {
  background(255);
  noFill();
  stroke(0);
  beginSvgGroup("prototype-global-api");
  line(10, 10, 110, 110);
  circle(60, 60, 45);
  rect(20, 25, 35, 30);
  point(90, 35);
  endSvgGroup();
}

window.runGlobalPrototypeApiExport = function(mode) {
  configureGlobalPrototypeApiExport();
  if (mode === "old-explicit") {
    beginRecordSvg(window, null);
  } else {
    beginRecordSvg(null);
  }
  drawGlobalPrototypeApiScene();
  return endRecordSvg();
};

window.runGlobalPrototypeApiExportWithFilename = function(mode) {
  configureGlobalPrototypeApiExport();
  if (mode === "old-explicit") {
    beginRecordSvg(window, "prototype-global-api.svg");
  } else {
    beginRecordSvg("prototype-global-api.svg");
  }
  drawGlobalPrototypeApiScene();
  const svg = endRecordSvg();
  return {
    svgLength: svg.length,
    hasFilenameComment: svg.includes("<!-- prototype-global-api.svg -->")
  };
};
