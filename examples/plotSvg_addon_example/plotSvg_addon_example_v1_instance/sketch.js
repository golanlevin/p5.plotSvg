function makeAddonExampleSketch(versionLabel) {
  return function(p) {
    let exportButton;

    p.setup = function() {
      const canvas = p.createCanvas(600, 600);
      canvas.parent("sketch-container");
      p.setSvgDocumentSize(p.width, p.height);

      exportButton = p.createButton("Export SVG");
      exportButton.mousePressed(exportScene);
      exportButton.parent("sketch-container");

      p.noLoop();
    };

    p.draw = function() {
      drawAddonExampleScene();
    };

    p.keyPressed = function() {
      if (p.key === "s" || p.key === "S") {
        exportScene();
      }
    };

    function exportScene() {
      p.beginRecordSvg(`plotSvg_addon_example_${versionLabel}_instance.svg`);
      drawAddonExampleScene();
      const svg = p.endRecordSvg();
      console.log("p5.plotSvg add-on example SVG length:", svg.length);
    }

    function drawAddonExampleScene() {
      p.background(255);
      p.noFill();
      p.strokeWeight(1.5);

      p.beginSvgGroup("grid");
      p.stroke("black");
      const margin = 36;
      const gridStep = 48;
      for (let y = margin; y <= p.height - margin; y += gridStep) {
        p.line(margin, y, p.width - margin, y);
      }
      for (let x = margin; x <= p.width - margin; x += gridStep) {
        p.line(x, margin, x, p.height - margin);
      }
      p.endSvgGroup();

      p.beginSvgGroup("circles");
      p.stroke("red");
      for (let i = 0; i < 9; i++) {
        const x = p.map(i, 0, 8, 95, 505);
        p.circle(x, 170 + 18 * p.sin(i * 0.85), 36 + i * 5);
      }
      p.endSvgGroup();

      p.beginSvgGroup("curves");
      p.stroke("blue");
      p.beginShape();
      for (let i = 0; i < 12; i++) {
        const x = p.map(i, 0, 11, 80, 520);
        const y = 330 + 58 * p.sin(i * 0.9);
        p.vertex(x, y);
      }
      p.endShape();

      p.stroke("green");
      p.bezier(90, 470, 210, 380, 370, 560, 510, 470);
      p.arc(300, 470, 260, 120, p.radians(205), p.radians(335), p.OPEN);
      p.endSvgGroup();
    }
  };
}

new p5(makeAddonExampleSketch("v1"), "sketch-container");
