function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
  noFill();
  stroke(0);
  strokeWeight(1);
  
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
  splineProperty('ends', INCLUDE);
  splineProperty('tightness', 0); 
  spline(240, 60, 300, 40, 320, 120, 260, 140);
  circle(240, 60, 5);
  circle(300, 40, 5);
  circle(320, 120, 5);
  circle(260, 140, 5);
  
  // A similar spline omits the ends
  splineProperty('ends', EXCLUDE);
  spline(240, 160, 300, 140, 320, 220, 260, 240);
  circle(240, 160, 5);
  circle(300, 140, 5);
  circle(320, 220, 5);
  circle(260, 240, 5);
  
  splineProperties({
    tightness: 2.0,
    ends: INCLUDE
  });
  spline(240, 260, 300, 240, 320, 320, 260, 340);
  splineProperty('tightness', 0); 
  
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

  // Draw the curve and a circle and tangent at t=0.3
  splineProperty('ends', INCLUDE);

  let st = 0.3;
  spline(sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4);
  let cx = splinePoint(sx1, sx2, sx3, sx4, st);
  let cy = splinePoint(sy1, sy2, sy3, sy4, st);
  circle(cx, cy, 5);
  
  let stx = splineTangent(sx1, sx2, sx3, sx4, st);
  let sty = splineTangent(sy1, sy2, sy3, sy4, st);
  const m = Math.hypot(tx, ty) || 1;
  stx = (stx / m) * 30;
  sty = (sty / m) * 30;
  line(cx, cy, cx + stx, cy + sty);
  
  //-------------------------
  // splineVertex tests.
  beginShape();
  splineVertex(25, 280);
  splineVertex(20, 230);
  splineVertex(85, 260);
  endShape();
  
  beginShape();
  splineVertex(125, 280);
  splineVertex(120, 230);
  splineVertex(185, 260);
  endShape(CLOSE);
  
  //-------------------------
  // bezierVertex tests
  beginShape();
  bezierVertex(130, 120); // anchor point.
  bezierVertex(180, 100);
  bezierVertex(180, 175);
  bezierVertex(130, 175);
  bezierVertex(150, 180);
  bezierVertex(160, 125);
  bezierVertex(130, 120);
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
  bezierVertex(130, 320); // anchor point.
  bezierVertex(180, 300);
  bezierVertex(180, 375);
  bezierVertex(130, 375);
  vertex(130, 350); 
  vertex(190, 350);
  splineVertex(220, 350);
  splineVertex(220, 270);
  splineVertex(180, 340);
  splineVertex(130, 320);
  endShape(CLOSE);
}