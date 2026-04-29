p5.disableFriendlyErrors = true; 

let bDoExportSvg = false; 
function setup() {
  createCanvas(400, 400);

  window.runShapesV1Export = function() {
    beginRecordSvg(window, null);
    drawShapesV1Scene();
    return endRecordSvg();
  };
}

function keyPressed(){
  if (key == 's'){
    bDoExportSvg = true; 
  }
}

function draw() {
  background(220);
  drawShapesV1Scene();

  if (bDoExportSvg){
    // End exporting, if doing so
    endRecordSvg();
    bDoExportSvg = false;
  }
}

function drawShapesV1Scene() {
  noFill();
  stroke(0);
  strokeWeight(1);

  if (bDoExportSvg){
    // Begin exporting, if requested
    beginRecordSvg(this, "shapes_v1.svg");
  }

  let x1 = 85;
  let x2 = 10;
  let x3 = 90;
  let x4 = 15;
  let y1 = 20;
  let y2 = 10;
  let y3 = 90;
  let y4 = 80;

  //-------------------------
  // Draw a bezier
  bezier(x1, y1, x2, y2, x3, y3, x4, y4);
  
  // Draw a circle at t=0.3
  let x = bezierPoint(x1, x2, x3, x4, 0.3);
  let y = bezierPoint(y1, y2, y3, y4, 0.3);
  circle(x, y, 5);
  
  // Draw a tangent line
  let tx = 0.2 * bezierTangent(x1, x2, x3, x4, 0);
  let ty = 0.2 * bezierTangent(y1, y2, y3, y4, 0);
  line(x1, y1, x1 + tx, y1 + ty);
  
  //-------------------------
  // Draw a sharp closed loop 
  bezier(150, 60, 105, 15, 195, 15, 150, 60);
  
  //-------------------------
  // A black spline passes smoothly through four points
  curveTightness(0); 
  curve(240, 160, 300, 140, 320, 220, 260, 240);
  circle(240, 160, 5);
  circle(300, 140, 5);
  circle(320, 220, 5);
  circle(260, 240, 5);
  
  curveTightness(2.0); 
  curve(240, 260, 300, 240, 320, 320, 260, 340);
  curveTightness(0); 
  
  //-------------------------
  // Find a point along a spline
  let sx1 =   5;
  let sy1 = 126;
  let sx2 =  73;
  let sy2 = 124;
  let sx3 =  73;
  let sy3 = 161;
  let sx4 =  15;
  let sy4 = 165;


  let st = 0.3;
  curve(sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4);
  let cx = curvePoint(sx1, sx2, sx3, sx4, st);
  let cy = curvePoint(sy1, sy2, sy3, sy4, st);
  circle(cx, cy, 5);
  
  let stx = curveTangent(sx1, sx2, sx3, sx4, st);
  let sty = curveTangent(sy1, sy2, sy3, sy4, st);
  const m = Math.hypot(tx, ty) || 1;
  stx = (stx / m) * 30;
  sty = (sty / m) * 30;
  line(cx, cy, cx + stx, cy + sty);
  
  //-------------------------
  // splineVertex tests.
  beginShape();
  curveVertex(25, 280);
  curveVertex(25, 280);
  curveVertex(20, 230);
  curveVertex(85, 260);
  curveVertex(85, 260);
  endShape();
  
  beginShape();
  curveVertex(125, 280);
  curveVertex(125, 280);
  curveVertex(120, 230);
  curveVertex(185, 260);
  endShape(CLOSE);
  
  //-------------------------
  // bezierVertex tests
  beginShape();
  vertex(130, 120); // anchor point.
  bezierVertex(180, 100, 180, 175, 130, 175);
  bezierVertex(150, 180, 160, 125, 130, 120);
  endShape();

  //-------------------------
  // Multi-contour shape
  beginShape();
  // Exterior vertices, clockwise winding.
  vertex(10, 310);
  vertex(90, 310);
  vertex(90, 390);
  vertex(10, 390);
  // Interior vertices, counter-clockwise winding.
  beginContour();
  vertex(30, 330);
  vertex(30, 370);
  vertex(70, 370);
  vertex(70, 330);
  endContour(CLOSE);
  endShape(CLOSE);
  
  //-------------------------
  // multiple vertex types
  beginShape(); 
  vertex(130, 350); 
  vertex(190, 350);
  curveVertex(220, 350);
  curveVertex(220, 270);
  curveVertex(180, 340);
  curveVertex(130, 320);
  endShape(CLOSE);
}
