let exportButton;

function setup() {
  createCanvas(600, 600);
  setSvgDocumentSize(width, height);

  exportButton = createButton("Export SVG");
  exportButton.mousePressed(exportScene);
  exportButton.parent(document.body);

  noLoop();
}

function draw() {
  drawAddonExampleScene();
}

function keyPressed() {
  if (key === "s" || key === "S") {
    exportScene();
  }
}

function exportScene() {
  beginRecordSvg("plotSvg_addon_example_v1_global.svg");
  drawAddonExampleScene();
  const svg = endRecordSvg();
  console.log("p5.plotSvg add-on example SVG length:", svg.length);
}

function drawAddonExampleScene() {
  background(255);
  noFill();
  strokeWeight(1.5);

  beginSvgGroup("grid");
  stroke("black");
  const margin = 36;
  const gridStep = 48;
  for (let y = margin; y <= height - margin; y += gridStep) {
    line(margin, y, width - margin, y);
  }
  for (let x = margin; x <= width - margin; x += gridStep) {
    line(x, margin, x, height - margin);
  }
  endSvgGroup();

  beginSvgGroup("circles");
  stroke("red");
  for (let i = 0; i < 9; i++) {
    const x = map(i, 0, 8, 95, 505);
    circle(x, 170 + 18 * sin(i * 0.85), 36 + i * 5);
  }
  endSvgGroup();

  beginSvgGroup("curves");
  stroke("blue");
  beginShape();
  for (let i = 0; i < 12; i++) {
    const x = map(i, 0, 11, 80, 520);
    const y = 330 + 58 * sin(i * 0.9);
    vertex(x, y);
  }
  endShape();

  stroke("green");
  bezier(90, 470, 210, 380, 370, 560, 510, 470);
  arc(300, 470, 260, 120, radians(205), radians(335), OPEN);
  endSvgGroup();
}
