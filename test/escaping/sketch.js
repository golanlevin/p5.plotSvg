p5.disableFriendlyErrors = true;

const ESCAPE_HEADER_VALUE = 'root & "quote" <tag> > end';
const ESCAPE_DEF_ID = 'marker & "quote" <tag> > end';
const ESCAPE_DEF_VALUE = 'def & "quote" <tag> > end';
const ESCAPE_GROUP_ID = 'group & "quote" <tag> > end';
const ESCAPE_GROUP_VALUE = 'group attr & "quote" <tag> > end';
const ESCAPE_FONT = 'Arial & <Sans>';
const ESCAPE_TEXT = 'Text & <tag> "quote" \'apos\' > end';
const ESCAPE_DESC = 'Description & <tag> "quote" \'apos\' > end';

function setup() {
  createCanvas(180, 100);
  noLoop();
  background(255);
}

window.runEscapingExport = function() {
  setSvgDocumentSize(180, 100);
  setSvgCoordinatePrecision(3);
  setSvgTransformPrecision(3);
  setSvgDefaultStrokeColor("black");
  setSvgDefaultStrokeWeight(1);
  setSvgFlattenTransforms(false);
  setSvgGroupByStrokeColor(false);

  beginRecordSvg(null);
  injectSvgHeaderAttribute("data-note", ESCAPE_HEADER_VALUE);
  injectSvgDef("marker", {
    id: ESCAPE_DEF_ID,
    orient: "auto",
    "data-note": ESCAPE_DEF_VALUE
  });
  beginSvgGroup(ESCAPE_GROUP_ID, {
    "data-note": ESCAPE_GROUP_VALUE
  });
  describe(ESCAPE_DESC);
  textFont(ESCAPE_FONT);
  text(ESCAPE_TEXT, 10, 30);
  line(10, 60, 160, 60);
  endSvgGroup();
  return endRecordSvg();
};
